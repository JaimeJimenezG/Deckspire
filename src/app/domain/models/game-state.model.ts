import type { Card } from './card.model';
import type { Player } from './player.model';
import type { CombatState } from './combat.model';
import type { EventState } from './event.model';
import type { GameMap } from './map.model';
import type { RewardState } from './reward.model';
import type { ShopState } from './shop.model';

export type GamePhase =
  | 'main-menu'
  | 'map'
  | 'combat'
  | 'shop'
  | 'rest'
  | 'reward'
  | 'event'
  | 'game-over';

/**
 * Resultado final de la run. Se rellena al transicionar a la fase 'game-over'.
 * null mientras la run sigue activa.
 */
export type GameOutcome = 'victory' | 'defeat' | null;

/**
 * Estado completo de una run activa. Se serializa para persistencia via GameRepository.
 * El deck maestro vive aquí; CombatState gestiona las subpilas (mano, robo, descarte)
 * derivadas de él durante el combate.
 */
export interface GameState {
  readonly phase: GamePhase;
  /** Resultado de la run; null mientras la run sigue activa. */
  readonly gameOutcome: GameOutcome;
  readonly player: Player;
  /** Estado de combate activo. null fuera de combate. */
  readonly combat: CombatState | null;
  /** Mapa del acto actual. null antes de generar el primer mapa. */
  readonly map: GameMap | null;
  /** Mazo maestro del jugador (fuera de combate). */
  readonly deck: readonly Card[];
  /** Oro acumulado. */
  readonly gold: number;
  /** Número de planta (nodo) actual dentro del acto. */
  readonly floor: number;
  /** Acto actual (1, 2 o 3). */
  readonly act: number;
  /** Seed de la run para reproducibilidad via SeededRandom. */
  readonly seed: number;
  /** IDs de reliquias equipadas, en orden de adquisición. */
  readonly relics: readonly string[];
  /** Estado de la tienda activa. null fuera de la fase 'shop'. */
  readonly shop: ShopState | null;
  /** Estado de la pantalla de recompensa activa. null fuera de la fase 'reward'. */
  readonly reward: RewardState | null;
  /** Estado del evento activo. null fuera de la fase 'event'. */
  readonly event: EventState | null;
  /**
   * Número de reliquias aleatorias pendientes de conceder al derrotar al boss.
   * Se acumula con el efecto 'gain-relic-post-boss' del evento de primer nodo.
   */
  readonly pendingBossRelics: number;
}

/** Estadísticas persistentes entre runs (no pertenecen a GameState sino al repositorio). */
export interface GameStats {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly highestFloorReached: number;
  readonly totalGoldEarned: number;
  readonly totalDamageDealt: number;
}
