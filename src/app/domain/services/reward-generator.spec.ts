import { RewardGenerator } from './reward-generator';
import { SeededRandom } from './seeded-random';
import type { Card } from '../models/card.model';

// ---------------------------------------------------------------------------
// Minimal card fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string, rarity: Card['rarity']): Card {
  return {
    id,
    name: id,
    type: 'attack',
    rarity,
    cost: 1,
    description: '',
    upgraded: false,
    effects: [],
  };
}

const COMMON_CARDS: readonly Card[] = [
  makeCard('strike', 'common'),
  makeCard('bash', 'common'),
  makeCard('clothesline', 'common'),
  makeCard('headbutt', 'common'),
  makeCard('pommel-strike', 'common'),
];

const UNCOMMON_CARDS: readonly Card[] = [
  makeCard('dropkick', 'uncommon'),
  makeCard('uppercut', 'uncommon'),
  makeCard('carnage', 'uncommon'),
  makeCard('hemokinesis', 'uncommon'),
];

const RARE_CARDS: readonly Card[] = [
  makeCard('feed', 'rare'),
  makeCard('bludgeon', 'rare'),
  makeCard('reaper', 'rare'),
];

const BASIC_CARDS: readonly Card[] = [
  makeCard('basic-strike', 'basic'),
  makeCard('basic-defend', 'basic'),
];

