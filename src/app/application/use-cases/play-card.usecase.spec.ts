import { CombatState } from '../../domain/models/combat.model';
import { Card } from '../../domain/models/card.model';
import { GameState } from '../../domain/models/game-state.model';
import { Player } from '../../domain/models/player.model';
import { EnemyInstance } from '../../domain/models/enemy.model';
import { CombatRendererPort } from '../../domain/ports/outbound/combat-renderer.port';
import { CombatEngine } from '../../domain/services/combat-engine';
import { DeckManager } from '../../domain/services/deck-manager';
import {
  PlayCardUseCaseImpl,
  InsufficientEnergyError,
  InvalidTurnPhaseError,
  NoCombatActiveError,
} from './play-card.usecase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 80,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 0,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    definitionId: 'jaw-worm',
    hp: 40,
    maxHp: 40,
    block: 0,
    statusEffects: [],
    currentIntent: null,
    aiState: { turnCount: 1, sequenceIndex: 0, lastMoves: [], currentPhase: 0 },
    ...overrides,
  };
}

const strikeCard: Card = {
  id: 'strike',
  name: 'Strike',
  type: 'attack',
  rarity: 'basic',
  cost: 1,
  description: 'Deal 6 damage.',
  upgraded: false,
  effects: [{ type: 'damage', value: 6 }],
};

const defendCard: Card = {
  id: 'defend',
  name: 'Defend',
  type: 'skill',
  rarity: 'basic',
  cost: 1,
  description: 'Gain 5 block.',
  upgraded: false,
  effects: [{ type: 'block', value: 5 }],
};

const expensiveCard: Card = {
  id: 'expensive',
  name: 'Expensive',
  type: 'attack',
  rarity: 'rare',
  cost: 4,
  description: 'Costs too much.',
  upgraded: false,
  effects: [{ type: 'damage', value: 20 }],
};

function makeActiveCombat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    player: makePlayer({ hand: [strikeCard, defendCard], energy: 3 }),
    enemies: [makeEnemy()],
    turn: 1,
    phase: 'player-turn',
    cardsPlayedThisTurn: [],
    damageDealt: 0,
    ...overrides,
  };
}

