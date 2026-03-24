import {
  BOSS_ENEMIES,
  ELITE_ENEMIES,
  ENEMIES_BY_ID,
  NORMAL_ENEMIES,
} from './enemies.data';
import {
  ConditionalPattern,
  CyclicPattern,
  EnemyDefinition,
  IntentAction,
  PhasedPattern,
  WeightedRandomPattern,
} from '../models/enemy.model';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function allEnemies(): readonly EnemyDefinition[] {
  return [...NORMAL_ENEMIES, ...ELITE_ENEMIES, ...BOSS_ENEMIES];
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('enemies.data', () => {
  // ── Estructura básica ─────────────────────────────────────────────────────

  describe('colecciones', () => {
    it('debe exportar 5 enemigos normales', () => {
      expect(NORMAL_ENEMIES.length).toBe(5);
    });

    it('debe exportar 5 enemigos elite (incluyendo los 3 Sentries)', () => {
      expect(ELITE_ENEMIES.length).toBe(5);
    });

    it('debe exportar 2 bosses', () => {
      expect(BOSS_ENEMIES.length).toBe(2);
    });

    it('todos los enemigos tienen un ID único', () => {
      const ids = allEnemies().map(e => e.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('todos los IDs están en kebab-case', () => {
      const kebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      allEnemies().forEach(enemy => {
        expect(enemy.id).toMatch(kebabCase);
      });
    });
  });

  // ── ENEMIES_BY_ID ──────────────────────────────────────────────────────────

  describe('ENEMIES_BY_ID', () => {
    it('contiene todos los enemigos indexados por ID', () => {
      const total = NORMAL_ENEMIES.length + ELITE_ENEMIES.length + BOSS_ENEMIES.length;
      expect(Object.keys(ENEMIES_BY_ID).length).toBe(total);
    });

    it('permite recuperar jaw-worm por ID', () => {
      const enemy = ENEMIES_BY_ID['jaw-worm'];
      expect(enemy).toBeDefined();
      expect(enemy.name).toBe('Jaw Worm');
    });

    it('permite recuperar the-guardian por ID', () => {
      const enemy = ENEMIES_BY_ID['the-guardian'];
      expect(enemy).toBeDefined();
      expect(enemy.tier).toBe('boss');
    });
  });

  // ── HP Ranges ─────────────────────────────────────────────────────────────

  describe('baseHp', () => {
    it('todos los enemigos tienen min <= max en baseHp', () => {
      allEnemies().forEach(enemy => {
        expect(enemy.baseHp.min).toBeLessThanOrEqual(enemy.baseHp.max);
      });
    });

    it('todos los enemigos tienen HP positivo', () => {
      allEnemies().forEach(enemy => {
        expect(enemy.baseHp.min).toBeGreaterThan(0);
      });
    });

    it('los bosses tienen más HP que los normales', () => {
      const minBossHp = Math.min(...BOSS_ENEMIES.map(e => e.baseHp.min));
      const maxNormalHp = Math.max(...NORMAL_ENEMIES.map(e => e.baseHp.max));
      expect(minBossHp).toBeGreaterThan(maxNormalHp);
    });
  });

  // ── Intents ────────────────────────────────────────────────────────────────

  describe('integridad de intents', () => {
    it('todos los intents tienen un ID único dentro de su enemigo (cyclic)', () => {
      NORMAL_ENEMIES.filter(e => e.pattern.type === 'cyclic').forEach(enemy => {
        const seq = (enemy.pattern as CyclicPattern).sequence;
        const ids = seq.map(i => i.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
      });
    });

    it('todos los intents de WeightedRandom tienen weight > 0', () => {
      NORMAL_ENEMIES.filter(e => e.pattern.type === 'weighted-random').forEach(enemy => {
        const moves = (enemy.pattern as WeightedRandomPattern).moves;
        moves.forEach(m => {
          expect(m.weight).toBeGreaterThan(0);
        });
      });
    });

    it('Jaw Worm: pesos suman 100', () => {
      const jawWorm = ENEMIES_BY_ID['jaw-worm'];
      const moves = (jawWorm.pattern as WeightedRandomPattern).moves;
      const total = moves.reduce((sum, m) => sum + m.weight, 0);
      expect(total).toBe(100);
    });

    it('Jaw Worm: tiene 3 movimientos (Chomp, Thrash, Bellow)', () => {
      const jawWorm = ENEMIES_BY_ID['jaw-worm'];
      const moves = (jawWorm.pattern as WeightedRandomPattern).moves;
      expect(moves.length).toBe(3);
    });

    it('Cultist: secuencia empieza con Incantation en índice 0', () => {
      const cultist = ENEMIES_BY_ID['cultist'];
      const seq = (cultist.pattern as CyclicPattern).sequence;
      expect(seq[0].id).toBe('cultist-incantation');
    });

    it('Cultist: startIndex es 1 (loop omite Incantation)', () => {
      const cultist = ENEMIES_BY_ID['cultist'];
      const pattern = cultist.pattern as CyclicPattern;
      expect(pattern.startIndex).toBe(1);
    });
  });

  // ── Tiers ──────────────────────────────────────────────────────────────────

  describe('tiers', () => {
    it('todos los normales tienen tier "normal"', () => {
      NORMAL_ENEMIES.forEach(e => expect(e.tier).toBe('normal'));
    });

    it('todos los elite tienen tier "elite"', () => {
      ELITE_ENEMIES.forEach(e => expect(e.tier).toBe('elite'));
    });

    it('todos los bosses tienen tier "boss"', () => {
      BOSS_ENEMIES.forEach(e => expect(e.tier).toBe('boss'));
    });
  });

  // ── Enemigos elite ─────────────────────────────────────────────────────────

  describe('Gremlin Nob', () => {
    it('usa estrategia conditional', () => {
      const nob = ENEMIES_BY_ID['gremlin-nob'];
      expect(nob.pattern.type).toBe('conditional');
    });

    it('primera regla: turno 1 → Bellow', () => {
      const nob = ENEMIES_BY_ID['gremlin-nob'];
      const pattern = nob.pattern as ConditionalPattern;
      const firstRule = pattern.rules[0];
      expect(firstRule.condition.type).toBe('turn-equals');
      expect(firstRule.intent.id).toBe('nob-bellow');
    });

    it('segunda regla: player jugó Skill → Skull Bash', () => {
      const nob = ENEMIES_BY_ID['gremlin-nob'];
      const pattern = nob.pattern as ConditionalPattern;
      const secondRule = pattern.rules[1];
      expect(secondRule.condition.type).toBe('player-played-type');
      expect(secondRule.intent.id).toBe('nob-skull-bash');
    });
  });

  describe('Lagavulin', () => {
    it('usa estrategia phased con 2 fases', () => {
      const lag = ENEMIES_BY_ID['lagavulin'];
      const pattern = lag.pattern as PhasedPattern;
      expect(pattern.phases.length).toBe(2);
    });

    it('fase 0 es "dormido" con sleep', () => {
      const lag = ENEMIES_BY_ID['lagavulin'];
      const pattern = lag.pattern as PhasedPattern;
      const phase0 = pattern.phases[0];
      expect(phase0.name).toBe('dormido');
      const strategy = phase0.strategy as CyclicPattern;
      expect(strategy.sequence[0].id).toBe('lagavulin-sleep');
    });

    it('fase 1 tiene ciclo de ataque y sap', () => {
      const lag = ENEMIES_BY_ID['lagavulin'];
      const pattern = lag.pattern as PhasedPattern;
      const phase1 = pattern.phases[1];
      const strategy = phase1.strategy as CyclicPattern;
      const ids = strategy.sequence.map(i => i.id);
      expect(ids).toContain('lagavulin-attack');
      expect(ids).toContain('lagavulin-sap');
    });

    it('transición de fase 0 a fase 1 incluye condición or (hp-below | turn-greater)', () => {
      const lag = ENEMIES_BY_ID['lagavulin'];
      const pattern = lag.pattern as PhasedPattern;
      const transition = pattern.phases[0].transitionTo?.[0];
      expect(transition).toBeDefined();
      expect(transition!.condition.type).toBe('or');
    });
  });

  describe('Sentries', () => {
    it('sentry-b empieza con Daze (desincronizado respecto a A y C)', () => {
      const sentryB = ENEMIES_BY_ID['sentry-b'];
      const pattern = sentryB.pattern as CyclicPattern;
      expect(pattern.sequence[0].id).toBe('sentry-daze');
    });

    it('sentry-a y sentry-c empiezan con Bolt', () => {
      ['sentry-a', 'sentry-c'].forEach(id => {
        const sentry = ENEMIES_BY_ID[id];
        const pattern = sentry.pattern as CyclicPattern;
        expect(pattern.sequence[0].id).toBe('sentry-bolt');
      });
    });
  });

  // ── Bosses ────────────────────────────────────────────────────────────────

  describe('The Guardian', () => {
    it('usa estrategia phased', () => {
      const guardian = ENEMIES_BY_ID['the-guardian'];
      expect(guardian.pattern.type).toBe('phased');
    });

    it('tiene fase attack-mode y defense-mode', () => {
      const guardian = ENEMIES_BY_ID['the-guardian'];
      const pattern = guardian.pattern as PhasedPattern;
      const names = pattern.phases.map(p => p.name);
      expect(names).toContain('attack-mode');
      expect(names).toContain('defense-mode');
    });

    it('attack-mode contiene Bash, Whirlwind y Charge', () => {
      const guardian = ENEMIES_BY_ID['the-guardian'];
      const pattern = guardian.pattern as PhasedPattern;
      const attackStrategy = pattern.phases[0].strategy as CyclicPattern;
      const ids = attackStrategy.sequence.map(i => i.id);
      expect(ids).toContain('guardian-bash');
      expect(ids).toContain('guardian-whirlwind');
      expect(ids).toContain('guardian-charge');
    });

    it('defense-mode contiene ShieldBash y RollAttack', () => {
      const guardian = ENEMIES_BY_ID['the-guardian'];
      const pattern = guardian.pattern as PhasedPattern;
      const defStrategy = pattern.phases[1].strategy as CyclicPattern;
      const ids = defStrategy.sequence.map(i => i.id);
      expect(ids).toContain('guardian-shield-bash');
      expect(ids).toContain('guardian-roll-attack');
    });

    it('transición a defense-mode ocurre con hp-below: 75', () => {
      const guardian = ENEMIES_BY_ID['the-guardian'];
      const pattern = guardian.pattern as PhasedPattern;
      const transition = pattern.phases[0].transitionTo?.[0];
      expect(transition).toBeDefined();
      const cond = transition!.condition;
      expect(cond.type).toBe('hp-below');
      if (cond.type === 'hp-below') {
        expect(cond.percent).toBe(75);
      }
    });

    it('Whirlwind golpea 4 veces', () => {
      const guardian = ENEMIES_BY_ID['the-guardian'];
      const pattern = guardian.pattern as PhasedPattern;
      const attackStrategy = pattern.phases[0].strategy as CyclicPattern;
      const whirlwind = attackStrategy.sequence.find(i => i.id === 'guardian-whirlwind');
      expect(whirlwind).toBeDefined();
      const dmgAction = whirlwind!.actions.find(
        (a): a is Extract<IntentAction, { type: 'damage' }> => a.type === 'damage',
      );
      expect(dmgAction).toBeDefined();
      expect(dmgAction!.times).toBe(4);
    });
  });

  describe('Hexaghost', () => {
    it('usa estrategia phased con fase dormant y active', () => {
      const hex = ENEMIES_BY_ID['hexaghost'];
      const pattern = hex.pattern as PhasedPattern;
      const names = pattern.phases.map(p => p.name);
      expect(names).toContain('dormant');
      expect(names).toContain('active');
    });

    it('fase dormant contiene Activate', () => {
      const hex = ENEMIES_BY_ID['hexaghost'];
      const pattern = hex.pattern as PhasedPattern;
      const dormantStrategy = pattern.phases[0].strategy as CyclicPattern;
      expect(dormantStrategy.sequence[0].id).toBe('hexaghost-activate');
    });

    it('transición de dormant a active en turn-greater: 1', () => {
      const hex = ENEMIES_BY_ID['hexaghost'];
      const pattern = hex.pattern as PhasedPattern;
      const transition = pattern.phases[0].transitionTo?.[0];
      expect(transition).toBeDefined();
      const cond = transition!.condition;
      expect(cond.type).toBe('turn-greater');
      if (cond.type === 'turn-greater') {
        expect(cond.turn).toBe(1);
      }
    });

    it('fase active tiene 6 movimientos en el ciclo', () => {
      const hex = ENEMIES_BY_ID['hexaghost'];
      const pattern = hex.pattern as PhasedPattern;
      const activeStrategy = pattern.phases[1].strategy as CyclicPattern;
      expect(activeStrategy.sequence.length).toBe(6);
    });

    it('ciclo activo: [Divider, Inferno, Sear, Tackle, Sear, Inflame]', () => {
      const hex = ENEMIES_BY_ID['hexaghost'];
      const pattern = hex.pattern as PhasedPattern;
      const activeStrategy = pattern.phases[1].strategy as CyclicPattern;
      const ids = activeStrategy.sequence.map(i => i.id);
      expect(ids).toEqual([
        'hexaghost-divider',
        'hexaghost-inferno',
        'hexaghost-sear',
        'hexaghost-tackle',
        'hexaghost-sear',
        'hexaghost-inflame',
      ]);
    });

    it('Divider: 6 golpes de 6 de daño', () => {
      const hex = ENEMIES_BY_ID['hexaghost'];
      const pattern = hex.pattern as PhasedPattern;
      const activeStrategy = pattern.phases[1].strategy as CyclicPattern;
      const divider = activeStrategy.sequence[0];
      const dmgAction = divider.actions.find(
        (a): a is Extract<IntentAction, { type: 'damage' }> => a.type === 'damage',
      );
      expect(dmgAction).toBeDefined();
      expect(dmgAction!.value).toBe(6);
      expect(dmgAction!.times).toBe(6);
    });
  });
});
