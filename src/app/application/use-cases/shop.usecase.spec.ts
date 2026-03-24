import type { Card } from '../../domain/models/card.model';
import type { GameState } from '../../domain/models/game-state.model';
import type { Player } from '../../domain/models/player.model';
import type { ShopItem, ShopState } from '../../domain/models/shop.model';
import { ShopManager } from '../../domain/services/shop-manager';
import {
  InsufficientGoldError,
  ItemNotARelicError,
  NotInShopPhaseError,
  RelicAlreadySoldError,
  RelicItemNotFoundError,
  ShopNotAvailableError,
  ShopUseCaseImpl,
} from './shop.usecase';

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

function makeShopItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'card-0',
    type: 'card',
    card: makeCard(),
    price: 50,
    sold: false,
    ...overrides,
  };
}

function makeShopState(overrides: Partial<ShopState> = {}): ShopState {
  return {
    items: [
      makeShopItem({ id: 'card-0', type: 'card', card: makeCard({ id: 'bash', rarity: 'uncommon' }), price: 75 }),
      makeShopItem({ id: 'relic-0', type: 'relic', card: undefined, relicId: 'burning-blood', price: 143 }),
    ],
    purgePrice: 75,
    purgeCount: 0,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'shop',
    gameOutcome: null,
    player: makePlayer({ gold: 200 }),
    combat: null,
    map: null,
    deck: [makeCard({ id: 'strike' }), makeCard({ id: 'defend', type: 'skill' })],
    gold: 200,
    floor: 3,
    act: 1,
    seed: 42,
    relics: [],
    shop: makeShopState(),
    reward: null,
    event: null,
    pendingBossRelics: 0,
    ...overrides,
  } as GameState;
}

// ---------------------------------------------------------------------------
// Tests: ShopUseCaseImpl
// ---------------------------------------------------------------------------

