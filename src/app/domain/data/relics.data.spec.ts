import { ALL_RELIC_IDS, RELIC_DEFINITIONS } from './relics.data';

describe('relics.data', () => {
  it('should expose at least one relic id', () => {
    expect(ALL_RELIC_IDS.length).toBeGreaterThan(0);
  });

  it('should contain unique ids', () => {
    const unique = new Set(ALL_RELIC_IDS);
    expect(unique.size).toBe(ALL_RELIC_IDS.length);
  });

  it('should use kebab-case ids', () => {
    const kebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    ALL_RELIC_IDS.forEach(id => expect(id).toMatch(kebabCase));
  });

  it('should have a definition for every relic id', () => {
    ALL_RELIC_IDS.forEach(id => {
      expect(RELIC_DEFINITIONS[id]).toBeDefined();
      expect(RELIC_DEFINITIONS[id].id).toBe(id);
    });
  });
});
