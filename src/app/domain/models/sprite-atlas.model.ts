/**
 * Contrato del manifiesto JSON que acompaña a cada spritesheet en `public/sprites/`.
 * Los archivos siguen la convención: `<nombre>.png` + `<nombre>.manifest.json` en la misma carpeta.
 */

export const SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION = 1 as const;

/** Recorte en píxeles dentro de la textura indicada por `texture`. */
export interface SpriteFrameRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Secuencia de frames por nombre lógico definido en `frames`. */
export interface SpriteAnimationClip {
  readonly frames: readonly string[];
  /** Duración de cada frame en segundos (loop uniforme). */
  readonly frameDurationSec: number;
}

/**
 * Manifiesto cargable vía `fetch`; `texture` es ruta relativa al JSON (mismo directorio).
 */
export interface SpriteAtlasManifest {
  readonly schemaVersion: typeof SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION;
  readonly texture: string;
  readonly frames: Readonly<Record<string, SpriteFrameRect>>;
  readonly animations?: Readonly<Record<string, SpriteAnimationClip>>;
}

function isSpriteFrameRect(value: unknown): value is SpriteFrameRect {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  const x = o['x'];
  const y = o['y'];
  const w = o['w'];
  const h = o['h'];
  return (
    typeof x === 'number' &&
    typeof y === 'number' &&
    typeof w === 'number' &&
    typeof h === 'number' &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    w > 0 &&
    h > 0
  );
}

function isSpriteAnimationClip(value: unknown): value is SpriteAnimationClip {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  const frames = o['frames'];
  const frameDurationSec = o['frameDurationSec'];
  if (!Array.isArray(frames) || frames.length === 0) {
    return false;
  }
  if (!frames.every((f) => typeof f === 'string' && f.length > 0)) {
    return false;
  }
  return (
    typeof frameDurationSec === 'number' &&
    frameDurationSec > 0 &&
    Number.isFinite(frameDurationSec)
  );
}

function isFramesRecord(value: unknown): value is Record<string, SpriteFrameRect> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return false;
  }
  return entries.every(([key, rect]) => typeof key === 'string' && key.length > 0 && isSpriteFrameRect(rect));
}

function isAnimationsRecord(value: unknown): value is Record<string, SpriteAnimationClip> {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([key, clip]) => typeof key === 'string' && key.length > 0 && isSpriteAnimationClip(clip));
}

/**
 * Comprueba que un valor parseado de JSON cumple el contrato de {@link SpriteAtlasManifest}.
 */
export function isSpriteAtlasManifest(value: unknown): value is SpriteAtlasManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (o['schemaVersion'] !== SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION) {
    return false;
  }
  const texture = o['texture'];
  if (typeof texture !== 'string' || texture.length === 0) {
    return false;
  }
  if (!isFramesRecord(o['frames'])) {
    return false;
  }
  if (!isAnimationsRecord(o['animations'])) {
    return false;
  }
  return true;
}
