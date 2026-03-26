import type { SpriteAtlasManifest } from '../models/sprite-atlas.model';
import { SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION } from '../models/sprite-atlas.model';

/** Alineado con `ANIMATION_OFFSETS.combat_idle` en el generador LPC (px). */
export const LPC_UNIVERSAL_FRAME_PX = 64;
export const LPC_COMBAT_IDLE_BLOCK_Y_PX = 42 * LPC_UNIVERSAL_FRAME_PX;

/** Fila de dirección dentro del bloque (0 = primera fila del bloque combat idle). */
export const LPC_COMBAT_IDLE_DIRECTION_ROW = 0;

/** Ciclo de columnas para “combat” idle en Universal LPC (`ANIMATION_CONFIGS.combat`). */
export const LPC_COMBAT_IDLE_COLUMN_CYCLE = [0, 0, 1] as const;

/**
 * Manifiesto virtual para recortar el combat idle del sheet Universal LPC compuesto.
 * `texture` vacío: el renderer usa la textura opaca (canvas LPC) directamente.
 */
export function buildLpcUniversalCombatIdleManifest(): SpriteAtlasManifest {
  const y = LPC_COMBAT_IDLE_BLOCK_Y_PX + LPC_COMBAT_IDLE_DIRECTION_ROW * LPC_UNIVERSAL_FRAME_PX;
  const w = LPC_UNIVERSAL_FRAME_PX;
  const h = LPC_UNIVERSAL_FRAME_PX;
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const clipFrames: string[] = [];
  LPC_COMBAT_IDLE_COLUMN_CYCLE.forEach((col, i) => {
    const id = `lpc-combat-idle-${i}`;
    frames[id] = { x: col * w, y, w, h };
    clipFrames.push(id);
  });
  return {
    schemaVersion: SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION,
    texture: '',
    frames,
    animations: {
      idle: { frames: clipFrames, frameDurationSec: 0.22 },
    },
  };
}
