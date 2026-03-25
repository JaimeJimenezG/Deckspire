import { computed, inject, Injectable, signal } from '@angular/core';
import type { Card } from '../domain/models/card.model';
import type { EnemyTier } from '../domain/models/enemy.model';
import type { GameOutcome, GameState, GameStats } from '../domain/models/game-state.model';
import { ALL_CARDS } from '../domain/data/cards.data';
import { RewardGenerator } from '../domain/services/reward-generator';
import { RelicEngine } from '../domain/services/relic-engine';
import { DeckManager } from '../domain/services/deck-manager';
import { SeededRandom } from '../domain/services/seeded-random';
import {
  NEW_GAME_USE_CASE,
  START_COMBAT_USE_CASE,
  PLAY_CARD_USE_CASE,
  END_TURN_USE_CASE,
  NAVIGATE_MAP_USE_CASE,
  SHOP_USE_CASE,
  REST_USE_CASE,
  COLLECT_REWARD_USE_CASE,
  SAVE_GAME_USE_CASE,
  LOAD_GAME_USE_CASE,
  RESOLVE_EVENT_USE_CASE,
  GAME_REPOSITORY,
} from './di/providers';

/** Non-basic cards eligible for post-combat rewards. */
const REWARD_CARD_POOL: readonly Card[] = ALL_CARDS.filter(c => c.rarity !== 'basic');

// ---------------------------------------------------------------------------
// Estado inicial (antes de cargar o iniciar una run)
// ---------------------------------------------------------------------------

const INITIAL_STATE: GameState = {
  phase: 'main-menu',
  gameOutcome: null,
  player: {
    hp: 0,
    maxHp: 0,
    block: 0,
    energy: 0,
    maxEnergy: 0,
    gold: 0,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
  },
  combat: null,
  map: null,
  deck: [],
  gold: 0,
  floor: 0,
  act: 1,
  seed: 0,
  relics: [],
  shop: null,
  reward: null,
  event: null,
  pendingBossRelics: 0,
};

// ---------------------------------------------------------------------------
// GameStateStore
// ---------------------------------------------------------------------------

/**
 * Servicio Angular que actúa como fachada reactiva entre la capa UI
 * y los casos de uso de la capa de aplicación.
 *
 * - Mantiene el estado global de la run en un signal central (`_state`).
 * - Expone señales derivadas (computed) para que los componentes lean solo
 *   la porción de estado que necesitan sin suscripciones manuales.
 * - Delega toda la lógica de negocio a los use cases inyectados.
 * - Cada acción pública actualiza `_state` con el nuevo estado devuelto
 *   por el use case correspondiente.
 */
@Injectable({ providedIn: 'root' })
export class GameStateStore {
  // ── Use cases inyectados ────────────────────────────────────────────────
  private readonly newGameUC = inject(NEW_GAME_USE_CASE);
  private readonly startCombatUC = inject(START_COMBAT_USE_CASE);
  private readonly playCardUC = inject(PLAY_CARD_USE_CASE);
  private readonly endTurnUC = inject(END_TURN_USE_CASE);
  private readonly navigateMapUC = inject(NAVIGATE_MAP_USE_CASE);
  private readonly shopUC = inject(SHOP_USE_CASE);
  private readonly restUC = inject(REST_USE_CASE);
  private readonly collectRewardUC = inject(COLLECT_REWARD_USE_CASE);
  private readonly saveGameUC = inject(SAVE_GAME_USE_CASE);
  private readonly loadGameUC = inject(LOAD_GAME_USE_CASE);
  private readonly resolveEventUC = inject(RESOLVE_EVENT_USE_CASE);
  private readonly gameRepository = inject(GAME_REPOSITORY);

  // ── Signal central ──────────────────────────────────────────────────────
  private readonly _state = signal<GameState>(INITIAL_STATE);

  // ── Signals derivados (computed) ────────────────────────────────────────

  /** Fase actual del juego. */
  readonly phase = computed(() => this._state().phase);

  /** Estado del jugador (HP, energía, bloqueo, reliquias activas, etc.). */
  readonly player = computed(() => this._state().player);

  /** Estado del combate activo. Null fuera de combate. */
  readonly combat = computed(() => this._state().combat);

  /** Mapa del acto actual. Null antes de generar el primer mapa. */
  readonly map = computed(() => this._state().map);

  /** Mazo maestro del jugador (fuera de combate). */
  readonly deck = computed(() => this._state().deck);

  /** Oro acumulado. */
  readonly gold = computed(() => this._state().gold);

  /** Número de planta actual. */
  readonly floor = computed(() => this._state().floor);

  /** Acto actual (1, 2 o 3). */
  readonly act = computed(() => this._state().act);

