import { SeededRandom } from './seeded-random';

describe('SeededRandom', () => {
  let rng: SeededRandom;

  beforeEach(() => {
    rng = new SeededRandom(42);
  });

  describe('next()', () => {
    it('should return values in [0, 1)', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should produce the same sequence for the same seed', () => {
      const rng2 = new SeededRandom(42);
      for (let i = 0; i < 20; i++) {
        expect(rng.next()).toBe(rng2.next());
      }
    });

    it('should produce different sequences for different seeds', () => {
      const rng2 = new SeededRandom(99);
      const results1 = Array.from({ length: 10 }, () => rng.next());
      const results2 = Array.from({ length: 10 }, () => rng2.next());
      expect(results1).not.toEqual(results2);
    });
  });

  describe('nextInt()', () => {
    it('should return integers within [min, max] inclusive', () => {
      for (let i = 0; i < 200; i++) {
        const value = rng.nextInt(3, 7);
        expect(value).toBeGreaterThanOrEqual(3);
        expect(value).toBeLessThanOrEqual(7);
        expect(Number.isInteger(value)).toBeTrue();
      }
    });

    it('should return min when min equals max', () => {
      for (let i = 0; i < 10; i++) {
        expect(rng.nextInt(5, 5)).toBe(5);
      }
    });
  });

  describe('nextFloat()', () => {
    it('should return floats in [min, max)', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.nextFloat(-10, 10);
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThan(10);
      }
    });
  });

  describe('weightedChoice()', () => {
    it('should always return an item from the list', () => {
      const items = [
        { item: 'a', weight: 1 },
        { item: 'b', weight: 2 },
        { item: 'c', weight: 7 },
      ];
      for (let i = 0; i < 50; i++) {
        const result = rng.weightedChoice(items);
        expect(['a', 'b', 'c']).toContain(result);
      }
    });

    it('should always pick the only item when weight list has one entry', () => {
      const items = [{ item: 'only', weight: 10 }];
      for (let i = 0; i < 10; i++) {
        expect(rng.weightedChoice(items)).toBe('only');
      }
    });

    it('should heavily favour the highest-weight item over many draws', () => {
      const items = [
        { item: 'rare', weight: 1 },
        { item: 'common', weight: 99 },
      ];
      const counts: Record<string, number> = { rare: 0, common: 0 };
      for (let i = 0; i < 1000; i++) {
        counts[rng.weightedChoice(items)]++;
      }
      expect(counts['common']).toBeGreaterThan(counts['rare']);
    });
  });
});
