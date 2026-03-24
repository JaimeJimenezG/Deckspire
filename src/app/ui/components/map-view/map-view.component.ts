import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { GameMap, MapNode, NodeType } from '../../../domain/models/map.model';
import { GameStateStore } from '../../game-state.store';

// ── Constantes de layout ──────────────────────────────────────────────────────

const ROW_HEIGHT = 80;   // px entre filas verticales
const COL_WIDTH  = 80;   // px entre columnas horizontales
const PADDING_X  = 64;   // margen horizontal del SVG
const PADDING_Y  = 100;  // margen vertical del SVG (generoso para que el boss quede lejos del borde)
const TOTAL_ROWS = 15;   // filas 0-14 (fila 14 = boss)
const MAX_COLS   = 7;    // columnas 0-6
const JITTER_MAX = 7;    // desplazamiento orgánico máximo (px)

/** Ancho total del SVG en píxeles. */
export const SVG_W = PADDING_X * 2 + (MAX_COLS - 1) * COL_WIDTH;   // 624

/** Alto total del SVG en píxeles. */
export const SVG_H = PADDING_Y * 2 + (TOTAL_ROWS - 1) * ROW_HEIGHT; // 1248

// ── Tipos de vista ────────────────────────────────────────────────────────────

export type NodeState = 'current' | 'visited' | 'reachable' | 'unreachable';
export type EdgeState = 'visited' | 'reachable' | 'future';

export interface MapNodeView {
  readonly id: string;
  readonly type: NodeType;
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly nodeState: NodeState;
  readonly label: string;
  readonly icon: string;
  readonly color: string;
  readonly radius: number;
  readonly fontSize: number;
}

export interface MapEdgeView {
  readonly id: string;
  readonly path: string;
  readonly state: EdgeState;
}

interface TooltipData {
  readonly label: string;
  readonly type: NodeType;
  readonly icon: string;
  readonly x: number;
  readonly y: number;
}

// ── Datos de nodos ────────────────────────────────────────────────────────────

const NODE_LABELS: Record<NodeType, string> = {
  combat:   'Combate',
  elite:    'Élite',
  rest:     'Descanso',
  shop:     'Tienda',
  treasure: 'Tesoro',
  event:    'Evento',
  boss:     'Jefe Final',
};

const NODE_ICONS: Record<NodeType, string> = {
  combat:   '⚔',
  elite:    '☠',
  rest:     '🔥',
  shop:     '$',
  treasure: '◆',
  event:    '?',
  boss:     '♛',
};

const NODE_COLORS: Record<NodeType, string> = {
  combat:   '#c84b31',
  elite:    '#ff6b35',
  rest:     '#2eb872',
  shop:     '#f0c040',
  treasure: '#f0c040',
  event:    '#6b7fd7',
  boss:     '#e94560',
};

const NODE_RADIUS: Record<NodeType, number> = {
  combat:   17,
  elite:    19,
  rest:     17,
  shop:     17,
  treasure: 17,
  event:    17,
  boss:     23,
};

const NODE_FONT: Record<NodeType, number> = {
  combat:   12,
  elite:    13,
  rest:     12,
  shop:     14,
  treasure: 12,
  event:    16,
  boss:     18,
};

// ── Helpers puros ─────────────────────────────────────────────────────────────

/** Coordenada X base de una columna. */
function colToX(col: number): number {
  return PADDING_X + col * COL_WIDTH;
}

/** Coordenada Y base de una fila (fila 0 = abajo, fila 14 = arriba). */
function rowToY(row: number): number {
  return SVG_H - PADDING_Y - row * ROW_HEIGHT;
}

/**
 * Jitter determinista basado en hash de string.
 * Garantiza que el mismo nodo siempre ocupe la misma posición visual.
 */
export function deterministicJitter(seed: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  const range = max * 2 + 1;
  return ((hash % range) + range) % range - max;
}

/** Genera un SVG path bezier cúbico entre dos puntos. */
export function bezierPath(
  from: { x: number; y: number },
  to:   { x: number; y: number },
): string {
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}

/** Devuelve el conjunto de IDs de nodos alcanzables desde la posición actual. */
function reachableSet(map: GameMap): Set<string> {
  if (map.currentNodeId === null) {
    const s = new Set<string>();
    for (const node of map.nodes.values()) {
      if (node.row === 0) s.add(node.id);
    }
    return s;
  }
  const current = map.nodes.get(map.currentNodeId);
  return current ? new Set(current.connections) : new Set();
}

// ── Componente ────────────────────────────────────────────────────────────────

/**
 * Vista del mapa procedural tipo Slay the Spire.
 *
 * Responsabilidades:
 *  - Renderizar el DAG del mapa como SVG con scroll vertical.
 *  - Mostrar iconos de tipo en cada nodo (combate, élite, descanso, etc.).
 *  - Pintar conexiones bezier con 3 estados visuales (visitado, alcanzable, futuro).
 *  - Aplicar 4 estados visuales a cada nodo (unreachable, reachable, current, visited).
 *  - Gestionar click en nodos alcanzables → NavigateMapUseCase vía GameStateStore.
 *  - Mostrar tooltip al hacer hover sobre cualquier nodo.
 *  - Auto-scroll al nodo actual cuando el jugador navega.
 */
@Component({
  selector: 'app-map-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss',
})
export class MapViewComponent {
  private readonly store = inject(GameStateStore);
  private readonly scrollEl =
    viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  // ── Señales de interacción ────────────────────────────────────────────────

  readonly hoveredNodeId = signal<string | null>(null);
  readonly mousePos = signal<{ x: number; y: number } | null>(null);

  // ── Dimensiones del SVG (expuestas al template) ───────────────────────────

