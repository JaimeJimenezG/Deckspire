import { Card } from './card.model';
import { Player } from './player.model';
import { EnemyInstance } from './enemy.model';

/**
 * Phases of a single combat encounter.
 *
 * - player-turn: the player is choosing and playing cards.
 * - enemy-turn: enemies are resolving their intents (managed by EndTurnUseCase).
 * - combat-end-victory: all enemies are dead; combat is over with a win.
 * - combat-end-defeat: the player's HP reached 0; game over.
 */
export type TurnPhase =
  | 'player-turn'
  | 'enemy-turn'
  | 'combat-end-victory'
  | 'combat-end-defeat';

/**
 * Full state of an active combat encounter.
 * Immutable snapshot; every mutation returns a new object.
 */
export interface CombatState {
  readonly player: Player;
  readonly enemies: readonly EnemyInstance[];

  /** 1-based turn counter; increments after each complete player+enemy cycle. */
  readonly turn: number;

  readonly phase: TurnPhase;

  /**
   * Cards the player has played during the current turn.
   * Used by ConditionalStrategy to check if a Skill/Attack was played (e.g. Gremlin Nob).
   */
  readonly cardsPlayedThisTurn: readonly Card[];

  /**
   * Total damage dealt to a single target by the last card played.
   * Set by CombatEngine.resolveCardEffects so PlayCardUseCase can trigger
   * the damage animation only when damage was actually dealt.
   */
  readonly damageDealt: number;
}
