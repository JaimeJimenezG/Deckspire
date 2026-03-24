import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import type { Card } from '../../../domain/models/card.model';
import type { EnemyInstance } from '../../../domain/models/enemy.model';
import { GameStateStore } from '../../game-state.store';
import { HandComponent, type EnemyDropZone } from '../hand/hand.component';
import { COMBAT_RENDERER } from '../../di/providers';

/**
 * Interfaz local que describe los métodos de ciclo de vida del canvas.
 * Evita importar CanvasCombatRenderer (infra) desde la capa UI.
 */
interface CanvasLifecycle {
  attachCanvas(canvas: HTMLCanvasElement): void;
  detachCanvas(): void;
}

/**
 * Devuelve true si la carta tiene algún efecto que necesite que el jugador
 * elija un enemigo concreto como objetivo.
 * - damage sin target (default targeted-enemy) o con target: 'targeted-enemy'
 * - apply-status con target: 'targeted-enemy'
 */
function cardNeedsTarget(card: Card): boolean {
  return card.effects.some(e => {
    if (e.type === 'damage') return !e.target || e.target === 'targeted-enemy';
    if (e.type === 'apply-status') return e.target === 'targeted-enemy';
    return false;
  });
}

/**
 * Posición X (porcentaje del ancho del canvas) de un enemigo.
 * Replica la fórmula de CanvasCombatRenderer.enemyPositions.
 */
function enemyXPercent(i: number, count: number): number {
  const startPct = 42;
  const endPct   = 90;
  if (count <= 1) return (startPct + endPct) / 2;
  return startPct + (endPct - startPct) * (i / (count - 1));
}

/** Posición Y (porcentaje de alto del canvas) de todos los enemigos. */
const ENEMY_Y_PERCENT = 36;

/**
 * Vista de combate principal.
 *
 * Responsabilidades:
 *  - Contiene el <canvas> donde CombatRenderer pinta la escena.
 *  - Conecta el canvas al renderer en el primer render y lo libera al destruirse.
 *  - Superpone el HUD Angular (HP, bloqueo, energía, botón fin de turno).
 *  - Aloja el HandComponent para jugar cartas.
 *  - Gestiona el modo de selección de objetivo para cartas que lo requieran.
 */
@Component({
  selector: 'app-combat-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandComponent],
  templateUrl: './combat-view.component.html',
  styleUrl: './combat-view.component.scss',
})
export class CombatViewComponent implements OnDestroy {
  private readonly store = inject(GameStateStore);
  private readonly renderer = inject(COMBAT_RENDERER);

  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('combatCanvas');

  private canvasResizeObserver: ResizeObserver | null = null;

  // ── Señales derivadas ─────────────────────────────────────────────────────

  readonly player  = computed(() => this.store.combat()?.player ?? null);
  readonly enemies = computed<readonly EnemyInstance[]>(() => this.store.combat()?.enemies ?? []);

  readonly isPlayerTurn = computed(
    () => this.store.combat()?.phase === 'player-turn',
  );
  readonly isEnemyTurn = computed(
    () => this.store.combat()?.phase === 'enemy-turn',
  );
  readonly isVictory = computed(
    () => this.store.combat()?.phase === 'combat-end-victory',
  );
  readonly isDefeat = computed(
    () => this.store.combat()?.phase === 'combat-end-defeat',
  );

  /** Ancho del relleno de la barra de HP como porcentaje (0–100%). */
  readonly hpPercent = computed(() => {
    const p = this.player();
    if (!p || p.maxHp === 0) return '0%';
    return `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100)).toFixed(1)}%`;
  });

  // ── Selección de objetivo ─────────────────────────────────────────────────

  /**
   * Se incrementa en cada redimensionado del lienzo para que los `computed` que
   * leen geometría del DOM (zonas de drop) se vuelvan a evaluar.
   */
  private readonly layoutRevision = signal(0);

  /** Carta en espera de que el jugador elija un objetivo. null = sin modo targeting. */
  readonly pendingCard = signal<Card | null>(null);

  /** True mientras el jugador debe elegir un enemigo como objetivo. */
  readonly isTargeting = computed(() => this.pendingCard() !== null);

  /**
   * Posiciones porcentuales de cada enemigo vivo sobre el canvas,
   * alineadas con las mismas fórmulas que usa CanvasCombatRenderer.
   */
  readonly enemyTargetSlots = computed(() => {
    const enemies = this.enemies();
    const count   = enemies.length;
    return enemies.map((enemy, i) => ({
      enemy,
      index: i,
      xPct: enemyXPercent(i, count),
      yPct: ENEMY_Y_PERCENT,
    }));
  });

