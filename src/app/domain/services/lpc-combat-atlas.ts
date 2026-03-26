import type { SpriteAtlasManifest } from '../models/sprite-atlas.model';
import { SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION } from '../models/sprite-atlas.model';

/** Alineado con `ANIMATION_OFFSETS.combat_idle` en el generador LPC (px). */
export const LPC_UNIVERSAL_FRAME_PX = 64;
export const LPC_COMBAT_IDLE_BLOCK_Y_PX = 42 * LPC_UNIVERSAL_FRAME_PX;

/** Bloque “backslash” / 1h slash (`ANIMATION_OFFSETS.backslash`, `ANIMATION_CONFIGS['1h_slash']`). */
export const LPC_1H_SLASH_BLOCK_Y_PX = 46 * LPC_UNIVERSAL_FRAME_PX;

/** Columnas del ciclo de ataque a una mano (mismo orden que `ANIMATION_CONFIGS['1h_slash'].cycle`). */
export const LPC_1H_SLASH_COLUMN_CYCLE = [0, 1, 2, 3, 4, 5, 6] as const;

/** Duración por frame del clip `attack` (segundos). */
export const LPC_ATTACK_FRAME_DURATION_SEC = 0.075;

/**
 * Fila de dirección dentro del bloque combat idle (cada fila = 64px).
 * 0=norte (espaldas), 1=oeste, 2=sur (frente a cámara), 3=este (mirando a la derecha) — orden LPC habitual.
 */
export const LPC_COMBAT_IDLE_DIRECTION_ROW = 2;

/** Este / derecha (encuentro: jugador a la izquierda del campo, mira hacia los enemigos). */
export const LPC_COMBAT_IDLE_DIRECTION_ROW_EAST = 3;

/** Oeste / izquierda (enemigos a la derecha atacando hacia el jugador). */
export const LPC_COMBAT_IDLE_DIRECTION_ROW_WEST = 1;

/** Opciones para fila de ataque distinta del idle (p. ej. idle sur, ataque oeste). */
export interface LpcCombatManifestOptions {
  readonly attackDirectionRow?: number;
}

/** Ciclo de columnas para “combat” idle en Universal LPC (`ANIMATION_CONFIGS.combat`). */
export const LPC_COMBAT_IDLE_COLUMN_CYCLE = [0, 0, 1] as const;

/**
 * Manifiesto virtual para recortar combat idle + 1h slash del sheet Universal LPC compuesto.
 * `texture` vacío: el renderer usa la textura opaca (canvas LPC) directamente.
 *
 * @param directionRow Fila del idle (sur enemigos; este jugador).
 * @param options `attackDirectionRow`: fila del 1h slash (enemigos: oeste hacia el jugador).
 */
export function buildLpcUniversalCombatIdleManifest(
  directionRow: number = LPC_COMBAT_IDLE_DIRECTION_ROW,
  options?: LpcCombatManifestOptions,
): SpriteAtlasManifest {
  const w = LPC_UNIVERSAL_FRAME_PX;
  const h = LPC_UNIVERSAL_FRAME_PX;
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const idleClipFrames: string[] = [];

  const idleY = LPC_COMBAT_IDLE_BLOCK_Y_PX + directionRow * LPC_UNIVERSAL_FRAME_PX;
  LPC_COMBAT_IDLE_COLUMN_CYCLE.forEach((col, i) => {
    const id = `lpc-combat-idle-${i}`;
    frames[id] = { x: col * w, y: idleY, w, h };
    idleClipFrames.push(id);
  });

  const attackClipFrames: string[] = [];
  const attackDirRow = options?.attackDirectionRow ?? directionRow;
  const attackY = LPC_1H_SLASH_BLOCK_Y_PX + attackDirRow * LPC_UNIVERSAL_FRAME_PX;
  LPC_1H_SLASH_COLUMN_CYCLE.forEach((col, i) => {
    const id = `lpc-1h-slash-${i}`;
    frames[id] = { x: col * w, y: attackY, w, h };
    attackClipFrames.push(id);
  });

  return {
    schemaVersion: SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION,
    texture: '',
    frames,
    animations: {
      idle: { frames: idleClipFrames, frameDurationSec: 0.22 },
      attack: { frames: attackClipFrames, frameDurationSec: LPC_ATTACK_FRAME_DURATION_SEC },
    },
  };
}

/** Duración total del clip `attack` (una pasada, sin loop). */
export function lpcCombatAttackDurationSec(manifest: SpriteAtlasManifest): number {
  const clip = manifest.animations?.['attack'];
  if (!clip || clip.frames.length === 0) {
    return 0;
  }
  return clip.frames.length * clip.frameDurationSec;
}