describe('ShopUseCaseImpl', () => {
  let useCase: ShopUseCaseImpl;
  let shopManager: jasmine.SpyObj<ShopManager>;

  beforeEach(() => {
    shopManager = jasmine.createSpyObj<ShopManager>('ShopManager', [
      'purchaseCard',
      'removeCardFromDeck',
    ]);
    useCase = new ShopUseCaseImpl(shopManager);
  });

  // ── buyCard ──────────────────────────────────────────────────────────────

  describe('buyCard()', () => {
    it('should delegate to ShopManager.purchaseCard with state.gold and state.deck as canonical sources', async () => {
      const state = makeState();
      const boughtCard = makeCard({ id: 'bash', rarity: 'uncommon' });
      const updatedShop: ShopState = { ...state.shop!, items: state.shop!.items.map(i => i.id === 'card-0' ? { ...i, sold: true } : i) };

      shopManager.purchaseCard.and.returnValue({
        player: { ...state.player, gold: 125, deck: [...state.deck, boughtCard] },
        shop: updatedShop,
      });

      const result = await useCase.buyCard('card-0', state);

      expect(shopManager.purchaseCard).toHaveBeenCalledOnceWith(
        'card-0',
        state.shop!,
        jasmine.objectContaining({ gold: state.gold, deck: state.deck }),
      );
      expect(result.gold).toBe(125);
      expect(result.deck).toContain(boughtCard);
      expect(result.shop).toEqual(updatedShop);
    });

    it('should keep state.player.gold in sync with state.gold after purchase', async () => {
      const state = makeState();
      shopManager.purchaseCard.and.returnValue({
        player: { ...state.player, gold: 125, deck: [...state.deck] },
        shop: state.shop!,
      });

      const result = await useCase.buyCard('card-0', state);

      expect(result.player.gold).toBe(125);
    });

    it('should throw NotInShopPhaseError when phase is not shop', async () => {
      const state = makeState({ phase: 'map' });

      await expectAsync(useCase.buyCard('card-0', state)).toBeRejectedWithError(NotInShopPhaseError);
    });

    it('should throw ShopNotAvailableError when shop is null', async () => {
      const state = makeState({ shop: null });

      await expectAsync(useCase.buyCard('card-0', state)).toBeRejectedWithError(ShopNotAvailableError);
    });

    it('should propagate errors thrown by ShopManager', async () => {
      const state = makeState();
      shopManager.purchaseCard.and.throwError('Item not found');

      await expectAsync(useCase.buyCard('nonexistent', state)).toBeRejected();
    });

    it('should not mutate the original state', async () => {
      const state = makeState();
      const originalGold = state.gold;
      const originalDeckLen = state.deck.length;

      shopManager.purchaseCard.and.returnValue({
        player: { ...state.player, gold: 125, deck: [...state.deck, makeCard({ id: 'new' })] },
        shop: state.shop!,
      });

      await useCase.buyCard('card-0', state);

      expect(state.gold).toBe(originalGold);
      expect(state.deck.length).toBe(originalDeckLen);
    });
  });

  // ── purgeCard ──────────────────────────────────────────────────────────────

  describe('purgeCard()', () => {
    it('should delegate to ShopManager.removeCardFromDeck with state.deck as canonical source', async () => {
      const state = makeState();
      const deckAfterPurge = [state.deck[1]]; // removed index 0
      const updatedShop: ShopState = { ...state.shop!, purgePrice: 100, purgeCount: 1 };

      shopManager.removeCardFromDeck.and.returnValue({
        player: { ...state.player, gold: 125, deck: deckAfterPurge },
        shop: updatedShop,
      });

      const result = await useCase.purgeCard(0, state);

      expect(shopManager.removeCardFromDeck).toHaveBeenCalledOnceWith(
        0,
        jasmine.objectContaining({ gold: state.gold, deck: state.deck }),
        state.shop!,
      );
      expect(result.gold).toBe(125);
      expect(result.deck).toEqual(deckAfterPurge);
      expect(result.shop).toEqual(updatedShop);
    });

    it('should throw NotInShopPhaseError when phase is not shop', async () => {
      const state = makeState({ phase: 'rest' });

      await expectAsync(useCase.purgeCard(0, state)).toBeRejectedWithError(NotInShopPhaseError);
    });

    it('should throw ShopNotAvailableError when shop is null', async () => {
      const state = makeState({ shop: null });

      await expectAsync(useCase.purgeCard(0, state)).toBeRejectedWithError(ShopNotAvailableError);
    });

    it('should propagate errors thrown by ShopManager', async () => {
      const state = makeState();
      shopManager.removeCardFromDeck.and.throwError('Not enough gold');

      await expectAsync(useCase.purgeCard(0, state)).toBeRejected();
    });
  });

  // ── buyRelic ──────────────────────────────────────────────────────────────

  describe('buyRelic()', () => {
    it('should add the relicId to state.relics and deduct gold', async () => {
      const state = makeState(); // shop has relic-0: burning-blood at 143 gold

      const result = await useCase.buyRelic('relic-0', state);

      expect(result.relics).toContain('burning-blood');
      expect(result.gold).toBe(200 - 143);
      expect(result.player.gold).toBe(200 - 143);
    });

    it('should mark the relic item as sold in the shop', async () => {
      const state = makeState();

      const result = await useCase.buyRelic('relic-0', state);

      const item = result.shop!.items.find(i => i.id === 'relic-0');
      expect(item?.sold).toBeTrue();
    });

    it('should not alter other shop items when buying a relic', async () => {
      const state = makeState();

      const result = await useCase.buyRelic('relic-0', state);

      const cardItem = result.shop!.items.find(i => i.id === 'card-0');
      expect(cardItem?.sold).toBeFalse();
    });

    it('should throw NotInShopPhaseError when phase is not shop', async () => {
      const state = makeState({ phase: 'map' });

      await expectAsync(useCase.buyRelic('relic-0', state)).toBeRejectedWithError(NotInShopPhaseError);
    });

    it('should throw ShopNotAvailableError when shop is null', async () => {
      const state = makeState({ shop: null });

      await expectAsync(useCase.buyRelic('relic-0', state)).toBeRejectedWithError(ShopNotAvailableError);
    });

    it('should throw RelicItemNotFoundError for unknown itemId', async () => {
      const state = makeState();

      await expectAsync(useCase.buyRelic('relic-99', state)).toBeRejectedWithError(RelicItemNotFoundError);
    });

    it('should throw ItemNotARelicError when buying a card item via buyRelic', async () => {
      const state = makeState();

      await expectAsync(useCase.buyRelic('card-0', state)).toBeRejectedWithError(ItemNotARelicError);
    });

    it('should throw RelicAlreadySoldError when relic is already sold', async () => {
      const soldShop = makeShopState({
        items: [
          makeShopItem({ id: 'card-0' }),
          makeShopItem({ id: 'relic-0', type: 'relic', card: undefined, relicId: 'burning-blood', price: 143, sold: true }),
        ],
      });
      const state = makeState({ shop: soldShop });

      await expectAsync(useCase.buyRelic('relic-0', state)).toBeRejectedWithError(RelicAlreadySoldError);
    });

    it('should throw InsufficientGoldError when player cannot afford the relic', async () => {
      const state = makeState({ gold: 10, player: makePlayer({ gold: 10 }) });

      await expectAsync(useCase.buyRelic('relic-0', state)).toBeRejectedWithError(InsufficientGoldError);
    });

    it('should not mutate the original state', async () => {
      const state = makeState();
      const originalRelics = [...state.relics];
      const originalGold = state.gold;

      await useCase.buyRelic('relic-0', state);

      expect(state.relics).toEqual(originalRelics);
      expect(state.gold).toBe(originalGold);
    });
  });
});
