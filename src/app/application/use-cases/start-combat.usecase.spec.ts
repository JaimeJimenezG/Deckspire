import { Card } from '../../domain/models/card.model';
import { GameState } from '../../domain/models/game-state.model';
import { GameMap, MapNode } from '../../domain/models/map.model';
import { Player } from '../../domain/models/player.model';
import { CombatEngine } from '../../domain/services/combat-engine';
import { DeckManager } from '../../domain/services/deck-manager';
import { EnemyAI } from '../../domain/services/enemy-ai';
import {
  NoCurrentNodeError,
  NoMapError,
  StartCombatUseCaseImpl,
  UnexpectedNodeTypeError,
  UnknownEnemyError,
} from './start-combat.usecase';

// ---------------------------------------------------------------------------
// Fixtures
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

/** Mazo de inicio con 5 Strike + 4 Defend (igual al mazo real del juego). */
const STARTER_CARDS: Card[] = [
  ...Array(5).fill(strikeCard),
  ...Array(4).fill(defendCard),
];

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 80,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 99,
    deck: STARTER_CARDS,
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

function makeMapNode(
  id: string,
  row: number,
  col: number,
  type: MapNode['type'],
): MapNode {
  return { id, row, col, type, connections: [], visited: true };
}

function makeMap(
  currentNodeId: string | null,
  nodeType: MapNode['type'] = 'combat',
  bossId = 'the-guardian',
  act = 1,
): GameMap {
  const nodeId = 'test-node';
  const nodes = new Map<string, MapNode>();
  nodes.set(nodeId, makeMapNode(nodeId, 0, 0, nodeType));
  return {
    nodes,
    currentNodeId,
    act,
    bossId,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'map',
    gameOutcome: null,
    player: makePlayer(),
    combat: null,
    map: makeMap('test-node'),
    deck: STARTER_CARDS,
    gold: 99,
    floor: 1,
    act: 1,
    seed: 42,
    relics: [],
    shop: null,
    reward: null,
    event: null,
    pendingBossRelics: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('StartCombatUseCaseImpl', () => {
  let useCase: StartCombatUseCaseImpl;

  beforeEach(() => {
    const deckManager = new DeckManager();
    const combatEngine = new CombatEngine(deckManager);
    const enemyAI = new EnemyAI();
    useCase = new StartCombatUseCaseImpl(combatEngine, enemyAI);
  });

  // ── Guards ────────────────────────────────────────────────────────────────

  it('should throw NoMapError when state has no map', async () => {
    const state = makeGameState({ map: null });
    await expectAsync(useCase.execute(state)).toBeRejectedWith(jasmine.any(NoMapError));
  });

  it('should throw NoCurrentNodeError when currentNodeId is null', async () => {
    const state = makeGameState({ map: makeMap(null) });
    await expectAsync(useCase.execute(state)).toBeRejectedWith(jasmine.any(NoCurrentNodeError));
  });

  it('should throw UnexpectedNodeTypeError for a rest node', async () => {
    const state = makeGameState({ map: makeMap('test-node', 'rest') });
    await expectAsync(useCase.execute(state)).toBeRejectedWith(
      jasmine.any(UnexpectedNodeTypeError),
    );
  });

  it('should throw UnexpectedNodeTypeError for a shop node', async () => {
    const state = makeGameState({ map: makeMap('test-node', 'shop') });
    await expectAsync(useCase.execute(state)).toBeRejectedWith(
      jasmine.any(UnexpectedNodeTypeError),
    );
  });

  it('should throw UnexpectedNodeTypeError for an event node', async () => {
    const state = makeGameState({ map: makeMap('test-node', 'event') });
    await expectAsync(useCase.execute(state)).toBeRejectedWith(
      jasmine.any(UnexpectedNodeTypeError),
    );
  });

  it('should throw UnexpectedNodeTypeError for a treasure node', async () => {
    const state = makeGameState({ map: makeMap('test-node', 'treasure') });
    await expectAsync(useCase.execute(state)).toBeRejectedWith(
      jasmine.any(UnexpectedNodeTypeError),
    );
  });

  // ── Happy path — combat node ───────────────────────────────────────────────

  it('should set phase to "combat" after starting a combat-node encounter', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.phase).toBe('combat');
  });

  it('should produce a non-null CombatState', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.combat).not.toBeNull();
  });

  it('should spawn at least one enemy in the combat', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.combat!.enemies.length).toBeGreaterThan(0);
  });

  it('should give every enemy a non-null initial intent', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    for (const enemy of result.combat!.enemies) {
      expect(enemy.currentIntent).not.toBeNull();
    }
  });

  it('should draw 5 cards into the player hand', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.combat!.player.hand.length).toBe(5);
  });

  it('should reset player block to 0 at combat start', async () => {
    const state = makeGameState({ player: makePlayer({ block: 99 }) });
    const result = await useCase.execute(state);
    expect(result.combat!.player.block).toBe(0);
  });

  it('should restore player energy to maxEnergy at combat start', async () => {
    const state = makeGameState({ player: makePlayer({ energy: 0 }) });
    const result = await useCase.execute(state);
    expect(result.combat!.player.energy).toBe(state.player.maxEnergy);
  });

  it('should set combat turn to 1', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.combat!.turn).toBe(1);
  });

  it('should set combat phase to "player-turn"', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.combat!.phase).toBe('player-turn');
  });

  // ── Happy path — elite node ────────────────────────────────────────────────

  it('should spawn enemies for an elite node', async () => {
    const state = makeGameState({ map: makeMap('test-node', 'elite') });
    const result = await useCase.execute(state);
    expect(result.combat!.enemies.length).toBeGreaterThan(0);
  });

  it('should assign intents to elite enemies', async () => {
    const state = makeGameState({ map: makeMap('test-node', 'elite') });
    const result = await useCase.execute(state);
    for (const enemy of result.combat!.enemies) {
      expect(enemy.currentIntent).not.toBeNull();
    }
  });

  // ── Happy path — boss node ─────────────────────────────────────────────────

  it('should spawn exactly the boss enemy for a boss node', async () => {
    const bossId = 'the-guardian';
    const state = makeGameState({ map: makeMap('test-node', 'boss', bossId) });
    const result = await useCase.execute(state);
    expect(result.combat!.enemies.length).toBe(1);
    expect(result.combat!.enemies[0].definitionId).toBe(bossId);
  });

  it('should assign an intent to the boss', async () => {
    const state = makeGameState({ map: makeMap('test-node', 'boss', 'hexaghost') });
    const result = await useCase.execute(state);
    expect(result.combat!.enemies[0].currentIntent).not.toBeNull();
  });

  // ── Determinism ────────────────────────────────────────────────────────────

  it('should produce the same encounter for the same seed+floor', async () => {
    const state = makeGameState({ seed: 999, floor: 3 });
    const result1 = await useCase.execute(state);
    const result2 = await useCase.execute(state);

    const ids1 = result1.combat!.enemies.map(e => e.definitionId);
    const ids2 = result2.combat!.enemies.map(e => e.definitionId);
    expect(ids1).toEqual(ids2);

    const hp1 = result1.combat!.enemies.map(e => e.maxHp);
    const hp2 = result2.combat!.enemies.map(e => e.maxHp);
    expect(hp1).toEqual(hp2);
  });

  it('should potentially produce different encounters for different floors', async () => {
    const state1 = makeGameState({ seed: 1, floor: 1 });
    const state2 = makeGameState({ seed: 1, floor: 10 });
    const result1 = await useCase.execute(state1);
    const result2 = await useCase.execute(state2);

    // With different floors the RNG starts at a different point;
    // at minimum we verify both resolve without error.
    expect(result1.combat).not.toBeNull();
    expect(result2.combat).not.toBeNull();
  });

  // ── Error — ID de enemigo desconocido ─────────────────────────────────────

  it('should throw UnknownEnemyError when the boss ID is not in ENEMIES_BY_ID', async () => {
    const state = makeGameState({
      map: makeMap('test-node', 'boss', 'nonexistent-monster'),
    });
    await expectAsync(useCase.execute(state)).toBeRejectedWith(jasmine.any(UnknownEnemyError));
  });

  // ── Preservación de estado ─────────────────────────────────────────────────

  it('should preserve seed, gold, floor, act and relics in the returned state', async () => {
    const state = makeGameState({ seed: 77, gold: 150, floor: 5, act: 2, relics: ['burning-blood'] });
    const result = await useCase.execute(state);
    expect(result.seed).toBe(77);
    expect(result.gold).toBe(150);
    expect(result.floor).toBe(5);
    expect(result.act).toBe(2);
    expect(result.relics).toEqual(['burning-blood']);
  });

  it('should preserve the map reference in the returned state', async () => {
    const state = makeGameState();
    const result = await useCase.execute(state);
    expect(result.map).toBe(state.map);
  });
});
