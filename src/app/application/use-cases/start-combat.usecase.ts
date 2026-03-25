import type { GameState } from '../../domain/models/game-state.model';
import type { EnemyInstance } from '../../domain/models/enemy.model';
import type { NodeType } from '../../domain/models/map.model';
import type { GameMap } from '../../domain/models/map.model';
import type { StartCombatUseCase } from '../../domain/ports/inbound/start-combat.usecase';
import { ENEMIES_BY_ID } from '../../domain/data/enemies.data';
import { ENCOUNTER_POOLS_BY_KEY } from '../../domain/data/encounters.data';
import { CombatEngine } from '../../domain/services/combat-engine';
import { DeckManager } from '../../domain/services/deck-manager';
import { CombatContext, EnemyAI } from '../../domain/services/enemy-ai';
import { RelicEngine } from '../../domain/services/relic-engine';
import { SeededRandom } from '../../domain/services/seeded-random';

// ---------------------------------------------------------------------------
// Errores de dominio específicos del caso de uso
// ---------------------------------------------------------------------------

/** Se lanza cuando se intenta iniciar combate sin un mapa activo. */
export class NoMapError extends Error {
  constructor() {
    super('Cannot start combat: no active map');
    this.name = 'NoMapError';
  }
}

/** Se lanza cuando no hay un nodo seleccionado en el mapa (currentNodeId es null). */
export class NoCurrentNodeError extends Error {
  constructor() {
    super('Cannot start combat: no current map node selected');
    this.name = 'NoCurrentNodeError';
  }
}

/** Se lanza cuando el nodo actual no es un nodo de combate (combat, elite, boss). */
export class UnexpectedNodeTypeError extends Error {
  constructor(nodeType: NodeType) {
    super(`Cannot start combat on node type: ${nodeType}`);
    this.name = 'UnexpectedNodeTypeError';
  }
}

/** Se lanza cuando se intenta instanciar un enemigo con ID desconocido. */
export class UnknownEnemyError extends Error {
  constructor(definitionId: string) {
    super(`Unknown enemy definition: ${definitionId}`);
    this.name = 'UnknownEnemyError';
  }
}

// ---------------------------------------------------------------------------
// StartCombatUseCaseImpl
// ---------------------------------------------------------------------------

/**
 * Inicializa un combate para el nodo actual del mapa.
 *
 * Flujo de orquestación:
 *  1. Validar que existe mapa y nodo actual con tipo combatible.
 *  2. Seleccionar el pool de encuentro (o usar el boss del mapa).
 *  3. Instanciar los EnemyInstance con HP randomizado (SeededRandom).
 *  4. Solicitar a EnemyAI el intent inicial de cada enemigo.
 *  5. Inicializar CombatState via CombatEngine (baraja mazo, roba mano inicial).
 *  6. Retornar nuevo GameState con phase='combat' y el combat poblado.
 */
export class StartCombatUseCaseImpl implements StartCombatUseCase {
  constructor(
    private readonly combatEngine: CombatEngine,
    private readonly enemyAI: EnemyAI,
    private readonly relicEngine = new RelicEngine(new DeckManager()),
  ) {}

  async execute(state: GameState): Promise<GameState> {
    // 1. Validar precondiciones
    const map = state.map;
    if (!map) {
      throw new NoMapError();
    }

    const currentNodeId = map.currentNodeId;
    if (!currentNodeId) {
      throw new NoCurrentNodeError();
    }

    const node = map.nodes.get(currentNodeId);
    if (!node) {
      throw new NoCurrentNodeError();
    }

    if (node.type !== 'combat' && node.type !== 'elite' && node.type !== 'boss') {
      throw new UnexpectedNodeTypeError(node.type);
    }

    // Generador reproducible: seed de la run + piso actual para que cada encuentro
    // sea único pero determinista dada la misma seed.
    const rng = new SeededRandom(state.seed + state.floor);

    // 2. Seleccionar IDs de enemigos para el encuentro
    const enemyIds = this.resolveEnemyIds(node.type, map, rng);

    // 3. Instanciar enemigos con HP aleatorio dentro de su rango base
    const rawEnemies: EnemyInstance[] = enemyIds.map(id => this.instantiateEnemy(id, rng));

    // 4. Calcular intent inicial de cada enemigo
    // El contexto usa rawEnemies (sin intents) porque en turno 1 ninguna
    // condición de ConditionalStrategy puede depender del intent de otro enemigo.
    const context: CombatContext = {
      turnNumber: 1,
      player: state.player,
      allEnemies: rawEnemies,
      cardsPlayedThisTurn: [],
      rng,
    };

    const enemies: EnemyInstance[] = rawEnemies.map(enemy => {
      const def = ENEMIES_BY_ID[enemy.definitionId];
      const { intent, updatedEnemy } = this.enemyAI.getNextIntent(enemy, def.pattern, context);
      return { ...updatedEnemy, currentIntent: intent };
    });

    // 5. Inicializar CombatState: baraja el mazo del jugador y roba la mano inicial.
    // state.player.deck está vacío fuera de combate; el mazo maestro vive en state.deck.
    const playerForCombat = { ...state.player, deck: state.deck };
    const baseCombat = this.combatEngine.initCombat(playerForCombat, enemies, rng);
    const combat = this.relicEngine.applyCombatStartHooks(baseCombat, state.relics, rng);

    // 6. Devolver GameState actualizado
    return { ...state, phase: 'combat', combat };
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Determina qué enemigos aparecen en el encuentro según el tipo de nodo.
   * - boss: siempre el boss del mapa (ID almacenado en GameMap.bossId por el generador).
   * - elite/combat: selección ponderada de ENCOUNTER_POOLS_BY_KEY para el acto activo,
   *   con fallback al acto 1 si no hay pool definido para el acto actual.
   */
  private resolveEnemyIds(nodeType: NodeType, map: GameMap, rng: SeededRandom): string[] {
    if (nodeType === 'boss') {
      return [map.bossId];
    }

    const key = `${map.act}-${nodeType}`;
    const fallbackKey = `1-${nodeType}`;
    const pool = ENCOUNTER_POOLS_BY_KEY[key] ?? ENCOUNTER_POOLS_BY_KEY[fallbackKey];

    if (!pool || pool.encounters.length === 0) {
      throw new Error(`No encounter pool found for key: ${key}`);
    }

    const encounter = rng.weightedChoice(
      pool.encounters.map(enc => ({ item: enc, weight: enc.weight })),
    );

    return [...encounter.enemies];
  }

  /**
   * Crea una EnemyInstance fresca a partir de su EnemyDefinition.
   * - HP aleatorio dentro del rango base definido.
   * - aiState inicializado: sequenceIndex = startIndex del patrón cíclico (si aplica),
   *   currentPhase = initialPhase del patrón por fases (si aplica).
   */
  private instantiateEnemy(definitionId: string, rng: SeededRandom): EnemyInstance {
    const def = ENEMIES_BY_ID[definitionId];
    if (!def) {
      throw new UnknownEnemyError(definitionId);
    }

    const hp = rng.nextInt(def.baseHp.min, def.baseHp.max);

    const sequenceIndex =
      def.pattern.type === 'cyclic' ? (def.pattern.startIndex ?? 0) : 0;
    const currentPhase =
      def.pattern.type === 'phased' ? def.pattern.initialPhase : 0;

    return {
      definitionId,
      hp,
      maxHp: hp,
      block: 0,
      statusEffects: [],
      currentIntent: null,
      aiState: {
        turnCount: 0,
        sequenceIndex,
        lastMoves: [],
        currentPhase,
      },
    };
  }
}
