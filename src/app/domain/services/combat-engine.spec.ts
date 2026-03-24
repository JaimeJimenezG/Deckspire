import { Card, CardEffect } from '../models/card.model';
import { CombatState } from '../models/combat.model';
import { EnemyInstance } from '../models/enemy.model';
import { Player } from '../models/player.model';
import { StatusEffect } from '../models/status-effect.model';
import { CombatEngine } from './combat-engine';
import { DeckManager } from './deck-manager';
import { SeededRandom } from './seeded-random';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    name: id,
    type: 'attack',
    rarity: 'basic',
    cost: 1,
    description: '',
    upgraded: false,
    effects: [],
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
    gold: 99,
    statusEffects: [],
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    definitionId: 'jaw-worm',
    hp: 42,
    maxHp: 44,
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('CombatEngine', () => {
  let engine: CombatEngine;
  let rng: SeededRandom;

  beforeEach(() => {
    engine = new CombatEngine(new DeckManager());
    rng = new SeededRandom(42);
  });

  // ── initCombat ─────────────────────────────────────────────────────────────

  describe('initCombat()', () => {
    it('should return a CombatState in player-turn phase with turn = 1', () => {
      const player = makePlayer({ deck: [makeCard('A'), makeCard('B'), makeCard('C'), makeCard('D'), makeCard('E')] });
      const enemies = [makeEnemy()];

      const state = engine.initCombat(player, enemies, rng);

      expect(state.phase).toBe('player-turn');
      expect(state.turn).toBe(1);
      expect(state.cardsPlayedThisTurn.length).toBe(0);
      expect(state.damageDealt).toBe(0);
    });

    it('should draw 5 cards into the player hand', () => {
      const deck = Array.from({ length: 10 }, (_, i) => makeCard(`c${i}`));
      const player = makePlayer({ deck });
      const state = engine.initCombat(player, [makeEnemy()], rng);

      expect(state.player.hand.length).toBe(5);
      expect(state.player.deck.length).toBe(5);
    });

    it('should reset player block to 0 and energy to maxEnergy', () => {
      const player = makePlayer({ block: 10, energy: 1, maxEnergy: 3 });
      const state = engine.initCombat(player, [makeEnemy()], rng);

      expect(state.player.block).toBe(0);
      expect(state.player.energy).toBe(3);
    });

    it('edge: should work with zero enemies', () => {
      const state = engine.initCombat(makePlayer(), [], rng);
      expect(state.enemies.length).toBe(0);
    });

    it('edge: should draw as many cards as possible when deck has fewer than 5', () => {
      const player = makePlayer({ deck: [makeCard('A'), makeCard('B')] });
      const state = engine.initCombat(player, [], rng);
      expect(state.player.hand.length).toBe(2);
    });
  });

  // ── resolveCardEffects ────────────────────────────────────────────────────

  describe('resolveCardEffects()', () => {
    it('should spend energy equal to card cost', () => {
      const card = makeCard('strike', { effects: [{ type: 'damage', value: 6 }] });
      const player = makePlayer({ hand: [card], energy: 3 });
      const state = makeCombat({ player });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.player.energy).toBe(2);
    });

    it('should move played card from hand to discard', () => {
      const card = makeCard('strike', { effects: [{ type: 'damage', value: 6 }] });
      const player = makePlayer({ hand: [card] });
      const state = makeCombat({ player });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.player.hand).not.toContain(card);
      expect(result.player.piles.discard).toContain(card);
    });

    it('should move played card to exhaust when exhaust-self is present', () => {
      const card = makeCard('offering', {
        effects: [{ type: 'exhaust-self' }, { type: 'gain-energy', value: 2 }],
      });
      const player = makePlayer({ hand: [card] });
      const state = makeCombat({ player });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.player.piles.exhaust).toContain(card);
      expect(result.player.piles.discard).not.toContain(card);
    });

    it('should deal damage to the targeted enemy', () => {
      const card = makeCard('strike', { effects: [{ type: 'damage', value: 6 }] });
      const player = makePlayer({ hand: [card] });
      const enemy = makeEnemy({ hp: 42, block: 0 });
      const state = makeCombat({ player, enemies: [enemy] });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.enemies[0].hp).toBe(36);
      expect(result.damageDealt).toBe(6);
    });

    it('should absorb damage with enemy block before reducing HP', () => {
      const card = makeCard('strike', { effects: [{ type: 'damage', value: 6 }] });
      const player = makePlayer({ hand: [card] });
      const enemy = makeEnemy({ hp: 42, block: 4 });
      const state = makeCombat({ player, enemies: [enemy] });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.enemies[0].block).toBe(0);
      expect(result.enemies[0].hp).toBe(40);
      expect(result.damageDealt).toBe(2);
    });

    it('should add block to the player', () => {
      const card = makeCard('defend', {
        type: 'skill',
        effects: [{ type: 'block', value: 5 }],
      });
      const player = makePlayer({ hand: [card], block: 3 });
      const state = makeCombat({ player });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.player.block).toBe(8);
    });

    it('should apply status to an enemy', () => {
      const card = makeCard('bash', {
        effects: [
          { type: 'damage', value: 8 },
          { type: 'apply-status', target: 'targeted-enemy', status: 'vulnerable', stacks: 2 },
        ],
      });
      const player = makePlayer({ hand: [card] });
      const state = makeCombat({ player, enemies: [makeEnemy({ hp: 44 })] });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      const vulnEffect = result.enemies[0].statusEffects.find(s => s.type === 'vulnerable');
      expect(vulnEffect?.stacks).toBe(2);
    });

    it('should apply status to self', () => {
      const card = makeCard('inflame', {
        type: 'skill',
        effects: [{ type: 'apply-status', target: 'self', status: 'strength', stacks: 2 }],
      });
      const player = makePlayer({ hand: [card] });
      const state = makeCombat({ player });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      const strengthEffect = result.player.statusEffects.find(s => s.type === 'strength');
      expect(strengthEffect?.stacks).toBe(2);
    });

    it('should draw cards with the draw effect', () => {
      const deck = Array.from({ length: 5 }, (_, i) => makeCard(`c${i}`));
      const card = makeCard('acrobatics', {
        type: 'skill',
        effects: [{ type: 'draw', value: 2 }],
      });
      const player = makePlayer({ hand: [card], deck });
      const state = makeCombat({ player });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      // started with 1 card in hand (the played card is discarded, +2 drawn)
      expect(result.player.hand.length).toBe(2);
    });

    it('should add to cardsPlayedThisTurn', () => {
      const card = makeCard('strike', { effects: [{ type: 'damage', value: 6 }] });
      const player = makePlayer({ hand: [card] });
      const state = makeCombat({ player, cardsPlayedThisTurn: [] });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.cardsPlayedThisTurn).toContain(card);
    });

    it('should trigger enrage on enemies when a skill is played', () => {
      const card = makeCard('armaments', {
        type: 'skill',
        effects: [{ type: 'block', value: 5 }],
      });
      const enemy = makeEnemy({ statusEffects: [{ type: 'enrage', stacks: 1 }] });
      const player = makePlayer({ hand: [card] });
      const state = makeCombat({ player, enemies: [enemy] });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      const strength = result.enemies[0].statusEffects.find(s => s.type === 'strength');
      expect(strength?.stacks).toBe(1);
    });

    it('should deal thorns damage to player when hitting an enemy with thorns', () => {
      const card = makeCard('strike', { effects: [{ type: 'damage', value: 6 }] });
      const enemy = makeEnemy({ statusEffects: [{ type: 'thorns', stacks: 3 }] });
      const player = makePlayer({ hand: [card], hp: 80 });
      const state = makeCombat({ player, enemies: [enemy] });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.player.hp).toBe(77);
    });

    it('edge: zero-damage card should not trigger thorns', () => {
      const card = makeCard('strike', { effects: [{ type: 'damage', value: 0 }] });
      const enemy = makeEnemy({ statusEffects: [{ type: 'thorns', stacks: 3 }] });
      const player = makePlayer({ hand: [card], hp: 80, statusEffects: [{ type: 'weak', stacks: 1 }] });
      const state = makeCombat({ player, enemies: [enemy] });

      const result = engine.resolveCardEffects(card, 0, state, rng);

      expect(result.player.hp).toBe(80);
    });
  });

  // ── calculateDamage ───────────────────────────────────────────────────────

  describe('calculateDamage()', () => {
    it('should return base damage with no modifiers', () => {
      expect(engine.calculateDamage(6, [], [])).toBe(6);
    });

    it('should add strength stacks to base damage', () => {
      const attackerEffects: StatusEffect[] = [{ type: 'strength', stacks: 3 }];
      expect(engine.calculateDamage(6, attackerEffects, [])).toBe(9);
    });

    it('should reduce damage by 25% when attacker has weak (floor)', () => {
      const attackerEffects: StatusEffect[] = [{ type: 'weak', stacks: 1 }];
      expect(engine.calculateDamage(6, attackerEffects, [])).toBe(4); // floor(6 * 0.75) = 4
    });

    it('should increase damage by 50% when target has vulnerable (floor)', () => {
      const targetEffects: StatusEffect[] = [{ type: 'vulnerable', stacks: 1 }];
      expect(engine.calculateDamage(6, [], targetEffects)).toBe(9); // floor(6 * 1.5) = 9
    });

    it('should apply weak before vulnerable', () => {
      const attackerEffects: StatusEffect[] = [{ type: 'weak', stacks: 1 }];
      const targetEffects: StatusEffect[] = [{ type: 'vulnerable', stacks: 1 }];
      // floor(floor(6 * 0.75) * 1.5) = floor(4 * 1.5) = floor(6.0) = 6
      expect(engine.calculateDamage(6, attackerEffects, targetEffects)).toBe(6);
    });

    it('should apply strength before weak modifier', () => {
      const attackerEffects: StatusEffect[] = [
        { type: 'strength', stacks: 4 },
        { type: 'weak', stacks: 1 },
      ];
      // floor((6+4) * 0.75) = floor(7.5) = 7
      expect(engine.calculateDamage(6, attackerEffects, [])).toBe(7);
    });

    it('should cap damage at 1 when target has intangible', () => {
      const targetEffects: StatusEffect[] = [{ type: 'intangible', stacks: 1 }];
      expect(engine.calculateDamage(100, [], targetEffects)).toBe(1);
    });

    it('edge: negative base damage should return 0', () => {
      expect(engine.calculateDamage(-5, [], [])).toBe(0);
    });

    it('edge: strength can bring negative base up to 0', () => {
      const attackerEffects: StatusEffect[] = [{ type: 'strength', stacks: 3 }];
      expect(engine.calculateDamage(-5, attackerEffects, [])).toBe(0);
    });
  });

  // ── applyStatusEffect ─────────────────────────────────────────────────────

  describe('applyStatusEffect()', () => {
    it('should add a new status to the player', () => {
      const state = makeCombat();
      const result = engine.applyStatusEffect(state, 'player', 'strength', 2);

      const effect = result.player.statusEffects.find(s => s.type === 'strength');
      expect(effect?.stacks).toBe(2);
    });

    it('should stack an existing status on the player', () => {
      const player = makePlayer({ statusEffects: [{ type: 'strength', stacks: 2 }] });
      const state = makeCombat({ player });
      const result = engine.applyStatusEffect(state, 'player', 'strength', 3);

      const effect = result.player.statusEffects.find(s => s.type === 'strength');
      expect(effect?.stacks).toBe(5);
    });

    it('should add a status to the enemy at the given index', () => {
      const state = makeCombat({ enemies: [makeEnemy()] });
      const result = engine.applyStatusEffect(state, 0, 'vulnerable', 2);

      const effect = result.enemies[0].statusEffects.find(s => s.type === 'vulnerable');
      expect(effect?.stacks).toBe(2);
    });

    it('should negate a debuff when the player has artifact', () => {
      const player = makePlayer({ statusEffects: [{ type: 'artifact', stacks: 1 }] });
      const state = makeCombat({ player });
      const result = engine.applyStatusEffect(state, 'player', 'vulnerable', 2);

      const vuln = result.player.statusEffects.find(s => s.type === 'vulnerable');
      expect(vuln).toBeUndefined();
      // Artifact with stacks=1 consumed: it is immediately removed from the array.
      const artifact = result.player.statusEffects.find(s => s.type === 'artifact');
      expect(artifact).toBeUndefined();
    });

    it('should consume one artifact stack and leave the rest', () => {
      const player = makePlayer({ statusEffects: [{ type: 'artifact', stacks: 2 }] });
      const state = makeCombat({ player });
      const result = engine.applyStatusEffect(state, 'player', 'weak', 1);

      const artifact = result.player.statusEffects.find(s => s.type === 'artifact');
      expect(artifact?.stacks).toBe(1);
    });

    it('should NOT negate a buff even when artifact is present', () => {
      const player = makePlayer({ statusEffects: [{ type: 'artifact', stacks: 1 }] });
      const state = makeCombat({ player });
      const result = engine.applyStatusEffect(state, 'player', 'strength', 2);

      const strength = result.player.statusEffects.find(s => s.type === 'strength');
      expect(strength?.stacks).toBe(2);
      // Artifact should be untouched
      const artifact = result.player.statusEffects.find(s => s.type === 'artifact');
      expect(artifact?.stacks).toBe(1);
    });
  });

  // ── tickStatusEffects ─────────────────────────────────────────────────────

  describe('tickStatusEffects()', () => {
    it('should deal poison damage to player at turn-start (ignores block)', () => {
      const player = makePlayer({
        hp: 80,
        block: 10,
        statusEffects: [{ type: 'poison', stacks: 3 }],
      });
      const state = makeCombat({ player });
      const result = engine.tickStatusEffects(state, 'player', 'turn-start');

      expect(result.player.hp).toBe(77);
      expect(result.player.block).toBe(10); // block untouched
    });

    it('should decrement poison stacks after dealing damage', () => {
      const player = makePlayer({ statusEffects: [{ type: 'poison', stacks: 3 }] });
      const state = makeCombat({ player });
      const result = engine.tickStatusEffects(state, 'player', 'turn-start');

      const poison = result.player.statusEffects.find(s => s.type === 'poison');
      expect(poison?.stacks).toBe(2);
    });

    it('should deal burn damage to player at turn-end', () => {
      const player = makePlayer({ hp: 80, statusEffects: [{ type: 'burn', stacks: 2 }] });
      const state = makeCombat({ player });
      const result = engine.tickStatusEffects(state, 'player', 'turn-end');

      expect(result.player.hp).toBe(78);
      const burn = result.player.statusEffects.find(s => s.type === 'burn');
      expect(burn?.stacks).toBe(1);
    });

    it('should heal regen stacks at turn-end and decrement', () => {
      const player = makePlayer({ hp: 70, maxHp: 80, statusEffects: [{ type: 'regen', stacks: 3 }] });
      const state = makeCombat({ player });
      const result = engine.tickStatusEffects(state, 'player', 'turn-end');

      expect(result.player.hp).toBe(73);
      const regen = result.player.statusEffects.find(s => s.type === 'regen');
      expect(regen?.stacks).toBe(2);
    });

    it('should not exceed maxHp when regen heals', () => {
      const player = makePlayer({ hp: 79, maxHp: 80, statusEffects: [{ type: 'regen', stacks: 5 }] });
      const state = makeCombat({ player });
      const result = engine.tickStatusEffects(state, 'player', 'turn-end');

      expect(result.player.hp).toBe(80);
    });

    it('should gain metallicize block at player turn-start', () => {
      const player = makePlayer({ block: 0, statusEffects: [{ type: 'metallicize', stacks: 3 }] });
      const state = makeCombat({ player });
      const result = engine.tickStatusEffects(state, 'player', 'turn-start');

      expect(result.player.block).toBe(3);
    });

    it('should deal combust damage to all enemies and 1 HP to player at turn-end', () => {
      const player = makePlayer({ hp: 80, statusEffects: [{ type: 'combust', stacks: 5 }] });
      const enemies = [makeEnemy({ hp: 40 }), makeEnemy({ hp: 30 })];
      const state = makeCombat({ player, enemies });
      const result = engine.tickStatusEffects(state, 'player', 'turn-end');

      expect(result.player.hp).toBe(79);
      expect(result.enemies[0].hp).toBe(35);
      expect(result.enemies[1].hp).toBe(25);
    });

    it('should deal poison damage to enemies at turn-start', () => {
      const enemies = [makeEnemy({ hp: 40, statusEffects: [{ type: 'poison', stacks: 4 }] })];
      const state = makeCombat({ enemies });
      const result = engine.tickStatusEffects(state, 'enemies', 'turn-start');

      expect(result.enemies[0].hp).toBe(36);
      const poison = result.enemies[0].statusEffects.find(s => s.type === 'poison');
      expect(poison?.stacks).toBe(3);
    });

    it('should trigger ritual on enemy at turn-end (gains strength)', () => {
      const enemies = [makeEnemy({ statusEffects: [{ type: 'ritual', stacks: 2 }] })];
      const state = makeCombat({ enemies });
      const result = engine.tickStatusEffects(state, 'enemies', 'turn-end');

      const strength = result.enemies[0].statusEffects.find(s => s.type === 'strength');
      expect(strength?.stacks).toBe(2);
    });

    it('edge: should not tick effects that do not match the phase', () => {
      // poison triggers at turn-start, not turn-end
      const player = makePlayer({ hp: 80, statusEffects: [{ type: 'poison', stacks: 3 }] });
      const state = makeCombat({ player });
      const result = engine.tickStatusEffects(state, 'player', 'turn-end');

      expect(result.player.hp).toBe(80); // no damage
      const poison = result.player.statusEffects.find(s => s.type === 'poison');
      expect(poison?.stacks).toBe(3); // unchanged
    });
  });

  // ── expireStatusEffects ───────────────────────────────────────────────────

  describe('expireStatusEffects()', () => {
    it('should remove player status effects with stacks <= 0', () => {
      const player = makePlayer({
        statusEffects: [
          { type: 'vulnerable', stacks: 0 },
          { type: 'strength', stacks: 2 },
        ],
      });
      const state = makeCombat({ player });
      const result = engine.expireStatusEffects(state);

      expect(result.player.statusEffects.length).toBe(1);
      expect(result.player.statusEffects[0].type).toBe('strength');
    });

    it('should remove enemy status effects with stacks <= 0', () => {
      const enemies = [
        makeEnemy({ statusEffects: [{ type: 'weak', stacks: 0 }, { type: 'thorns', stacks: 2 }] }),
      ];
      const state = makeCombat({ enemies });
      const result = engine.expireStatusEffects(state);

      expect(result.enemies[0].statusEffects.length).toBe(1);
      expect(result.enemies[0].statusEffects[0].type).toBe('thorns');
    });

    it('should keep all statuses when none have stacks <= 0', () => {
      const player = makePlayer({
        statusEffects: [{ type: 'strength', stacks: 3 }, { type: 'dexterity', stacks: 1 }],
      });
      const state = makeCombat({ player });
      const result = engine.expireStatusEffects(state);

      expect(result.player.statusEffects.length).toBe(2);
    });

    it('edge: empty statusEffects arrays stay empty', () => {
      const state = makeCombat();
      const result = engine.expireStatusEffects(state);

      expect(result.player.statusEffects.length).toBe(0);
      expect(result.enemies[0].statusEffects.length).toBe(0);
    });
  });

  // ── processPlayerTurn ─────────────────────────────────────────────────────

  describe('processPlayerTurn()', () => {
    it('should set phase to player-turn and increment turn counter', () => {
      const state = makeCombat({ turn: 1, phase: 'enemy-turn' });
      const result = engine.processPlayerTurn(state, rng);

      expect(result.phase).toBe('player-turn');
      expect(result.turn).toBe(2);
    });

    it('should reset cardsPlayedThisTurn to empty', () => {
      const card = makeCard('strike');
      const state = makeCombat({ cardsPlayedThisTurn: [card] });
      const result = engine.processPlayerTurn(state, rng);

      expect(result.cardsPlayedThisTurn.length).toBe(0);
    });

    it('should reset player block (without barricade)', () => {
      const player = makePlayer({ block: 8 });
      const state = makeCombat({ player });
      const result = engine.processPlayerTurn(state, rng);

      expect(result.player.block).toBe(0);
    });

    it('should NOT reset player block when barricade is active', () => {
      const player = makePlayer({ block: 8, statusEffects: [{ type: 'barricade', stacks: 1 }] });
      const state = makeCombat({ player });
      const result = engine.processPlayerTurn(state, rng);

      expect(result.player.block).toBe(8);
    });

    it('should restore player energy to maxEnergy', () => {
      const player = makePlayer({ energy: 0, maxEnergy: 3 });
      const state = makeCombat({ player });
      const result = engine.processPlayerTurn(state, rng);

      expect(result.player.energy).toBe(3);
    });

    it('should draw 5 cards at start of turn', () => {
      const deck = Array.from({ length: 10 }, (_, i) => makeCard(`c${i}`));
      const player = makePlayer({ deck, hand: [] });
      const state = makeCombat({ player });
      const result = engine.processPlayerTurn(state, rng);

      expect(result.player.hand.length).toBe(5);
    });

    it('should NOT draw when no-draw status is active', () => {
      const player = makePlayer({
        deck: [makeCard('A'), makeCard('B')],
        statusEffects: [{ type: 'no-draw', stacks: 1 }],
      });
      const state = makeCombat({ player });
      const result = engine.processPlayerTurn(state, rng);

      expect(result.player.hand.length).toBe(0);
    });

    it('should apply player turn-start poison damage', () => {
      const player = makePlayer({ hp: 80, statusEffects: [{ type: 'poison', stacks: 3 }] });
      const state = makeCombat({ player });
      const result = engine.processPlayerTurn(state, rng);

      expect(result.player.hp).toBe(77);
    });

    it('should decrement passive player debuffs (vulnerable) at turn start', () => {
      const player = makePlayer({ statusEffects: [{ type: 'vulnerable', stacks: 2 }] });
      const state = makeCombat({ player });
      const result = engine.processPlayerTurn(state, rng);

      const vuln = result.player.statusEffects.find(s => s.type === 'vulnerable');
      expect(vuln?.stacks).toBe(1);
    });

    it('should expire player statuses decremented to 0', () => {
      const player = makePlayer({ statusEffects: [{ type: 'vulnerable', stacks: 1 }] });
      const state = makeCombat({ player });
      const result = engine.processPlayerTurn(state, rng);

      const vuln = result.player.statusEffects.find(s => s.type === 'vulnerable');
      expect(vuln).toBeUndefined();
    });
  });

  // ── processEnemyTurn ──────────────────────────────────────────────────────

  describe('processEnemyTurn()', () => {
    it('should set phase to enemy-turn', () => {
      const state = makeCombat({ phase: 'player-turn' });
      const result = engine.processEnemyTurn(state);

      expect(result.phase).toBe('enemy-turn');
    });

    it('should discard all cards from player hand', () => {
      const cards = [makeCard('A'), makeCard('B'), makeCard('C')];
      const player = makePlayer({ hand: cards });
      const state = makeCombat({ player });
      const result = engine.processEnemyTurn(state);

      expect(result.player.hand.length).toBe(0);
      expect(result.player.piles.discard.length).toBe(3);
    });

    it('should apply player turn-end burn damage', () => {
      const player = makePlayer({ hp: 80, statusEffects: [{ type: 'burn', stacks: 3 }] });
      const state = makeCombat({ player });
      const result = engine.processEnemyTurn(state);

      expect(result.player.hp).toBe(77);
    });

    it('should reset all enemy block at start of enemy turn', () => {
      const enemies = [makeEnemy({ block: 12 })];
      const state = makeCombat({ enemies });
      const result = engine.processEnemyTurn(state);

      expect(result.enemies[0].block).toBe(0);
    });

    it('should deal poison damage to enemies at start of enemy turn', () => {
      const enemies = [makeEnemy({ hp: 40, statusEffects: [{ type: 'poison', stacks: 5 }] })];
      const state = makeCombat({ enemies });
      const result = engine.processEnemyTurn(state);

      expect(result.enemies[0].hp).toBe(35);
    });

    it('should decrement passive enemy debuffs (vulnerable) during enemy turn', () => {
      const enemies = [makeEnemy({ statusEffects: [{ type: 'vulnerable', stacks: 2 }] })];
      const state = makeCombat({ enemies });
      const result = engine.processEnemyTurn(state);

      const vuln = result.enemies[0].statusEffects.find(s => s.type === 'vulnerable');
      expect(vuln?.stacks).toBe(1);
    });

    it('should expire enemy statuses decremented to 0', () => {
      const enemies = [makeEnemy({ statusEffects: [{ type: 'weak', stacks: 1 }] })];
      const state = makeCombat({ enemies });
      const result = engine.processEnemyTurn(state);

      const weak = result.enemies[0].statusEffects.find(s => s.type === 'weak');
      expect(weak).toBeUndefined();
    });
  });

  // ── checkWinLoseConditions ────────────────────────────────────────────────

  describe('checkWinLoseConditions()', () => {
    it('should return combat-end-victory when all enemies are dead', () => {
      const enemies = [makeEnemy({ hp: 0 }), makeEnemy({ hp: 0 })];
      const state = makeCombat({ enemies });

      expect(engine.checkWinLoseConditions(state)).toBe('combat-end-victory');
    });

    it('should return combat-end-defeat when player hp is 0', () => {
      const player = makePlayer({ hp: 0 });
      const state = makeCombat({ player });

      expect(engine.checkWinLoseConditions(state)).toBe('combat-end-defeat');
    });

    it('should prioritise defeat over victory (simultaneous kill)', () => {
      const player = makePlayer({ hp: 0 });
      const enemies = [makeEnemy({ hp: 0 })];
      const state = makeCombat({ player, enemies });

      expect(engine.checkWinLoseConditions(state)).toBe('combat-end-defeat');
    });

    it('should return current phase when combat is ongoing', () => {
      const state = makeCombat({ phase: 'player-turn' });

      expect(engine.checkWinLoseConditions(state)).toBe('player-turn');
    });

    it('edge: should return current phase when there are no enemies', () => {
      const state = makeCombat({ enemies: [] });

      expect(engine.checkWinLoseConditions(state)).toBe('player-turn');
    });
  });
});

