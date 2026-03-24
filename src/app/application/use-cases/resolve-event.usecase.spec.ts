import type { GameState } from '../../domain/models/game-state.model';
import type { Player } from '../../domain/models/player.model';
import type { EventState, GameEvent } from '../../domain/models/event.model';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';
import {
  ResolveEventUseCaseImpl,
  NoActiveEventError,
  InvalidEventChoiceError,
  EventAlreadyResolvedError,
} from './resolve-event.usecase';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const SAMPLE_EVENT: GameEvent = {
  id: 'test-event',
  title: 'Evento de prueba',
  icon: '🧪',
  description: 'Un evento para tests.',
  choices: [
    {
      id: 'gain-gold',
      text: 'Ganar oro',
      effects: [{ type: 'gain-gold', value: 50 }],
      outcomeText: 'Ganaste oro.',
    },
    {
      id: 'lose-hp',
      text: 'Perder vida',
      effects: [{ type: 'lose-hp', value: 15 }],
      outcomeText: 'Perdiste vida.',
    },
    {
      id: 'gain-max-hp',
      text: 'Ganar HP máximo',
      effects: [{ type: 'gain-max-hp', value: 10 }],
      outcomeText: 'Tu HP máximo aumentó.',
    },
    {
      id: 'no-effect',
      text: 'No hacer nada',
      effects: [],
      outcomeText: 'No pasó nada.',
    },
  ],
};

function makeEventState(chosenId: string | null = null): EventState {
  return { event: SAMPLE_EVENT, chosenId };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'event',
    gameOutcome: null,
    player: makePlayer(),
    combat: null,
    map: null,
    deck: [],
    gold: 100,
    floor: 3,
    act: 1,
    seed: 42,
    relics: [],
    shop: null,
    reward: null,
    event: makeEventState(),
    pendingBossRelics: 0,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ResolveEventUseCaseImpl', () => {
  let mockRepository: jasmine.SpyObj<GameRepository>;
  let useCase: ResolveEventUseCaseImpl;

  beforeEach(() => {
    mockRepository = jasmine.createSpyObj<GameRepository>('GameRepository', [
      'save',
      'load',
      'deleteSave',
      'getStats',
      'updateStats',
    ]);
    mockRepository.save.and.returnValue(Promise.resolve());

    useCase = new ResolveEventUseCaseImpl(mockRepository);
  });

  // ── Guards ────────────────────────────────────────────────────────────────

  it('should throw NoActiveEventError when there is no active event', async () => {
    const state = makeGameState({ event: null });
    await expectAsync(useCase.execute('gain-gold', state)).toBeRejectedWith(
      jasmine.any(NoActiveEventError),
    );
  });

  it('should throw EventAlreadyResolvedError when the event was already resolved', async () => {
    const state = makeGameState({ event: makeEventState('gain-gold') });
    await expectAsync(useCase.execute('no-effect', state)).toBeRejectedWith(
      jasmine.any(EventAlreadyResolvedError),
    );
  });

  it('should throw InvalidEventChoiceError for an unknown choice id', async () => {
    const state = makeGameState();
    await expectAsync(useCase.execute('non-existent-choice', state)).toBeRejectedWith(
      jasmine.any(InvalidEventChoiceError),
    );
  });

  // ── Happy path: efectos sobre el oro ─────────────────────────────────────

  it('should add gold when the chosen effect is gain-gold', async () => {
    const state = makeGameState({ gold: 100 });
    const result = await useCase.execute('gain-gold', state);
    expect(result.gold).toBe(150);
  });

  it('should not let gold go below 0 when losing gold', async () => {
    const loseGoldEvent: GameEvent = {
      ...SAMPLE_EVENT,
      choices: [
        {
          id: 'lose-all',
          text: 'Perder todo el oro',
          effects: [{ type: 'lose-gold', value: 9999 }],
          outcomeText: 'Quedaste sin oro.',
        },
      ],
    };
    const state = makeGameState({
      gold: 50,
      event: { event: loseGoldEvent, chosenId: null },
    });
    const result = await useCase.execute('lose-all', state);
    expect(result.gold).toBe(0);
  });

  // ── Happy path: efectos sobre el HP ──────────────────────────────────────

  it('should reduce player hp when the chosen effect is lose-hp', async () => {
    const state = makeGameState();
    const result = await useCase.execute('lose-hp', state);
    expect(result.player.hp).toBe(45); // 60 - 15
  });

  it('should not let player hp go below 0 when losing hp', async () => {
    const state = makeGameState({ player: makePlayer({ hp: 5 }) });
    const result = await useCase.execute('lose-hp', state);
    expect(result.player.hp).toBe(0);
  });

  it('should increase player maxHp when the chosen effect is gain-max-hp', async () => {
    const state = makeGameState();
    const result = await useCase.execute('gain-max-hp', state);
    expect(result.player.maxHp).toBe(90); // 80 + 10
  });

  it('should not change state when the chosen effect list is empty', async () => {
    const state = makeGameState();
    const result = await useCase.execute('no-effect', state);
    expect(result.gold).toBe(state.gold);
    expect(result.player.hp).toBe(state.player.hp);
    expect(result.player.maxHp).toBe(state.player.maxHp);
  });

  // ── Marcado de resolución ─────────────────────────────────────────────────

  it('should mark the event as resolved with the chosen id', async () => {
    const state = makeGameState();
    const result = await useCase.execute('gain-gold', state);
    expect(result.event!.chosenId).toBe('gain-gold');
  });

  it('should keep the phase as "event" after resolving (la UI maneja la transición)', async () => {
    const state = makeGameState();
    const result = await useCase.execute('gain-gold', state);
    expect(result.phase).toBe('event');
  });

  // ── Efecto diferido: gain-relic-post-boss ────────────────────────────────

  it('should increment pendingBossRelics when effect is gain-relic-post-boss', async () => {
    const relicEvent: GameEvent = {
      ...SAMPLE_EVENT,
      choices: [
        {
          id: 'pact',
          text: 'Sellar el pacto',
          effects: [{ type: 'gain-relic-post-boss', value: 2 }],
          outcomeText: 'Dos reliquias te esperan al vencer al boss.',
        },
      ],
    };
    const state = makeGameState({
      pendingBossRelics: 1,
      event: { event: relicEvent, chosenId: null },
    });
    const result = await useCase.execute('pact', state);
    expect(result.pendingBossRelics).toBe(3);
  });

  it('should not modify player hp or gold when effect is gain-relic-post-boss', async () => {
    const relicEvent: GameEvent = {
      ...SAMPLE_EVENT,
      choices: [
        {
          id: 'pact',
          text: 'Sellar el pacto',
          effects: [{ type: 'gain-relic-post-boss', value: 2 }],
          outcomeText: 'Pacto sellado.',
        },
      ],
    };
    const state = makeGameState({ event: { event: relicEvent, chosenId: null } });
    const result = await useCase.execute('pact', state);
    expect(result.player.hp).toBe(state.player.hp);
    expect(result.gold).toBe(state.gold);
  });

  // ── Persistencia ──────────────────────────────────────────────────────────

  it('should call repository.save after resolving', async () => {
    const state = makeGameState();
    await useCase.execute('gain-gold', state);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });
});
