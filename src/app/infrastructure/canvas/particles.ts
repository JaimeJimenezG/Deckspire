/**
 * Sistema de partículas y números flotantes para efectos visuales del combate.
 * Toda la aleatoriedad aquí es puramente visual y no afecta la lógica del juego,
 * por lo que se usa Math.random() en lugar de SeededRandom.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Fracción de vida restante: 1 = recién creada, 0 = muerta. */
  life: number;
  /** Duración total en segundos. */
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingNumber {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  /** Fracción de vida restante: 1 = recién creada, 0 = muerta. */
  life: number;
  /** Duración total en segundos. */
  maxLife: number;
  /** Velocidad vertical en px/s (negativa = sube). */
  vy: number;
}

/**
 * Anillo expansivo que aparece al morir una entidad.
 * Se dibuja en coordenadas de escena (con screen shake).
 */
export interface Shockwave {
  x: number;
  y: number;
  /** Radio actual en px. */
  radius: number;
  /** Radio máximo al que expande. */
  readonly maxRadius: number;
  /** Opacidad actual [0..1]. */
  alpha: number;
  readonly color: string;
  elapsed: number;
  readonly duration: number;
}

// ---------------------------------------------------------------------------
// ParticleSystem
// ---------------------------------------------------------------------------

/**
 * Gestiona partículas de chispa/humo y números flotantes de daño/bloqueo.
 * Actualizable y dibujable en cada frame del render loop.
 */
export class ParticleSystem {
  private readonly particles: Particle[] = [];
  private readonly floatingNumbers: FloatingNumber[] = [];
  /** Ondas de choque activas — las dibuja el renderer en coordenadas de escena. */
  readonly shockwaves: Shockwave[] = [];

  // ── Emisores ──────────────────────────────────────────────────────────────

  /**
   * Registra una onda de choque expansiva (se usa al morir una entidad).
   * El renderer es responsable de dibujarla en coordenadas de escena.
   */
  emitShockwave(x: number, y: number, color: string, maxRadius = 100, duration = 0.5): void {
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius,
      alpha: 0.9,
      color,
      elapsed: 0,
      duration,
    });
  }

  /**
   * Emite chispas radiales (impacto de daño, ganancia de bloqueo, etc.).
   */
  emitSparks(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 1,
        maxLife: 0.3 + Math.random() * 0.35,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  /**
   * Emite una explosión de partículas grandes para la muerte de una entidad.
   */
  emitDeathParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.8,
        size: 4 + Math.random() * 10,
        color,
      });
    }
    // Secondary smaller sparks in white
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 100;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life: 1,
        maxLife: 0.25 + Math.random() * 0.2,
        size: 1.5 + Math.random() * 2.5,
        color: '#ffffff',
      });
    }
  }

  /**
   * Añade un número flotante que sube y se desvanece (daño, bloqueo, curación).
   */
  addFloatingNumber(
    x: number,
    y: number,
    text: string,
    color: string,
    fontSize = 26,
  ): void {
    this.floatingNumbers.push({
      x,
      y,
      text,
      color,
      fontSize,
      life: 1,
      maxLife: 1.1,
      vy: -90,
    });
  }

  // ── Update & Draw ─────────────────────────────────────────────────────────

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt; // gravedad
      p.vx *= 1 - dt * 2; // fricción horizontal
      p.life -= dt / p.maxLife;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingNumbers.length - 1; i >= 0; i--) {
      const fn = this.floatingNumbers[i];
      fn.y += fn.vy * dt;
      fn.vy += 40 * dt; // desaceleración (resistencia al aire)
      fn.life -= dt / fn.maxLife;
      if (fn.life <= 0) this.floatingNumbers.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.elapsed += dt;
      const t = Math.min(1, sw.elapsed / sw.duration);
      sw.radius = sw.maxRadius * t;
      // Fade rápido al inicio (ease-in), más lento al final
      sw.alpha = 0.9 * Math.pow(1 - t, 0.6);
      if (sw.elapsed >= sw.duration) this.shockwaves.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Partículas
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
      ctx.fill();
    }

    // Números flotantes
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const fn of this.floatingNumbers) {
      // Aparece rápido, desaparece en la segunda mitad de vida
      const alpha = fn.life > 0.5 ? 1 : fn.life * 2;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `bold ${fn.fontSize}px sans-serif`;

      // Sombra exterior para legibilidad
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = fn.color;
      ctx.fillText(fn.text, fn.x, fn.y);
    }

    ctx.restore();
  }

  get hasActiveEffects(): boolean {
    return this.particles.length > 0 || this.floatingNumbers.length > 0;
  }

  clear(): void {
    this.particles.length = 0;
    this.floatingNumbers.length = 0;
    this.shockwaves.length = 0;
  }
}
