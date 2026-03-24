import type { Card } from './card.model';

/**
 * State of the reward screen shown after a combat victory.
 * Holds the card choices offered to the player and the gold
 * earned from the defeated enemy.
 *
 * Both `cardOptions` and `gold` are consumed when the player
 * calls `CollectRewardUseCase.pickCard` or `skip`.
 */
export interface RewardState {
  /** Cards offered to the player — typically 3 for normal/elite, 4 for boss. */
  readonly cardOptions: readonly Card[];
  /** Gold earned from the combat. Added to the player's wallet when leaving the reward screen. */
  readonly gold: number;
}
