import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import type { Card } from '../../../domain/models/card.model';
import { CardComponent } from '../card/card.component';
import { GameStateStore } from '../../game-state.store';
import { CARD_WRAP_ANIM } from './card-animations';

/** Zona circular de detección de enemigo (viewport px). */
export interface EnemyDropZone {
  /** Índice del enemigo en el array enemies[]. */
  index: number;
  /** Centro X en px (coordenadas viewport). */
  cx: number;
  /** Centro Y en px (coordenadas viewport). */
  cy: number;
  /** Radio de detección en px. */
  r: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum rotation applied to the outermost card in the fan (degrees). */
const MAX_FAN_HALF_ANGLE = 18;

/** Horizontal spacing between card centers (px). Shrinks for large hands. */
const BASE_CARD_SPACING = 76;

/**
 * Vertical arc coefficient: how many px the outermost card dips below center.
 * arcY = dist² * ARC_COEFFICIENT
 */
const ARC_COEFFICIENT = 2.5;

/** How many px a hovered card lifts above its fan position. */
const HOVER_LIFT = 48;

/**
 * Distance (px) the pointer must travel before the interaction is
 * classified as a drag rather than a click.
 */
const DRAG_THRESHOLD_PX = 10;

/**
 * Fracción de la altura del viewport: por encima de esta Y (px) cuenta como
 * zona "soltar para jugar". Debe coincidir con `.hand__play-zone { height }` en SCSS.
 */
const PLAY_ZONE_HEIGHT_FRACTION = 0.62;

/** Per-card stagger for draw animation (ms per index position). */
const DRAW_STAGGER_MS = 55;

/** Per-card stagger for end-of-turn discard animation (ms per index position). */
const DISCARD_STAGGER_MS = 35;

/** Ghost card dimensions in px (must match `card.component.scss`). */
const CARD_WIDTH_PX = 120;
const CARD_HEIGHT_PX = 180;

/** Max drag ghost scale used in SCSS (`.hand__ghost--targeting-enemy`). */
const GHOST_MAX_SCALE = 1.18;

/** Anchor used by the ghost CSS transform (`translate(-50%, -60%)`). */
const GHOST_ANCHOR_X = 0.5;
const GHOST_ANCHOR_Y = 0.6;

// ---------------------------------------------------------------------------
// Helpers (pure – exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Computes the CSS transform string for a card slot in the fan.
 * The transform-origin is expected to be `bottom center`.
 */
export function fanTransform(
  index: number,
  total: number,
  hovered: boolean,
): string {
  if (total === 0) return '';

  const center = (total - 1) / 2;
  const dist = index - center;

  // Angle: cards at the edges tilt more; scale down for small hands
  const anglePerUnit =
    total <= 1 ? 0 : Math.min(MAX_FAN_HALF_ANGLE / center, 6);
  const angle = dist * anglePerUnit;

  // Arc: edges dip downward quadratically
  const arcY = dist * dist * ARC_COEFFICIENT;

  // Horizontal spread with mild compression for large hands
  const spacing = Math.min(BASE_CARD_SPACING, 520 / Math.max(total - 1, 1));
  const translateX = dist * spacing;

  if (hovered) {
    // Straighten and lift the hovered card
    return `translateX(${translateX}px) translateY(${arcY - HOVER_LIFT}px) rotate(0deg)`;
  }

  return `translateX(${translateX}px) translateY(${arcY}px) rotate(${angle}deg)`;
}

/**
 * Returns the z-index for a card in the fan.
 * Center cards are on top by default; the hovered card is always on top.
 */
export function fanZIndex(
  index: number,
  total: number,
  hovered: boolean,
): number {
  if (hovered) return 200;
  const center = (total - 1) / 2;
  return Math.round(100 - Math.abs(index - center) * 5);
}

/**
 * Clamps the drag ghost anchor point so the full card stays inside viewport.
 */
export function clampDragPointToViewport(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const ghostWidth = CARD_WIDTH_PX * GHOST_MAX_SCALE;
  const ghostHeight = CARD_HEIGHT_PX * GHOST_MAX_SCALE;

  const minX = ghostWidth * GHOST_ANCHOR_X;
  const maxX = viewportWidth - ghostWidth * (1 - GHOST_ANCHOR_X);
  const minY = ghostHeight * GHOST_ANCHOR_Y;
  const maxY = viewportHeight - ghostHeight * (1 - GHOST_ANCHOR_Y);

  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the player's hand as an animated card fan at the bottom of the screen.
 *
 * - Fan layout: cards spread horizontally with arc and tilt, computed purely.
 * - Hover: a card lifts and straightens when the pointer enters its slot.
 * - Drag & Drop: pressing and dragging a card upward plays it.
 *   Releasing above the play-zone threshold emits `cardPlayed`.
 *   A quick click (no significant pointer movement) also plays the card.
 *
 * Animation lifecycle (via CARD_WRAP_ANIM trigger on the inner wrapper):
 *  - Draw   : staggered slide-in from below (void → visible)
 *  - Discard: staggered fall when end-of-turn empties the hand (visible → void)
 */
@Component({
  selector: 'app-hand',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  templateUrl: './hand.component.html',
  styleUrl: './hand.component.scss',
  animations: [CARD_WRAP_ANIM],
})
export class HandComponent implements OnDestroy {
  private readonly store = inject(GameStateStore);

  // ── Derived state ─────────────────────────────────────────────────────────

  readonly hand = computed(() => this.store.combat()?.player.hand ?? []);
  readonly energy = computed(() => this.store.combat()?.player.energy ?? 0);
  readonly isPlayerTurn = computed(
    () => this.store.combat()?.phase === 'player-turn',
  );

  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * Zonas circulares de enemigos vivos (coordenadas viewport px).
   * Cuando la carta arrastrada entra en una zona, se pre-selecciona ese
   * enemigo como objetivo. Provisto por CombatViewComponent.
   */
  readonly dropZones = input<EnemyDropZone[]>([]);

  // ── Interaction state ─────────────────────────────────────────────────────

  readonly hoveredIndex = signal(-1);
  readonly draggingIndex = signal(-1);
  readonly dragPos = signal<{ x: number; y: number } | null>(null);

  /** True once the pointer has moved past DRAG_THRESHOLD_PX during a drag. */
  readonly isDragActive = signal(false);
  /** Carta recién jugada pendiente de sincronización con el estado global. */
  readonly pendingPlayed = signal<{ index: number; card: Card } | null>(null);

  /**
   * Índice del enemigo cuya zona está actualmente bajo la carta arrastrada.
   * null = ninguna zona activa.
   */
  readonly hoveredDropZoneIdx = signal<number | null>(null);

  /**
   * True when the dragged card is above the play-zone threshold.
   * Shows the drop-zone indicator to the player.
   */
  readonly isAboveThreshold = computed(() => {
    const pos = this.dragPos();
    if (!pos) return false;
    return pos.y < this.playThresholdY;
  });

  // ── Output ────────────────────────────────────────────────────────────────

  /**
   * Emitted when the player plays a card.
   * - `targetIdx >= 0`: el jugador soltó la carta sobre esa zona de enemigo
   *   (drag-to-enemy). El padre puede jugarla directamente a ese objetivo.
   * - `targetIdx === -1`: play por clic rápido o soltar sobre la zona genérica;
   *   el padre decide el objetivo (auto-target o overlay de selección).
   */
  readonly cardPlayed = output<{ card: Card; targetIdx: number }>();

  /**
   * Emitido cuando la zona de enemigo bajo la carta arrastrada cambia.
   * null = sin zona activa (drag terminado o fuera de toda zona).
   * El padre lo usa para mostrar la reticula de objetivo sobre el enemigo.
   */
  readonly hoveredDropZone = output<number | null>();

  // ── Private drag bookkeeping ──────────────────────────────────────────────

  private dragStartY = 0;
  private dragStartX = 0;
  private playThresholdY = 0;

  private readonly boundPointerMove = this.onPointerMove.bind(this);
  private readonly boundPointerUp = this.onPointerUp.bind(this);
  private readonly boundPointerCancel = this.onPointerCancel.bind(this);

  constructor() {
    effect(() => {
      const pending = this.pendingPlayed();
      if (!pending) return;

      const hand = this.hand();
      if (hand[pending.index] !== pending.card) {
        this.pendingPlayed.set(null);
      }
    });
  }

  ngOnDestroy(): void {
    this.removeDocListeners();
  }

  // ── Template helpers (called in template) ─────────────────────────────────

  /** Returns the CSS transform for a fan slot. */
  getTransform(index: number): string {
    return fanTransform(index, this.hand().length, this.hoveredIndex() === index);
  }

  /** Returns the z-index for a fan slot. */
  getZIndex(index: number): number {
    return fanZIndex(index, this.hand().length, this.hoveredIndex() === index);
  }

  /** True when the card at `index` can currently be played. */
  isPlayable(card: Card): boolean {
    return this.isPlayerTurn() && card.cost <= this.energy();
  }

  /** True when the card at `index` is being dragged (hidden from its slot). */
  isBeingDragged(index: number): boolean {
    const pending = this.pendingPlayed();
    return (
      (this.isDragActive() && this.draggingIndex() === index) ||
      (pending !== null && pending.index === index)
    );
  }

  /** Estado del trigger @cardWrap mientras la carta sigue en la mano. */
  getCardWrapState(_card: Card): 'visible' {
    return 'visible';
  }

  /**
   * Stagger delay for the draw animation of a card at a given hand index.
   * Each card slides in slightly after the previous one.
   */
  getDrawDelay(index: number): number {
    return index * DRAW_STAGGER_MS;
  }

  /**
   * Stagger delay for the end-of-turn discard animation of a card at a given index.
   * Cards fall away in a cascade from left to right.
   */
  getDiscardDelay(index: number): number {
    return index * DISCARD_STAGGER_MS;
  }

  // ── Mouse / touch event handlers ──────────────────────────────────────────

  onMouseEnter(index: number): void {
    this.hoveredIndex.set(index);
  }

  onMouseLeave(): void {
    if (this.draggingIndex() === -1) {
      this.hoveredIndex.set(-1);
    }
  }

  onPointerDown(event: PointerEvent, card: Card, index: number): void {
    if (!this.isPlayable(card)) return;

    event.preventDefault();
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);

    this.draggingIndex.set(index);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragPos.set(
      clampDragPointToViewport(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight,
      ),
    );
    this.isDragActive.set(false);

    this.playThresholdY = window.innerHeight * PLAY_ZONE_HEIGHT_FRACTION;

    document.addEventListener('pointermove', this.boundPointerMove);
    document.addEventListener('pointerup', this.boundPointerUp);
    document.addEventListener('pointercancel', this.boundPointerCancel);
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.draggingIndex() === -1) return;
    event.preventDefault();
    this.dragPos.set(
      clampDragPointToViewport(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight,
      ),
    );

    const totalMovement =
      Math.abs(event.clientX - this.dragStartX) +
      Math.abs(event.clientY - this.dragStartY);

    if (totalMovement > DRAG_THRESHOLD_PX) {
      this.isDragActive.set(true);
    }

    if (this.isDragActive()) {
      this.updateHoveredDropZone(event.clientX, event.clientY);
    }
  }

