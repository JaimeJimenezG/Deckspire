import {
  isSpriteAtlasManifest,
  SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION,
  type SpriteAtlasManifest,
} from './sprite-atlas.model';

describe('isSpriteAtlasManifest', () => {
  const minimalValid: SpriteAtlasManifest = {
    schemaVersion: SPRITE_ATLAS_MANIFEST_SCHEMA_VERSION,
    texture: 't.png',
    frames: { a: { x: 0, y: 0, w: 1, h: 1 } },
  };

  it('should accept a minimal valid manifest', () => {
    expect(isSpriteAtlasManifest(minimalValid)).toBe(true);
  });

  it('should accept manifest with animations', () => {
    const withAnim: SpriteAtlasManifest = {
      ...minimalValid,
      animations: {
        idle: { frames: ['a'], frameDurationSec: 0.2 },
      },
    };
    expect(isSpriteAtlasManifest(withAnim)).toBe(true);
  });

  it('should reject wrong schemaVersion', () => {
    expect(isSpriteAtlasManifest({ ...minimalValid, schemaVersion: 0 })).toBe(false);
    expect(isSpriteAtlasManifest({ ...minimalValid, schemaVersion: 2 })).toBe(false);
  });

  it('should reject invalid frames', () => {
    expect(
      isSpriteAtlasManifest({
        ...minimalValid,
        frames: { a: { x: 0, y: 0, w: 0, h: 10 } },
      }),
    ).toBe(false);
    expect(
      isSpriteAtlasManifest({
        ...minimalValid,
        frames: {},
      }),
    ).toBe(false);
  });

  it('should reject invalid animations', () => {
    expect(
      isSpriteAtlasManifest({
        ...minimalValid,
        animations: { idle: { frames: [], frameDurationSec: 0.2 } },
      }),
    ).toBe(false);
  });

  it('should accept empty texture string for inline atlases', () => {
    expect(
      isSpriteAtlasManifest({
        ...minimalValid,
        texture: '',
      }),
    ).toBe(true);
  });

  it('should reject non-objects', () => {
    expect(isSpriteAtlasManifest(null)).toBe(false);
    expect(isSpriteAtlasManifest('json')).toBe(false);
  });
});
