import { CombatState } from '../../domain/models/combat.model';
import { Card } from '../../domain/models/card.model';
import { GameState } from '../../domain/models/game-state.model';
import { Player } from '../../domain/models/player.model';
import { EnemyInstance, Intent } from '../../domain/models/enemy.model';
import { CombatRendererPort } from '../../domain/ports/outbound/combat-renderer.port';
import { CombatEngine } from '../../domain/services/combat-engine';
import { DeckManager } from '../../domain/services/deck-manager';
import { EnemyAI } from '../../domain/services/enemy-ai';
import {
  EndTurnUseCaseImpl,
  NoCombatActiveError,
  NotInPlayerTurnError,
} from './end-turn.usecase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** A damage-only intent used to test that the player takes damage. */
const attackIntent: Intent = {
  id: 'test-attack',
  display: { type: 'attack', value: 10 },
  actions: [{ type: 'damage', value: 10 }],
};

/** A block-only intent used to test that the enemy gains block. */
const blockIntent: Intent = {
  id: 'test-block',
  display: { type: 'defend' },
  actions: [{ type: 'block', value: 8 }],
};

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 80,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 0,
    deck: [strikeCard, strikeCard, strikeCard, strikeCard, strikeCard],
    hand: [strikeCard, defendCard],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    // 'cultist' has a simple CyclicPattern: [Incantation, DarkStrike] loop
    definitionId: 'cultist',
    hp: 50,
    maxHp: 50,
    block: 0,
    statusEffects: [],
    currentIntent: attackIntent,
    aiState: { turnCount: 1, sequenceIndex: 0, lastMoves: [], currentPhase: 0 },
    ...overrides,
  };
}

function makeActiveCombat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    player: makePlayer(),
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

