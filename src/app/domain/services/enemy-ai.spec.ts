import {
  ConditionalPattern,
  CyclicPattern,
  EnemyInstance,
  Intent,
  PhasedPattern,
  WeightedRandomPattern,
} from '../models/enemy.model';
import { Player } from '../models/player.model';
import { SeededRandom } from './seeded-random';
import { CombatContext, EnemyAI } from './enemy-ai';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const strikeIntent: Intent = {
  id: 'strike',
  display: { type: 'attack', value: 6 },
  actions: [{ type: 'damage', value: 6 }],
};

const buffIntent: Intent = {
  id: 'bellow',
  display: { type: 'buff' },
  actions: [{ type: 'buff', status: 'strength', stacks: 3 }],
};

const blockIntent: Intent = {
  id: 'defend',
  display: { type: 'defend' },
  actions: [{ type: 'block', value: 8 }],
};

const debuffIntent: Intent = {
  id: 'lick',
  display: { type: 'debuff' },
  actions: [{ type: 'debuff-player', status: 'vulnerable', stacks: 2 }],
};

const healIntent: Intent = {
  id: 'regenerate',
  display: { type: 'buff' },
  actions: [{ type: 'heal', value: 10 }],
};

const splitIntent: Intent = {
  id: 'split',
  display: { type: 'unknown' },
  actions: [{ type: 'split' }],
};

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    definitionId: 'jaw-worm',
    hp: 44,
    maxHp: 44,
    block: 0,
    statusEffects: [],
    currentIntent: null,
    aiState: {
      turnCount: 1,
      sequenceIndex: 0,
      lastMoves: [],
      currentPhase: 0,
    },
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 80,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 0,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

