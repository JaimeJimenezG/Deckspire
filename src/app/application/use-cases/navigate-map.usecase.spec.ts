import { GameMap, MapNode } from '../../domain/models/map.model';
import { GameState } from '../../domain/models/game-state.model';
import { Player } from '../../domain/models/player.model';
import { GameRepository } from '../../domain/ports/outbound/game-repository.port';
import { MapGenerator } from '../../domain/services/map-generator';
import { SeededRandom } from '../../domain/services/seeded-random';
import {
  NavigateMapUseCaseImpl,
  NoMapActiveError,
  NodeNotReachableError,
} from './navigate-map.usecase';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 75,
    maxHp: 75,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 99,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

/**
 * Crea un GameMap mínimo con dos nodos:
 *   - "0-0" (fila 0, tipo combat) → conecta a "1-0"
 *   - "1-0" (fila 1, tipo rest)
 *
 * El jugador aún no ha empezado (currentNodeId = null).
 */
function makeMinimalMap(overrides: Partial<GameMap> = {}): GameMap {
  const node0: MapNode = {
    id: '0-0',
    row: 0,
    col: 0,
    type: 'combat',
    connections: ['1-0'],
    visited: false,
  };
  const node1: MapNode = {
    id: '1-0',
    row: 1,
    col: 0,
    type: 'rest',
    connections: [],
    visited: false,
  };
  return {
    nodes: new Map([['0-0', node0], ['1-0', node1]]),
    currentNodeId: null,
    act: 1,
    bossId: 'the-guardian',
    ...overrides,
  };
}

/** Crea un GameMap con currentNodeId ya establecido en "0-0". */
function makeMapAtNode00(): GameMap {
  const base = makeMinimalMap();
  const node0 = base.nodes.get('0-0')!;
  const updatedNodes = new Map(base.nodes);
  updatedNodes.set('0-0', { ...node0, visited: true });
  return { ...base, nodes: updatedNodes, currentNodeId: '0-0' };
}

