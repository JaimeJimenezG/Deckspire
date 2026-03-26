import {
  buildLpcUniversalCombatIdleManifest,
  LPC_COMBAT_IDLE_COLUMN_CYCLE,
  LPC_UNIVERSAL_FRAME_PX,
  LPC_COMBAT_IDLE_BLOCK_Y_PX,
} from './lpc-combat-atlas';
import { isSpriteAtlasManifest } from '../models/sprite-atlas.model';

describe('buildLpcUniversalCombatIdleManifest', () => {
  it('should produce a valid manifest with idle animation', () => {
    const m = buildLpcUniversalCombatIdleManifest();
    expect(isSpriteAtlasManifest(m)).toBe(true);
    expect(m.animations?.['idle']?.frames.length).toBe(LPC_COMBAT_IDLE_COLUMN_CYCLE.length);
  });

  it('should place frames at expected y (south row of combat idle block)', () => {
    const m = buildLpcUniversalCombatIdleManifest();
    const first = m.frames['lpc-combat-idle-0'];
    expect(first.y).toBe(LPC_COMBAT_IDLE_BLOCK_Y_PX);
    expect(first.w).toBe(LPC_UNIVERSAL_FRAME_PX);
    expect(first.h).toBe(LPC_UNIVERSAL_FRAME_PX);
  });
});