  /** IDs de reliquias equipadas. */
  readonly relics = computed(() => this._state().relics);

  /** Estado de la tienda activa. Null fuera de la fase 'shop'. */
  readonly shop = computed(() => this._state().shop);

  /** Estado de la pantalla de recompensa activa. Null fuera de la fase 'reward'. */
  readonly reward = computed(() => this._state().reward);

  /** Estado del evento activo. Null fuera de la fase 'event'. */
  readonly event = computed(() => this._state().event);

  /** Resultado de la run ('victory' | 'defeat'). null mientras la run está activa. */
  readonly gameOutcome = computed(() => this._state().gameOutcome);

  /** Controla la visibilidad del overlay DeckViewerComponent. */
  readonly deckViewerOpen = signal(false);

  // ── Acciones públicas ───────────────────────────────────────────────────

  /** Abre el modal de visor del mazo. */
  openDeckViewer(): void {
    this.deckViewerOpen.set(true);
  }

  /** Cierra el modal de visor del mazo. */
  closeDeckViewer(): void {
    this.deckViewerOpen.set(false);
  }

  /** Inicia una nueva run con una seed opcional. */
  async newGame(seed?: number): Promise<void> {
    const newState = await this.newGameUC.execute(seed);
    this._state.set(newState);
  }

  /** Inicia el combate del nodo actual del mapa. */
  async startCombat(): Promise<void> {
    const newState = await this.startCombatUC.execute(this._state());
    this._state.set(newState);
  }

  /** Juega una carta de la mano contra un objetivo. */
  async playCard(card: Card, targetIdx: number): Promise<void> {
    const newState = await this.playCardUC.execute(card, targetIdx, this._state(), {
      onCombatCommitted: s => this._state.set(s),
    });
    this._state.set(newState);
  }

  /** Finaliza el turno del jugador y ejecuta el turno enemigo. */
  async endTurn(): Promise<void> {
    const newState = await this.endTurnUC.execute(this._state());
    this._state.set(newState);
  }

  /** Navega al nodo del mapa indicado. */
  async navigateToNode(nodeId: string): Promise<void> {
    const newState = await this.navigateMapUC.execute(nodeId, this._state());
    this._state.set(newState);
  }

  /** Compra una carta en la tienda. */
  async buyCard(itemId: string): Promise<void> {
    const newState = await this.shopUC.buyCard(itemId, this._state());
    this._state.set(newState);
  }

  /** Elimina una carta del mazo pagando el coste de purga en la tienda. */
  async purgeCard(cardInstanceIdx: number): Promise<void> {
    const newState = await this.shopUC.purgeCard(cardInstanceIdx, this._state());
    this._state.set(newState);
  }

  /** Compra una reliquia en la tienda. */
  async buyRelic(itemId: string): Promise<void> {
    const newState = await this.shopUC.buyRelic(itemId, this._state());
    this._state.set(newState);
  }

  /** Descansa en la hoguera para recuperar HP. */
  async rest(): Promise<void> {
    const newState = await this.restUC.rest(this._state());
    this._state.set(newState);
  }

  /** Mejora una carta en la hoguera (Smith). */
  async smith(cardInstanceIdx: number): Promise<void> {
    const newState = await this.restUC.smith(cardInstanceIdx, this._state());
    this._state.set(newState);
  }

  /** Abandona la hoguera y vuelve al mapa tras haber completado la acción. */
  leaveRestSite(): void {
    this._state.update(s => ({ ...s, phase: 'map' }));
  }

  /** Resuelve la elección del jugador en el evento activo y aplica sus efectos. */
  async resolveEvent(choiceId: string): Promise<void> {
    const newState = await this.resolveEventUC.execute(choiceId, this._state());
    this._state.set(newState);
  }

  /** Abandona el evento y vuelve al mapa. */
  leaveEvent(): void {
    this._state.update(s => ({ ...s, phase: 'map', event: null }));
  }

  /** Abandona la tienda y vuelve al mapa. */
  leaveShop(): void {
    this._state.update(s => ({ ...s, phase: 'map', shop: null }));
  }

  /** El jugador elige una carta de las ofrecidas como recompensa. */
  async pickRewardCard(card: Card): Promise<void> {
    const newState = await this.collectRewardUC.pickCard(card, this._state());
    this._state.set(newState);
  }

  /** El jugador omite las recompensas de cartas sin elegir ninguna. */
  async skipReward(): Promise<void> {
    const newState = await this.collectRewardUC.skip(this._state());
    this._state.set(newState);
  }