  private onPointerUp(event: PointerEvent): void {
    const idx = this.draggingIndex();
    if (idx === -1) {
      this.resetDragState();
      return;
    }

    const card = this.hand()[idx];
    const wasActive = this.isDragActive();
    const releaseY = event.clientY;
    // Capturar zona antes de reset
    const targetedZone = this.hoveredDropZoneIdx();

    const willPlay =
      !!card &&
      this.isPlayerTurn() &&
      (targetedZone !== null || !wasActive || releaseY < this.playThresholdY);

    // Importante: marcar animación de juego ANTES de resetDragState(). Si se
    // resetea primero, el slot deja de estar --dragging (opacity 0), el
    // fantasma desaparece y la carta se ve un instante en el abanico en
    // estado visible antes de que arranque visible→playing.
    if (willPlay && card) {
      this.pendingPlayed.set({ index: idx, card });
      this.cardPlayed.emit({ card, targetIdx: targetedZone ?? -1 });
    }

    this.resetDragState();
  }

  private onPointerCancel(): void {
    this.resetDragState();
  }

  /**
   * Actualiza `hoveredDropZoneIdx` comprobando si (x, y) cae dentro de alguna
   * de las zonas circulares de enemigos. Emite `hoveredDropZone` al padre si
   * el valor cambia para que pueda mostrar feedback visual.
   */
  private updateHoveredDropZone(x: number, y: number): void {
    const zones = this.dropZones();
    let found: number | null = null;

    for (const zone of zones) {
      const dx = x - zone.cx;
      const dy = y - zone.cy;
      if (dx * dx + dy * dy <= zone.r * zone.r) {
        found = zone.index;
        break;
      }
    }

    if (found !== this.hoveredDropZoneIdx()) {
      this.hoveredDropZoneIdx.set(found);
      this.hoveredDropZone.emit(found);
    }
  }

  private resetDragState(): void {
    this.draggingIndex.set(-1);
    this.dragPos.set(null);
    this.isDragActive.set(false);
    this.hoveredIndex.set(-1);
    if (this.hoveredDropZoneIdx() !== null) {
      this.hoveredDropZoneIdx.set(null);
      this.hoveredDropZone.emit(null);
    }
    this.removeDocListeners();
  }

  private removeDocListeners(): void {
    document.removeEventListener('pointermove', this.boundPointerMove);
    document.removeEventListener('pointerup', this.boundPointerUp);
    document.removeEventListener('pointercancel', this.boundPointerCancel);
  }
}