const ALL_CARDS: readonly Card[] = [
  ...COMMON_CARDS,
  ...UNCOMMON_CARDS,
  ...RARE_CARDS,
  ...BASIC_CARDS,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRng(seed = 42): SeededRandom {
  return new SeededRandom(seed);
}

// ---------------------------------------------------------------------------
// generateCardRewards
// ---------------------------------------------------------------------------

describe('RewardGenerator.generateCardRewards', () => {
  let generator: RewardGenerator;

  beforeEach(() => {
    generator = new RewardGenerator(ALL_CARDS);
  });

  it('returns 3 cards for a normal enemy', () => {
    const rewards = generator.generateCardRewards('normal', 1, makeRng());
    expect(rewards.length).toBe(3);
  });

  it('returns 3 cards for an elite enemy', () => {
    const rewards = generator.generateCardRewards('elite', 1, makeRng());
    expect(rewards.length).toBe(3);
  });

  it('returns 4 cards for a boss enemy', () => {
    const rewards = generator.generateCardRewards('boss', 1, makeRng());
    expect(rewards.length).toBe(4);
  });

  it('never includes basic-rarity cards', () => {
    const rewards = generator.generateCardRewards('normal', 1, makeRng());
    for (const card of rewards) {
      expect(card.rarity).not.toBe('basic');
    }
  });

  it('never returns duplicate card IDs in the same reward set', () => {
    const rewards = generator.generateCardRewards('boss', 1, makeRng());
    const ids = rewards.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('returns deterministic results for the same seed', () => {
    const a = generator.generateCardRewards('normal', 1, makeRng(123));
    const b = generator.generateCardRewards('normal', 1, makeRng(123));
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });

  it('returns different results for different seeds', () => {
    const a = generator.generateCardRewards('normal', 1, makeRng(1));
    const b = generator.generateCardRewards('normal', 1, makeRng(9999));
    // With different seeds at least one card should differ (probabilistic, but seed spread is large)
    const sameIds = a.map(c => c.id).join(',') === b.map(c => c.id).join(',');
    expect(sameIds).toBeFalse();
  });

  it('all returned cards exist in the card pool', () => {
    const poolIds = new Set(ALL_CARDS.map(c => c.id));
    const rewards = generator.generateCardRewards('elite', 2, makeRng(77));
    for (const card of rewards) {
      expect(poolIds.has(card.id)).toBeTrue();
    }
  });

  it('handles an act > 3 without throwing (fallback weights)', () => {
    expect(() => generator.generateCardRewards('normal', 99, makeRng())).not.toThrow();
  });

  it('handles a pool with only one card of a rarity without duplicates', () => {
    const tinyPool: Card[] = [makeCard('only-rare', 'rare'), ...COMMON_CARDS, ...UNCOMMON_CARDS];
    const tiny = new RewardGenerator(tinyPool);
    // Force rare slot by using a seed that picks rare – we just check no duplicates
    const rewards = tiny.generateCardRewards('boss', 3, makeRng(0));
    const ids = rewards.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns fewer cards than target when pool is too small', () => {
    const smallPool: Card[] = [makeCard('lone-common', 'common')];
    const small = new RewardGenerator(smallPool);
    // With only 1 card the second and third slots will find nothing (exhausted pool)
    const rewards = small.generateCardRewards('normal', 1, makeRng(42));
    expect(rewards.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// calculateGoldReward
// ---------------------------------------------------------------------------

describe('RewardGenerator.calculateGoldReward', () => {
  let generator: RewardGenerator;

  beforeEach(() => {
    generator = new RewardGenerator(ALL_CARDS);
  });

  it('returns a positive integer for a normal enemy', () => {
    const gold = generator.calculateGoldReward('normal', 1, makeRng());
    expect(gold).toBeGreaterThan(0);
    expect(Number.isInteger(gold)).toBeTrue();
  });

  it('normal enemy act 1 gold is in [10, 20]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gold = generator.calculateGoldReward('normal', 1, makeRng(seed));
      expect(gold).toBeGreaterThanOrEqual(10);
      expect(gold).toBeLessThanOrEqual(20);
    }
  });

  it('elite enemy act 1 gold is in [25, 35]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gold = generator.calculateGoldReward('elite', 1, makeRng(seed));
      expect(gold).toBeGreaterThanOrEqual(25);
      expect(gold).toBeLessThanOrEqual(35);
    }
  });

  it('boss enemy act 1 gold is in [95, 105]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gold = generator.calculateGoldReward('boss', 1, makeRng(seed));
      expect(gold).toBeGreaterThanOrEqual(95);
      expect(gold).toBeLessThanOrEqual(105);
    }
  });

  it('act 2 gives more gold than act 1 on average (normal enemy)', () => {
    let sumAct1 = 0;
    let sumAct2 = 0;
    const iterations = 100;
    for (let seed = 0; seed < iterations; seed++) {
      sumAct1 += generator.calculateGoldReward('normal', 1, makeRng(seed));
      sumAct2 += generator.calculateGoldReward('normal', 2, makeRng(seed));
    }
    expect(sumAct2 / iterations).toBeGreaterThan(sumAct1 / iterations);
  });

  it('boss rewards significantly more gold than normal enemies', () => {
    const normalGold = generator.calculateGoldReward('normal', 1, makeRng(1));
    const bossGold = generator.calculateGoldReward('boss', 1, makeRng(1));
    expect(bossGold).toBeGreaterThan(normalGold);
  });

  it('returns deterministic results for the same seed', () => {
    const a = generator.calculateGoldReward('elite', 2, makeRng(555));
    const b = generator.calculateGoldReward('elite', 2, makeRng(555));
    expect(a).toBe(b);
  });

  it('normal enemy act 3 gold is in [14, 24]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gold = generator.calculateGoldReward('normal', 3, makeRng(seed));
      expect(gold).toBeGreaterThanOrEqual(14);
      expect(gold).toBeLessThanOrEqual(24);
    }
  });

  it('elite enemy act 3 gold is in [35, 45]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gold = generator.calculateGoldReward('elite', 3, makeRng(seed));
      expect(gold).toBeGreaterThanOrEqual(35);
      expect(gold).toBeLessThanOrEqual(45);
    }
  });

  it('boss enemy act 3 gold is in [125, 135]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gold = generator.calculateGoldReward('boss', 3, makeRng(seed));
      expect(gold).toBeGreaterThanOrEqual(125);
      expect(gold).toBeLessThanOrEqual(135);
    }
  });
});