  /**
   * Zonas circulares de hit detection para cada enemigo vivo, en coordenadas
   * viewport (px). Se calculan leyendo el bounding rect del canvas al momento
   * de acceso; el canvas no se mueve durante el drag así que el caché es válido.
   */
  readonly enemyDropZones = computed<EnemyDropZone[]>(() => {
    this.layoutRevision();
    const canvas = this.canvasRef()?.nativeElement;
    const slots  = this.enemyTargetSlots();
    if (!canvas) return [];
    const rect = canvas.getBoundingClientRect();
    const minSide = Math.min(rect.width, rect.height);
    const hitR = Math.max(44, Math.min(96, minSide * 0.11));
    return slots
      .filter(s => s.enemy.hp > 0)
      .map(s => ({
        index: s.index,
        cx: rect.left + rect.width  * (s.xPct / 100),
        cy: rect.top  + rect.height * (s.yPct / 100),
        r: hitR,
      }));
  });

  /**
   * Índice del enemigo que el jugador está apuntando con una carta arrastrada.
   * null = sin targeting activo por drag.
   */
  readonly hoveredEnemyDuringDrag = signal<number | null>(null);

  // ── Ciclo de vida del canvas ──────────────────────────────────────────────

  constructor() {
    // Adjuntar el canvas al renderer y arrancar el combate tras el primer render
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      this.syncCanvasPixelSize(canvas);

      this.canvasResizeObserver = new ResizeObserver(() => {
        this.syncCanvasPixelSize(canvas);
        this.layoutRevision.update(n => n + 1);
      });
      this.canvasResizeObserver.observe(canvas);

      (this.renderer as unknown as CanvasLifecycle).attachCanvas?.(canvas);

      if (!this.store.combat()) {
        this.store.startCombat();
      }
    });

    // Mantener el renderer sincronizado con el estado de combate
    effect(() => {
      const combat = this.store.combat();
      if (combat) {
        this.renderer.renderScene(combat);
      }
    });

    // Transición automática al finalizar el combate (victoria o derrota)
    effect(() => {
      if (this.isVictory()) {
        setTimeout(() => this.onCombatEnd(), 400);
      }
    });

    effect(() => {
      if (this.isDefeat()) {
        setTimeout(() => this.onCombatEnd(), 800);
      }
    });
  }

  ngOnDestroy(): void {
    this.canvasResizeObserver?.disconnect();
    this.canvasResizeObserver = null;
    (this.renderer as unknown as CanvasLifecycle).detachCanvas?.();
  }

  /**
   * Iguala width/height del bitmap a los píxeles CSS del elemento para que no
   * haya estiramiento al cambiar el tamaño de la ventana.
   */
  private syncCanvasPixelSize(canvas: HTMLCanvasElement): void {
    const w = Math.max(1, Math.round(canvas.clientWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  onEndTurn(): void {
    if (this.isPlayerTurn()) {
      this.store.endTurn();
    }
  }

  onCardPlayed(event: { card: Card; targetIdx: number }): void {
    const { card, targetIdx } = event;

    // Drag-to-enemy: el jugador soltó la carta sobre un enemigo concreto
    if (targetIdx >= 0) {
      const enemy = this.enemies()[targetIdx];
      if (enemy?.hp > 0) {
        this.store.playCard(card, targetIdx);
        return;
      }
      // Si el enemigo no es válido (raro), caer al comportamiento normal
    }

    // Play por clic o soltar en zona genérica: lógica original
    const aliveEnemies = this.enemies().filter(e => e.hp > 0);
    if (cardNeedsTarget(card) && aliveEnemies.length > 1) {
      // Más de un enemigo vivo: el jugador elige el objetivo
      this.pendingCard.set(card);
    } else {
      // Un solo enemigo (o carta que no necesita objetivo): auto-target
      const firstAliveIdx = this.enemies().findIndex(e => e.hp > 0);
      this.store.playCard(card, Math.max(0, firstAliveIdx));
    }
  }

  /** Llamado desde HandComponent cuando la carta arrastrada entra/sale de una zona enemiga. */
  onHoveredDropZone(idx: number | null): void {
    this.hoveredEnemyDuringDrag.set(idx);
  }

  /** Llamado cuando el jugador hace clic sobre un enemigo en modo targeting. */
  onTargetSelected(enemyIdx: number): void {
    const card = this.pendingCard();
    if (!card) return;
    this.pendingCard.set(null);
    this.store.playCard(card, enemyIdx);
  }

  /** Cancela la selección de objetivo (clic fuera de los botones). */
  onCancelTargeting(): void {
    this.pendingCard.set(null);
  }

  /**
   * Llamado desde el template cuando el jugador hace clic en el botón
   * de victoria o derrota para salir de la vista de combate.
   *
   * - Derrota → game-over (defeat)
   * - Victoria en boss → game-over (victory)
   * - Victoria normal → pantalla de recompensa (gestionada por CollectRewardUseCase)
   */
  async onCombatEnd(): Promise<void> {
    if (this.isDefeat()) {
      await this.store.declareGameOver('defeat');
      return;
    }
    if (this.isVictory()) {
      const map = this.store.map();
      const currentNode = map?.currentNodeId ? map.nodes.get(map.currentNodeId) : null;
      if (currentNode?.type === 'boss') {
        await this.store.declareGameOver('victory');
      } else {
        this.store.collectCombatReward();
      }
    }
  }
}
