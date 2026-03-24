import { SaveGameUseCaseImpl } from './save-game.usecase';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';
import type { GameState } from '../../domain/models/game-state.model';

const MOCK_STATE: GameState = {
  phase: 'map',
  gameOutcome: null,
  player: {
    hp: 80,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 99,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
  },
  combat: null,
  map: null,
  deck: [],
  gold: 99,
  floor: 0,
  act: 1,
  seed: 42,
  relics: [],
  shop: null,
  reward: null,
  event: null,
  pendingBossRelics: 0,
};

describe('SaveGameUseCaseImpl', () => {
  let useCase: SaveGameUseCaseImpl;
  let mockRepository: jasmine.SpyObj<GameRepository>;

  beforeEach(() => {
    mockRepository = jasmine.createSpyObj<GameRepository>('GameRepository', [
      'save',
      'load',
      'deleteSave',
      'getStats',
      'updateStats',
    ]);
    mockRepository.save.and.returnValue(Promise.resolve());

    useCase = new SaveGameUseCaseImpl(mockRepository);
  });

  it('should call repository.save with the provided state', async () => {
    await useCase.execute(MOCK_STATE);
    expect(mockRepository.save).toHaveBeenCalledOnceWith(MOCK_STATE);
  });

  it('should resolve without returning a value', async () => {
    const result = await useCase.execute(MOCK_STATE);
    expect(result).toBeUndefined();
  });

  it('should propagate errors thrown by the repository', async () => {
    mockRepository.save.and.returnValue(Promise.reject(new Error('Storage full')));
    await expectAsync(useCase.execute(MOCK_STATE)).toBeRejectedWithError('Storage full');
  });
});