function makeContext(overrides: Partial<CombatContext> = {}): CombatContext {
  return {
    turnNumber: 1,
    player: makePlayer(),
    allEnemies: [],
    cardsPlayedThisTurn: [],
    rng: new SeededRandom(42),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CyclicStrategy
// ---------------------------------------------------------------------------

describe('EnemyAI — CyclicStrategy', () => {
  let ai: EnemyAI;

  beforeEach(() => {
    ai = new EnemyAI();
  });

  it('debe devolver el primer intent de la secuencia en el turno inicial', () => {
    const pattern: CyclicPattern = {
      type: 'cyclic',
      sequence: [buffIntent, strikeIntent],
    };

    const { intent } = ai.getNextIntent(makeEnemy(), pattern, makeContext());

    expect(intent.id).toBe('bellow');
  });

  it('debe avanzar el sequenceIndex tras cada llamada', () => {
    const pattern: CyclicPattern = {
      type: 'cyclic',
      sequence: [buffIntent, strikeIntent],
    };
    const enemy = makeEnemy();

    const { updatedEnemy: e1 } = ai.getNextIntent(enemy, pattern, makeContext());
    expect(e1.aiState.sequenceIndex).toBe(1);

    const { updatedEnemy: e2 } = ai.getNextIntent(e1, pattern, makeContext());
    expect(e2.aiState.sequenceIndex).toBe(0);
  });

  it('debe ciclar al inicio de la secuencia al llegar al final (sin startIndex)', () => {
    const pattern: CyclicPattern = {
      type: 'cyclic',
      sequence: [buffIntent, strikeIntent],
    };
    const enemy = makeEnemy({ aiState: { turnCount: 1, sequenceIndex: 1, lastMoves: [], currentPhase: 0 } });

    const { intent, updatedEnemy } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(intent.id).toBe('strike');
    expect(updatedEnemy.aiState.sequenceIndex).toBe(0);
  });

  it('debe hacer el preámbulo y luego ciclar desde startIndex (comportamiento Cultist)', () => {
    // [Incantation(buff), DarkStrike(attack)] con startIndex: 1
    // Turno 1: Incantation (índice 0) → siguiente: 1
    // Turno 2: DarkStrike  (índice 1) → siguiente: 1 (loop)
    // Turno 3: DarkStrike  (índice 1) → siguiente: 1
    const incantation: Intent = { id: 'incantation', display: { type: 'buff' }, actions: [{ type: 'buff', status: 'strength', stacks: 3 }] };
    const darkStrike: Intent = { id: 'dark-strike', display: { type: 'attack', value: 6 }, actions: [{ type: 'damage', value: 6 }] };

    const pattern: CyclicPattern = {
      type: 'cyclic',
      sequence: [incantation, darkStrike],
      startIndex: 1,
    };

    let enemy = makeEnemy();

    const r1 = ai.getNextIntent(enemy, pattern, makeContext());
    expect(r1.intent.id).toBe('incantation');
    expect(r1.updatedEnemy.aiState.sequenceIndex).toBe(1);

    const r2 = ai.getNextIntent(r1.updatedEnemy, pattern, makeContext());
    expect(r2.intent.id).toBe('dark-strike');
    expect(r2.updatedEnemy.aiState.sequenceIndex).toBe(1);

    const r3 = ai.getNextIntent(r2.updatedEnemy, pattern, makeContext());
    expect(r3.intent.id).toBe('dark-strike');
  });

  it('caso límite: secuencia de un solo elemento cicla sobre sí misma', () => {
    const pattern: CyclicPattern = {
      type: 'cyclic',
      sequence: [strikeIntent],
    };

    const r1 = ai.getNextIntent(makeEnemy(), pattern, makeContext());
    expect(r1.intent.id).toBe('strike');
    expect(r1.updatedEnemy.aiState.sequenceIndex).toBe(0);

    const r2 = ai.getNextIntent(r1.updatedEnemy, pattern, makeContext());
    expect(r2.intent.id).toBe('strike');
  });
});

// ---------------------------------------------------------------------------
// WeightedRandomStrategy
// ---------------------------------------------------------------------------

describe('EnemyAI — WeightedRandomStrategy', () => {
  let ai: EnemyAI;

  beforeEach(() => {
    ai = new EnemyAI();
  });

  it('debe seleccionar un intent presente en la lista de moves', () => {
    const pattern: WeightedRandomPattern = {
      type: 'weighted-random',
      moves: [
        { intent: strikeIntent, weight: 45 },
        { intent: buffIntent, weight: 25 },
        { intent: blockIntent, weight: 30 },
      ],
      maxConsecutive: 2,
    };
    const { intent } = ai.getNextIntent(makeEnemy(), pattern, makeContext());
    const validIds = ['strike', 'bellow', 'defend'];

    expect(validIds).toContain(intent.id);
  });

  it('debe excluir el intent repetido cuando se supera maxConsecutive', () => {
    // Con weight 100 para strike, normalmente siempre elegiría strike.
    // Pero si lastMoves = ['strike', 'strike'] y maxConsecutive = 2, debe excluirlo.
    const pattern: WeightedRandomPattern = {
      type: 'weighted-random',
      moves: [
        { intent: strikeIntent, weight: 100 },
        { intent: buffIntent, weight: 1 },
      ],
      maxConsecutive: 2,
    };
    const enemy = makeEnemy({
      aiState: {
        turnCount: 3,
        sequenceIndex: 0,
        lastMoves: ['strike', 'strike'],
        currentPhase: 0,
      },
    });

    const { intent } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(intent.id).toBe('bellow');
  });

  it('debe actualizar lastMoves con el intent seleccionado', () => {
    const pattern: WeightedRandomPattern = {
      type: 'weighted-random',
      moves: [{ intent: strikeIntent, weight: 100 }],
      maxConsecutive: 3,
    };
    const enemy = makeEnemy({
      aiState: { turnCount: 1, sequenceIndex: 0, lastMoves: ['strike'], currentPhase: 0 },
    });

    const { updatedEnemy } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(updatedEnemy.aiState.lastMoves).toContain('strike');
    expect(updatedEnemy.aiState.lastMoves.length).toBeLessThanOrEqual(3);
  });

  it('debe mantener la ventana deslizante de lastMoves', () => {
    const pattern: WeightedRandomPattern = {
      type: 'weighted-random',
      moves: [{ intent: strikeIntent, weight: 100 }],
      maxConsecutive: 2,
    };
    const enemy = makeEnemy({
      aiState: { turnCount: 5, sequenceIndex: 0, lastMoves: ['bellow', 'bellow'], currentPhase: 0 },
    });

    const { updatedEnemy } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(updatedEnemy.aiState.lastMoves.length).toBeLessThanOrEqual(2);
  });

  it('caso límite: no aplica filtro cuando hay un único move disponible', () => {
    const pattern: WeightedRandomPattern = {
      type: 'weighted-random',
      moves: [{ intent: strikeIntent, weight: 100 }],
      maxConsecutive: 1,
    };
    const enemy = makeEnemy({
      aiState: { turnCount: 2, sequenceIndex: 0, lastMoves: ['strike'], currentPhase: 0 },
    });

    const { intent } = ai.getNextIntent(enemy, pattern, makeContext());

    // Solo hay un move: debe devolverlo aunque se viole maxConsecutive.
    expect(intent.id).toBe('strike');
  });
});

// ---------------------------------------------------------------------------
// ConditionalStrategy
// ---------------------------------------------------------------------------

describe('EnemyAI — ConditionalStrategy', () => {
  let ai: EnemyAI;

  beforeEach(() => {
    ai = new EnemyAI();
  });

  it('debe usar el fallback cuando ninguna regla se cumple', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [{ condition: { type: 'hp-below', percent: 50 }, intent: splitIntent }],
      fallback: strikeIntent,
    };

    const { intent } = ai.getNextIntent(makeEnemy({ hp: 44, maxHp: 44 }), pattern, makeContext());

    expect(intent.id).toBe('strike');
  });

  it('debe usar el primer intent cuya condición se cumpla', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [
        { condition: { type: 'hp-below', percent: 50 }, intent: splitIntent },
        { condition: { type: 'turn-equals', turn: 1 }, intent: buffIntent },
      ],
      fallback: strikeIntent,
    };
    const enemy = makeEnemy({ hp: 44, maxHp: 44 });
    const context = makeContext({ turnNumber: 1 });

    const { intent } = ai.getNextIntent(enemy, pattern, context);

    expect(intent.id).toBe('bellow');
  });

  it('hp-below: activa cuando el HP es menor que el umbral', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [{ condition: { type: 'hp-below', percent: 50 }, intent: splitIntent }],
      fallback: strikeIntent,
    };
    const enemy = makeEnemy({ hp: 20, maxHp: 44 });

    const { intent } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(intent.id).toBe('split');
  });

  it('player-has-status: activa cuando el jugador tiene el efecto de estado', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [
        {
          condition: { type: 'player-has-status', status: 'vulnerable' },
          intent: buffIntent,
        },
      ],
      fallback: strikeIntent,
    };
    const player = makePlayer({
      statusEffects: [{ type: 'vulnerable', stacks: 2 }],
    });

    const { intent } = ai.getNextIntent(makeEnemy(), pattern, makeContext({ player }));

    expect(intent.id).toBe('bellow');
  });

  it('player-played-type: activa cuando el jugador jugó el tipo de carta indicado', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [
        {
          condition: { type: 'player-played-type', cardType: 'skill' },
          intent: buffIntent,
        },
      ],
      fallback: strikeIntent,
    };
    const skillCard = {
      id: 'defend', name: 'Defend', type: 'skill' as const, rarity: 'basic' as const,
      cost: 1, description: '', upgraded: false, effects: [],
    };
    const context = makeContext({ cardsPlayedThisTurn: [skillCard] });

    const { intent } = ai.getNextIntent(makeEnemy(), pattern, context);

    expect(intent.id).toBe('bellow');
  });

  it('condición "and": solo activa cuando todas las sub-condiciones se cumplen', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [
        {
          condition: {
            type: 'and',
            conditions: [
              { type: 'hp-below', percent: 50 },
              { type: 'turn-greater', turn: 2 },
            ],
          },
          intent: buffIntent,
        },
      ],
      fallback: strikeIntent,
    };

    // HP bajo pero turno 1 → no activa
    const r1 = ai.getNextIntent(
      makeEnemy({ hp: 10, maxHp: 44 }),
      pattern,
      makeContext({ turnNumber: 1 }),
    );
    expect(r1.intent.id).toBe('strike');

    // HP bajo y turno 3 → activa
    const r2 = ai.getNextIntent(
      makeEnemy({ hp: 10, maxHp: 44 }),
      pattern,
      makeContext({ turnNumber: 3 }),
    );
    expect(r2.intent.id).toBe('bellow');
  });

  it('condición "or": activa cuando al menos una sub-condición se cumple', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [
        {
          condition: {
            type: 'or',
            conditions: [
              { type: 'hp-below', percent: 50 },
              { type: 'turn-equals', turn: 1 },
            ],
          },
          intent: buffIntent,
        },
      ],
      fallback: strikeIntent,
    };

    // HP alto y turno 1 → activa por turno
    const r1 = ai.getNextIntent(
      makeEnemy({ hp: 44, maxHp: 44 }),
      pattern,
      makeContext({ turnNumber: 1 }),
    );
    expect(r1.intent.id).toBe('bellow');
  });

  it('condición "not": invierte la condición envuelta', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [
        {
          condition: { type: 'not', condition: { type: 'hp-below', percent: 50 } },
          intent: strikeIntent,
        },
      ],
      fallback: buffIntent,
    };

    // HP alto → "not hp-below(50)" es verdadero → strike
    const r1 = ai.getNextIntent(makeEnemy({ hp: 44, maxHp: 44 }), pattern, makeContext());
    expect(r1.intent.id).toBe('strike');

    // HP bajo → "not hp-below(50)" es falso → fallback (buff)
    const r2 = ai.getNextIntent(makeEnemy({ hp: 10, maxHp: 44 }), pattern, makeContext());
    expect(r2.intent.id).toBe('bellow');
  });
});