function makeGameState(mapOverride: GameMap | null = makeMinimalMap()): GameState {
  return {
    phase: 'map',
    gameOutcome: null,
    player: makePlayer(),
    combat: null,
    map: mapOverride,
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
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('NavigateMapUseCaseImpl', () => {
  let mockRepository: jasmine.SpyObj<GameRepository>;
  let mapGenerator: MapGenerator;
  let useCase: NavigateMapUseCaseImpl;

  beforeEach(() => {
    mockRepository = jasmine.createSpyObj<GameRepository>('GameRepository', [
      'save',
      'load',
      'deleteSave',
      'getStats',
      'updateStats',
    ]);
    mockRepository.save.and.returnValue(Promise.resolve());

    mapGenerator = new MapGenerator();
    useCase = new NavigateMapUseCaseImpl(mapGenerator, mockRepository);
  });

  // ── Guards ────────────────────────────────────────────────────────────────

  it('should throw NoMapActiveError when state has no map', async () => {
    const state = makeGameState(null);
    await expectAsync(useCase.execute('0-0', state)).toBeRejectedWith(
      jasmine.any(NoMapActiveError),
    );
  });

  it('should throw NodeNotReachableError when target is not reachable', async () => {
    // El mapa empieza con currentNodeId null; sólo la fila 0 es alcanzable.
    // "1-0" no es alcanzable directamente desde el inicio.
    const state = makeGameState(makeMinimalMap());
    await expectAsync(useCase.execute('1-0', state)).toBeRejectedWith(
      jasmine.any(NodeNotReachableError),
    );
  });

  it('should throw NodeNotReachableError for a completely unknown nodeId', async () => {
    const state = makeGameState(makeMinimalMap());
    await expectAsync(useCase.execute('99-99', state)).toBeRejectedWith(
      jasmine.any(NodeNotReachableError),
    );
  });

  // ── Happy path: fase del nodo ─────────────────────────────────────────────

  it('should transition to "combat" when navigating to a combat node (row 0)', async () => {
    const state = makeGameState(makeMinimalMap());
    const result = await useCase.execute('0-0', state);
    expect(result.phase).toBe('combat');
  });

  it('should transition to "rest" when navigating to a rest node', async () => {
    // Desde node "0-0" (ya visitado) el jugador puede ir a "1-0" (rest)
    const state = makeGameState(makeMapAtNode00());
    const result = await useCase.execute('1-0', state);
    expect(result.phase).toBe('rest');
  });

  it('should transition to "combat" for an elite node', async () => {
    const eliteNode: MapNode = {
      id: '0-0',
      row: 0,
      col: 0,
      type: 'elite',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-0', eliteNode]]),
      currentNodeId: null,
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('0-0', state);
    expect(result.phase).toBe('combat');
  });

  it('should transition to "combat" for a boss node', async () => {
    const bossNode: MapNode = {
      id: '0-0',
      row: 0,
      col: 0,
      type: 'boss',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-0', bossNode]]),
      currentNodeId: null,
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('0-0', state);
    expect(result.phase).toBe('combat');
  });

  it('should transition to "shop" for a shop node', async () => {
    const shopNode: MapNode = {
      id: '0-0',
      row: 0,
      col: 0,
      type: 'shop',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-0', shopNode]]),
      currentNodeId: null,
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('0-0', state);
    expect(result.phase).toBe('shop');
  });

  it('should initialize shop state when navigating to a shop node', async () => {
    const shopNode: MapNode = {
      id: '0-0',
      row: 0,
      col: 0,
      type: 'shop',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-0', shopNode]]),
      currentNodeId: null,
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('0-0', state);
    expect(result.shop).not.toBeNull();
    expect(result.shop!.items.length).toBeGreaterThan(0);
    expect(result.shop!.purgePrice).toBeGreaterThan(0);
  });

  it('should keep shop null when navigating to a non-shop node', async () => {
    const state = makeGameState(makeMinimalMap());
    const result = await useCase.execute('0-0', state);
    expect(result.phase).toBe('combat');
    expect(result.shop).toBeNull();
  });

  it('should transition to "reward" for a treasure node', async () => {
    const treasureNode: MapNode = {
      id: '0-0',
      row: 0,
      col: 0,
      type: 'treasure',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-0', treasureNode]]),
      currentNodeId: null,
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('0-0', state);
    expect(result.phase).toBe('reward');
  });

  it('should initialize reward state when navigating to a treasure node', async () => {
    const treasureNode: MapNode = {
      id: '0-0',
      row: 0,
      col: 0,
      type: 'treasure',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-0', treasureNode]]),
      currentNodeId: null,
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('0-0', state);
    expect(result.reward).not.toBeNull();
    expect(result.reward!.cardOptions.length).toBeGreaterThan(0);
    expect(result.reward!.gold).toBeGreaterThanOrEqual(0);
  });

  it('should keep reward null when navigating to a non-treasure node', async () => {
    const state = makeGameState(makeMinimalMap());
    const result = await useCase.execute('0-0', state);
    expect(result.phase).toBe('combat');
    expect(result.reward).toBeNull();
  });

  it('should transition to "event" phase for an event node', async () => {
    const eventNode: MapNode = {
      id: '0-0',
      row: 0,
      col: 0,
      type: 'event',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-0', eventNode]]),
      currentNodeId: null,
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('0-0', state);
    expect(result.phase).toBe('event');
    expect(result.event).not.toBeNull();
    expect(result.event!.chosenId).toBeNull();
  });

  it('should generate the first-node "Pacto de Origen" event for row-0 event nodes', async () => {
    const firstNode: MapNode = {
      id: '0-3',
      row: 0,
      col: 3,
      type: 'event',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-3', firstNode]]),
      currentNodeId: null,
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('0-3', state);
    expect(result.event).not.toBeNull();
    expect(result.event!.event.id).toBe('origin-pact');
    expect(result.event!.event.choices.length).toBe(3);
    const categories = result.event!.event.choices.map(c => c.category);
    expect(categories).toContain('good-now');
    expect(categories).toContain('good-later');
    expect(categories).toContain('uncertain');
  });

  it('should use a regular event for row > 0 event nodes', async () => {
    // El nodo parent (fila 0) está ya visitado y conecta al nodo de evento en fila 1
    const parentNode: MapNode = {
      id: '0-2',
      row: 0,
      col: 2,
      type: 'event',
      connections: ['1-2'],
      visited: true,
    };
    const lateNode: MapNode = {
      id: '1-2',
      row: 1,
      col: 2,
      type: 'event',
      connections: [],
      visited: false,
    };
    const map: GameMap = {
      nodes: new Map([['0-2', parentNode], ['1-2', lateNode]]),
      currentNodeId: '0-2',
      act: 1,
      bossId: 'the-guardian',
    };
    const state = makeGameState(map);
    const result = await useCase.execute('1-2', state);
    expect(result.event).not.toBeNull();
    expect(result.event!.event.id).not.toBe('origin-pact');
  });

  // ── Happy path: actualización del mapa ───────────────────────────────────

  it('should mark the target node as visited', async () => {
    const state = makeGameState(makeMinimalMap());
    const result = await useCase.execute('0-0', state);
    expect(result.map!.nodes.get('0-0')!.visited).toBeTrue();
  });

  it('should set currentNodeId to the navigated node', async () => {
    const state = makeGameState(makeMinimalMap());
    const result = await useCase.execute('0-0', state);
    expect(result.map!.currentNodeId).toBe('0-0');
  });

  it('should not mutate the original map', async () => {
    const state = makeGameState(makeMinimalMap());
    const originalCurrentNodeId = state.map!.currentNodeId;
    await useCase.execute('0-0', state);
    expect(state.map!.currentNodeId).toBe(originalCurrentNodeId);
  });

  // ── Happy path: floor ─────────────────────────────────────────────────────

  it('should set floor to node.row + 1', async () => {
    // "0-0" tiene row=0 → floor debe ser 1
    const state = makeGameState(makeMinimalMap());
    const result = await useCase.execute('0-0', state);
    expect(result.floor).toBe(1);
  });

  it('should update floor correctly when advancing to row 1', async () => {
    // Desde "0-0" (visitado) navegamos a "1-0" (row=1) → floor debe ser 2
    const state = makeGameState(makeMapAtNode00());
    const result = await useCase.execute('1-0', state);
    expect(result.floor).toBe(2);
  });

  // ── Auto-guardado ─────────────────────────────────────────────────────────

  it('should call repository.save exactly once', async () => {
    const state = makeGameState(makeMinimalMap());
    await useCase.execute('0-0', state);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should call repository.save with the updated state', async () => {
    const state = makeGameState(makeMinimalMap());
    const result = await useCase.execute('0-0', state);
    expect(mockRepository.save).toHaveBeenCalledWith(result);
  });

  it('should preserve other GameState fields', async () => {
    const state = makeGameState(makeMinimalMap());
    const result = await useCase.execute('0-0', state);
    expect(result.seed).toBe(state.seed);
    expect(result.gold).toBe(state.gold);
    expect(result.act).toBe(state.act);
    expect(result.relics).toBe(state.relics);
    expect(result.player).toBe(state.player);
  });

  // ── Integración con MapGenerator real ────────────────────────────────────

  it('should navigate through a procedurally generated map (seed 42)', async () => {
    const rng = new SeededRandom(42);
    const generatedMap = mapGenerator.generateMap(1, rng, 'the-guardian');
    const state = makeGameState(generatedMap);

    // El jugador puede moverse a cualquier nodo de la fila 0
    const reachable = mapGenerator.getReachableNodes(generatedMap);
    expect(reachable.length).toBeGreaterThan(0);

    const firstNodeId = reachable[0];
    const result = await useCase.execute(firstNodeId, state);

    expect(result.map!.currentNodeId).toBe(firstNodeId);
    expect(result.map!.nodes.get(firstNodeId)!.visited).toBeTrue();
  });

  it('should only allow reaching row-1 nodes after stepping on row-0 (generated map)', async () => {
    const rng = new SeededRandom(99);
    const generatedMap = mapGenerator.generateMap(1, rng, 'the-guardian');
    const state = makeGameState(generatedMap);

    // Entrar al primer nodo de fila 0
    const row0Nodes = mapGenerator.getReachableNodes(generatedMap);
    const firstId = row0Nodes[0];
    const afterFirst = await useCase.execute(firstId, state);

    // Ahora sólo los hijos directos (fila 1 conectados) son alcanzables
    const reachableAfter = mapGenerator.getReachableNodes(afterFirst.map!);
    const allInRow1OrHigher = reachableAfter.every(id => {
      const node = afterFirst.map!.nodes.get(id)!;
      return node.row > 0;
    });
    expect(allInRow1OrHigher).toBeTrue();
  });
});
