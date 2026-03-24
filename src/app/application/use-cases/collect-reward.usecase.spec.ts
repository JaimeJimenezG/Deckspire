import type { Card } from '../../domain/models/card.model';
import type { GameState } from '../../domain/models/game-state.model';
import type { Player } from '../../domain/models/player.model';
import type { RewardState } from '../../domain/models/reward.model';
import {
  CardNotInRewardOptionsError,
  CollectRewardUseCaseImpl,
  NotInRewardPhaseError,
} from './collect-reward.usecase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCard = (id: string): Card => ({
  id,
  name: id,
  type: 'attack',
  rarity: 'common',
  cost: 1,
  description: '',
  upgraded: false,
  effects: [],
});

const STRIKE = makeCard('strike');
const DEFEND = makeCard('defend');
const BASH   = makeCard('bash');

const makePlayer = (gold = 50): Player => ({
  hp: 80,
  maxHp: 80,
  block: 0,
  energy: 3,
  maxEnergy: 3,
  gold,
  deck: [STRIKE, DEFEND],
  hand: [],
  piles: { discard: [], exhaust: [] },
  statusEffects: [],
});

const makeRewardState = (gold = 20, cardOptions: Card[] = [BASH]): RewardState => ({
  cardOptions,
  gold,
});

const makeState = (overrides: Partial<GameState> = {}): GameState => ({
  phase: 'reward',
  gameOutcome: null,
  player: makePlayer(),
  combat: null,
  map: null,
  deck: [STRIKE, DEFEND],
  gold: 0,
  floor: 1,
  act: 1,
  seed: 42,
  relics: [],
  shop: null,
  reward: makeRewardState(),
  event: null,
  pendingBossRelics: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectRewardUseCaseImpl', () => {
  let useCase: CollectRewardUseCaseImpl;

  beforeEach(() => {
    useCase = new CollectRewardUseCaseImpl();
  });

  // ── pickCard ─────────────────────────────────────────────────────────────

  describe('pickCard', () => {
    it('should add the chosen card to the master deck', async () => {
      const state = makeState();
      const result = await useCase.pickCard(BASH, state);

      expect(result.deck).toContain(BASH);
      expect(result.deck.length).toBe(state.deck.length + 1);
    });

    it('should preserve the existing cards in the deck', async () => {
      const state = makeState();
      const result = await useCase.pickCard(BASH, state);

      expect(result.deck).toContain(STRIKE);
      expect(result.deck).toContain(DEFEND);
    });

    it('should add the reward gold to the player wallet', async () => {
      const state = makeState({ player: makePlayer(50), reward: makeRewardState(20) });
      const result = await useCase.pickCard(BASH, state);

      expect(result.player.gold).toBe(70);
    });

    it('should transition the phase to map', async () => {
      const result = await useCase.pickCard(BASH, makeState());

      expect(result.phase).toBe('map');
    });

    it('should clear the reward state after picking', async () => {
      const result = await useCase.pickCard(BASH, makeState());

      expect(result.reward).toBeNull();
    });

    it('should work when multiple cards are offered and any is chosen', async () => {
      const extra = makeCard('extra');
      const state = makeState({ reward: makeRewardState(10, [BASH, extra]) });

      const result = await useCase.pickCard(extra, state);

      expect(result.deck).toContain(extra);
      expect(result.deck).not.toContain(BASH);
    });

    it('should throw NotInRewardPhaseError when phase is not reward', async () => {
      const state = makeState({ phase: 'map' });

      await expectAsync(useCase.pickCard(BASH, state))
        .toBeRejectedWithError(NotInRewardPhaseError);
    });

    it('should throw NotInRewardPhaseError when reward state is null', async () => {
      const state = makeState({ reward: null });

      await expectAsync(useCase.pickCard(BASH, state))
        .toBeRejectedWithError(NotInRewardPhaseError);
    });

    it('should throw CardNotInRewardOptionsError when card was not offered', async () => {
      const notOffered = makeCard('not-offered');
      const state = makeState();

      await expectAsync(useCase.pickCard(notOffered, state))
        .toBeRejectedWithError(CardNotInRewardOptionsError);
    });

    it('should not mutate the original state', async () => {
      const state = makeState();
      const originalDeckLength = state.deck.length;
      const originalGold = state.player.gold;

      await useCase.pickCard(BASH, state);

      expect(state.deck.length).toBe(originalDeckLength);
      expect(state.player.gold).toBe(originalGold);
      expect(state.reward).not.toBeNull();
    });
  });

  // ── skip ─────────────────────────────────────────────────────────────────

  describe('skip', () => {
    it('should not add any card to the deck', async () => {
      const state = makeState();
      const result = await useCase.skip(state);

      expect(result.deck.length).toBe(state.deck.length);
      expect(result.deck).not.toContain(BASH);
    });

    it('should still add the reward gold to the player wallet', async () => {
      const state = makeState({ player: makePlayer(100), reward: makeRewardState(30) });
      const result = await useCase.skip(state);

      expect(result.player.gold).toBe(130);
    });

    it('should transition the phase to map', async () => {
      const result = await useCase.skip(makeState());

      expect(result.phase).toBe('map');
    });

    it('should clear the reward state after skipping', async () => {
      const result = await useCase.skip(makeState());

      expect(result.reward).toBeNull();
    });

    it('should throw NotInRewardPhaseError when phase is not reward', async () => {
      const state = makeState({ phase: 'combat' });

      await expectAsync(useCase.skip(state))
        .toBeRejectedWithError(NotInRewardPhaseError);
    });

    it('should throw NotInRewardPhaseError when reward state is null', async () => {
      const state = makeState({ reward: null });

      await expectAsync(useCase.skip(state))
        .toBeRejectedWithError(NotInRewardPhaseError);
    });

    it('should not mutate the original state', async () => {
      const state = makeState();
      const originalGold = state.player.gold;

      await useCase.skip(state);

      expect(state.player.gold).toBe(originalGold);
      expect(state.reward).not.toBeNull();
    });
  });
});
