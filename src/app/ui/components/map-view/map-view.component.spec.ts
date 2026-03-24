import {
  bezierPath,
  deterministicJitter,
  SVG_H,
  SVG_W,
} from './map-view.component';

describe('MapViewComponent helpers', () => {

  // ── deterministicJitter ────────────────────────────────────────────────────

  describe('deterministicJitter', () => {
    it('should return a value in [-max, max] for any string seed', () => {
      const max = 8;
      for (const seed of ['0-0x', '7-14y', '3-2x', 'boss-nodex']) {
        const result = deterministicJitter(seed, max);
        expect(result).toBeGreaterThanOrEqual(-max);
        expect(result).toBeLessThanOrEqual(max);
      }
    });

    it('should return the same value for the same seed (deterministic)', () => {
      const seed = '5-3x';
      const first  = deterministicJitter(seed, 8);
      const second = deterministicJitter(seed, 8);
      expect(first).toBe(second);
    });

    it('should return an integer', () => {
      const result = deterministicJitter('4-1y', 8);
      expect(Number.isInteger(result)).toBeTrue();
    });

    it('should produce 0 for max=0', () => {
      expect(deterministicJitter('anything', 0)).toBe(0);
    });
  });

  // ── bezierPath ─────────────────────────────────────────────────────────────

  describe('bezierPath', () => {
    it('should start with M and contain C (cubic bezier)', () => {
      const path = bezierPath({ x: 100, y: 200 }, { x: 150, y: 120 });
      expect(path.startsWith('M')).toBeTrue();
      expect(path).toContain('C');
    });

    it('should include the from point as the starting M coordinate', () => {
      const path = bezierPath({ x: 100, y: 200 }, { x: 150, y: 120 });
      expect(path).toContain('M 100 200');
    });

    it('should include the to point as the last coordinate', () => {
      const path = bezierPath({ x: 100, y: 200 }, { x: 150, y: 120 });
      expect(path.endsWith('150 120')).toBeTrue();
    });

    it('should use the midpoint Y for control points', () => {
      // from.y=200, to.y=120 → midY=160
      const path = bezierPath({ x: 100, y: 200 }, { x: 150, y: 120 });
      expect(path).toContain('160');
    });
  });

  // ── SVG dimensions ─────────────────────────────────────────────────────────

  describe('SVG dimensions', () => {
    it('SVG_W should be positive', () => {
      expect(SVG_W).toBeGreaterThan(0);
    });

    it('SVG_H should be positive', () => {
      expect(SVG_H).toBeGreaterThan(0);
    });

    it('SVG_H should be greater than SVG_W (tall map)', () => {
      expect(SVG_H).toBeGreaterThan(SVG_W);
    });
  });

});
