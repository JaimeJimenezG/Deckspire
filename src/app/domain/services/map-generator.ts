import { GameMap, MapNode, NodeType } from '../models/map.model';
import { SeededRandom } from './seeded-random';

// ── Constantes del mapa ──────────────────────────────────────────────────────

const MAP_CONFIG = {
  TOTAL_ROWS: 15,
  MAX_COLUMNS: 7,
  NUM_PATHS: 6,
  BOSS_ROW: 14,
  REST_ROW: 8,
} as const;

// Distribución objetivo para filas no fijas (excluye boss, rest fijo, primera fila)
const NODE_DISTRIBUTION: { type: NodeType; weight: number }[] = [
  { type: 'combat',   weight: 45 },
  { type: 'event',    weight: 22 },
  { type: 'elite',    weight: 8  },
  { type: 'rest',     weight: 12 },
  { type: 'shop',     weight: 5  },
  { type: 'treasure', weight: 8  },
];

// ── Tipos internos ───────────────────────────────────────────────────────────

/** Posición (fila, columna) de un paso de camino. */
interface Position {
  row: number;
  col: number;
}

/** Un camino completo: array de posiciones, una por fila. */
type PathTrace = Position[];

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nodeKey(row: number, col: number): string {
  return `${row}-${col}`;
}

// ── MapGenerator ─────────────────────────────────────────────────────────────

/**
 * Generador de mapas procedurales tipo Slay the Spire.
 *
 * El mapa es un DAG donde los nodos de fila 0 conectan (a través de varias
 * filas intermedias) con el boss en la fila 14.  El algoritmo tiene 4 fases:
 *   1. Trazar NUM_PATHS caminos con drift aleatorio.
 *   2. Aplicar restricción de no-cruce.
 *   3. Fusionar nodos coincidentes y deducir aristas.
 *   4. Asignar tipos a los nodos.
 */
export class MapGenerator {

  // ── Fase 1: Trazar caminos ─────────────────────────────────────────────────

  /**
   * Genera NUM_PATHS caminos desde la fila 0 hasta la fila BOSS_ROW.
   * Cada camino deriva con drift aleatorio (-1, 0, +1) por columna en cada fila.
   */
  private generatePaths(rng: SeededRandom): PathTrace[] {
    const paths: PathTrace[] = [];

    const centerCol = Math.floor(MAP_CONFIG.MAX_COLUMNS / 2);  // col 3
    // Fila desde la cual los caminos empiezan a converger gradualmente hacia el boss
    const convergenceStart = MAP_CONFIG.BOSS_ROW - 4;  // fila 10

    for (let p = 0; p < MAP_CONFIG.NUM_PATHS; p++) {
      const path: Position[] = [];
      // Todas las rutas parten del mismo nodo central en fila 0 (simetría con el boss).
      // El mapa se abre en abanico desde el inicio y converge de nuevo en el boss.
      let col = centerCol;
      path.push({ row: 0, col });

      for (let row = 1; row < MAP_CONFIG.TOTAL_ROWS; row++) {
        if (row === MAP_CONFIG.BOSS_ROW) {
          // Todas las rutas convergen al nodo central del boss
          col = centerCol;
        } else {
          const drift = rng.nextInt(-1, 1);

          if (row >= convergenceStart) {
            // En las últimas 4 filas antes del boss, añadir un empuje hacia el centro
            // para evitar nodos en columnas extremas cerca del borde superior del mapa.
            const steer = col < centerCol ? 1 : col > centerCol ? -1 : 0;
            col = clamp(col + drift + steer, 0, MAP_CONFIG.MAX_COLUMNS - 1);
          } else {
            col = clamp(col + drift, 0, MAP_CONFIG.MAX_COLUMNS - 1);
          }
        }
        path.push({ row, col });
      }

      paths.push(path);
    }

    return paths;
  }

  // ── Fase 1.5: Restricción de no-cruce ─────────────────────────────────────

  /**
   * Ordena los caminos por columna inicial (izquierda → derecha) y luego,
   * fila a fila, evita que el camino i pase a la derecha del camino i+1
   * (lo que crearía un cruce visual).
   *
   * Si se detecta un cruce se fuerza al camino a mantener la columna del paso
   * anterior (comportamiento conservador que nunca cruza).
   */
  private constrainPaths(paths: PathTrace[]): PathTrace[] {
    // Copia mutable de columnas para poder modificarlas
    const mutable: { row: number; col: number }[][] = paths.map(p =>
      p.map(pos => ({ ...pos })),
    );

    // Ordenar por columna inicial
    mutable.sort((a, b) => a[0].col - b[0].col);

    for (let row = 1; row < MAP_CONFIG.TOTAL_ROWS; row++) {
      for (let p = 0; p < mutable.length - 1; p++) {
        if (mutable[p][row].col > mutable[p + 1][row].col) {
          // El camino p está a la derecha de p+1 → cruce detectado
          // Forzar al camino p a mantenerse en su columna anterior
          mutable[p][row].col = mutable[p][row - 1].col;
        }
      }
    }

    return mutable;
  }

