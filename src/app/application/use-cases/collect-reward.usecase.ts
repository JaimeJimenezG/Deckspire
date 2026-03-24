import type { Card } from '../../domain/models/card.model';
import type { GameState } from '../../domain/models/game-state.model';
import type { CollectRewardUseCase } from '../../domain/ports/inbound/collect-reward.usecase';

/**
 * Error thrown when `pickCard` or `skip` is called outside of the reward phase.
 */
export class NotInRewardPhaseError extends Error {
  constructor(phase: string) {
    super(`Cannot collect reward outside of the reward phase (current: ${phase})`);
    this.name = 'NotInRewardPhaseError';
  }
}

/**
 * Error thrown when the player tries to pick a card that was not offered.
 */
export class CardNotInRewardOptionsError extends Error {
  constructor(cardId: string) {
    super(`Card "${cardId}" is not one of the offered reward options`);
    this.name = 'CardNotInRewardOptionsError';
  }
}

/**
 * Implements CollectRewardUseCase.
 *
 * Orchestration flow for `pickCard`:
 *  1. Guard: phase must be 'reward' and reward state must exist.
 *  2. Validate that the chosen card is one of the offered options.
 *  3. Add the card to the player's permanent deck (`GameState.deck`).
 *  4. Add the pending gold to the player's wallet (`player.gold`).
 *  5. Clear reward state and transition phase to 'map'.
 *
 * Orchestration flow for `skip`:
 *  1. Guard: phase must be 'reward'.
 *  2. Add the pending gold without adding a card.
 *  3. Clear reward state and transition phase to 'map'.
 *
 * Gold is stored in `state.reward.gold` (set when the reward screen opens, typically
 * by the use case that transitions into the reward phase after a combat victory).
 * Both `pickCard` and `skip` finalise the reward by granting the gold and returning
 * to the map.
 */
export class CollectRewardUseCaseImpl implements CollectRewardUseCase {
  async pickCard(card: Card, state: GameState): Promise<GameState> {
    if (state.phase !== 'reward' || !state.reward) {
      throw new NotInRewardPhaseError(state.phase);
    }

    const isOffered = state.reward.cardOptions.some(c => c.id === card.id);
    if (!isOffered) {
      throw new CardNotInRewardOptionsError(card.id);
    }

    const updatedDeck = [...state.deck, card];
    const updatedPlayer = { ...state.player, gold: state.player.gold + state.reward.gold };

    return {
      ...state,
      phase: 'map',
      deck: updatedDeck,
      player: updatedPlayer,
      reward: null,
    };
  }

  async skip(state: GameState): Promise<GameState> {
    if (state.phase !== 'reward' || !state.reward) {
      throw new NotInRewardPhaseError(state.phase);
    }

    const updatedPlayer = { ...state.player, gold: state.player.gold + state.reward.gold };

    return {
      ...state,
      phase: 'map',
      player: updatedPlayer,
      reward: null,
    };
  }
}
