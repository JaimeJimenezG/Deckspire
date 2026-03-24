import { Card } from '../models/card.model';
import { Player } from '../models/player.model';
import { ShopState } from '../models/shop.model';
import { SeededRandom } from './seeded-random';
import { ShopManager } from './shop-manager';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'strike',
    name: 'Strike',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    description: 'Deal 6 damage.',
    upgraded: false,
    effects: [{ type: 'damage', value: 6 }],
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 80,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 200,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

const CARD_POOL: readonly Card[] = [
  makeCard({ id: 'strike',    name: 'Strike',    rarity: 'common' }),
  makeCard({ id: 'defend',    name: 'Defend',    rarity: 'common',   type: 'skill' }),
  makeCard({ id: 'bash',      name: 'Bash',      rarity: 'uncommon', effects: [{ type: 'damage', value: 8 }] }),
  makeCard({ id: 'clothesline', name: 'Clothesline', rarity: 'uncommon', effects: [{ type: 'damage', value: 12 }] }),
  makeCard({ id: 'feed',      name: 'Feed',      rarity: 'rare',     effects: [{ type: 'damage', value: 10 }] }),
  makeCard({ id: 'reaper',    name: 'Reaper',    rarity: 'rare',     effects: [{ type: 'damage', value: 4 }] }),
];

const RELIC_POOL = ['burning-blood', 'cracked-core', 'pure-water', 'vajra'];

