import type { Card, CardRarity } from '../models/card.model';
import type { EnemyTier } from '../models/enemy.model';
import type { SeededRandom } from './seeded-random';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of card choices offered after a normal/elite combat. */
const REWARD_CARD_COUNT = 3;

/** Number of card choices offered after a boss combat. */
const BOSS_REWARD_CARD_COUNT = 4;

interface RarityWeights {
  readonly common: number;
  readonly uncommon: number;
  readonly rare: number;
}

/**
 * Probability weights for each rarity tier, scaled per act.
 * Higher acts shift the distribution toward rarer cards.
 */
const RARITY_WEIGHTS_BY_ACT: Readonly<Record<number, RarityWeights>> = {
  1: { common: 60, uncommon: 37, rare: 3 },
  2: { common: 45, uncommon: 48, rare: 7 },
  3: { common: 30, uncommon: 52, rare: 18 },
};

/** Fallback for acts beyond 3. */
const FALLBACK_RARITY_WEIGHTS: RarityWeights = { common: 30, uncommon: 52, rare: 18 };

interface GoldRange {
  readonly min: number;
  readonly max: number;
  /** Extra gold added per act beyond act 1. */
  readonly actBonus: number;
}

/**
 * Base gold ranges per enemy tier.
 * Mirrors Slay the Spire reward economy:
 *   normal → 10-20 g  |  elite → 25-35 g  |  boss → 95-105 g
 */
const GOLD_RANGES: Readonly<Record<EnemyTier, GoldRange>> = {
  normal: { min: 10, max: 20, actBonus: 2 },
  elite:  { min: 25, max: 35, actBonus: 5 },
  boss:   { min: 95, max: 105, actBonus: 15 },
};

// ---------------------------------------------------------------------------
// RewardGenerator
// ---------------------------------------------------------------------------

/**
 * Pure domain service that generates post-combat rewards.
 *
 * Responsibilities:
 *   - Select card reward options from a pool, respecting rarity weights and
 *     the no-duplicate rule.
 *   - Compute a random gold amount scaled to enemy tier and act number.
 *
 * All randomness is delegated to SeededRandom so results are deterministic
 * given the same seed.
 */
export class RewardGenerator {
  /**
   * @param cardPool - Full catalogue of obtainable cards (excludes basic cards).
   *                   Injected so the service remains testable without static imports.
   */
  constructor(private readonly cardPool: readonly Card[]) {}

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Generates a set of distinct card choices to present as a combat reward.
   *
   * - Returns {@link REWARD_CARD_COUNT} cards for normal/elite combats and
   *   {@link BOSS_REWARD_CARD_COUNT} cards after a boss.
   * - Each card is drawn from the pool using rarity weights appropriate to
   *   the current act; basic-rarity cards are never included.
   * - No card appears twice in the same reward set.
   *
   * @param tier - Tier of the defeated enemy (affects pool size for bosses).
   * @param act  - Current act number (1–3). Affects rarity probabilities.
   * @param rng  - Seeded RNG instance; advances its state during the call.
   * @returns Array of unique cards (may be shorter than the target count if the
   *          pool for a given rarity is exhausted).
   */
  generateCardRewards(tier: EnemyTier, act: number, rng: SeededRandom): Card[] {
    const weights = RARITY_WEIGHTS_BY_ACT[act] ?? FALLBACK_RARITY_WEIGHTS;
    const targetCount = tier === 'boss' ? BOSS_REWARD_CARD_COUNT : REWARD_CARD_COUNT;

    const chosen: Card[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < targetCount; i++) {
      const rarity = this.pickRarity(weights, rng);
      const available = this.cardPool.filter(
        c => c.rarity === rarity && !usedIds.has(c.id),
      );

      if (available.length === 0) {
        // Pool for this rarity exhausted — skip this slot gracefully.
        continue;
      }

      const pick = available[rng.nextInt(0, available.length - 1)];
      chosen.push(pick);
      usedIds.add(pick.id);
    }

    return chosen;
  }

  /**
   * Calculates a random gold reward for defeating an enemy of the given tier.
   *
   * The range scales with the act number so later acts yield more gold:
   * - Normal  act 1 → 10–20 g, act 2 → 12–22 g, act 3 → 14–24 g
   * - Elite   act 1 → 25–35 g, act 2 → 30–40 g, act 3 → 35–45 g
   * - Boss    act 1 → 95–105 g, act 2 → 110–120 g, act 3 → 125–135 g
   *
   * @param tier - Tier of the defeated enemy.
   * @param act  - Current act number (1–3).
   * @param rng  - Seeded RNG instance; advances its state by one step.
   */
  calculateGoldReward(tier: EnemyTier, act: number, rng: SeededRandom): number {
    const { min, max, actBonus } = GOLD_RANGES[tier];
    const bonus = actBonus * (act - 1);
    return rng.nextInt(min + bonus, max + bonus);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private pickRarity(weights: RarityWeights, rng: SeededRandom): CardRarity {
    return rng.weightedChoice<CardRarity>([
      { item: 'common',   weight: weights.common },
      { item: 'uncommon', weight: weights.uncommon },
      { item: 'rare',     weight: weights.rare },
    ]);
  }
}
