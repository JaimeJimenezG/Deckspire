import { LoadGameUseCaseImpl } from './load-game.usecase';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';
import type { GameState } from '../../domain/models/game-state.model';

const MOCK_STATE: GameState = {
  phase: 'combat',
  gameOutcome: null,
  player: {
    hp: 60,
    maxHp: 80,
    block: 5,
    energy: 2,
    maxEnergy: 3,
    gold: 40,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
  },
  combat: null,
  map: null,
  deck: [],
  gold: 40,
  floor: 5,
  act: 1,
  seed: 99,
  relics: [],
  shop: null,
  reward: null,
  event: null,
  pendingBossRelics: 0,
};

describe('LoadGameUseCaseImpl', () => {
  let useCase: LoadGameUseCaseImpl;
  let mockRepository: jasmine.SpyObj<GameRepository>;

  beforeEach(() => {
    mockRepository = jasmine.createSpyObj<GameRepository>('GameRepository', [
      'save',
      'load',
      'deleteSave',
      'getStats',
      'updateStats',
    ]);

    useCase = new LoadGameUseCaseImpl(mockRepository);
  });

  it('should return the state provided by the repository', async () => {
    mockRepository.load.and.returnValue(Promise.resolve(MOCK_STATE));
    const result = await useCase.execute();
    expect(result).toBe(MOCK_STATE);
  });

  it('should return null when repository has no saved state', async () => {
    mockRepository.load.and.returnValue(Promise.resolve(null));
    const result = await useCase.execute();
    expect(result).toBeNull();
  });

  it('should call repository.load exactly once', async () => {
    mockRepository.load.and.returnValue(Promise.resolve(null));
    await useCase.execute();
    expect(mockRepository.load).toHaveBeenCalledTimes(1);
  });

  it('should propagate errors thrown by the repository', async () => {
    mockRepository.load.and.returnValue(Promise.reject(new Error('DB corrupted')));
    await expectAsync(useCase.execute()).toBeRejectedWithError('DB corrupted');
  });
});
