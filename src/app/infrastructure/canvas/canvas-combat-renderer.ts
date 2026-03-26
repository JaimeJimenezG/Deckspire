import { Inject } from '@angular/core';
import type { Card } from '../../domain/models/card.model';
import type { CombatState } from '../../domain/models/combat.model';
import type { EnemyInstance } from '../../domain/models/enemy.model';
import type { SpriteAtlasManifest, SpriteFrameRect } from '../../domain/models/sprite-atlas.model';
import type {
  AnimateDamageOptions,
  CombatRendererPort,
} from '../../domain/ports/outbound/combat-renderer.port';
import type { LpcSpriteComposerPort } from '../../domain/ports/outbound/lpc-sprite-composer.port';
import { LPC_SPRITE_COMPOSER, PLAYER_LPC_PRESET_URL } from '../../di/tokens';
import { ENEMIES_BY_ID } from '../../domain/data/enemies.data';
import {
  buildLpcUniversalCombatIdleManifest,
  LPC_COMBAT_IDLE_DIRECTION_ROW,
  LPC_COMBAT_IDLE_DIRECTION_ROW_EAST,
  LPC_COMBAT_IDLE_DIRECTION_ROW_WEST,
  lpcCombatAttackDurationSec,
} from '../../domain/services/lpc-combat-atlas';
import { AppAssetUrlResolver } from '../app-asset-url.resolver';
import { ParticleSystem } from './particles';
import {
  drawBlockBadge,
  drawEnemyBody,
  drawEnergyOrbs,
  drawHpBar,
  drawIntentIcon,
  drawStatusEffects,
  fillRoundRect,
  getEnemyColor,
} from './sprite-helpers';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface EntityPosition {
  readonly x: number;
  readonly y: number;
}

interface DeathAnimation {
  /** 0 = jugador, >=1 = índice de enemigo + 1 */
  readonly targetIdx: number;
  /** Progreso 0..1 (1 = completado). */
  progress: number;
  readonly duration: number;
  readonly resolve: () => void;
}

interface ScreenShake {
  intensity: number;
  elapsed: number;
  readonly duration: number;
}

/**
 * Superposición radial blanca que parpadea sobre una entidad al recibir daño.
 * Se pinta en coordenadas de escena (afectada por el screen shake).
 */
interface DamageFlash {
  readonly x: number;
  readonly y: number;
  /** Opacidad máxima inicial [0..1]. */
  readonly maxAlpha: number;
  /** Opacidad actual (decrece hacia 0). */
  alpha: number;
  /** Radio del degradado en px. */
  readonly radius: number;
  elapsed: number;
  readonly duration: number;
}

type EnemyLpcCacheEntry =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly texture: CanvasImageSource;
      readonly manifest: SpriteAtlasManifest;
    }
  | { readonly status: 'error' };

// ---------------------------------------------------------------------------
// CanvasCombatRenderer
// ---------------------------------------------------------------------------

/**
 * Adaptador driven que implementa `CombatRendererPort` usando Canvas 2D.
 *
 * Ciclo de vida:
 *   1. Angular crea la instancia e inyecta a través de DI.
 *   2. El componente llama a `attachCanvas(canvasEl)` en `ngAfterViewInit`.
 *   3. El render loop arranca con `requestAnimationFrame`.
 *   4. El componente llama a `detachCanvas()` en `ngOnDestroy`.
 */
export class CanvasCombatRenderer implements CombatRendererPort {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId = 0;
  private lastTimestamp = 0;
  private running = false;

  /** Textura compuesta LPC + manifiesto virtual para combat idle (fila sur). */
  private playerLpc:
    | {
        readonly texture: CanvasImageSource;
        readonly manifest: SpriteAtlasManifest;
      }
    | null = null;
  private playerLpcAnimT = 0;
  /** Segundos transcurridos dentro del clip `attack`; null = idle. */
  private playerAttackClipElapsed: number | null = null;
  /** Enemigo que está ejecutando el clip de ataque LPC (índice 0-based en `combat.enemies`). */
  private enemyAttackClip: { enemyIdx: number; elapsed: number } | null = null;
  private playerLpcLoadStarted = false;
  /** Apariencia del jugador: solo LPC raster (sin silueta vectorial). */
  private playerLpcLoadStatus: 'loading' | 'ready' | 'error' | 'unconfigured' = 'unconfigured';