describe('EndTurnUseCaseImpl', () => {
  let mockRenderer: jasmine.SpyObj<CombatRendererPort>;
  let combatEngine: CombatEngine;
  let enemyAI: EnemyAI;
  let useCase: EndTurnUseCaseImpl;

  beforeEach(() => {
    mockRenderer = jasmine.createSpyObj<CombatRendererPort>('CombatRendererPort', [
      'renderScene',
      'animateDamage',
      'animateBlock',
      'animateDeath',
      'animateCardPlay',
    ]);
    mockRenderer.animateDamage.and.returnValue(Promise.resolve());
    mockRenderer.animateBlock.and.returnValue(Promise.resolve());
    mockRenderer.animateDeath.and.returnValue(Promise.resolve());

    combatEngine = new CombatEngine(new DeckManager());
    enemyAI = new EnemyAI();
    useCase = new EndTurnUseCaseImpl(combatEngine, enemyAI, mockRenderer);
  });

  // ── Guards ────────────────────────────────────────────────────────────────

  it('should throw NoCombatActiveError when combat is null', async () => {
    const state = makeGameState(null);
    await expectAsync(useCase.execute(state)).toBeRejectedWith(
      jasmine.any(NoCombatActiveError),
    );
  });

  it('should throw NotInPlayerTurnError when phase is enemy-turn', async () => {
    const state = makeGameState(makeActiveCombat({ phase: 'enemy-turn' }));
    await expectAsync(useCase.execute(state)).toBeRejectedWith(
      jasmine.any(NotInPlayerTurnError),
    );
  });

  it('should throw NotInPlayerTurnError when phase is combat-end-victory', async () => {
    const state = makeGameState(makeActiveCombat({ phase: 'combat-end-victory' }));
    await expectAsync(useCase.execute(state)).toBeRejectedWith(
      jasmine.any(NotInPlayerTurnError),
    );
  });

  // ── Player hand discard ───────────────────────────────────────────────────

  it('should discard the player hand at the start of enemy turn', async () => {
    const combat = makeActiveCombat({
      player: makePlayer({ hand: [strikeCard, defendCard] }),
    });
    const state = makeGameState(combat);
    const result = await useCase.execute(state);
    // After the full end-turn cycle, the player should have a fresh hand drawn from deck.
    // The old hand cards (2 cards) should have moved to discard during processEnemyTurn,
    // then be reshuffled into the deck and drawn (since deck has 5 + 2 from discard = enough).
    expect(result.combat!.player.hand.length).toBeGreaterThan(0);
  });

  // ── Enemy intent resolution ───────────────────────────────────────────────

  it('should call animateDamage(0, amount) when enemy attacks the player', async () => {
    const state = makeGameState(makeActiveCombat({
      enemies: [makeEnemy({ currentIntent: attackIntent })],
    }));
    await useCase.execute(state);
    expect(mockRenderer.animateDamage).toHaveBeenCalledWith(0, jasmine.any(Number));
  });

  it('should reduce player HP when enemy uses a damage intent', async () => {
    const state = makeGameState(makeActiveCombat({
      enemies: [makeEnemy({ currentIntent: attackIntent })],
    }));
    const result = await useCase.execute(state);
    expect(result.combat!.player.hp).toBeLessThan(80);
  });

  it('should call animateBlock for enemy index when enemy gains block', async () => {
    const state = makeGameState(makeActiveCombat({
      enemies: [makeEnemy({ currentIntent: blockIntent })],
    }));
    await useCase.execute(state);
    // Enemy index in renderer is i+1 (0 = player)
    expect(mockRenderer.animateBlock).toHaveBeenCalledWith(1, 8);
  });

  it('should NOT call animateDamage when enemy uses a block-only intent', async () => {
    const state = makeGameState(makeActiveCombat({
      enemies: [makeEnemy({ currentIntent: blockIntent })],
    }));
    await useCase.execute(state);
    expect(mockRenderer.animateDamage).not.toHaveBeenCalled();
  });

  it('should skip enemies with null currentIntent', async () => {
    const state = makeGameState(makeActiveCombat({
      enemies: [makeEnemy({ currentIntent: null })],
    }));
    await useCase.execute(state);
    expect(mockRenderer.animateDamage).not.toHaveBeenCalled();
  });

  // ── Thorns retaliation ────────────────────────────────────────────────────

  it('should call animateDeath for enemy killed by thorns during its own attack', async () => {
    const enemyWithLowHp = makeEnemy({
      hp: 1,
      currentIntent: attackIntent,
    });
    const playerWithThorns: Player = {
      ...makePlayer(),
      statusEffects: [{ type: 'thorns', stacks: 5 }],
    };
    const state = makeGameState(makeActiveCombat({
      player: playerWithThorns,
      enemies: [enemyWithLowHp],
    }));
    await useCase.execute(state);
    // Enemy index 1 in animateDeath (i+1)
    expect(mockRenderer.animateDeath).toHaveBeenCalledWith(1);
  });

  // ── Combat end defeat ─────────────────────────────────────────────────────

  it('should return combat-end-defeat when player HP reaches 0', async () => {
    const nearDeadPlayer = makePlayer({ hp: 1 });
    const strongEnemy = makeEnemy({
      currentIntent: {
        id: 'big-hit',
        display: { type: 'attack', value: 50 },
        actions: [{ type: 'damage', value: 50 }],
      },
    });
    const state = makeGameState(makeActiveCombat({
      player: nearDeadPlayer,
      enemies: [strongEnemy],
    }));
    const result = await useCase.execute(state);
    expect(result.combat!.phase).toBe('combat-end-defeat');
  });

  it('should stop processing remaining enemies after player death', async () => {
    const nearDeadPlayer = makePlayer({ hp: 1 });
    const killerIntent: Intent = {
      id: 'killer',
      display: { type: 'attack', value: 50 },
      actions: [{ type: 'damage', value: 50 }],
    };
    const secondIntent: Intent = {
      id: 'second-hit',
      display: { type: 'attack', value: 10 },
      actions: [{ type: 'damage', value: 10 }],
    };
    const state = makeGameState(makeActiveCombat({
      player: nearDeadPlayer,
      enemies: [
        makeEnemy({ currentIntent: killerIntent }),
        makeEnemy({ currentIntent: secondIntent }),
      ],
    }));
    const result = await useCase.execute(state);
    // Phase should be defeat, not enemy-turn or player-turn
    expect(result.combat!.phase).toBe('combat-end-defeat');
    // animateDamage called once (first enemy hit; second enemy skipped)
    expect(mockRenderer.animateDamage).toHaveBeenCalledTimes(1);
  });

  // ── Combat end victory ────────────────────────────────────────────────────

  it('should return combat-end-victory when last enemy dies to thorns', async () => {
    const enemyAboutToDie = makeEnemy({
      hp: 1,
      currentIntent: attackIntent,
    });
    const playerWithThorns: Player = {
      ...makePlayer(),
      statusEffects: [{ type: 'thorns', stacks: 10 }],
    };
    const state = makeGameState(makeActiveCombat({
      player: playerWithThorns,
      enemies: [enemyAboutToDie],
    }));
    const result = await useCase.execute(state);
    expect(result.combat!.phase).toBe('combat-end-victory');
  });

  it('should heal player on victory when burning-blood is equipped', async () => {
    const enemyAboutToDie = makeEnemy({
      hp: 1,
      currentIntent: attackIntent,
    });
    const playerWithThorns: Player = {
      ...makePlayer({ hp: 60, maxHp: 80 }),
      statusEffects: [{ type: 'thorns', stacks: 10 }],
    };
    const state = {
      ...makeGameState(
        makeActiveCombat({
          player: playerWithThorns,
          enemies: [enemyAboutToDie],
        }),
      ),
      relics: ['burning-blood'],
    };
    const result = await useCase.execute(state);
    expect(result.combat!.phase).toBe('combat-end-victory');
    expect(result.combat!.player.hp).toBe(56);
    expect(result.player.hp).toBe(56);
  });

  it('should apply orichalcum block before enemy attacks', async () => {
    const state = {
      ...makeGameState(
        makeActiveCombat({
          player: makePlayer({ block: 0, hp: 80 }),
          enemies: [makeEnemy({ currentIntent: attackIntent })],
        }),
      ),
      relics: ['orichalcum'],
    };
    const result = await useCase.execute(state);
    // Enemy attacks for 10, Orichalcum grants 6 first -> 4 HP lost.
    expect(result.combat!.player.hp).toBe(76);
  });

  // ── Next intent assignment ────────────────────────────────────────────────

  it('should assign a non-null next intent to alive enemies', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.combat!.enemies[0].currentIntent).not.toBeNull();
  });

  it('should not assign next intent to dead enemies', async () => {
    const deadEnemy = makeEnemy({ hp: 0, currentIntent: null });
    const aliveEnemy = makeEnemy({ currentIntent: attackIntent });
    const state = makeGameState(makeActiveCombat({
      enemies: [deadEnemy, aliveEnemy],
    }));
    const result = await useCase.execute(state);
    // Dead enemy keeps its null intent
    expect(result.combat!.enemies[0].currentIntent).toBeNull();
    // Alive enemy gets a new intent
    expect(result.combat!.enemies[1].currentIntent).not.toBeNull();
  });

  // ── New player turn ───────────────────────────────────────────────────────

  it('should restore player energy to maxEnergy', async () => {
    const spentPlayer = makePlayer({ energy: 0 });
    const state = makeGameState(makeActiveCombat({ player: spentPlayer }));
    const result = await useCase.execute(state);
    expect(result.combat!.player.energy).toBe(spentPlayer.maxEnergy);
  });

  it('should draw a new hand for the player', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.combat!.player.hand.length).toBeGreaterThan(0);
  });

  it('should increment the turn counter', async () => {
    const state = makeGameState(makeActiveCombat({ turn: 3 }));
    const result = await useCase.execute(state);
    expect(result.combat!.turn).toBe(4);
  });

  it('should set phase back to player-turn', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.combat!.phase).toBe('player-turn');
  });

  it('should clear cardsPlayedThisTurn at the start of the new turn', async () => {
    const state = makeGameState(makeActiveCombat({
      cardsPlayedThisTurn: [strikeCard],
    }));
    const result = await useCase.execute(state);
    expect(result.combat!.cardsPlayedThisTurn.length).toBe(0);
  });

  // ── Immutability ──────────────────────────────────────────────────────────

  it('should return a new GameState object without mutating the input', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result).not.toBe(state);
    expect(result.combat).not.toBe(state.combat);
  });

  it('should preserve non-combat GameState fields', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.seed).toBe(state.seed);
    expect(result.gold).toBe(state.gold);
    expect(result.act).toBe(state.act);
    expect(result.floor).toBe(state.floor);
    expect(result.relics).toBe(state.relics);
  });
});
