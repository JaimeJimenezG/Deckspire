/**
 * Deterministic pseudo-random number generator (mulberry32 algorithm).
 * Use this instead of Math.random() to keep runs reproducible given the same seed.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  }

  /** Returns an integer in [min, max] (inclusive on both ends). */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max). */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Picks one item from the array according to relative weights.
   * Weights do not need to sum to any particular value.
   */
  weightedChoice<T>(items: { item: T; weight: number }[]): T {
    const total = items.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.next() * total;
    for (const entry of items) {
      roll -= entry.weight;
      if (roll < 0) return entry.item;
    }
    return items[items.length - 1].item;
  }
}