const SEED = 42;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShopManager', () => {
  let manager: ShopManager;
  let rng: SeededRandom;

  beforeEach(() => {
    manager = new ShopManager();
    rng = new SeededRandom(SEED);
  });

  // ── generateOfferings ─────────────────────────────────────────────────────

  describe('generateOfferings()', () => {
    it('should generate exactly 3 card items and up to 2 relic items', () => {
      const shop = manager.generateOfferings(CARD_POOL, RELIC_POOL, [], rng);
      const cards = shop.items.filter(i => i.type === 'card');
      const relics = shop.items.filter(i => i.type === 'relic');

      expect(cards.length).toBe(3);
      expect(relics.length).toBeLessThanOrEqual(2);
    });

    it('should set purgePrice to 75 and purgeCount to 0 initially', () => {
      const shop = manager.generateOfferings(CARD_POOL, RELIC_POOL, [], rng);
      expect(shop.purgePrice).toBe(75);
      expect(shop.purgeCount).toBe(0);
    });

    it('should mark all items as not sold', () => {
      const shop = manager.generateOfferings(CARD_POOL, RELIC_POOL, [], rng);
      expect(shop.items.every(i => !i.sold)).toBeTrue();
    });

    it('should not include basic cards in offerings', () => {
      const poolWithBasic: readonly Card[] = [
        ...CARD_POOL,
        makeCard({ id: 'basic-strike', rarity: 'basic' }),
      ];
      const shop = manager.generateOfferings(poolWithBasic, RELIC_POOL, [], rng);
      const cardItems = shop.items.filter(i => i.type === 'card');
      expect(cardItems.every(i => i.card?.rarity !== 'basic')).toBeTrue();
    });

    it('should not include relics already owned by the player', () => {
      const owned = ['burning-blood', 'cracked-core'];
      const shop = manager.generateOfferings(CARD_POOL, RELIC_POOL, owned, rng);
      const relicItems = shop.items.filter(i => i.type === 'relic');
      expect(relicItems.every(i => !owned.includes(i.relicId!))).toBeTrue();
    });

    it('should produce deterministic results with the same seed', () => {
      const rng1 = new SeededRandom(SEED);
      const rng2 = new SeededRandom(SEED);
      const shop1 = manager.generateOfferings(CARD_POOL, RELIC_POOL, [], rng1);
      const shop2 = manager.generateOfferings(CARD_POOL, RELIC_POOL, [], rng2);

      expect(shop1.items.map(i => i.id)).toEqual(shop2.items.map(i => i.id));
      expect(shop1.items.map(i => i.price)).toEqual(shop2.items.map(i => i.price));
    });

    it('should not repeat the same card twice in the shop', () => {
      const shop = manager.generateOfferings(CARD_POOL, RELIC_POOL, [], rng);
      const cardIds = shop.items.filter(i => i.type === 'card').map(i => i.card!.id);
      const uniqueIds = new Set(cardIds);
      expect(uniqueIds.size).toBe(cardIds.length);
    });

    it('should handle a card pool smaller than SHOP_CARD_SLOTS gracefully', () => {
      const smallPool: readonly Card[] = [makeCard({ id: 'only-card', rarity: 'common' })];
      const shop = manager.generateOfferings(smallPool, [], [], rng);
      const cards = shop.items.filter(i => i.type === 'card');
      expect(cards.length).toBeLessThanOrEqual(1);
    });
  });

  // ── calculatePrice ────────────────────────────────────────────────────────

  describe('calculatePrice()', () => {
    it('should return 0 for basic cards', () => {
      const basicCard = makeCard({ rarity: 'basic' });
      expect(manager.calculatePrice(basicCard, rng)).toBe(0);
    });

    it('should return a price within the common range [45, 55]', () => {
      const commonCard = makeCard({ rarity: 'common' });
      // Test across multiple RNG calls to verify bounds
      for (let i = 0; i < 20; i++) {
        const price = manager.calculatePrice(commonCard, new SeededRandom(i));
        expect(price).toBeGreaterThanOrEqual(45);
        expect(price).toBeLessThanOrEqual(55);
      }
    });

    it('should return a price within the uncommon range [68, 82]', () => {
      const uncommonCard = makeCard({ rarity: 'uncommon' });
      for (let i = 0; i < 20; i++) {
        const price = manager.calculatePrice(uncommonCard, new SeededRandom(i));
        expect(price).toBeGreaterThanOrEqual(68);
        expect(price).toBeLessThanOrEqual(82);
      }
    });

    it('should return a price within the rare range [135, 165]', () => {
      const rareCard = makeCard({ rarity: 'rare' });
      for (let i = 0; i < 20; i++) {
        const price = manager.calculatePrice(rareCard, new SeededRandom(i));
        expect(price).toBeGreaterThanOrEqual(135);
        expect(price).toBeLessThanOrEqual(165);
      }
    });
  });

  // ── purchaseCard ──────────────────────────────────────────────────────────

  describe('purchaseCard()', () => {
    let shop: ShopState;
    let player: Player;

    beforeEach(() => {
      shop = manager.generateOfferings(CARD_POOL, RELIC_POOL, [], new SeededRandom(SEED));
      player = makePlayer({ gold: 200 });
    });

    it('should deduct the item price from player gold', () => {
      const item = shop.items.find(i => i.type === 'card')!;
      const result = manager.purchaseCard(item.id, shop, player);
      expect(result.player.gold).toBe(player.gold - item.price);
    });

    it('should add the purchased card to the player deck', () => {
      const item = shop.items.find(i => i.type === 'card')!;
      const result = manager.purchaseCard(item.id, shop, player);
      expect(result.player.deck).toContain(item.card as Card);
    });

    it('should mark the item as sold in the returned shop', () => {
      const item = shop.items.find(i => i.type === 'card')!;
      const result = manager.purchaseCard(item.id, shop, player);
      const updatedItem = result.shop.items.find(i => i.id === item.id)!;
      expect(updatedItem.sold).toBeTrue();
    });

    it('should not mutate the original shop or player', () => {
      const item = shop.items.find(i => i.type === 'card')!;
      const originalGold = player.gold;
      const originalDeckLen = player.deck.length;
      const originalSoldState = item.sold;

      manager.purchaseCard(item.id, shop, player);

      expect(player.gold).toBe(originalGold);
      expect(player.deck.length).toBe(originalDeckLen);
      expect(item.sold).toBe(originalSoldState);
    });

    it('should throw if the item ID does not exist', () => {
      expect(() => manager.purchaseCard('nonexistent', shop, player)).toThrowError(
        /not found/i,
      );
    });

    it('should throw if the item is already sold', () => {
      const item = shop.items.find(i => i.type === 'card')!;
      const { shop: shopAfterBuy } = manager.purchaseCard(item.id, shop, player);
      expect(() => manager.purchaseCard(item.id, shopAfterBuy, player)).toThrowError(
        /already sold/i,
      );
    });

    it('should throw if the player does not have enough gold', () => {
      const item = shop.items.find(i => i.type === 'card')!;
      const poorPlayer = makePlayer({ gold: 1 });
      expect(() => manager.purchaseCard(item.id, shop, poorPlayer)).toThrowError(
        /not enough gold/i,
      );
    });

    it('should throw when trying to purchase a relic item via purchaseCard', () => {
      const relicItem = shop.items.find(i => i.type === 'relic');
      if (!relicItem) return; // pool may be empty in edge cases
      expect(() => manager.purchaseCard(relicItem.id, shop, player)).toThrowError(
        /not a card/i,
      );
    });
  });

  // ── removeCardFromDeck ────────────────────────────────────────────────────

  describe('removeCardFromDeck()', () => {
    let shop: ShopState;
    let player: Player;

    beforeEach(() => {
      shop = manager.generateOfferings(CARD_POOL, RELIC_POOL, [], new SeededRandom(SEED));
      player = makePlayer({
        gold: 200,
        deck: [
          makeCard({ id: 'strike' }),
          makeCard({ id: 'defend', type: 'skill' }),
          makeCard({ id: 'bash', rarity: 'uncommon' }),
        ],
      });
    });

    it('should remove the card at the given index from the deck', () => {
      const { player: updatedPlayer } = manager.removeCardFromDeck(1, player, shop);
      expect(updatedPlayer.deck.length).toBe(2);
      expect(updatedPlayer.deck.find(c => c.id === 'defend')).toBeUndefined();
    });

    it('should deduct purgePrice from player gold', () => {
      const { player: updatedPlayer } = manager.removeCardFromDeck(0, player, shop);
      expect(updatedPlayer.gold).toBe(player.gold - shop.purgePrice);
    });

    it('should increment purgePrice by 25 after each use', () => {
      const { shop: shopAfter } = manager.removeCardFromDeck(0, player, shop);
      expect(shopAfter.purgePrice).toBe(shop.purgePrice + 25);
    });

    it('should increment purgeCount after each use', () => {
      const { shop: shopAfter } = manager.removeCardFromDeck(0, player, shop);
      expect(shopAfter.purgeCount).toBe(1);
    });

    it('should stack purge price increases over multiple purges', () => {
      const deckWithTwo: readonly Card[] = [
        makeCard({ id: 'card-a' }),
        makeCard({ id: 'card-b' }),
      ];
      const richPlayer = makePlayer({ gold: 999, deck: deckWithTwo });
      const { shop: shop1, player: p1 } = manager.removeCardFromDeck(0, richPlayer, shop);
      const { shop: shop2 } = manager.removeCardFromDeck(0, p1, shop1);
      expect(shop2.purgePrice).toBe(shop.purgePrice + 50);
      expect(shop2.purgeCount).toBe(2);
    });

    it('should not mutate the original player or shop', () => {
      const originalGold = player.gold;
      const originalDeckLen = player.deck.length;
      const originalPurgePrice = shop.purgePrice;

      manager.removeCardFromDeck(0, player, shop);

      expect(player.gold).toBe(originalGold);
      expect(player.deck.length).toBe(originalDeckLen);
      expect(shop.purgePrice).toBe(originalPurgePrice);
    });

    it('should throw for a negative card index', () => {
      expect(() => manager.removeCardFromDeck(-1, player, shop)).toThrowError(
        /invalid card index/i,
      );
    });

    it('should throw for an out-of-bounds card index', () => {
      expect(() => manager.removeCardFromDeck(99, player, shop)).toThrowError(
        /invalid card index/i,
      );
    });

    it('should throw if the player does not have enough gold', () => {
      const poorPlayer = makePlayer({ gold: 10, deck: player.deck });
      expect(() => manager.removeCardFromDeck(0, poorPlayer, shop)).toThrowError(
        /not enough gold/i,
      );
    });
  });
});