  // ── Fase 2: Merge de nodos y creación de aristas ──────────────────────────

  /**
   * Donde varios caminos pasan por la misma (fila, col) se crea un único nodo.
   * Las aristas (conexiones) se extraen de los segmentos consecutivos de cada camino.
   * El tipo se deja como 'combat' provisional; se sobreescribe en Fase 3.
   */
  private mergeNodes(paths: PathTrace[]): Map<string, MapNode> {
    const nodeMap = new Map<string, MapNode>();

    for (const path of paths) {
      for (let i = 0; i < path.length; i++) {
        const { row, col } = path[i];
        const key = nodeKey(row, col);

        if (!nodeMap.has(key)) {
          nodeMap.set(key, {
            id: key,
            row,
            col,
            type: 'combat',
            connections: [],
            visited: false,
          });
        }

        if (i > 0) {
          const prevKey = nodeKey(path[i - 1].row, path[i - 1].col);
          const prevNode = nodeMap.get(prevKey)!;

          if (!prevNode.connections.includes(key)) {
            // Inmutable: reemplazar el nodo con las conexiones actualizadas
            nodeMap.set(prevKey, {
              ...prevNode,
              connections: [...prevNode.connections, key],
            });
          }
        }
      }
    }

    return nodeMap;
  }

  // ── Fase 3: Asignación de tipos ───────────────────────────────────────────

  /**
   * Asigna tipos a todos los nodos respetando:
   *   - Fila 0:  siempre 'event' (Pacto de Origen)
   *   - Fila 8:  siempre 'rest'
   *   - Fila 14: siempre 'boss'
   *   - Ningún 'elite' en filas 0-4 ni en fila 13
   *   - Ningún 'elite' adyacente a otro 'elite' en el mismo camino
   *   - Ningún 'shop' en fila 0
   *   - No 2 'rest' consecutivos en un mismo camino
   *
   * Para el resto de nodos se genera un pool con la distribución objetivo,
   * se baraja con SeededRandom y se asigna respetando restricciones.
   * Si ningún elite quedó colocado, se fuerza uno en el primer nodo válido.
   */
  private assignNodeTypes(
    nodeMap: Map<string, MapNode>,
    paths: PathTrace[],
    rng: SeededRandom,
  ): Map<string, MapNode> {
    const result = new Map<string, MapNode>(nodeMap);

    // 1. Filas fijas
    for (const [key, node] of result) {
      if (node.row === 0) {
        result.set(key, { ...node, type: 'event' });
      } else if (node.row === MAP_CONFIG.REST_ROW) {
        result.set(key, { ...node, type: 'rest' });
      } else if (node.row === MAP_CONFIG.BOSS_ROW) {
        result.set(key, { ...node, type: 'boss' });
      }
    }

    // 2. Recopilar nodos que necesitan tipo libre
    const freeNodes = [...result.values()].filter(
      n => n.row !== 0 &&
           n.row !== MAP_CONFIG.REST_ROW &&
           n.row !== MAP_CONFIG.BOSS_ROW,
    );

    // 3. Construir pool según pesos y barajarlo
    const pool = this.buildTypePool(freeNodes.length, rng);

    // 4. Asignar tipos del pool, con fallback a 'combat' si hay restricción
    for (let i = 0; i < freeNodes.length; i++) {
      const node = freeNodes[i];
      const candidate = pool[i];
      const finalType = this.pickValidType(candidate, node, result, paths);
      result.set(node.id, { ...node, type: finalType });
    }

    // 5. Garantizar al menos un elite: si ninguno quedó, forzar en el primer
    //    nodo válido que sea 'combat' en filas 5-12 (sin restricción de adyacencia
    //    porque en este punto aún podemos elegir uno aislado).
    const hasElite = [...result.values()].some(n => n.type === 'elite');
    if (!hasElite) {
      const candidate = [...result.values()].find(
        n => n.type === 'combat' &&
             n.row >= 5 &&
             n.row <= 12 &&
             n.row !== MAP_CONFIG.REST_ROW &&
             !this.violatesConstraints('elite', n, result, paths),
      );
      if (candidate) {
        result.set(candidate.id, { ...candidate, type: 'elite' });
      }
    }

    return result;
  }

  /**
   * Genera un array de tipos barajado que respeta aproximadamente la
   * distribución objetivo (usando pesos).
   */
  private buildTypePool(size: number, rng: SeededRandom): NodeType[] {
    // Expandir según pesos relativos al tamaño del pool
    const totalWeight = NODE_DISTRIBUTION.reduce((s, e) => s + e.weight, 0);
    const pool: NodeType[] = [];

    for (const entry of NODE_DISTRIBUTION) {
      const count = Math.round((entry.weight / totalWeight) * size);
      for (let i = 0; i < count; i++) {
        pool.push(entry.type);
      }
    }

    // Ajustar tamaño exacto completando o recortando con 'combat'
    while (pool.length < size) pool.push('combat');
    pool.splice(size);

    // Barajar Fisher-Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool;
  }