  /** Presets de enemigos por ruta (`lpc-presets/enemies/...`); varios IDs pueden compartir archivo. */
  private readonly enemyLpcByPresetPath = new Map<string, EnemyLpcCacheEntry>();

  // Estado del combate que se pinta en cada frame
  private combat: CombatState | null = null;

  // Efectos visuales
  private readonly particles = new ParticleSystem();
  private readonly deathAnimations: DeathAnimation[] = [];
  private readonly damageFlashes: DamageFlash[] = [];
  private shake: ScreenShake | null = null;

  constructor(
    @Inject(LPC_SPRITE_COMPOSER) private readonly lpcComposer: LpcSpriteComposerPort,
    @Inject(PLAYER_LPC_PRESET_URL) private readonly playerLpcPresetUrl: string | null,
    private readonly appAssets: AppAssetUrlResolver,
  ) {}

  // ── Ciclo de vida del canvas ───────────────────────────────────────────────

  /**
   * Conecta el renderer a un elemento `<canvas>` e inicia el render loop.
   * Debe llamarse desde `ngAfterViewInit` del componente que aloja el canvas.
   */
  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (this.running) return;

    this.running = true;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.renderLoop);

    if (this.playerLpcPresetUrl && !this.playerLpcLoadStarted) {
      this.playerLpcLoadStarted = true;
      this.playerLpcLoadStatus = 'loading';
      void this.bootstrapPlayerLpc();
    } else if (!this.playerLpcPresetUrl) {
      this.playerLpcLoadStatus = 'unconfigured';
    }
  }

  /**
   * Desconecta el canvas y cancela el render loop.
   * Debe llamarse desde `ngOnDestroy` del componente anfitrión.
   */
  detachCanvas(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.canvas = null;
    this.ctx = null;
    this.combat = null;
    this.particles.clear();
    this.deathAnimations.length = 0;
    this.damageFlashes.length = 0;
    this.shake = null;
    this.playerLpcLoadStarted = false;
    this.playerLpc = null;
    this.playerLpcLoadStatus = 'unconfigured';
    this.playerAttackClipElapsed = null;
    this.enemyAttackClip = null;
    this.enemyLpcByPresetPath.clear();
  }

  private async bootstrapPlayerLpc(): Promise<void> {
    const path = this.playerLpcPresetUrl;
    if (!path) {
      this.playerLpcLoadStatus = 'unconfigured';
      return;
    }
    this.playerLpcLoadStatus = 'loading';
    try {
      const resolved = this.appAssets.resolve(path.replace(/^\/+/, ''));
      const res = await fetch(resolved, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`LPC preset HTTP ${res.status}: ${resolved}`);
      }
      const json = await res.text();
      const out = await this.lpcComposer.compose(json);
      const handle = out.textureHandle as HTMLCanvasElement;
      if (!handle?.width) {
        throw new Error('LPC: texture handle is not a canvas');
      }
      this.playerLpc = {
        texture: handle,
        manifest: buildLpcUniversalCombatIdleManifest(LPC_COMBAT_IDLE_DIRECTION_ROW_EAST),
      };
      this.playerLpcLoadStatus = 'ready';
    } catch (err) {
      console.warn('[Deckspire] LPC player sprite not available.', err);
      this.playerLpc = null;
      this.playerLpcLoadStatus = 'error';
    }
  }

  private ensureEnemyLpcLoaded(presetPath: string): void {
    if (this.enemyLpcByPresetPath.has(presetPath)) {
      return;
    }
    this.enemyLpcByPresetPath.set(presetPath, { status: 'loading' });
    void this.loadEnemyLpcPreset(presetPath);
  }

  private async loadEnemyLpcPreset(presetPath: string): Promise<void> {
    try {
      const resolved = this.appAssets.resolve(presetPath.replace(/^\/+/, ''));
      const res = await fetch(resolved, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`LPC preset HTTP ${res.status}: ${resolved}`);
      }
      const json = await res.text();
      const out = await this.lpcComposer.compose(json);
      const handle = out.textureHandle as HTMLCanvasElement;
      if (!handle?.width) {
        throw new Error('LPC: enemy texture handle is not a canvas');
      }
      this.enemyLpcByPresetPath.set(presetPath, {
        status: 'ready',
        texture: handle,
        manifest: buildLpcUniversalCombatIdleManifest(LPC_COMBAT_IDLE_DIRECTION_ROW, {
          attackDirectionRow: LPC_COMBAT_IDLE_DIRECTION_ROW_WEST,
        }),
      });
    } catch (err) {
      console.warn('[Deckspire] LPC enemy sprite not available.', presetPath, err);
      this.enemyLpcByPresetPath.set(presetPath, { status: 'error' });
    }
  }

  // ── CombatRendererPort ─────────────────────────────────────────────────────

  /**
   * Actualiza el estado interno del combate que se dibuja en cada frame.
   * No dibuja inmediatamente; el render loop lo hará en el siguiente tick.
   */
  renderScene(combat: CombatState): void {
    this.combat = combat;
  }

  /**
   * Anima el impacto de daño sobre el objetivo:
   * flash blanco sobre la entidad, chispas rojas, número flotante y screen shake.
   */
  async animateDamage(
    targetIdx: number,
    amount: number,
    options?: AnimateDamageOptions,
  ): Promise<void> {
    const pos = this.resolvePosition(targetIdx);

    let waitMs = 320;
    if (
      targetIdx === 0 &&
      options?.attackerEnemyIdx !== undefined &&
      this.combat
    ) {
      const enemy = this.combat.enemies[options.attackerEnemyIdx];
      const path = enemy ? ENEMIES_BY_ID[enemy.definitionId]?.lpcPresetPath : undefined;
      const entry = path ? this.enemyLpcByPresetPath.get(path) : null;
      if (entry?.status === 'ready' && lpcCombatAttackDurationSec(entry.manifest) > 0) {
        this.enemyAttackClip = { enemyIdx: options.attackerEnemyIdx, elapsed: 0 };
        waitMs = Math.max(
          320,
          Math.round(lpcCombatAttackDurationSec(entry.manifest) * 1000),
        );
      }
    }

    // Flash de impacto: superposición blanca que se desvanece en ~0.25 s
    this.damageFlashes.push({
      x: pos.x,
      y: pos.y,
      maxAlpha: 0.72,
      alpha: 0.72,
      radius: 65,
      elapsed: 0,
      duration: 0.25,
    });

    this.particles.emitSparks(pos.x, pos.y, 14, '#e74c3c');
    this.particles.addFloatingNumber(pos.x, pos.y - 45, `-${amount}`, '#e74c3c', 28);
    this.applyScreenShake(7, 0.22);
    await this.delay(waitMs);
  }

  /**
   * Anima la ganancia de bloqueo:
   * chispas azules y número flotante positivo.
   */
  async animateBlock(targetIdx: number, amount: number): Promise<void> {
    const pos = this.resolvePosition(targetIdx);
    this.particles.emitSparks(pos.x, pos.y, 8, '#5dade2');
    this.particles.addFloatingNumber(pos.x, pos.y - 45, `+${amount} ⬡`, '#5dade2', 22);
    await this.delay(260);
  }

  /**
   * Anima la muerte de un combatiente:
   * flash de impacto, onda de choque expansiva, explosión de partículas,
   * screen shake intenso y desvanecimiento de la entidad.
   * Resuelve la promesa al terminar la animación (≈800 ms).
   */
  animateDeath(targetIdx: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const pos = this.resolvePosition(targetIdx);
      const color = this.resolveEntityColor(targetIdx);

      // Flash blanco intenso al momento del golpe de gracia
      this.damageFlashes.push({
        x: pos.x,
        y: pos.y,
        maxAlpha: 0.9,
        alpha: 0.9,
        radius: 90,
        elapsed: 0,
        duration: 0.45,
      });

      // Onda de choque expansiva
      this.particles.emitShockwave(pos.x, pos.y, color, 110, 0.55);

      this.particles.emitDeathParticles(pos.x, pos.y, color);
      this.applyScreenShake(9, 0.45);

      this.deathAnimations.push({
        targetIdx,
        progress: 0,
        duration: 0.8,
        resolve,
      });
    });
  }

  /**
   * Anima el uso de una carta:
   * breve destello de chispas coloreadas según el tipo de carta.
   */
  async animateCardPlay(card: Card): Promise<void> {
    const sparkColor =
      card.type === 'attack' ? '#e74c3c' :
      card.type === 'skill'  ? '#3498db' : '#f39c12';

    const cx = this.canvas ? this.canvas.width * 0.5 : 400;
    const cy = this.canvas ? this.canvas.height * 0.6 : 350;
    this.particles.emitSparks(cx, cy, 7, sparkColor);

    let waitMs = 180;
    if (
      card.type === 'attack' &&
      this.playerLpc &&
      this.playerLpcLoadStatus === 'ready' &&
      lpcCombatAttackDurationSec(this.playerLpc.manifest) > 0
    ) {
      this.playerAttackClipElapsed = 0;
      waitMs = Math.max(
        180,
        Math.round(lpcCombatAttackDurationSec(this.playerLpc.manifest) * 1000),
      );
    }

    await this.delay(waitMs);
  }

  // ── Render loop ────────────────────────────────────────────────────────────

  private readonly renderLoop = (timestamp: number): void => {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.paint();

    this.rafId = requestAnimationFrame(this.renderLoop);
  };

  private update(dt: number): void {
    this.particles.update(dt);

    if (this.playerAttackClipElapsed !== null && this.playerLpc) {
      const total = lpcCombatAttackDurationSec(this.playerLpc.manifest);
      this.playerAttackClipElapsed += dt;
      if (total <= 0 || this.playerAttackClipElapsed >= total) {
        this.playerAttackClipElapsed = null;
      }
    }

    if (this.enemyAttackClip !== null) {
      const enemy = this.combat?.enemies[this.enemyAttackClip.enemyIdx];
      const path = enemy ? ENEMIES_BY_ID[enemy.definitionId]?.lpcPresetPath : undefined;
      const entry = path ? this.enemyLpcByPresetPath.get(path) : null;
      const manifest = entry?.status === 'ready' ? entry.manifest : null;
      const total = manifest ? lpcCombatAttackDurationSec(manifest) : 0;
      this.enemyAttackClip.elapsed += dt;
      if (total <= 0 || this.enemyAttackClip.elapsed >= total) {
        this.enemyAttackClip = null;
      }
    }

    if (this.playerAttackClipElapsed === null) {
      this.playerLpcAnimT += dt;
    }

    // Progresa animaciones de muerte y resuelve las terminadas
    for (let i = this.deathAnimations.length - 1; i >= 0; i--) {
      const anim = this.deathAnimations[i];
      anim.progress += dt / anim.duration;
      if (anim.progress >= 1) {
        anim.resolve();
        this.deathAnimations.splice(i, 1);
      }
    }

    // Progresa flashes de daño
    for (let i = this.damageFlashes.length - 1; i >= 0; i--) {
      const f = this.damageFlashes[i];
      f.elapsed += dt;
      // Ease-out cuadrático: rápido al inicio, suave al desvanecerse
      const t = Math.min(1, f.elapsed / f.duration);
      f.alpha = f.maxAlpha * (1 - t * t);
      if (f.elapsed >= f.duration) this.damageFlashes.splice(i, 1);
    }

    // Agota el screen shake
    if (this.shake) {
      this.shake.elapsed += dt;
      if (this.shake.elapsed >= this.shake.duration) {
        this.shake = null;
      }
    }
  }

  private paint(): void {
    if (!this.ctx || !this.canvas) return;

    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;

    // Offset de screen shake
    const { ox, oy } = this.shakeOffset();

    ctx.save();
    ctx.translate(ox, oy);

    this.paintBackground(ctx, W, H);

    if (this.combat) {
      this.paintCombatScene(ctx, W, H);
    } else {
      this.paintIdleScreen(ctx, W, H);
    }

    // Flashes y shockwaves se pintan dentro del shake transform para que
    // se muevan con la escena y refuercen la sensación de impacto.
    this.paintDamageFlashes(ctx);
    this.paintShockwaves(ctx);

    ctx.restore();

    // Las partículas se dibujan en coordenadas de pantalla (sin el shake offset)
    // para que los números flotantes no tiemblen junto con la escena.
    this.particles.draw(ctx);
  }

  // ── Pintado de escenas ─────────────────────────────────────────────────────

  private paintBackground(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // Fondo degradado oscuro
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#06060f');
    grad.addColorStop(0.6, '#0d0d1f');
    grad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Suelo con textura tenue
    const floorGrad = ctx.createLinearGradient(0, H * 0.68, 0, H);
    floorGrad.addColorStop(0, 'rgba(255,255,255,0.04)');
    floorGrad.addColorStop(1, 'rgba(255,255,255,0.01)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, H * 0.68, W, H * 0.32);

    // Línea divisoria de suelo
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.68);
    ctx.lineTo(W, H * 0.68);
    ctx.stroke();
  }

  private paintIdleScreen(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Preparando combate…', W / 2, H / 2);
  }

  private paintCombatScene(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const combat = this.combat!;
    const enemyPositions = this.enemyPositions(combat.enemies.length, W, H);

    // ── Enemigos ───────────────────────────────────────────────────────────
    combat.enemies.forEach((enemy, idx) => {
      const pos = enemyPositions[idx];
      if (!pos) return;

      const tier = this.resolveEnemyTier(enemy.definitionId);
      const color = getEnemyColor(enemy.definitionId, tier);
      const deathAnim = this.deathAnimations.find(d => d.targetIdx === idx + 1);
      // Sin animación activa, los muertos (hp≤0) deben permanecer invisibles.
      const alpha = deathAnim
        ? Math.max(0, 1 - deathAnim.progress * 1.6)
        : enemy.hp <= 0
          ? 0
          : 1;

      this.paintEnemy(ctx, pos, enemy, idx, tier, color, alpha);
    });

    // ── Jugador ───────────────────────────────────────────────────────────
    const playerPos = this.playerPosition(W, H);
    const playerDeath = this.deathAnimations.find(d => d.targetIdx === 0);
    const playerAlpha = playerDeath
      ? Math.max(0, 1 - playerDeath.progress * 1.6)
      : combat.player.hp <= 0
        ? 0
        : 1;

    this.paintPlayer(ctx, playerPos, combat, playerAlpha);

    // ── Indicador de turno ────────────────────────────────────────────────
    this.paintTurnBadge(ctx, W, H, combat.phase);
  }

  private paintEnemy(
    ctx: CanvasRenderingContext2D,
    pos: EntityPosition,
    enemy: EnemyInstance,
    enemyIdx: number,
    tier: string,
    color: string,
    alpha: number,
  ): void {
    const { x, y } = pos;

    // Intent icon (encima del cuerpo)
    if (enemy.currentIntent && alpha > 0.1) {
      drawIntentIcon(ctx, x, y - 78, enemy.currentIntent.display);
    }

    const def = ENEMIES_BY_ID[enemy.definitionId];
    const presetPath = def?.lpcPresetPath;
    let drewLpc = false;
    if (presetPath) {
      this.ensureEnemyLpcLoaded(presetPath);
      const entry = this.enemyLpcByPresetPath.get(presetPath);
      if (entry?.status === 'ready') {
        const rect = this.resolveEnemyLpcSpriteRect(entry.manifest, enemyIdx);
        if (rect) {
          const scale =
            tier === 'boss' ? 2.5 : tier === 'elite' ? 2.35 : 2.05;
          const sw = rect.w;
          const sh = rect.h;
          const dw = sw * scale;
          const dh = sh * scale;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            entry.texture,
            rect.x,
            rect.y,
            sw,
            sh,
            x - dw / 2,
            y - dh / 2 - 18,
            dw,
            dh,
          );
          ctx.restore();
          drewLpc = true;
        }
      } else if (entry?.status === 'loading' && alpha > 0.05) {
        this.paintEnemyLpcPlaceholder(ctx, x, y, alpha, true);
        drewLpc = true;
      }
    }

    if (!drewLpc) {
      drawEnemyBody(ctx, x, y, tier, alpha, color);
    }

    if (alpha < 0.05) return; // no dibujar etiquetas en una entidad casi muerta

    // Barra de HP
    const barW = tier === 'boss' ? 110 : tier === 'elite' ? 96 : 82;
    drawHpBar(ctx, x - barW / 2, y + 58, barW, 13, enemy.hp, enemy.maxHp);

    // Bloqueo
    if (enemy.block > 0) {
      drawBlockBadge(ctx, x + (tier === 'boss' ? 60 : tier === 'elite' ? 52 : 44), y + 10, enemy.block);
    }

    // Status effects
    if (enemy.statusEffects.length > 0) {
      const rowW = Math.min(enemy.statusEffects.length, 6) * 20;
      drawStatusEffects(ctx, x - rowW / 2, y + 76, enemy.statusEffects);
    }

    // Nombre del enemigo (debajo de todo)
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(def?.name ?? enemy.definitionId, x, y + 96);
    ctx.restore();
  }

  private paintPlayer(
    ctx: CanvasRenderingContext2D,
    pos: EntityPosition,
    combat: CombatState,
      alpha: number,
  ): void {
    const { x, y } = pos;
    const { player } = combat;

    const lpcRect =
      this.playerLpc && this.playerLpcLoadStatus === 'ready'
        ? this.resolvePlayerLpcSpriteRect(this.playerLpc.manifest)
        : null;
    if (lpcRect && this.playerLpc && this.playerLpcLoadStatus === 'ready') {
      const scale = 2.25;
      const sw = lpcRect.w;
      const sh = lpcRect.h;
      const dw = sw * scale;
      const dh = sh * scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.playerLpc.texture,
        lpcRect.x,
        lpcRect.y,
        sw,
        sh,
        x - dw / 2,
        y - dh / 2 - 18,
        dw,
        dh,
      );
      ctx.restore();
    } else {
      this.paintPlayerLpcPlaceholder(ctx, x, y, alpha);
    }

    if (alpha < 0.05) return;

    // Barra de HP
    drawHpBar(ctx, x - 54, y + 58, 108, 14, player.hp, player.maxHp);

    // Bloqueo
    if (player.block > 0) {
      drawBlockBadge(ctx, x + 58, y + 10, player.block);
    }

    // Orbes de energía
    const energyStartX = x - ((player.maxEnergy - 1) * 26) / 2;
    drawEnergyOrbs(ctx, energyStartX, y + 84, player.energy, player.maxEnergy);

    // Status effects
    if (player.statusEffects.length > 0) {
      const rowW = Math.min(player.statusEffects.length, 6) * 20;
      drawStatusEffects(ctx, x - rowW / 2, y + 100, player.statusEffects);
    }

    // Etiqueta "Jugador"
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#aed6f1';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Jugador', x, y + 114);
    ctx.restore();
  }

  /** Placeholder mínimo mientras compone el LPC de un enemigo (sin silueta vectorial). */
  private paintEnemyLpcPlaceholder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    alpha: number,
    loading: boolean,
  ): void {
    if (alpha < 0.05) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c9b8e0';
    ctx.font = '11px sans-serif';
    ctx.fillText(loading ? 'Cargando…' : 'Sprite no disponible', x, y - 6);

    if (loading) {
      ctx.strokeStyle = '#a080d0';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const t = this.playerLpcAnimT * 2.8;
      ctx.beginPath();
      ctx.arc(x, y + 18, 12, t, t + Math.PI * 1.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Mientras el LPC compone o si falla: mensaje + arco animado (sin silueta vectorial).
   */
  private paintPlayerLpcPlaceholder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    alpha: number,
  ): void {
    if (alpha < 0.05) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b8d4f0';
    ctx.font = '12px sans-serif';

    const loading = this.playerLpcLoadStatus === 'loading';
    const msg = loading
      ? 'Cargando personaje…'
      : this.playerLpcLoadStatus === 'unconfigured'
        ? 'Apariencia LPC no configurada'
        : 'No se pudo cargar el personaje';

    ctx.fillText(msg, x, y - 10);

    if (loading) {
      ctx.strokeStyle = '#7eb8ff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const t = this.playerLpcAnimT * 2.8;
      ctx.beginPath();
      ctx.arc(x, y + 24, 17, t, t + Math.PI * 1.35);
      ctx.stroke();
    }

    ctx.restore();
  }

  private resolveCombatIdleRect(manifest: SpriteAtlasManifest): SpriteFrameRect | null {
    const clip = manifest.animations?.['idle'];
    if (!clip || clip.frames.length === 0) return null;
    const dur = clip.frameDurationSec;
    const total = dur * clip.frames.length;
    const t = total > 0 ? this.playerLpcAnimT % total : 0;
    const idx = Math.min(clip.frames.length - 1, Math.floor(t / dur));
    const key = clip.frames[idx];
    return manifest.frames[key] ?? null;
  }

  private resolvePlayerLpcSpriteRect(manifest: SpriteAtlasManifest): SpriteFrameRect | null {
    if (this.playerAttackClipElapsed !== null) {
      const clip = manifest.animations?.['attack'];
      if (clip && clip.frames.length > 0) {
        const dur = clip.frameDurationSec;
        const t = this.playerAttackClipElapsed;
        const idx = Math.min(clip.frames.length - 1, Math.floor(t / dur));
        const key = clip.frames[idx];
        return manifest.frames[key] ?? null;
      }
    }
    return this.resolveCombatIdleRect(manifest);
  }

  private resolveEnemyLpcSpriteRect(
    manifest: SpriteAtlasManifest,
    enemyIdx: number,
  ): SpriteFrameRect | null {
    if (
      this.enemyAttackClip !== null &&
      this.enemyAttackClip.enemyIdx === enemyIdx
    ) {
      const clip = manifest.animations?.['attack'];
      if (clip && clip.frames.length > 0) {
        const dur = clip.frameDurationSec;
        const t = this.enemyAttackClip.elapsed;
        const idx = Math.min(clip.frames.length - 1, Math.floor(t / dur));
        const key = clip.frames[idx];
        return manifest.frames[key] ?? null;
      }
    }
    return this.resolveCombatIdleRect(manifest);
  }

  private paintTurnBadge(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    phase: string,
  ): void {
    const LABELS: Record<string, { text: string; color: string }> = {
      'player-turn':        { text: 'Tu turno',       color: '#2ecc71' },
      'enemy-turn':         { text: 'Turno enemigo',  color: '#e74c3c' },
      'combat-end-victory': { text: '¡Victoria!',     color: '#f39c12' },
      'combat-end-defeat':  { text: 'Derrota',        color: '#7f8c8d' },
    };

    const info = LABELS[phase] ?? { text: phase, color: '#aaa' };

    const PW = 160;
    const PH = 28;
    const px = (W - PW) / 2;
    const py = H - PH - 10;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    fillRoundRect(ctx, px, py, PW, PH, 6);

    ctx.fillStyle = info.color;
    ctx.shadowColor = info.color;
    ctx.shadowBlur = 6;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.text, W / 2, py + PH / 2);
    ctx.restore();
  }

  // ── Efectos de impacto ─────────────────────────────────────────────────────

  /**
   * Pinta un flash de impacto blanco sobre cada entidad golpeada.
   * El degradado radial se desvanece en opacidad con ease-out cuadrático.
   */
  private paintDamageFlashes(ctx: CanvasRenderingContext2D): void {
    if (this.damageFlashes.length === 0) return;

    ctx.save();
    for (const flash of this.damageFlashes) {
      const grad = ctx.createRadialGradient(
        flash.x, flash.y, 0,
        flash.x, flash.y, flash.radius,
      );
      grad.addColorStop(0,   `rgba(255,255,255,${flash.alpha.toFixed(3)})`);
      grad.addColorStop(0.4, `rgba(255,220,180,${(flash.alpha * 0.55).toFixed(3)})`);
      grad.addColorStop(1,   'rgba(255,180,100,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Pinta los anillos expansivos de muerte en coordenadas de escena.
   * Cada onda crece desde el centro y se desvanece con ease-out.
   */
  private paintShockwaves(ctx: CanvasRenderingContext2D): void {
    if (this.particles.shockwaves.length === 0) return;

    ctx.save();
    ctx.lineWidth = 3;
    for (const sw of this.particles.shockwaves) {
      if (sw.alpha <= 0 || sw.radius <= 0) continue;
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = sw.color;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Posicionamiento ────────────────────────────────────────────────────────

  /**
   * Calcula las posiciones en canvas de los enemigos según su cantidad,
   * distribuyéndolos en la mitad derecha de la escena.
   */
  private enemyPositions(count: number, W: number, H: number): EntityPosition[] {
    if (count === 0) return [];

    const centerY = H * 0.36;
    const startX = W * 0.42;
    const endX = W * 0.9;

    if (count === 1) return [{ x: (startX + endX) / 2, y: centerY }];

    return Array.from({ length: count }, (_, i) => ({
      x: startX + (endX - startX) * (i / (count - 1)),
      y: centerY,
    }));
  }

  private playerPosition(W: number, H: number): EntityPosition {
    return { x: W * 0.17, y: H * 0.4 };
  }

  /**
   * Traduce un `targetIdx` (0 = jugador, >=1 = enemigo) a coordenadas canvas.
   * Usado por los métodos de animación para emitir efectos en el lugar correcto.
   */
  private resolvePosition(targetIdx: number): EntityPosition {
    if (!this.canvas) return { x: 400, y: 300 };
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (targetIdx === 0) return this.playerPosition(W, H);

    const count = this.combat?.enemies.length ?? 1;
    const positions = this.enemyPositions(count, W, H);
    return positions[targetIdx - 1] ?? { x: W / 2, y: H / 2 };
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  private resolveEnemyTier(definitionId: string): string {
    return ENEMIES_BY_ID[definitionId]?.tier ?? 'normal';
  }

  private resolveEntityColor(targetIdx: number): string {
    if (targetIdx === 0) return '#2e86c1';
    const enemy = this.combat?.enemies[targetIdx - 1];
    if (!enemy) return '#e74c3c';
    const tier = this.resolveEnemyTier(enemy.definitionId);
    return getEnemyColor(enemy.definitionId, tier);
  }

  /**
   * Registra un screen shake. Si ya hay uno activo más intenso, no lo sobreescribe.
   */
  private applyScreenShake(intensity: number, duration: number): void {
    if (!this.shake || this.shake.intensity < intensity) {
      this.shake = { intensity, duration, elapsed: 0 };
    }
  }

  /**
   * Calcula el offset de traslación del shake para el frame actual.
   * Combina oscilación sinusoidal (que evita saltos bruscos) con
   * ruido aleatorio para una sensación de impacto más natural.
   * Usa Math.random() porque es un efecto puramente visual.
   */
  private shakeOffset(): { ox: number; oy: number } {
    if (!this.shake) return { ox: 0, oy: 0 };
    const t = this.shake.elapsed / this.shake.duration;
    // Decaimiento exponencial: fuerte al inicio, suave al final
    const envelope = Math.pow(1 - t, 1.5) * this.shake.intensity;
    // Frecuencia alta para vibración rápida
    const freq = 42;
    const sinX = Math.sin(t * Math.PI * 2 * freq) * envelope;
    const sinY = Math.cos(t * Math.PI * 2 * freq * 0.87) * envelope;
    // Pequeño componente aleatorio para irregularidad
    const jitterScale = 0.35;
    return {
      ox: sinX + (Math.random() - 0.5) * 2 * envelope * jitterScale,
      oy: sinY + (Math.random() - 0.5) * 2 * envelope * jitterScale,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
