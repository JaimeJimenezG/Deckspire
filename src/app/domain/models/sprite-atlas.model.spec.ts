import {
  isSpriteAtlasManifest,
  SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION,
  type SpriteAtlasManifest,
} from './sprite-atlas.model';

describe('isSpriteAtlasManifest', () => {
  const minimalValid: SpriteAtlasManifest = {
    schemaVersion: SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION,
    texture: 'hero.png',
    frames: {
      'idle-0': { x: 0, y: 0, w: 32, h: 48 },
    },
  };

  it('should accept a minimal valid manifest', () => {
    expect(isSpriteAtlasManifest(minimalValid)).toBe(true);
  });

  it('should accept manifest with animations', () => {
    const withAnim: SpriteAtlasManifest = {
      ...minimalValid,
      animations: {
        idle: { frames: ['idle-0'], frameDurationSec: 0.2 },
      },
    };
    expect(isSpriteAtlasManifest(withAnim)).toBe(true);
  });

  it('should reject wrong schema version', () => {
    expect(isSpriteAtlasManifest({ ...minimalValid, schemaVersion: 0 })).toBe(false);
    expect(isSpriteAtlasManifest({ ...minimalValid, schemaVersion: 2 })).toBe(false);
  });

  it('should reject empty frames map', () => {
    expect(
      isSpriteAtlasManifest({
        ...minimalValid,
        frames: {},
      }),
    ).toBe(false);
  });

  it('should reject non-positive frame dimensions', () => {
    expect(
      isSpriteAtlasManifest({
        ...minimalValid,
        frames: { a: { x: 0, y: 0, w: 0, h: 10 } },
      }),
    ).toBe(false);
  });

  it('should reject animation with empty frames array', () => {
    expect(
      isSpriteAtlasManifest({
        ...minimalValid,
        animations: { idle: { frames: [], frameDurationSec: 0.2 } },
      }),
    ).toBe(false);
  });

  it('should reject non-object input', () => {
    expect(isSpriteAtlasManifest(null)).toBe(false);
    expect(isSpriteAtlasManifest('json')).toBe(false);
  });
});