  /**
   * Decide el tipo definitivo para un nodo aplicando restricciones.
   * Si el candidato viola alguna restricción, retorna 'combat' como fallback seguro.
   */
  private pickValidType(
    candidate: NodeType,
    node: MapNode,
    nodeMap: Map<string, MapNode>,
    paths: PathTrace[],
  ): NodeType {
    if (this.violatesConstraints(candidate, node, nodeMap, paths)) {
      return 'combat';
    }
    return candidate;
  }

  private violatesConstraints(
    type: NodeType,
    node: MapNode,
    nodeMap: Map<string, MapNode>,
    paths: PathTrace[],
  ): boolean {
    // Elite prohibido en filas 0-4 y fila 13
    if (type === 'elite' && (node.row <= 4 || node.row === 13)) return true;

    // Shop prohibido en fila 0 (ya garantizado por filas fijas, pero defensivo)
    if (type === 'shop' && node.row === 0) return true;

    // Elite no adyacente a otro elite en el mismo camino
    // Rest no consecutivo en el mismo camino
    if (type === 'elite' || type === 'rest') {
      for (const path of paths) {
        const idxInPath = path.findIndex(
          p => p.row === node.row && p.col === node.col,
        );
        if (idxInPath === -1) continue;

        // Comprobar nodo anterior en el camino
        if (idxInPath > 0) {
          const prev = path[idxInPath - 1];
          const prevNode = nodeMap.get(nodeKey(prev.row, prev.col));
          if (prevNode && prevNode.type === type) return true;
        }

        // Comprobar nodo siguiente en el camino (si ya tiene tipo asignado)
        if (idxInPath < path.length - 1) {
          const next = path[idxInPath + 1];
          const nextNode = nodeMap.get(nodeKey(next.row, next.col));
          if (nextNode && nextNode.type === type) return true;
        }
      }
    }

    return false;
  }

  // ── Fase 4: Validación ────────────────────────────────────────────────────

  /**
   * Verificaciones básicas del mapa generado.
   * Lanza un error descriptivo si alguna condición no se cumple.
   */
  private validateMap(nodeMap: Map<string, MapNode>): void {
    const nodes = [...nodeMap.values()];

    const rowCounts = new Map<number, number>();
    for (const n of nodes) {
      rowCounts.set(n.row, (rowCounts.get(n.row) ?? 0) + 1);
    }

    for (let row = 0; row < MAP_CONFIG.TOTAL_ROWS; row++) {
      if (!rowCounts.has(row) || rowCounts.get(row)! < 1) {
        throw new Error(`MapGenerator: fila ${row} no tiene nodos`);
      }
    }

    const hasElite = nodes.some(n => n.type === 'elite');
    const hasRest  = nodes.some(n => n.type === 'rest');
    if (!hasElite) throw new Error('MapGenerator: el mapa no tiene ningún elite');
    if (!hasRest)  throw new Error('MapGenerator: el mapa no tiene ningún descanso');
  }

  // ── API pública ───────────────────────────────────────────────────────────

  /**
   * Genera un mapa completo para un acto.
   * El `bossId` debe ser provisto por la capa de aplicación (sale de los datos
   * estáticos de encuentros); aquí se acepta como parámetro.
   */
  generateMap(act: number, rng: SeededRandom, bossId: string = 'unknown'): GameMap {
    const rawPaths   = this.generatePaths(rng);
    const constrained = this.constrainPaths(rawPaths);
    const nodeMap    = this.mergeNodes(constrained);
    const typedNodes = this.assignNodeTypes(nodeMap, constrained, rng);

    this.validateMap(typedNodes);

    return {
      nodes: typedNodes,
      currentNodeId: null,
      act,
      bossId,
    };
  }

  /**
   * Retorna los IDs de nodos a los que el jugador puede moverse
   * desde su posición actual.
   *
   * Si `currentNodeId` es `null` (aún no ha empezado), retorna todos
   * los nodos de la fila 0.
   */
  getReachableNodes(map: GameMap): string[] {
    if (map.currentNodeId === null) {
      return [...map.nodes.values()]
        .filter(n => n.row === 0)
        .map(n => n.id);
    }

    const current = map.nodes.get(map.currentNodeId);
    if (!current) return [];

    return [...current.connections];
  }

  /**
   * Mueve al jugador al nodo indicado.
   * Retorna un nuevo `GameMap` con el nodo marcado como visitado y
   * `currentNodeId` actualizado.  No muta el mapa recibido.
   */
  moveToNode(map: GameMap, nodeId: string): GameMap {
    const node = map.nodes.get(nodeId);
    if (!node) return map;

    const updatedNodes = new Map(map.nodes);
    updatedNodes.set(nodeId, { ...node, visited: true });

    return { ...map, nodes: updatedNodes, currentNodeId: nodeId };
  }
}
