import type { Card } from '../models/card.model';
import type { CombatState } from '../models/combat.model';
import type { EnemyInstance } from '../models/enemy.model';
import type { Player } from '../models/player.model';
import { DeckManager } from './deck-manager';
import { RelicEngine } from './relic-engine';
import { SeededRandom } from './seeded-random';

function makeCard(id: string): Card {
  return {
    id,
    name: id,
    type: 'attack',
    rarity: 'basic',
    cost: 1,
    description: '',
    upgraded: false,
    effects: [],
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 50,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 0,
    deck: [makeCard('c1'), makeCard('c2'), makeCard('c3')],
    hand: [makeCard('h1'), makeCard('h2'), makeCard('h3'), makeCard('h4'), makeCard('h5')],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    definitionId: 'cultist',
    hp: 40,
    maxHp: 40,
    block: 0,
    statusEffects: [],
    currentIntent: null,
    aiState: { turnCount: 1, sequenceIndex: 0, lastMoves: [], currentPhase: 0 },
    ...overrides,
  };
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
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

describe('RelicEngine', () => {
  let engine: RelicEngine;

  beforeEach(() => {
    engine = new RelicEngine(new DeckManager());
  });

  it('should apply lantern energy at combat start', () => {
    const combat = makeCombat({ player: makePlayer({ energy: 3 }) });
    const result = engine.applyCombatStartHooks(combat, ['lantern'], new SeededRandom(42));
    expect(result.player.energy).toBe(4);
  });

  it('should apply anchor block at combat start', () => {
    const combat = makeCombat({ player: makePlayer({ block: 0 }) });
    const result = engine.applyCombatStartHooks(combat, ['anchor'], new SeededRandom(42));
    expect(result.player.block).toBe(10);
  });

  it('should apply bag-of-preparation card draw at combat start', () => {
    const combat = makeCombat({
      player: makePlayer({
        hand: [makeCard('h1'), makeCard('h2'), makeCard('h3'), makeCard('h4'), makeCard('h5')],
        deck: [makeCard('d1'), makeCard('d2')],
      }),
    });
    const result = engine.applyCombatStartHooks(combat, ['bag-of-preparation'], new SeededRandom(42));
    expect(result.player.hand.length).toBe(7);
    expect(result.player.deck.length).toBe(0);
  });

  it('should apply orichalcum at turn end only when block is zero', () => {
    const withNoBlock = makeCombat({ player: makePlayer({ block: 0 }) });
    const withBlock = makeCombat({ player: makePlayer({ block: 3 }) });

    const resultNoBlock = engine.applyPlayerTurnEndHooks(withNoBlock, ['orichalcum']);
    const resultWithBlock = engine.applyPlayerTurnEndHooks(withBlock, ['orichalcum']);

    expect(resultNoBlock.player.block).toBe(6);
    expect(resultWithBlock.player.block).toBe(3);
  });

  it('should apply burning-blood heal on victory and cap at maxHp', () => {
    const lowHp = makePlayer({ hp: 70, maxHp: 80 });
    const nearCap = makePlayer({ hp: 78, maxHp: 80 });

    expect(engine.applyCombatEndVictoryHooks(lowHp, ['burning-blood']).hp).toBe(76);
    expect(engine.applyCombatEndVictoryHooks(nearCap, ['burning-blood']).hp).toBe(80);
  });
});