  /**
   * Genera la recompensa de combate y transiciona a la fase 'reward'.
   * Debe llamarse desde CombatViewComponent cuando 'combat-end-victory' se detecta
   * en un nodo de combate normal o elite (no boss).
   */
  collectCombatReward(): void {
    const state = this._state();
    const map = state.map;
    const node = map?.currentNodeId ? map.nodes.get(map.currentNodeId) : null;

    const tier: EnemyTier =
      node?.type === 'elite' ? 'elite' : 'normal';

    // Elite rewards: grant a random relic (base 1) plus any equipped modifiers.
    let relics = state.relics;
    if (node?.type === 'elite') {
      const relicEngine = new RelicEngine(new DeckManager());
      const baseCount = 1;
      const count = relicEngine.calculateRelicRewardCount('elite', baseCount, relics);
      const rngRelics = new SeededRandom(state.seed + state.floor * 4001 + 31);
      relics = relicEngine.grantRandomRelics(relics, count, rngRelics).relics;
    }

    const rng = new SeededRandom(state.seed + state.floor * 1009);
    const rewardGen = new RewardGenerator(REWARD_CARD_POOL);
    const cardOptions = rewardGen.generateCardRewards(tier, state.act, rng);
    const gold = rewardGen.calculateGoldReward(tier, state.act, rng);

    this._state.update(s => ({
      ...s,
      relics,
      phase: 'reward',
      combat: null,
      reward: { cardOptions, gold },
    }));
  }

  /**
   * Transiciona a la fase 'game-over' registrando el resultado de la run.
   * Además:
   *  - Actualiza las estadísticas acumuladas (partidas, victorias/derrotas, planta máxima, oro).
   *  - Elimina el guardado activo para que "Continuar" no aparezca en el menú principal.
   *
   * Debe llamarse desde CombatViewComponent cuando el combate termina en
   * 'combat-end-victory' (boss derrotado) o 'combat-end-defeat' (jugador muerto).
   */
  async declareGameOver(outcome: NonNullable<GameOutcome>): Promise<void> {
    const state = this._state();

    // Boss victory: grant 1 random relic by default.
    // If the origin pact is active (`pendingBossRelics`), it overrides the base count.
    let relics = state.relics;
    if (outcome === 'victory') {
      const node =
        state.map?.currentNodeId ? state.map.nodes.get(state.map.currentNodeId) : null;

      if (node?.type === 'boss') {
        const relicEngine = new RelicEngine(new DeckManager());
        const baseCount = state.pendingBossRelics > 0 ? state.pendingBossRelics : 1;
        const count = relicEngine.calculateRelicRewardCount('boss', baseCount, relics);
        const rngRelics = new SeededRandom(state.seed + state.floor * 7919 + 2);
        relics = relicEngine.grantRandomRelics(relics, count, rngRelics).relics;
      }
    }

    const currentStats = await this.gameRepository.getStats();
    await this.gameRepository.updateStats({
      gamesPlayed: currentStats.gamesPlayed + 1,
      wins:   outcome === 'victory' ? currentStats.wins   + 1 : currentStats.wins,
      losses: outcome === 'defeat'  ? currentStats.losses + 1 : currentStats.losses,
      highestFloorReached: Math.max(currentStats.highestFloorReached, state.floor),
      totalGoldEarned:     currentStats.totalGoldEarned + state.gold,
    });

    await this.gameRepository.deleteSave();

    this._state.update(s => ({
      ...s,
      relics,
      pendingBossRelics: 0,
      phase: 'game-over',
      gameOutcome: outcome,
    }));
  }

  /**
   * Vuelve a la pantalla del menú principal reseteando el estado de la run.
   * No inicia ninguna partida nueva: el jugador elige desde el menú.
   */
  returnToMenu(): void {
    this._state.set(INITIAL_STATE);
  }

  /** Guarda el estado actual en IndexedDB. */
  async saveGame(): Promise<void> {
    await this.saveGameUC.execute(this._state());
  }

  /**
   * Carga la partida guardada y actualiza el signal central.
   * Retorna true si existía una partida guardada, false si no.
   */
  async loadGame(): Promise<boolean> {
    const saved = await this.loadGameUC.execute();
    if (saved) {
      this._state.set(saved);
      return true;
    }
    return false;
  }

  /**
   * Comprueba si existe una partida guardada sin cargarla ni modificar el estado actual.
   * Útil para mostrar/ocultar el botón "Continuar" en el menú principal.
   */
  async checkSavedGame(): Promise<boolean> {
    const saved = await this.loadGameUC.execute();
    return saved !== null;
  }

  /** Obtiene las estadísticas acumuladas entre runs directamente del repositorio. */
  async getStats(): Promise<GameStats> {
    return this.gameRepository.getStats();
  }
}
