import {
  buildLpcUniversalCombatIdleManifest,
  LPC_1H_SLASH_BLOCK_Y_PX,
  LPC_1H_SLASH_COLUMN_CYCLE,
  LPC_COMBAT_IDLE_COLUMN_CYCLE,
  LPC_COMBAT_IDLE_DIRECTION_ROW,
  LPC_COMBAT_IDLE_DIRECTION_ROW_EAST,
  LPC_COMBAT_IDLE_DIRECTION_ROW_WEST,
  LPC_UNIVERSAL_FRAME_PX,
  LPC_COMBAT_IDLE_BLOCK_Y_PX,
  lpcCombatAttackDurationSec,
} from './lpc-combat-atlas';
import { isSpriteAtlasManifest } from '../models/sprite-atlas.model';

describe('buildLpcUniversalCombatIdleManifest', () => {
  it('should produce a valid manifest with idle and attack animations', () => {
    const m = buildLpcUniversalCombatIdleManifest();
    expect(isSpriteAtlasManifest(m)).toBe(true);
    expect(m.animations?.['idle']?.frames.length).toBe(LPC_COMBAT_IDLE_COLUMN_CYCLE.length);
    expect(m.animations?.['attack']?.frames.length).toBe(LPC_1H_SLASH_COLUMN_CYCLE.length);
    expect(lpcCombatAttackDurationSec(m)).toBeGreaterThan(0);
  });

  it('should place frames on the south-facing row by default (enemies)', () => {
    const m = buildLpcUniversalCombatIdleManifest();
    const first = m.frames['lpc-combat-idle-0'];
    const expectedY =
      LPC_COMBAT_IDLE_BLOCK_Y_PX + LPC_COMBAT_IDLE_DIRECTION_ROW * LPC_UNIVERSAL_FRAME_PX;
    expect(first.y).toBe(expectedY);
    expect(first.w).toBe(LPC_UNIVERSAL_FRAME_PX);
    expect(first.h).toBe(LPC_UNIVERSAL_FRAME_PX);
  });

  it('should place frames on the east row when requested (player facing right)', () => {
    const m = buildLpcUniversalCombatIdleManifest(LPC_COMBAT_IDLE_DIRECTION_ROW_EAST);
    const first = m.frames['lpc-combat-idle-0'];
    expect(first.y).toBe(
      LPC_COMBAT_IDLE_BLOCK_Y_PX + LPC_COMBAT_IDLE_DIRECTION_ROW_EAST * LPC_UNIVERSAL_FRAME_PX,
    );
  });

  it('should align attack clip to the same direction row as idle when no options', () => {
    const m = buildLpcUniversalCombatIdleManifest(LPC_COMBAT_IDLE_DIRECTION_ROW_EAST);
    const slash = m.frames['lpc-1h-slash-0'];
    expect(slash.y).toBe(
      LPC_1H_SLASH_BLOCK_Y_PX + LPC_COMBAT_IDLE_DIRECTION_ROW_EAST * LPC_UNIVERSAL_FRAME_PX,
    );
  });

  it('should use attackDirectionRow for slash when different from idle (enemies)', () => {
    const m = buildLpcUniversalCombatIdleManifest(LPC_COMBAT_IDLE_DIRECTION_ROW, {
      attackDirectionRow: LPC_COMBAT_IDLE_DIRECTION_ROW_WEST,
    });
    expect(m.frames['lpc-combat-idle-0'].y).toBe(
      LPC_COMBAT_IDLE_BLOCK_Y_PX + LPC_COMBAT_IDLE_DIRECTION_ROW * LPC_UNIVERSAL_FRAME_PX,
    );
    expect(m.frames['lpc-1h-slash-0'].y).toBe(
      LPC_1H_SLASH_BLOCK_Y_PX + LPC_COMBAT_IDLE_DIRECTION_ROW_WEST * LPC_UNIVERSAL_FRAME_PX,
    );
  });
});
