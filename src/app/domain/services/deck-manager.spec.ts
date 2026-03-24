import { Card } from '../models/card.model';
import { Player } from '../models/player.model';
import { DeckManager, DeckState, deckStateFromPlayer, playerWithDeckState } from './deck-manager';
import { SeededRandom } from './seeded-random';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCard(id: string): Card {
  return {
    id,
    name: id,
    type: 'attack',
    rarity: 'basic',
    cost: 1,
    description: '',
    upgraded: false,
    effects: [],
  };
}

function makePlayer(overrides: Partial<{
  deck: Card[];
  hand: Card[];
  discard: Card[];
  exhaust: Card[];
}>): Player {
  return {
    hp: 80,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 99,
    statusEffects: [],
    deck: overrides.deck ?? [],
    hand: overrides.hand ?? [],
    piles: {
      discard: overrides.discard ?? [],
      exhaust: overrides.exhaust ?? [],
    },
  };
}

function makeState(overrides: Partial<{
  deck: Card[];
  hand: Card[];
  discard: Card[];
  exhaust: Card[];
}>): DeckState {
  return {
    deck: overrides.deck ?? [],
    hand: overrides.hand ?? [],
    discard: overrides.discard ?? [],
    exhaust: overrides.exhaust ?? [],
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DeckManager', () => {
  let manager: DeckManager;
  let rng: SeededRandom;

  const A = makeCard('A');
  const B = makeCard('B');
  const C = makeCard('C');
  const D = makeCard('D');
  const E = makeCard('E');

  beforeEach(() => {
    manager = new DeckManager();
    rng = new SeededRandom(42);
  });

  // ── shuffle ──────────────────────────────────────────────────────────────

  describe('shuffle()', () => {
    it('should return a new array with the same cards', () => {
      const cards = [A, B, C, D, E];
      const shuffled = manager.shuffle(cards, rng);
      expect(shuffled.length).toBe(cards.length);
      expect(shuffled).toContain(A);
      expect(shuffled).toContain(E);
    });

    it('should not mutate the original array', () => {
      const cards = [A, B, C, D, E];
      const original = [...cards];
      manager.shuffle(cards, rng);
      expect(cards).toEqual(original);
    });

    it('should produce the same order for the same seed', () => {
      const cards = [A, B, C, D, E];
      const rng2 = new SeededRandom(42);
      const s1 = manager.shuffle(cards, rng);
      const s2 = manager.shuffle(cards, rng2);
      expect(s1.map(c => c.id)).toEqual(s2.map(c => c.id));
    });

    it('should handle an empty array', () => {
      expect(manager.shuffle([], rng)).toEqual([]);
    });

    it('should handle a single-card array', () => {
      expect(manager.shuffle([A], rng)).toEqual([A]);
    });
  });

  // ── drawCards ────────────────────────────────────────────────────────────

  describe('drawCards()', () => {
    it('should move the top N cards from deck to hand', () => {
      const state = makeState({ deck: [A, B, C, D, E] });
      const result = manager.drawCards(state, 3, rng);
      expect(result.hand.length).toBe(3);
      expect(result.deck.length).toBe(2);
    });

    it('should preserve existing hand cards', () => {
      const state = makeState({ deck: [A, B, C], hand: [D] });
      const result = manager.drawCards(state, 2, rng);
      expect(result.hand).toContain(D);
      expect(result.hand.length).toBe(3);
    });

    it('should reshuffle discard when deck runs out mid-draw', () => {
      const state = makeState({ deck: [A], discard: [B, C, D] });
      const result = manager.drawCards(state, 4, rng);
      expect(result.hand.length).toBe(4);
      expect(result.discard.length).toBe(0);
    });

    it('should stop drawing when both deck and discard are empty', () => {
      const state = makeState({ deck: [A, B] });
      const result = manager.drawCards(state, 10, rng);
      expect(result.hand.length).toBe(2);
    });

    it('should not mutate the original state', () => {
      const state = makeState({ deck: [A, B, C] });
      const deckBefore = [...state.deck];
      manager.drawCards(state, 2, rng);
      expect([...state.deck]).toEqual(deckBefore);
    });
  });

  // ── discardCard ──────────────────────────────────────────────────────────

  describe('discardCard()', () => {
    it('should move the card from hand to discard', () => {
      const state = makeState({ hand: [A, B, C] });
      const result = manager.discardCard(state, B);
      expect(result.hand).toEqual([A, C]);
      expect(result.discard).toContain(B);
    });

    it('should return unchanged state when card is not in hand', () => {
      const state = makeState({ hand: [A, B] });
      const result = manager.discardCard(state, C);
      expect(result).toEqual(state);
    });

    it('should only remove the first occurrence', () => {
      const state = makeState({ hand: [A, A, B] });
      const result = manager.discardCard(state, A);
      expect(result.hand.length).toBe(2);
      expect(result.discard.length).toBe(1);
    });
  });

  // ── exhaustCard ──────────────────────────────────────────────────────────

  describe('exhaustCard()', () => {
    it('should move the card from hand to exhaust', () => {
      const state = makeState({ hand: [A, B, C] });
      const result = manager.exhaustCard(state, B);
      expect(result.hand).toEqual([A, C]);
      expect(result.exhaust).toContain(B);
    });

    it('should not place the card in discard', () => {
      const state = makeState({ hand: [A, B] });
      const result = manager.exhaustCard(state, A);
      expect(result.discard.length).toBe(0);
    });

    it('should return unchanged state when card is not in hand', () => {
      const state = makeState({ hand: [A] });
      const result = manager.exhaustCard(state, C);
      expect(result).toEqual(state);
    });
  });

  // ── reshuffleDiscard ─────────────────────────────────────────────────────

  describe('reshuffleDiscard()', () => {
    it('should merge discard into deck and clear discard', () => {
      const state = makeState({ deck: [A], discard: [B, C] });
      const result = manager.reshuffleDiscard(state, rng);
      expect(result.deck.length).toBe(3);
      expect(result.discard.length).toBe(0);
    });

    it('should keep hand and exhaust unchanged', () => {
      const state = makeState({ hand: [D], exhaust: [E], deck: [A], discard: [B] });
      const result = manager.reshuffleDiscard(state, rng);
      expect(result.hand).toEqual([D]);
      expect(result.exhaust).toEqual([E]);
    });

    it('should work when discard is empty', () => {
      const state = makeState({ deck: [A, B] });
      const result = manager.reshuffleDiscard(state, rng);
      expect(result.deck.length).toBe(2);
      expect(result.discard.length).toBe(0);
    });
  });

  // ── addCard ──────────────────────────────────────────────────────────────

  describe('addCard()', () => {
    it('should append the card to the player deck', () => {
      const player = makePlayer({ deck: [A, B] });
      const result = manager.addCard(player, C);
      expect(result.deck).toContain(C);
      expect(result.deck.length).toBe(3);
    });

    it('should not mutate the original player', () => {
      const player = makePlayer({ deck: [A] });
      const before = [...player.deck];
      manager.addCard(player, B);
      expect([...player.deck]).toEqual(before);
    });

    it('should preserve all other player properties', () => {
      const player = makePlayer({ deck: [A] });
      const result = manager.addCard(player, B);
      expect(result.hp).toBe(player.hp);
      expect(result.gold).toBe(player.gold);
    });
  });

  // ── removeCard ───────────────────────────────────────────────────────────

  describe('removeCard()', () => {
    it('should remove the first occurrence of the card from the deck', () => {
      const player = makePlayer({ deck: [A, B, C] });
      const result = manager.removeCard(player, B);
      expect(result.deck).toEqual([A, C]);
    });

    it('should return unchanged player when card is not in deck', () => {
      const player = makePlayer({ deck: [A, B] });
      const result = manager.removeCard(player, C);
      expect(result).toEqual(player);
    });

    it('should only remove the first occurrence of a duplicate', () => {
      const player = makePlayer({ deck: [A, A, B] });
      const result = manager.removeCard(player, A);
      expect(result.deck.length).toBe(2);
    });
  });

  // ── upgradeCard ──────────────────────────────────────────────────────────

  describe('upgradeCard()', () => {
    it('should replace the card with the upgraded version', () => {
      const upgraded = { ...A, upgraded: true, name: 'A+' };
      const player = makePlayer({ deck: [A, B, C] });
      const result = manager.upgradeCard(player, A, upgraded);
      expect(result.deck[0]).toEqual(upgraded);
      expect(result.deck[1]).toBe(B);
      expect(result.deck[2]).toBe(C);
    });

    it('should return unchanged player when card is not found', () => {
      const upgraded = { ...C, upgraded: true };
      const player = makePlayer({ deck: [A, B] });
      const result = manager.upgradeCard(player, C, upgraded);
      expect(result).toEqual(player);
    });

    it('should only replace the first occurrence', () => {
      const upgraded = { ...A, upgraded: true };
      const player = makePlayer({ deck: [A, A, B] });
      const result = manager.upgradeCard(player, A, upgraded);
      expect(result.deck[0]).toEqual(upgraded);
      expect(result.deck[1]).toBe(A);
    });
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  describe('deckStateFromPlayer() / playerWithDeckState()', () => {
    it('should round-trip without data loss', () => {
      const player = makePlayer({ deck: [A], hand: [B], discard: [C], exhaust: [D] });
      const state = deckStateFromPlayer(player);
      const restored = playerWithDeckState(player, state);
      expect(restored.deck).toEqual(player.deck);
      expect(restored.hand).toEqual(player.hand);
      expect(restored.piles.discard).toEqual(player.piles.discard);
      expect(restored.piles.exhaust).toEqual(player.piles.exhaust);
      expect(restored.hp).toBe(player.hp);
    });
  });
});
