import type { Card } from '../../domain/models/card.model';
import type { GameState } from '../../domain/models/game-state.model';
import type { Player } from '../../domain/models/player.model';
import {
  buildUpgradedCard,
  CardAlreadyUpgradedError,
  InvalidCardIndexError,
  NotAtRestSiteError,
  RestUseCaseImpl,
} from './rest.usecase';

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
    hp: 60,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 100,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'rest',
    gameOutcome: null,
    player: makePlayer(),
    combat: null,
    map: null,
    deck: [
      makeCard({ id: 'strike' }),
      makeCard({ id: 'defend', type: 'skill', effects: [{ type: 'block', value: 5 }] }),
    ],
    gold: 100,
    floor: 8,
    act: 1,
    seed: 42,
    relics: [],
    shop: null,
    reward: null,
    event: null,
    pendingBossRelics: 0,
    ...overrides,
  } as GameState;
}

// ---------------------------------------------------------------------------
// Tests: buildUpgradedCard helper
// ---------------------------------------------------------------------------

describe('buildUpgradedCard()', () => {
  it('should set upgraded to true', () => {
    const card = makeCard();
    const result = buildUpgradedCard(card);
    expect(result.upgraded).toBeTrue();
  });

  it('should increase damage effect value by 3', () => {
    const card = makeCard({ effects: [{ type: 'damage', value: 6 }] });
    const result = buildUpgradedCard(card);
    const dmg = result.effects.find(e => e.type === 'damage') as { type: 'damage'; value: number };
    expect(dmg.value).toBe(9);
  });

  it('should increase block effect value by 3', () => {
    const card = makeCard({ effects: [{ type: 'block', value: 5 }] });
    const result = buildUpgradedCard(card);
    const blk = result.effects.find(e => e.type === 'block') as { type: 'block'; value: number };
    expect(blk.value).toBe(8);
  });

  it('should increase draw effect value by 1', () => {
    const card = makeCard({ effects: [{ type: 'draw', value: 2 }] });
    const result = buildUpgradedCard(card);
    const draw = result.effects.find(e => e.type === 'draw') as { type: 'draw'; value: number };
    expect(draw.value).toBe(3);
  });

  it('should increase apply-status stacks by 1', () => {
    const card = makeCard({
      effects: [{ type: 'apply-status', target: 'targeted-enemy', status: 'vulnerable', stacks: 2 }],
    });
    const result = buildUpgradedCard(card);
    const status = result.effects.find(e => e.type === 'apply-status') as {
      type: 'apply-status';
      stacks: number;
    };
    expect(status.stacks).toBe(3);
  });

  it('should leave exhaust-self effects unchanged', () => {
    const card = makeCard({ effects: [{ type: 'exhaust-self' }] });
    const result = buildUpgradedCard(card);
    expect(result.effects.find(e => e.type === 'exhaust-self')).toBeDefined();
  });

  it('should leave gain-energy effects unchanged', () => {
    const card = makeCard({ effects: [{ type: 'gain-energy', value: 2 }] });
    const result = buildUpgradedCard(card);
    const e = result.effects.find(ef => ef.type === 'gain-energy') as { type: 'gain-energy'; value: number };
    expect(e.value).toBe(2);
  });

  it('should not mutate the original card', () => {
    const card = makeCard({ effects: [{ type: 'damage', value: 6 }] });
    buildUpgradedCard(card);
    const dmg = card.effects.find(e => e.type === 'damage') as { type: 'damage'; value: number };
    expect(dmg.value).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Tests: RestUseCaseImpl
// ---------------------------------------------------------------------------

describe('RestUseCaseImpl', () => {
  let useCase: RestUseCaseImpl;

  beforeEach(() => {
    useCase = new RestUseCaseImpl();
  });

  // ── rest ──────────────────────────────────────────────────────────────────

  describe('rest()', () => {
    it('should heal the player by 30% of maxHp (floor)', async () => {
      // maxHp=80 → 30% = 24 → 60+24=84 → capped at 80
      const state = makeState({ player: makePlayer({ hp: 60, maxHp: 80 }) });
      const result = await useCase.rest(state);
      // 80*0.3 = 24, 60+24=84 → capped at 80
      expect(result.player.hp).toBe(80);
    });

    it('should not exceed maxHp when healing', async () => {
      const state = makeState({ player: makePlayer({ hp: 78, maxHp: 80 }) });
      const result = await useCase.rest(state);
      expect(result.player.hp).toBeLessThanOrEqual(80);
      expect(result.player.hp).toBe(80);
    });

    it('should heal exactly floor(maxHp * 0.3) when far below maxHp', async () => {
      // maxHp=80 → heal=24. Player at 10hp → 34hp
      const state = makeState({ player: makePlayer({ hp: 10, maxHp: 80 }) });
      const result = await useCase.rest(state);
      expect(result.player.hp).toBe(34);
    });

    it('should truncate fractional heal with Math.floor', async () => {
      // maxHp=100 → 30% = 30. Player at 50 → 80
      const state = makeState({ player: makePlayer({ hp: 50, maxHp: 100 }) });
      const result = await useCase.rest(state);
      expect(result.player.hp).toBe(80);
    });

    it('should floor a fractional heal value', async () => {
      // maxHp=7 → 30% = 2.1 → floor = 2. Player at 3 → 5
      const state = makeState({ player: makePlayer({ hp: 3, maxHp: 7 }) });
      const result = await useCase.rest(state);
      expect(result.player.hp).toBe(5);
    });

    it('should throw NotAtRestSiteError when phase is not rest', async () => {
      const state = makeState({ phase: 'map' });
      await expectAsync(useCase.rest(state)).toBeRejectedWithError(NotAtRestSiteError);
    });

    it('should not mutate the original state', async () => {
      const state = makeState({ player: makePlayer({ hp: 40, maxHp: 80 }) });
      const originalHp = state.player.hp;
      await useCase.rest(state);
      expect(state.player.hp).toBe(originalHp);
    });
  });

  // ── smith ─────────────────────────────────────────────────────────────────

  describe('smith()', () => {
    it('should replace the card at the given index with its upgraded version', async () => {
      const state = makeState();
      const result = await useCase.smith(0, state); // upgrade 'strike'

      expect(result.deck[0].upgraded).toBeTrue();
      expect(result.deck[0].id).toBe('strike');
    });

    it('should preserve all other cards in the deck', async () => {
      const state = makeState();
      const result = await useCase.smith(0, state);

      expect(result.deck.length).toBe(state.deck.length);
      expect(result.deck[1]).toEqual(state.deck[1]);
    });

    it('should upgrade the card at the correct index', async () => {
      const state = makeState();
      const result = await useCase.smith(1, state); // upgrade 'defend' (index 1)

      expect(result.deck[0]).toEqual(state.deck[0]); // strike unchanged
      expect(result.deck[1].upgraded).toBeTrue();
      expect(result.deck[1].id).toBe('defend');
    });

    it('should increase damage value when upgrading an attack card', async () => {
      const state = makeState(); // deck[0] is strike with damage 6
      const result = await useCase.smith(0, state);

      const dmg = result.deck[0].effects.find(e => e.type === 'damage') as { type: 'damage'; value: number };
      expect(dmg.value).toBe(9);
    });

    it('should increase block value when upgrading a skill card', async () => {
      const state = makeState(); // deck[1] is defend with block 5
      const result = await useCase.smith(1, state);

      const blk = result.deck[1].effects.find(e => e.type === 'block') as { type: 'block'; value: number };
      expect(blk.value).toBe(8);
    });

    it('should throw CardAlreadyUpgradedError when the card is already upgraded', async () => {
      const state = makeState({
        deck: [makeCard({ upgraded: true }), makeCard({ id: 'defend', type: 'skill' })],
      });

      await expectAsync(useCase.smith(0, state)).toBeRejectedWithError(CardAlreadyUpgradedError);
    });

    it('should throw InvalidCardIndexError for negative index', async () => {
      const state = makeState();
      await expectAsync(useCase.smith(-1, state)).toBeRejectedWithError(InvalidCardIndexError);
    });

    it('should throw InvalidCardIndexError for out-of-bounds index', async () => {
      const state = makeState();
      await expectAsync(useCase.smith(99, state)).toBeRejectedWithError(InvalidCardIndexError);
    });

    it('should throw NotAtRestSiteError when phase is not rest', async () => {
      const state = makeState({ phase: 'shop' });
      await expectAsync(useCase.smith(0, state)).toBeRejectedWithError(NotAtRestSiteError);
    });

    it('should not mutate the original state or deck', async () => {
      const state = makeState();
      const originalCard = state.deck[0];
      const originalUpgraded = originalCard.upgraded;

      await useCase.smith(0, state);

      expect(state.deck[0].upgraded).toBe(originalUpgraded);
    });
  });
});