function makeGameState(combat: CombatState | null = makeActiveCombat()): GameState {
  return {
    phase: 'combat',
    gameOutcome: null,
    player: makePlayer(),
    combat,
    map: null,
    deck: [],
    gold: 0,
    floor: 1,
    act: 1,
    seed: 42,
    relics: [],
    shop: null,
    reward: null,
    event: null,
    pendingBossRelics: 0,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlayCardUseCaseImpl', () => {
  let mockRenderer: jasmine.SpyObj<CombatRendererPort>;
  let combatEngine: CombatEngine;
  let useCase: PlayCardUseCaseImpl;

  beforeEach(() => {
    mockRenderer = jasmine.createSpyObj<CombatRendererPort>('CombatRendererPort', [
      'renderScene',
      'animateDamage',
      'animateBlock',
      'animateDeath',
      'animateCardPlay',
    ]);
    mockRenderer.animateCardPlay.and.returnValue(Promise.resolve());
    mockRenderer.animateDamage.and.returnValue(Promise.resolve());
    mockRenderer.animateBlock.and.returnValue(Promise.resolve());
    mockRenderer.animateDeath.and.returnValue(Promise.resolve());

    combatEngine = new CombatEngine(new DeckManager());
    useCase = new PlayCardUseCaseImpl(combatEngine, mockRenderer);
  });

  // ── Guards ────────────────────────────────────────────────────────────────

  it('should throw NoCombatActiveError when combat is null', async () => {
    const state = makeGameState(null);
    await expectAsync(useCase.execute(strikeCard, 0, state)).toBeRejectedWith(
      jasmine.any(NoCombatActiveError),
    );
  });

  it('should throw InvalidTurnPhaseError when it is enemy-turn', async () => {
    const combat = makeActiveCombat({ phase: 'enemy-turn' });
    const state = makeGameState(combat);
    await expectAsync(useCase.execute(strikeCard, 0, state)).toBeRejectedWith(
      jasmine.any(InvalidTurnPhaseError),
    );
  });

  it('should throw InsufficientEnergyError when card cost exceeds energy', async () => {
    const combat = makeActiveCombat({
      player: makePlayer({ hand: [expensiveCard], energy: 2 }),
    });
    const state = makeGameState(combat);
    await expectAsync(useCase.execute(expensiveCard, 0, state)).toBeRejectedWith(
      jasmine.any(InsufficientEnergyError),
    );
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('should call animateCardPlay after resolving effects', async () => {
    const state = makeGameState();
    await useCase.execute(strikeCard, 0, state);
    expect(mockRenderer.animateCardPlay).toHaveBeenCalledWith(strikeCard);
  });

  it('should invoke onCombatCommitted before animateCardPlay resolves', async () => {
    let committed = false;
    mockRenderer.animateCardPlay.and.callFake(() => {
      return new Promise<void>(resolve => {
        expect(committed).toBe(true);
        resolve();
      });
    });
    const state = makeGameState();
    await useCase.execute(strikeCard, 0, state, {
      onCombatCommitted: () => {
        committed = true;
      },
    });
  });

  it('should return a new GameState with updated combat', async () => {
    const state = makeGameState();
    const result = await useCase.execute(strikeCard, 0, state);
    expect(result.combat).not.toBeNull();
    expect(result.combat).not.toBe(state.combat);
  });

  it('should spend the card energy cost in the returned state', async () => {
    const state = makeGameState();
    const result = await useCase.execute(strikeCard, 0, state);
    expect(result.combat!.player.energy).toBe(state.combat!.player.energy - strikeCard.cost);
  });

  it('should call animateDamage when an attack card deals damage', async () => {
    const state = makeGameState();
    await useCase.execute(strikeCard, 0, state);
    expect(mockRenderer.animateDamage).toHaveBeenCalled();
  });

  it('should NOT call animateDamage for a pure block card', async () => {
    const combat = makeActiveCombat({
      player: makePlayer({ hand: [defendCard], energy: 3 }),
    });
    const state = makeGameState(combat);
    await useCase.execute(defendCard, 0, state);
    expect(mockRenderer.animateDamage).not.toHaveBeenCalled();
  });

  it('should call animateBlock when a block card is played', async () => {
    const combat = makeActiveCombat({
      player: makePlayer({ hand: [defendCard], energy: 3 }),
    });
    const state = makeGameState(combat);
    await useCase.execute(defendCard, 0, state);
    expect(mockRenderer.animateBlock).toHaveBeenCalledWith(0, jasmine.any(Number));
  });

  it('should call animateDeath when an enemy is killed', async () => {
    const dyingEnemy = makeEnemy({ hp: 1, maxHp: 10 });
    const combat = makeActiveCombat({
      player: makePlayer({ hand: [strikeCard], energy: 3 }),
      enemies: [dyingEnemy],
    });
    const state = makeGameState(combat);
    await useCase.execute(strikeCard, 0, state);
    expect(mockRenderer.animateDeath).toHaveBeenCalledWith(1);
  });

  it('should NOT call animateDeath when the enemy survives', async () => {
    const toughEnemy = makeEnemy({ hp: 100, maxHp: 100 });
    const combat = makeActiveCombat({
      player: makePlayer({ hand: [strikeCard], energy: 3 }),
      enemies: [toughEnemy],
    });
    const state = makeGameState(combat);
    await useCase.execute(strikeCard, 0, state);
    expect(mockRenderer.animateDeath).not.toHaveBeenCalled();
  });

  it('should preserve other GameState fields untouched', async () => {
    const state = makeGameState();
    const result = await useCase.execute(strikeCard, 0, state);
    expect(result.seed).toBe(state.seed);
    expect(result.gold).toBe(state.gold);
    expect(result.act).toBe(state.act);
    expect(result.floor).toBe(state.floor);
    expect(result.relics).toBe(state.relics);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('should allow playing a 0-cost card when energy is 0', async () => {
    const freeCard: Card = {
      id: 'clash',
      name: 'Clash',
      type: 'attack',
      rarity: 'basic',
      cost: 0,
      description: 'Deal 14 damage.',
      upgraded: false,
      effects: [{ type: 'damage', value: 14 }],
    };
    const combat = makeActiveCombat({
      player: makePlayer({ hand: [freeCard], energy: 0 }),
    });
    const state = makeGameState(combat);
    const result = await useCase.execute(freeCard, 0, state);
    expect(result.combat).not.toBeNull();
    expect(result.combat!.player.energy).toBe(0);
  });

  it('should record the card in cardsPlayedThisTurn', async () => {
    const state = makeGameState();
    const result = await useCase.execute(strikeCard, 0, state);
    expect(result.combat!.cardsPlayedThisTurn).toContain(strikeCard);
  });
});
