import {
  ENCOUNTER_POOLS,
  ENCOUNTER_POOLS_BY_KEY,
  ENCOUNTERS_BY_ID,
  EncounterPool,
} from './encounters.data';
import { ENEMIES_BY_ID } from './enemies.data';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function poolFor(act: number, nodeType: string): EncounterPool {
  const pool = ENCOUNTER_POOLS.find(
    p => p.act === act && p.nodeType === nodeType,
  );
  if (!pool) throw new Error(`Pool not found: act=${act} nodeType=${nodeType}`);
  return pool;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('encounters.data', () => {
  // ── Estructura de ENCOUNTER_POOLS ─────────────────────────────────────────

  describe('ENCOUNTER_POOLS', () => {
    it('contiene exactamente 9 pools (3 actos × 3 tipos de nodo)', () => {
      expect(ENCOUNTER_POOLS.length).toBe(9);
    });

    it('tiene un pool para cada combinación de acto (1-3) y tipo (combat, elite, boss)', () => {
      const acts = [1, 2, 3] as const;
      const nodeTypes = ['combat', 'elite', 'boss'] as const;

      for (const act of acts) {
        for (const nodeType of nodeTypes) {
          const pool = ENCOUNTER_POOLS.find(
            p => p.act === act && p.nodeType === nodeType,
          );
          expect(pool).withContext(`act=${act} nodeType=${nodeType}`).toBeDefined();
        }
      }
    });

    it('ningún pool tiene lista de encuentros vacía', () => {
      ENCOUNTER_POOLS.forEach(pool => {
        expect(pool.encounters.length)
          .withContext(`act=${pool.act} nodeType=${pool.nodeType}`)
          .toBeGreaterThan(0);
      });
    });
  });

  // ── IDs de encuentros ─────────────────────────────────────────────────────

  describe('IDs de encuentros', () => {
    it('todos los encuentros tienen un ID único en todo el juego', () => {
      const ids = ENCOUNTER_POOLS.flatMap(p => p.encounters.map(e => e.id));
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('todos los IDs de encuentros están en kebab-case', () => {
      const kebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      ENCOUNTER_POOLS.flatMap(p => p.encounters).forEach(enc => {
        expect(enc.id).withContext(enc.id).toMatch(kebabCase);
      });
    });
  });

  // ── Referencias a enemigos ────────────────────────────────────────────────

  describe('referencias a enemigos', () => {
    it('todos los IDs de enemigos referenciados existen en ENEMIES_BY_ID', () => {
      ENCOUNTER_POOLS.flatMap(p => p.encounters).forEach(enc => {
        enc.enemies.forEach(enemyId => {
          expect(ENEMIES_BY_ID[enemyId])
            .withContext(`Encuentro "${enc.id}" referencia enemigo inexistente "${enemyId}"`)
            .toBeDefined();
        });
      });
    });

    it('ningún encuentro tiene la lista de enemigos vacía', () => {
      ENCOUNTER_POOLS.flatMap(p => p.encounters).forEach(enc => {
        expect(enc.enemies.length)
          .withContext(`Encuentro "${enc.id}" sin enemigos`)
          .toBeGreaterThan(0);
      });
    });
  });

  // ── Pesos ─────────────────────────────────────────────────────────────────

  describe('pesos', () => {
    it('todos los encuentros tienen weight > 0', () => {
      ENCOUNTER_POOLS.flatMap(p => p.encounters).forEach(enc => {
        expect(enc.weight)
          .withContext(`Encuentro "${enc.id}" tiene weight <= 0`)
          .toBeGreaterThan(0);
      });
    });
  });

  // ── Pools por acto ────────────────────────────────────────────────────────

  describe('Acto 1', () => {
    it('el pool de combate normal tiene al menos 5 encuentros', () => {
      expect(poolFor(1, 'combat').encounters.length).toBeGreaterThanOrEqual(5);
    });

    it('el pool de elite incluye gremlin-nob, lagavulin y sentries', () => {
      const elitePool = poolFor(1, 'elite');
      const allEnemyIds = elitePool.encounters.flatMap(e => e.enemies);
      expect(allEnemyIds).toContain('gremlin-nob');
      expect(allEnemyIds).toContain('lagavulin');
      expect(allEnemyIds).toContain('sentry-a');
      expect(allEnemyIds).toContain('sentry-b');
      expect(allEnemyIds).toContain('sentry-c');
    });

    it('el pool de boss incluye the-guardian y hexaghost', () => {
      const bossPool = poolFor(1, 'boss');
      const allEnemyIds = bossPool.encounters.flatMap(e => e.enemies);
      expect(allEnemyIds).toContain('the-guardian');
      expect(allEnemyIds).toContain('hexaghost');
    });

    it('todos los enemigos de elite en el pool de elite tienen tier elite', () => {
      const elitePool = poolFor(1, 'elite');
      elitePool.encounters
        .flatMap(e => e.enemies)
        .forEach(enemyId => {
          const def = ENEMIES_BY_ID[enemyId];
          expect(def.tier)
            .withContext(`Enemigo "${enemyId}" en pool elite no es tier elite`)
            .toBe('elite');
        });
    });

    it('todos los enemigos de boss en el pool de boss tienen tier boss', () => {
      const bossPool = poolFor(1, 'boss');
      bossPool.encounters
        .flatMap(e => e.enemies)
        .forEach(enemyId => {
          const def = ENEMIES_BY_ID[enemyId];
          expect(def.tier)
            .withContext(`Enemigo "${enemyId}" en pool boss no es tier boss`)
            .toBe('boss');
        });
    });
  });

  describe('Acto 2', () => {
    it('el pool de combate normal tiene al menos 4 encuentros', () => {
      expect(poolFor(2, 'combat').encounters.length).toBeGreaterThanOrEqual(4);
    });

    it('el pool de elite tiene al menos 3 encuentros', () => {
      expect(poolFor(2, 'elite').encounters.length).toBeGreaterThanOrEqual(3);
    });

    it('el pool de boss tiene al menos 2 encuentros', () => {
      expect(poolFor(2, 'boss').encounters.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Acto 3', () => {
    it('el pool de combate normal tiene al menos 4 encuentros', () => {
      expect(poolFor(3, 'combat').encounters.length).toBeGreaterThanOrEqual(4);
    });

    it('el pool de elite tiene al menos 3 encuentros', () => {
      expect(poolFor(3, 'elite').encounters.length).toBeGreaterThanOrEqual(3);
    });

    it('el pool de boss tiene al menos 2 encuentros', () => {
      expect(poolFor(3, 'boss').encounters.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Índices derivados ─────────────────────────────────────────────────────

  describe('ENCOUNTER_POOLS_BY_KEY', () => {
    it('permite recuperar un pool mediante clave "act-nodeType"', () => {
      const pool = ENCOUNTER_POOLS_BY_KEY['1-combat'];
      expect(pool).toBeDefined();
      expect(pool.act).toBe(1);
      expect(pool.nodeType).toBe('combat');
    });

    it('contiene 9 entradas (una por combinación de acto y tipo)', () => {
      expect(Object.keys(ENCOUNTER_POOLS_BY_KEY).length).toBe(9);
    });
  });

  describe('ENCOUNTERS_BY_ID', () => {
    it('permite recuperar el encuentro de los sentries por ID', () => {
      const enc = ENCOUNTERS_BY_ID['act1-sentries'];
      expect(enc).toBeDefined();
      expect(enc.enemies).toContain('sentry-a');
      expect(enc.enemies).toContain('sentry-b');
      expect(enc.enemies).toContain('sentry-c');
    });

    it('el total de entradas coincide con la suma de encuentros de todos los pools', () => {
      const total = ENCOUNTER_POOLS.reduce(
        (sum, pool) => sum + pool.encounters.length,
        0,
      );
      expect(Object.keys(ENCOUNTERS_BY_ID).length).toBe(total);
    });
  });
});