// ---------------------------------------------------------------------------
// PhasedStrategy
// ---------------------------------------------------------------------------

describe('EnemyAI — PhasedStrategy', () => {
  let ai: EnemyAI;

  beforeEach(() => {
    ai = new EnemyAI();
  });

  it('debe delegar a la sub-estrategia de la fase inicial', () => {
    const pattern: PhasedPattern = {
      type: 'phased',
      initialPhase: 0,
      phases: [
        { name: 'attack', strategy: { type: 'cyclic', sequence: [strikeIntent] } },
        { name: 'defense', strategy: { type: 'cyclic', sequence: [blockIntent] } },
      ],
    };
    const enemy = makeEnemy();

    const { intent } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(intent.id).toBe('strike');
  });

  it('debe transicionar de fase cuando se cumple la condición', () => {
    const pattern: PhasedPattern = {
      type: 'phased',
      initialPhase: 0,
      phases: [
        {
          name: 'attack',
          strategy: { type: 'cyclic', sequence: [strikeIntent] },
          transitionTo: [
            {
              targetPhase: 1,
              condition: { type: 'hp-below', percent: 50 },
              resetSequence: true,
            },
          ],
        },
        {
          name: 'defense',
          strategy: { type: 'cyclic', sequence: [blockIntent] },
        },
      ],
    };
    const enemy = makeEnemy({ hp: 20, maxHp: 44 });

    const { intent, updatedEnemy } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(intent.id).toBe('defend');
    expect(updatedEnemy.aiState.currentPhase).toBe(1);
  });

  it('debe resetear sequenceIndex al transicionar si resetSequence es true', () => {
    const pattern: PhasedPattern = {
      type: 'phased',
      initialPhase: 0,
      phases: [
        {
          name: 'phase0',
          strategy: { type: 'cyclic', sequence: [strikeIntent, buffIntent] },
          transitionTo: [
            { targetPhase: 1, condition: { type: 'turn-equals', turn: 2 }, resetSequence: true },
          ],
        },
        {
          name: 'phase1',
          strategy: { type: 'cyclic', sequence: [blockIntent] },
        },
      ],
    };
    const enemy = makeEnemy({
      aiState: { turnCount: 2, sequenceIndex: 1, lastMoves: [], currentPhase: 0 },
    });

    const { updatedEnemy } = ai.getNextIntent(enemy, pattern, makeContext({ turnNumber: 2 }));

    expect(updatedEnemy.aiState.currentPhase).toBe(1);
    // [blockIntent] tiene 1 elemento: juega índice 0 → siguiente = wrap a startIndex(0)
    expect(updatedEnemy.aiState.sequenceIndex).toBe(0);
  });

  it('no debe transicionar si la condición no se cumple', () => {
    const pattern: PhasedPattern = {
      type: 'phased',
      initialPhase: 0,
      phases: [
        {
          name: 'phase0',
          strategy: { type: 'cyclic', sequence: [strikeIntent] },
          transitionTo: [
            { targetPhase: 1, condition: { type: 'hp-below', percent: 50 } },
          ],
        },
        {
          name: 'phase1',
          strategy: { type: 'cyclic', sequence: [blockIntent] },
        },
      ],
    };
    const enemy = makeEnemy({ hp: 44, maxHp: 44 });

    const { updatedEnemy } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(updatedEnemy.aiState.currentPhase).toBe(0);
  });

  it('caso límite: fase sin transitionTo permanece en esa fase', () => {
    const pattern: PhasedPattern = {
      type: 'phased',
      initialPhase: 1,
      phases: [
        { name: 'phase0', strategy: { type: 'cyclic', sequence: [strikeIntent] } },
        { name: 'phase1', strategy: { type: 'cyclic', sequence: [blockIntent] } },
      ],
    };
    const enemy = makeEnemy({
      aiState: { turnCount: 1, sequenceIndex: 0, lastMoves: [], currentPhase: 1 },
    });

    const { intent, updatedEnemy } = ai.getNextIntent(enemy, pattern, makeContext());

    expect(intent.id).toBe('defend');
    expect(updatedEnemy.aiState.currentPhase).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// resolveIntent — acciones individuales
// ---------------------------------------------------------------------------

describe('EnemyAI — resolveIntent', () => {
  let ai: EnemyAI;

  beforeEach(() => {
    ai = new EnemyAI();
  });

  describe('damage', () => {
    it('debe reducir el bloqueo antes de afectar el HP', () => {
      const intent: Intent = { id: 'hit', display: { type: 'attack', value: 6 }, actions: [{ type: 'damage', value: 6 }] };
      const player = makePlayer({ hp: 80, block: 4 });

      const { updatedPlayer } = ai.resolveIntent(makeEnemy(), intent, player);

      expect(updatedPlayer.block).toBe(0);
      expect(updatedPlayer.hp).toBe(78);
    });

    it('debe aplicar strength del enemigo al daño', () => {
      const intent: Intent = { id: 'hit', display: { type: 'attack', value: 6 }, actions: [{ type: 'damage', value: 6 }] };
      const enemy = makeEnemy({ statusEffects: [{ type: 'strength', stacks: 3 }] });

      const { updatedPlayer } = ai.resolveIntent(enemy, intent, makePlayer());

      // 6 + 3 strength = 9 de daño
      expect(updatedPlayer.hp).toBe(71);
    });

    it('weak en el enemigo reduce el daño un 25%', () => {
      const intent: Intent = { id: 'hit', display: { type: 'attack', value: 10 }, actions: [{ type: 'damage', value: 10 }] };
      const enemy = makeEnemy({ statusEffects: [{ type: 'weak', stacks: 1 }] });

      const { updatedPlayer } = ai.resolveIntent(enemy, intent, makePlayer());

      // floor(10 * 0.75) = 7
      expect(updatedPlayer.hp).toBe(73);
    });

    it('vulnerable en el jugador aumenta el daño un 50%', () => {
      const intent: Intent = { id: 'hit', display: { type: 'attack', value: 10 }, actions: [{ type: 'damage', value: 10 }] };
      const player = makePlayer({ statusEffects: [{ type: 'vulnerable', stacks: 1 }] });

      const { updatedPlayer } = ai.resolveIntent(makeEnemy(), intent, player);

      // floor(10 * 1.5) = 15
      expect(updatedPlayer.hp).toBe(65);
    });

    it('intangible en el jugador limita el daño a 1', () => {
      const intent: Intent = { id: 'hit', display: { type: 'attack', value: 50 }, actions: [{ type: 'damage', value: 50 }] };
      const player = makePlayer({ statusEffects: [{ type: 'intangible', stacks: 1 }] });

      const { updatedPlayer } = ai.resolveIntent(makeEnemy(), intent, player);

      expect(updatedPlayer.hp).toBe(79);
    });

    it('multi-hit aplica el daño N veces', () => {
      const intent: Intent = {
        id: 'whirlwind',
        display: { type: 'attack', value: 5, times: 3 },
        actions: [{ type: 'damage', value: 5, times: 3 }],
      };

      const { updatedPlayer } = ai.resolveIntent(makeEnemy(), intent, makePlayer());

      expect(updatedPlayer.hp).toBe(65);
    });

    it('thorns daña al enemigo atacante por cada golpe', () => {
      const intent: Intent = { id: 'hit', display: { type: 'attack', value: 6 }, actions: [{ type: 'damage', value: 6 }] };
      const player = makePlayer({ statusEffects: [{ type: 'thorns', stacks: 3 }] });
      const enemy = makeEnemy({ hp: 44 });

      const { updatedEnemy } = ai.resolveIntent(enemy, intent, player);

      expect(updatedEnemy.hp).toBe(41);
    });

    it('no aplica thorns si el daño es 0', () => {
      const intent: Intent = { id: 'hit', display: { type: 'attack', value: 0 }, actions: [{ type: 'damage', value: 0 }] };
      const player = makePlayer({ statusEffects: [{ type: 'thorns', stacks: 3 }] });
      const enemy = makeEnemy({ hp: 44 });

      const { updatedEnemy } = ai.resolveIntent(enemy, intent, player);

      expect(updatedEnemy.hp).toBe(44);
    });

    it('el HP del jugador no baja de 0', () => {
      const intent: Intent = { id: 'hit', display: { type: 'attack', value: 999 }, actions: [{ type: 'damage', value: 999 }] };

      const { updatedPlayer } = ai.resolveIntent(makeEnemy(), intent, makePlayer({ hp: 5 }));

      expect(updatedPlayer.hp).toBe(0);
    });
  });

  describe('block', () => {
    it('debe añadir bloqueo al enemigo', () => {
      const enemy = makeEnemy({ block: 5 });

      const { updatedEnemy } = ai.resolveIntent(enemy, blockIntent, makePlayer());

      expect(updatedEnemy.block).toBe(13);
    });
  });

  describe('buff (al enemigo)', () => {
    it('debe aplicar un status buff al enemigo', () => {
      const { updatedEnemy } = ai.resolveIntent(makeEnemy(), buffIntent, makePlayer());

      expect(updatedEnemy.statusEffects.length).toBe(1);
      expect(updatedEnemy.statusEffects[0].type).toBe('strength');
      expect(updatedEnemy.statusEffects[0].stacks).toBe(3);
    });

    it('debe acumular stacks si el status ya existe', () => {
      const enemy = makeEnemy({ statusEffects: [{ type: 'strength', stacks: 2 }] });

      const { updatedEnemy } = ai.resolveIntent(enemy, buffIntent, makePlayer());

      expect(updatedEnemy.statusEffects[0].stacks).toBe(5);
    });
  });

  describe('debuff-player', () => {
    it('debe aplicar un debuff al jugador', () => {
      const { updatedPlayer } = ai.resolveIntent(makeEnemy(), debuffIntent, makePlayer());

      expect(updatedPlayer.statusEffects.length).toBe(1);
      expect(updatedPlayer.statusEffects[0].type).toBe('vulnerable');
      expect(updatedPlayer.statusEffects[0].stacks).toBe(2);
    });

    it('artifact en el jugador niega el primer debuff', () => {
      const player = makePlayer({ statusEffects: [{ type: 'artifact', stacks: 1 }] });

      const { updatedPlayer } = ai.resolveIntent(makeEnemy(), debuffIntent, player);

      const hasVulnerable = updatedPlayer.statusEffects.some(e => e.type === 'vulnerable');
      expect(hasVulnerable).toBeFalse();
      const artifactRemaining = updatedPlayer.statusEffects.find(e => e.type === 'artifact');
      expect(artifactRemaining).toBeUndefined();
    });
  });

  describe('heal', () => {
    it('debe curar al enemigo sin superar su maxHp', () => {
      const enemy = makeEnemy({ hp: 30, maxHp: 44 });

      const { updatedEnemy } = ai.resolveIntent(enemy, healIntent, makePlayer());

      expect(updatedEnemy.hp).toBe(40);
    });

    it('no supera el maxHp al curar', () => {
      const enemy = makeEnemy({ hp: 42, maxHp: 44 });

      const { updatedEnemy } = ai.resolveIntent(enemy, healIntent, makePlayer());

      expect(updatedEnemy.hp).toBe(44);
    });
  });

  describe('split', () => {
    it('debe poner el HP del enemigo a 0', () => {
      const enemy = makeEnemy({ hp: 44 });

      const { updatedEnemy } = ai.resolveIntent(enemy, splitIntent, makePlayer());

      expect(updatedEnemy.hp).toBe(0);
    });
  });

  describe('summon', () => {
    it('no modifica ni al jugador ni al enemigo (la invocación la gestiona el use case)', () => {
      const summonIntent: Intent = {
        id: 'call-minion',
        display: { type: 'unknown' },
        actions: [{ type: 'summon', enemyId: 'slime-s', count: 2 }],
      };
      const player = makePlayer();
      const enemy = makeEnemy();

      const { updatedPlayer, updatedEnemy } = ai.resolveIntent(enemy, summonIntent, player);

      expect(updatedPlayer.hp).toBe(player.hp);
      expect(updatedEnemy.hp).toBe(enemy.hp);
    });
  });
});
