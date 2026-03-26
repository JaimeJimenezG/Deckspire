import type { GameState, GamePhase } from '../../domain/models/game-state.model';
import type { EventState } from '../../domain/models/event.model';
import type { NodeType } from '../../domain/models/map.model';
import type { RewardState } from '../../domain/models/reward.model';
import type { NavigateMapUseCase } from '../../domain/ports/inbound/navigate-map.usecase';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';
import type { EventChoice, GameEvent } from '../../domain/models/event.model';
import { ALL_CARDS } from '../../domain/data/cards.data';
import {
  ALL_EVENTS,
  FIRST_NODE_EVENT_ID,
  FIRST_NODE_CHOICES_GOOD_NOW,
  FIRST_NODE_CHOICES_GOOD_LATER,
  FIRST_NODE_UNCERTAIN_TEMPLATES,
} from '../../domain/data/events.data';
import { ALL_RELIC_IDS } from '../../domain/data/relics.data';
import { MapGenerator } from '../../domain/services/map-generator';
import { RewardGenerator } from '../../domain/services/reward-generator';
import { SeededRandom } from '../../domain/services/seeded-random';
import { ShopManager } from '../../domain/services/shop-manager';

const TREASURE_CARD_POOL = ALL_CARDS.filter(c => c.rarity !== 'basic');

// ── Mapeo de tipo de nodo a fase del juego ────────────────────────────────────

const NODE_PHASE_MAP: Record<NodeType, GamePhase> = {
  combat:   'combat',
  elite:    'combat',
  boss:     'combat',
  rest:     'rest',
  shop:     'shop',
  treasure: 'reward',
  event:    'event',
};

// ── Helpers: evento de primer nodo ───────────────────────────────────────────

/**
 * Construye el evento especial "Pacto de Origen" que aparece siempre en el
 * primer nodo del mapa.  Las tres elecciones (buena-ahora, buena-a-la-larga,
 * incierta) se seleccionan y ordenan aleatoriamente con el RNG de la run,
 * garantizando reproducibilidad con la misma seed.
 */
function buildFirstNodeEvent(rng: SeededRandom): GameEvent {
  const goodNow =
    FIRST_NODE_CHOICES_GOOD_NOW[rng.nextInt(0, FIRST_NODE_CHOICES_GOOD_NOW.length - 1)];

  const goodLater =
    FIRST_NODE_CHOICES_GOOD_LATER[rng.nextInt(0, FIRST_NODE_CHOICES_GOOD_LATER.length - 1)];

  const template =
    FIRST_NODE_UNCERTAIN_TEMPLATES[rng.nextInt(0, FIRST_NODE_UNCERTAIN_TEMPLATES.length - 1)];
  const isGood = rng.next() < 0.5;
  const uncertain: EventChoice = {
    id:         template.id,
    category:   'uncertain',
    text:       template.text,
    effects:    isGood ? template.goodEffects    : template.badEffects,
    outcomeText: isGood ? template.goodOutcomeText : template.badOutcomeText,
  };

  const choices: EventChoice[] = [goodNow, goodLater, uncertain];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return {
    id: FIRST_NODE_EVENT_ID,
    title: 'El Pacto de Origen',
    icon: '⚖️',
    description:
      'Al adentrarte en la Torre, una entidad antigua te detiene. Su voz resuena sin palabras en tu mente: «Antes de comenzar, debes elegir el precio de tu ambición». Tres caminos se abren ante ti.',
    choices,
  };
}

// ── Errores de dominio ────────────────────────────────────────────────────────

/** Se lanza cuando el estado de juego no tiene mapa activo. */
export class NoMapActiveError extends Error {
  constructor() {
    super('No active map in the current game state');
    this.name = 'NoMapActiveError';
  }
}

/** Se lanza cuando el nodo de destino no es alcanzable desde la posición actual. */
export class NodeNotReachableError extends Error {
  constructor(nodeId: string) {
    super(`Node "${nodeId}" is not reachable from the current position`);
    this.name = 'NodeNotReachableError';
  }
}

// ── Implementación ────────────────────────────────────────────────────────────

/**
 * Implementa NavigateMapUseCase.
 *
 * Flujo de orquestación:
 *  1. Guard: el estado tiene un mapa activo.
 *  2. Guard: el nodo destino es alcanzable desde la posición actual.
 *  3. Delegar el movimiento a MapGenerator (retorna nuevo GameMap inmutable).
 *  4. Calcular la nueva fase según el tipo del nodo destino.
 *  5. Actualizar el floor al row del nodo (1-indexed).
 *  6. Auto-guardar el nuevo estado en el repositorio.
 *  7. Retornar el GameState actualizado.
 */
export class NavigateMapUseCaseImpl implements NavigateMapUseCase {
  constructor(
    private readonly mapGenerator: MapGenerator,
    private readonly repository: GameRepository,
    private readonly shopManager: ShopManager = new ShopManager(),
  ) {}

  async execute(nodeId: string, state: GameState): Promise<GameState> {
    if (!state.map) {
      throw new NoMapActiveError();
    }

    const reachableIds = this.mapGenerator.getReachableNodes(state.map);
    if (!reachableIds.includes(nodeId)) {
      throw new NodeNotReachableError(nodeId);
    }

    const updatedMap = this.mapGenerator.moveToNode(state.map, nodeId);
    const node = updatedMap.nodes.get(nodeId)!;
    const newFloor = node.row + 1;

    const shopState =
      node.type === 'shop'
        ? this.shopManager.generateOfferings(
            ALL_CARDS,
            ALL_RELIC_IDS,
            state.relics,
            new SeededRandom(state.seed + newFloor * 31),
          )
        : null;

    const eventState: EventState | null =
      node.type === 'event'
        ? (() => {
            const rng = new SeededRandom(state.seed + newFloor * 97);
            const event =
              node.row === 0
                ? buildFirstNodeEvent(rng)
                : ALL_EVENTS[rng.nextInt(0, ALL_EVENTS.length - 1)];
            return { event, chosenId: null };
          })()
        : null;

    const treasureReward: RewardState | null =
      node.type === 'treasure'
        ? (() => {
            const rng = new SeededRandom(state.seed + newFloor * 53);
            const rewardGen = new RewardGenerator(TREASURE_CARD_POOL);
            return {
              cardOptions: rewardGen.generateCardRewards('normal', state.act, rng),
              gold: rewardGen.calculateGoldReward('normal', state.act, rng),
            };
          })()
        : null;

    const newState: GameState = {
      ...state,
      map:    updatedMap,
      phase:  NODE_PHASE_MAP[node.type],
      // floor es 1-indexed; row 0 = planta 1, row 14 = planta 15 (boss)
      floor:  newFloor,
      shop:   shopState,
      event:  eventState,
      reward: treasureReward,
    };

    await this.repository.save(newState);

    return newState;
  }
}
