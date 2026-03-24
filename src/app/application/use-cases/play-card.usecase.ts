import type { Card } from '../../domain/models/card.model';
import type { GameState } from '../../domain/models/game-state.model';
import type {
  PlayCardPlayOptions,
  PlayCardUseCase,
} from '../../domain/ports/inbound/play-card.usecase';
import type { CombatRendererPort } from '../../domain/ports/outbound/combat-renderer.port';
import { CombatEngine } from '../../domain/services/combat-engine';
import { SeededRandom } from '../../domain/services/seeded-random';

/**
 * Error thrown when a card cannot be played due to insufficient energy.
 */
export class InsufficientEnergyError extends Error {
  constructor(required: number, available: number) {
    super(`Not enough energy: card costs ${required} but player has ${available}`);
    this.name = 'InsufficientEnergyError';
  }
}

/**
 * Error thrown when trying to play a card outside of the player's turn.
 */
export class InvalidTurnPhaseError extends Error {
  constructor(phase: string) {
    super(`Cannot play cards during phase: ${phase}`);
    this.name = 'InvalidTurnPhaseError';
  }
}

/**
 * Error thrown when there is no active combat.
 */
export class NoCombatActiveError extends Error {
  constructor() {
    super('No active combat state');
    this.name = 'NoCombatActiveError';
  }
}

/**
 * Implements PlayCardUseCase.
 *
 * Orchestration flow:
 *  1. Guard: active combat + player turn + sufficient energy
 *  2. Resolve effects via CombatEngine (hand / energy / combat actualizado)
 *  3. Optional `onCombatCommitted` (p. ej. actualizar UI de la mano al instante)
 *  4. Animate card play spark (renderer)
 *  5. Animate damage / block feedback (renderer)
 *  6. Animate enemy deaths if any (renderer)
 *  7. Return updated GameState
 */
export class PlayCardUseCaseImpl implements PlayCardUseCase {
  constructor(
    private readonly combatEngine: CombatEngine,
    private readonly renderer: CombatRendererPort,
  ) {}

  async execute(
    card: Card,
    targetIdx: number,
    state: GameState,
    options?: PlayCardPlayOptions,
  ): Promise<GameState> {
    const combat = state.combat;

    if (!combat) {
      throw new NoCombatActiveError();
    }

    if (combat.phase !== 'player-turn') {
      throw new InvalidTurnPhaseError(combat.phase);
    }

    if (combat.player.energy < card.cost) {
      throw new InsufficientEnergyError(card.cost, combat.player.energy);
    }

    // Use a SeededRandom derived from the run seed + turn for deterministic
    // randomness (e.g. random-enemy targeting, Juggernaut, etc.).
    const rng = new SeededRandom(state.seed + combat.turn);

    const newCombat = this.combatEngine.resolveCardEffects(card, targetIdx, combat, rng);
    const newState: GameState = { ...state, combat: newCombat };
    options?.onCombatCommitted?.(newState);

    await this.renderer.animateCardPlay(card);

    // Animate damage to the primary target if any was dealt.
    // Canvas convention: 0 = player, 1+ = enemy (targetIdx is 0-based enemy index).
    if (newCombat.damageDealt > 0) {
      await this.renderer.animateDamage(targetIdx + 1, newCombat.damageDealt);
    }

    // Animate block gain for the player if a block effect was in the card.
    const blockGained =
      newCombat.player.block - combat.player.block > 0
        ? newCombat.player.block - combat.player.block
        : 0;
    if (blockGained > 0) {
      await this.renderer.animateBlock(0, blockGained);
    }

    // Animate deaths for enemies that just died.
    for (let i = 0; i < combat.enemies.length; i++) {
      const wasAlive = combat.enemies[i].hp > 0;
      const isDead = newCombat.enemies[i]?.hp === 0;
      if (wasAlive && isDead) {
        await this.renderer.animateDeath(i + 1);
      }
    }

    return newState;
  }
}
