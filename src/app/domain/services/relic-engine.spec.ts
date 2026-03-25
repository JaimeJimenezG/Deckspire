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

  describe('relic reward count modifiers', () => {
    it('should modify elite and boss relic counts based on hooks', () => {
      const definitions = {
        'relic-mod': {
          id: 'relic-mod',
          name: 'Relic Mod',
          description: '',
          rarity: 'common',
          passiveHooks: [
            {
              hook: 'combat-end-victory',
              effect: {
                type: 'modify-relic-reward-count',
                target: 'elite',
                value: 2,
              },
            },
            {
              hook: 'combat-end-victory',
              effect: {
                type: 'modify-relic-reward-count',
                target: 'boss',
                value: -1,
              },
            },
          ],
        },
      } as const;

      const customEngine = new RelicEngine(
        new DeckManager(),
        definitions as unknown as Record<string, any>,
        ['relic-mod'],
      );

      expect(customEngine.calculateRelicRewardCount('elite', 1, ['relic-mod'])).toBe(3);
      expect(customEngine.calculateRelicRewardCount('boss', 1, ['relic-mod'])).toBe(0);
    });
  });

  describe('grantRandomRelics()', () => {
    it('should grant up to count available relics without duplicates', () => {
      const customEngine = new RelicEngine(new DeckManager(), {}, ['a', 'b', 'c']);
      const rng = new SeededRandom(1);

      const { relics, granted } = customEngine.grantRandomRelics(['a'], 5, rng);

      expect(relics).toContain('a');
      expect(granted.length).toBe(2);
      expect(granted).not.toContain('a');
      expect(new Set(granted).size).toBe(granted.length);
    });
  });
});
