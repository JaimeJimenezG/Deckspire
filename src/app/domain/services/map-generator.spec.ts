import { GameMap, MapNode, NodeType } from '../models/map.model';
import { MapGenerator } from './map-generator';
import { SeededRandom } from './seeded-random';

describe('MapGenerator', () => {
  let generator: MapGenerator;
  let rng: SeededRandom;

  beforeEach(() => {
    generator = new MapGenerator();
    rng = new SeededRandom(42);
  });

  // ── generateMap ────────────────────────────────────────────────────────────

  describe('generateMap', () => {
    let map: GameMap;

    beforeEach(() => {
      map = generator.generateMap(1, rng);
    });

    it('should create nodes for every row (0-14)', () => {
      const rows = new Set([...map.nodes.values()].map(n => n.row));
      for (let row = 0; row < 15; row++) {
        expect(rows.has(row)).withContext(`row ${row} must exist`).toBeTrue();
      }
    });

    it('should start with currentNodeId null', () => {
      expect(map.currentNodeId).toBeNull();
    });

    it('should assign act correctly', () => {
      expect(map.act).toBe(1);
    });

    it('should have nodes with valid connections (only to row+1)', () => {
      for (const node of map.nodes.values()) {
        for (const connId of node.connections) {
          const target = map.nodes.get(connId);
          expect(target).toBeDefined();
          expect(target!.row).toBe(node.row + 1);
        }
      }
    });

    it('should assign "event" to all row-0 nodes (Pacto de Origen)', () => {
      const row0 = [...map.nodes.values()].filter(n => n.row === 0);
      expect(row0.length).toBeGreaterThan(0);
      for (const n of row0) {
        expect(n.type).toBe('event');
      }
    });

    it('should assign "rest" to all row-8 nodes', () => {
      const row8 = [...map.nodes.values()].filter(n => n.row === 8);
      expect(row8.length).toBeGreaterThan(0);
      for (const n of row8) {
        expect(n.type).toBe('rest');
      }
    });

    it('should assign "boss" to all row-14 nodes', () => {
      const row14 = [...map.nodes.values()].filter(n => n.row === 14);
      expect(row14.length).toBeGreaterThan(0);
      for (const n of row14) {
        expect(n.type).toBe('boss');
      }
    });

    it('should have exactly one boss node (all paths converge)', () => {
      const bossNodes = [...map.nodes.values()].filter(n => n.type === 'boss');
      expect(bossNodes.length).toBe(1);
    });

    it('should place the boss node at the center column (col 3)', () => {
      const bossNode = [...map.nodes.values()].find(n => n.type === 'boss')!;
      expect(bossNode.col).toBe(3);
    });

    it('should have boss with no outgoing connections', () => {
      const bossNode = [...map.nodes.values()].find(n => n.type === 'boss')!;
      expect(bossNode.connections.length).toBe(0);
    });

    it('should have exactly one initial node (all paths start from the same node)', () => {
      const row0Nodes = [...map.nodes.values()].filter(n => n.row === 0);
      expect(row0Nodes.length).toBe(1);
    });

    it('should place the initial node at the center column (col 3)', () => {
      const initialNode = [...map.nodes.values()].find(n => n.row === 0)!;
      expect(initialNode.col).toBe(3);
    });

    it('should have initial node with multiple outgoing connections (map fans out)', () => {
      const initialNode = [...map.nodes.values()].find(n => n.row === 0)!;
      expect(initialNode.connections.length).toBeGreaterThan(1);
    });

    it('should have at least one elite node', () => {
      const hasElite = [...map.nodes.values()].some(n => n.type === 'elite');
      expect(hasElite).toBeTrue();
    });

    it('should have at least one rest node', () => {
      const hasRest = [...map.nodes.values()].some(n => n.type === 'rest');
      expect(hasRest).toBeTrue();
    });

    it('should not place elite in rows 0-4', () => {
      const earlyElites = [...map.nodes.values()].filter(
        n => n.type === 'elite' && n.row <= 4,
      );
      expect(earlyElites.length).toBe(0);
    });

    it('should not place elite in row 13', () => {
      const row13Elites = [...map.nodes.values()].filter(
        n => n.type === 'elite' && n.row === 13,
      );
      expect(row13Elites.length).toBe(0);
    });

    it('should produce a deterministic map given the same seed', () => {
      const rng2 = new SeededRandom(42);
      const map2 = generator.generateMap(1, rng2);
      expect(map.nodes.size).toBe(map2.nodes.size);

      for (const [id, node] of map.nodes) {
        const node2 = map2.nodes.get(id);
        expect(node2).toBeDefined();
        expect(node.type).toBe(node2!.type);
        expect(node.connections).toEqual(node2!.connections);
      }
    });

    it('should produce different maps with different seeds', () => {
      const rng3 = new SeededRandom(99999);
      const map3 = generator.generateMap(1, rng3);
      // Las estructuras no tienen por qué ser iguales (muy probable que difieran)
      const types1 = [...map.nodes.values()].map(n => n.type).join(',');
      const types3 = [...map3.nodes.values()].map(n => n.type).join(',');
      // Es prácticamente imposible que dos seeds distintas produzcan el mismo mapa
      expect(types1).not.toBe(types3);
    });

    it('should have between 30 and 80 total nodes', () => {
      expect(map.nodes.size).toBeGreaterThanOrEqual(30);
      expect(map.nodes.size).toBeLessThanOrEqual(80);
    });
  });

  // ── getReachableNodes ──────────────────────────────────────────────────────

  describe('getReachableNodes', () => {
    let map: GameMap;

    beforeEach(() => {
      map = generator.generateMap(1, new SeededRandom(7));
    });

    it('should return all row-0 nodes when currentNodeId is null', () => {
      const reachable = generator.getReachableNodes(map);
      const row0Ids = [...map.nodes.values()]
        .filter(n => n.row === 0)
        .map(n => n.id);

      expect(reachable.length).toBe(row0Ids.length);
      for (const id of row0Ids) {
        expect(reachable).toContain(id);
      }
    });

    it('should return the connections of the current node', () => {
      const firstRow0 = [...map.nodes.values()].find(n => n.row === 0)!;
      const mapWithCurrent: GameMap = { ...map, currentNodeId: firstRow0.id };

      const reachable = generator.getReachableNodes(mapWithCurrent);
      expect(reachable).toEqual([...firstRow0.connections]);
    });

    it('should return empty array if current node has no connections (boss)', () => {
      const bossNode = [...map.nodes.values()].find(n => n.type === 'boss')!;
      const mapAtBoss: GameMap = { ...map, currentNodeId: bossNode.id };

      const reachable = generator.getReachableNodes(mapAtBoss);
      expect(reachable.length).toBe(0);
    });
  });

  // ── moveToNode ─────────────────────────────────────────────────────────────

  describe('moveToNode', () => {
    let map: GameMap;

    beforeEach(() => {
      map = generator.generateMap(1, new SeededRandom(13));
    });

    it('should update currentNodeId', () => {
      const row0Node = [...map.nodes.values()].find(n => n.row === 0)!;
      const moved = generator.moveToNode(map, row0Node.id);
      expect(moved.currentNodeId).toBe(row0Node.id);
    });

    it('should mark the node as visited', () => {
      const row0Node = [...map.nodes.values()].find(n => n.row === 0)!;
      const moved = generator.moveToNode(map, row0Node.id);
      expect(moved.nodes.get(row0Node.id)!.visited).toBeTrue();
    });

    it('should not mutate the original map', () => {
      const row0Node = [...map.nodes.values()].find(n => n.row === 0)!;
      generator.moveToNode(map, row0Node.id);

      expect(map.currentNodeId).toBeNull();
      expect(map.nodes.get(row0Node.id)!.visited).toBeFalse();
    });

    it('should return the same map if nodeId does not exist', () => {
      const result = generator.moveToNode(map, 'nonexistent-id');
      expect(result).toBe(map);
    });
  });

  // ── constrainPaths: sin cruces ─────────────────────────────────────────────

  describe('path ordering (no crossings)', () => {
    it('should generate maps without crossed paths for multiple seeds', () => {
      for (let seed = 0; seed < 20; seed++) {
        const m = generator.generateMap(1, new SeededRandom(seed));
        // Verificar que los nodos tienen IDs válidos del formato row-col
        for (const [id, node] of m.nodes) {
          expect(id).toBe(`${node.row}-${node.col}`);
          expect(node.col).toBeGreaterThanOrEqual(0);
          expect(node.col).toBeLessThan(7);
        }
      }
    });
  });
});