  readonly svgWidth  = SVG_W;
  readonly svgHeight = SVG_H;

  // ── Posiciones precalculadas (evitar recomputar en nodes y edges) ─────────

  private readonly positions = computed<ReadonlyMap<string, { x: number; y: number }>>(() => {
    const map = this.store.map();
    if (!map) return new Map();

    const result = new Map<string, { x: number; y: number }>();
    for (const node of map.nodes.values()) {
      result.set(node.id, {
        x: colToX(node.col) + deterministicJitter(node.id + 'x', JITTER_MAX),
        y: rowToY(node.row)  + deterministicJitter(node.id + 'y', JITTER_MAX),
      });
    }
    return result;
  });

  // ── Nodos con estado visual y coordenadas SVG ─────────────────────────────

  readonly nodes = computed<MapNodeView[]>(() => {
    const map = this.store.map();
    if (!map) return [];

    const reach = reachableSet(map);
    const pos   = this.positions();

    return [...map.nodes.values()].map(node => {
      const { x, y } = pos.get(node.id) ?? { x: colToX(node.col), y: rowToY(node.row) };
      return {
        id:        node.id,
        type:      node.type,
        row:       node.row,
        col:       node.col,
        x,
        y,
        nodeState: nodeStateOf(node, map.currentNodeId, reach),
        label:     NODE_LABELS[node.type],
        icon:      NODE_ICONS[node.type],
        color:     NODE_COLORS[node.type],
        radius:    NODE_RADIUS[node.type],
        fontSize:  NODE_FONT[node.type],
      };
    });
  });

  // ── Aristas (conexiones bezier) ───────────────────────────────────────────

  readonly edges = computed<MapEdgeView[]>(() => {
    const map = this.store.map();
    if (!map) return [];

    const pos   = this.positions();
    const reach = reachableSet(map);
    const edges: MapEdgeView[] = [];

    for (const node of map.nodes.values()) {
      const fromPos = pos.get(node.id);
      if (!fromPos) continue;

      for (const connId of node.connections) {
        const toPos = pos.get(connId);
        if (!toPos) continue;

        const toNode = map.nodes.get(connId);
        edges.push({
          id:    `${node.id}->${connId}`,
          path:  bezierPath(fromPos, toPos),
          state: edgeStateOf(node, toNode, map.currentNodeId, reach),
        });
      }
    }

    return edges;
  });

  // ── Tooltip ───────────────────────────────────────────────────────────────

  readonly tooltipData = computed<TooltipData | null>(() => {
    const id  = this.hoveredNodeId();
    const mp  = this.mousePos();
    if (!id || !mp) return null;

    const node = this.nodes().find(n => n.id === id);
    if (!node) return null;

    return { label: node.label, type: node.type, icon: node.icon, x: mp.x, y: mp.y };
  });

  // ── Auto-scroll al nodo actual ────────────────────────────────────────────

  constructor() {
    effect(() => {
      const map = this.store.map();
      if (!map) return;

      // Sin nodo actual: ir al inicio (fila 0 = parte inferior del SVG).
      // Se usa un delay de 80ms igual que scrollToNode para garantizar que el
      // layout SVG esté completamente calculado antes de leer scrollHeight.
      if (!map.currentNodeId) {
        setTimeout(() => {
          const el = this.scrollEl()?.nativeElement;
          if (el) el.scrollTop = el.scrollHeight;
        }, 80);
        return;
      }

      // Centrar el nodo actual en el viewport
      setTimeout(() => this.scrollToNode(map.currentNodeId!), 80);
    });
  }

  // ── Manejadores de eventos ────────────────────────────────────────────────

  onNodeClick(node: MapNodeView): void {
    if (node.nodeState === 'reachable') {
      this.store.navigateToNode(node.id);
    }
  }

  onNodePointerEnter(nodeId: string): void {
    this.hoveredNodeId.set(nodeId);
  }

  onNodePointerLeave(): void {
    this.hoveredNodeId.set(null);
  }

  onSvgMouseMove(event: MouseEvent): void {
    this.mousePos.set({ x: event.clientX, y: event.clientY });
  }

  onNodeKeyDown(event: KeyboardEvent, node: MapNodeView): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onNodeClick(node);
    }
  }

  // ── Helpers internos ──────────────────────────────────────────────────────

  private scrollToNode(nodeId: string): void {
    const el  = this.scrollEl()?.nativeElement;
    const pos = this.positions();
    if (!el || !pos.has(nodeId)) return;

    const { y } = pos.get(nodeId)!;
    // Convertir coordenada SVG (user units) a píxeles CSS según el scale actual del SVG.
    // El SVG puede estar escalado (max-width: 100% en móvil), por lo que no podemos usar
    // las coordenadas SVG directamente como píxeles de scroll.
    const scale = el.scrollHeight > 0 ? el.scrollHeight / SVG_H : 1;
    el.scrollTo({ top: y * scale - el.clientHeight / 2, behavior: 'smooth' });
  }
}

// ── Funciones puras de estado (separadas del componente para testabilidad) ────

function nodeStateOf(
  node: MapNode,
  currentId: string | null,
  reach: Set<string>,
): NodeState {
  if (node.id === currentId) return 'current';
  if (node.visited)          return 'visited';
  if (reach.has(node.id))    return 'reachable';
  return 'unreachable';
}

function edgeStateOf(
  from: MapNode,
  to:   MapNode | undefined,
  currentId: string | null,
  reach: Set<string>,
): EdgeState {
  if (from.visited && to?.visited)                        return 'visited';
  if (from.id === currentId && to && reach.has(to.id))   return 'reachable';
  return 'future';
}
