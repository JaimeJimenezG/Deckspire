import { Card } from '../models/card.model';
import { Player } from '../models/player.model';
import { SeededRandom } from './seeded-random';

/**
 * Snapshot of all card piles that DeckManager operates on.
 * Extracted from Player so each method receives and returns only what it needs,
 * keeping the API composable without coupling to the full Player shape.
 */
export interface DeckState {
  readonly deck: readonly Card[];
  readonly hand: readonly Card[];
  readonly discard: readonly Card[];
  readonly exhaust: readonly Card[];
}

/** Extracts the deck-relevant piles from a Player. */
export function deckStateFromPlayer(player: Player): DeckState {
  return {
    deck: player.deck,
    hand: player.hand,
    discard: player.piles.discard,
    exhaust: player.piles.exhaust,
  };
}

/** Merges updated piles back into a Player snapshot. */
export function playerWithDeckState(player: Player, state: DeckState): Player {
  return {
    ...player,
    deck: state.deck,
    hand: state.hand,
    piles: { ...player.piles, discard: state.discard, exhaust: state.exhaust },
  };
}

/**
 * Pure domain service that manages the four card piles:
 *   deck (draw pile) · hand · discard · exhaust
 *
 * Every method receives state and returns NEW state — nothing is mutated.
 */
export class DeckManager {
  /**
   * Shuffles an array of cards using the Fisher-Yates algorithm.
   * Returns a new array; the original is not mutated.
   */
  shuffle(cards: readonly Card[], rng: SeededRandom): Card[] {
    const result = [...cards];
    for (let i = result.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Draws up to `count` cards from the top of the deck into the hand.
   * If the deck runs out mid-draw, the discard pile is automatically shuffled
   * into a new deck before continuing (standard Slay the Spire rule).
   * Returns the new DeckState.
   */
  drawCards(state: DeckState, count: number, rng: SeededRandom): DeckState {
    let deck = [...state.deck];
    let discard = [...state.discard];
    const hand = [...state.hand];

    for (let i = 0; i < count; i++) {
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = this.shuffle(discard, rng);
        discard = [];
      }
      hand.push(deck.pop()!);
    }

    return { ...state, deck, hand, discard };
  }

  /**
   * Moves a card from the hand to the discard pile.
   * If the card is not in the hand the state is returned unchanged.
   */
  discardCard(state: DeckState, card: Card): DeckState {
    const idx = state.hand.indexOf(card);
    if (idx === -1) return state;

    const hand = [...state.hand.slice(0, idx), ...state.hand.slice(idx + 1)];
    const discard = [...state.discard, card];
    return { ...state, hand, discard };
  }

  /**
   * Moves a card from the hand to the exhaust pile (removed from the combat cycle).
   * If the card is not in the hand the state is returned unchanged.
   */
  exhaustCard(state: DeckState, card: Card): DeckState {
    const idx = state.hand.indexOf(card);
    if (idx === -1) return state;

    const hand = [...state.hand.slice(0, idx), ...state.hand.slice(idx + 1)];
    const exhaust = [...state.exhaust, card];
    return { ...state, hand, exhaust };
  }

  /**
   * Shuffles the entire discard pile into the draw deck.
   * The existing deck cards remain and the discard pile becomes empty.
   * Typically used at the end of combat setup or by card effects.
   */
  reshuffleDiscard(state: DeckState, rng: SeededRandom): DeckState {
    const combined = [...state.deck, ...state.discard];
    const deck = this.shuffle(combined, rng);
    return { ...state, deck, discard: [] };
  }

  // ── Mazo completo (fuera del combate) ────────────────────────────────────

  /**
   * Adds a card to the player's permanent deck.
   * Returns a new Player with the card appended to `deck`.
   */
  addCard(player: Player, card: Card): Player {
    return { ...player, deck: [...player.deck, card] };
  }

  /**
   * Removes the first occurrence of `card` from the player's permanent deck.
   * Returns the Player unchanged if the card is not found.
   */
  removeCard(player: Player, card: Card): Player {
    const idx = player.deck.indexOf(card);
    if (idx === -1) return player;

    const deck = [
      ...player.deck.slice(0, idx),
      ...player.deck.slice(idx + 1),
    ];
    return { ...player, deck };
  }

  /**
   * Replaces the first occurrence of `card` in the player's permanent deck
   * with `upgradedCard`. Returns the Player unchanged if `card` is not found.
   */
  upgradeCard(player: Player, card: Card, upgradedCard: Card): Player {
    const idx = player.deck.indexOf(card);
    if (idx === -1) return player;

    const deck = [
      ...player.deck.slice(0, idx),
      upgradedCard,
      ...player.deck.slice(idx + 1),
    ];
    return { ...player, deck };
  }
}
