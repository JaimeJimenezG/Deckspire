import type { GameState } from '../../domain/models/game-state.model';
import type { Player } from '../../domain/models/player.model';
import type { NewGameUseCase } from '../../domain/ports/inbound/new-game.usecase';
import { STARTER_DECK } from '../../domain/data/cards.data';
import { ENCOUNTER_POOLS_BY_KEY } from '../../domain/data/encounters.data';
import { MapGenerator } from '../../domain/services/map-generator';
import { SeededRandom } from '../../domain/services/seeded-random';

const INITIAL_HP = 80;
const INITIAL_MAX_ENERGY = 3;
const INITIAL_GOLD = 99;
const INITIAL_ACT = 1;

/**
 * Implementación del caso de uso NewGame.
 *
 * Responsabilidades:
 *   1. Generar o aceptar una seed para reproducibilidad.
 *   2. Seleccionar el boss del acto 1 con peso aleatorio determinista.
 *   3. Generar el mapa del acto 1 con MapGenerator.
 *   4. Crear el jugador inicial con el mazo de inicio (5× Strike + 4× Defend).
 *   5. Devolver un GameState con fase 'map', listo para que el jugador elija nodo.
 */
export class NewGameUseCaseImpl implements NewGameUseCase {
  constructor(private readonly mapGenerator: MapGenerator) {}

  async execute(seed?: number): Promise<GameState> {
    const resolvedSeed = seed ?? Date.now();
    const rng = new SeededRandom(resolvedSeed);

    const bossId = this.selectBoss(INITIAL_ACT, rng);
    const map = this.mapGenerator.generateMap(INITIAL_ACT, rng, bossId);

    const player: Player = {
      hp: INITIAL_HP,
      maxHp: INITIAL_HP,
      block: 0,
      energy: INITIAL_MAX_ENERGY,
      maxEnergy: INITIAL_MAX_ENERGY,
      gold: INITIAL_GOLD,
      deck: [],
      hand: [],
      piles: { discard: [], exhaust: [] },
      statusEffects: [],
    };

    return {
      phase: 'map',
      gameOutcome: null,
      player,
      combat: null,
      map,
      deck: [...STARTER_DECK],
      gold: INITIAL_GOLD,
      floor: 0,
      act: INITIAL_ACT,
      seed: resolvedSeed,
      relics: [],
      shop: null,
      reward: null,
      event: null,
      pendingBossRelics: 0,
    };
  }

  /**
   * Selecciona aleatoriamente el enemigo boss del acto dado
   * usando el pool de encuentros y pesos definidos en los datos estáticos.
   */
  private selectBoss(act: number, rng: SeededRandom): string {
    const pool = ENCOUNTER_POOLS_BY_KEY[`${act}-boss`];
    if (!pool || pool.encounters.length === 0) {
      return 'unknown';
    }
    const encounter = rng.weightedChoice(
      pool.encounters.map(e => ({ item: e, weight: e.weight })),
    );
    return encounter.enemies[0];
  }
}
