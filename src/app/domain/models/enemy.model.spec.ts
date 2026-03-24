import {
  CyclicPattern,
  ConditionalPattern,
  EnemyDefinition,
  EnemyInstance,
  Intent,
  IntentAction,
  IntentCondition,
  PhasedPattern,
  WeightedRandomPattern,
} from './enemy.model';

// ---------------------------------------------------------------------------
// Fixtures reutilizables
// ---------------------------------------------------------------------------

const strikeIntent: Intent = {
  id: 'strike',
  display: { type: 'attack', value: 6 },
  actions: [{ type: 'damage', value: 6 }],
};

const buffIntent: Intent = {
  id: 'bellow',
  display: { type: 'buff' },
  actions: [
    { type: 'buff', status: 'strength', stacks: 3 },
    { type: 'block', value: 6 },
  ],
};

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

describe('Intent', () => {
  it('debe construirse con display de ataque y acciones de daño', () => {
    const intent: Intent = {
      id: 'chomp',
      display: { type: 'attack', value: 11 },
      actions: [{ type: 'damage', value: 11 }],
    };

    expect(intent.id).toBe('chomp');
    expect(intent.display.type).toBe('attack');
    expect(intent.display.value).toBe(11);
    expect((intent.actions[0] as { type: 'damage'; value: number }).value).toBe(11);
  });

  it('debe admitir multi-hit con campo times', () => {
    const intent: Intent = {
      id: 'whirlwind',
      display: { type: 'attack', value: 5, times: 4 },
      actions: [{ type: 'damage', value: 5, times: 4 }],
    };

    expect(intent.display.times).toBe(4);
    const action = intent.actions[0] as { type: 'damage'; value: number; times?: number };
    expect(action.times).toBe(4);
  });

  it('debe admitir display de tipo unknown sin value', () => {
    const intent: Intent = {
      id: 'sleep',
      display: { type: 'unknown' },
      actions: [],
    };

    expect(intent.display.type).toBe('unknown');
    expect(intent.display.value).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// IntentAction (discriminated union)
// ---------------------------------------------------------------------------

describe('IntentAction', () => {
  it('action de tipo block debe tener value', () => {
    const action: IntentAction = { type: 'block', value: 12 };
    expect(action.type).toBe('block');
    if (action.type === 'block') {
      expect(action.value).toBe(12);
    }
  });

  it('action de tipo debuff-player debe tener status y stacks', () => {
    const action: IntentAction = { type: 'debuff-player', status: 'vulnerable', stacks: 2 };
    expect(action.type).toBe('debuff-player');
    if (action.type === 'debuff-player') {
      expect(action.status).toBe('vulnerable');
      expect(action.stacks).toBe(2);
    }
  });

  it('action de tipo split no necesita campos adicionales', () => {
    const action: IntentAction = { type: 'split' };
    expect(action.type).toBe('split');
  });

  it('action de tipo summon debe tener enemyId y count', () => {
    const action: IntentAction = { type: 'summon', enemyId: 'slime-s', count: 2 };
    if (action.type === 'summon') {
      expect(action.enemyId).toBe('slime-s');
      expect(action.count).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// IntentCondition (discriminated union recursivo)
// ---------------------------------------------------------------------------

describe('IntentCondition', () => {
  it('condición hp-below debe tener percent', () => {
    const cond: IntentCondition = { type: 'hp-below', percent: 50 };
    if (cond.type === 'hp-below') {
      expect(cond.percent).toBe(50);
    }
  });

  it('condición and debe contener sub-condiciones', () => {
    const cond: IntentCondition = {
      type: 'and',
      conditions: [
        { type: 'hp-below', percent: 50 },
        { type: 'turn-greater', turn: 3 },
      ],
    };
    if (cond.type === 'and') {
      expect(cond.conditions.length).toBe(2);
    }
  });

  it('condición not debe envolver otra condición', () => {
    const cond: IntentCondition = {
      type: 'not',
      condition: { type: 'player-has-status', status: 'vulnerable' },
    };
    if (cond.type === 'not') {
      expect(cond.condition.type).toBe('player-has-status');
    }
  });
});

// ---------------------------------------------------------------------------
// CyclicPattern
// ---------------------------------------------------------------------------

describe('CyclicPattern', () => {
  it('debe construirse con secuencia de intents', () => {
    const pattern: CyclicPattern = {
      type: 'cyclic',
      sequence: [buffIntent, strikeIntent],
    };

    expect(pattern.type).toBe('cyclic');
    expect(pattern.sequence.length).toBe(2);
    expect(pattern.sequence[0].id).toBe('bellow');
  });

  it('caso límite: secuencia de un solo intent', () => {
    const pattern: CyclicPattern = {
      type: 'cyclic',
      sequence: [strikeIntent],
      startIndex: 0,
    };

    expect(pattern.sequence.length).toBe(1);
    expect(pattern.startIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// WeightedRandomPattern
// ---------------------------------------------------------------------------

describe('WeightedRandomPattern', () => {
  it('debe construirse con moves y maxConsecutive', () => {
    const pattern: WeightedRandomPattern = {
      type: 'weighted-random',
      moves: [
        { intent: strikeIntent, weight: 45 },
        { intent: buffIntent, weight: 25 },
      ],
      maxConsecutive: 2,
    };

    expect(pattern.moves.length).toBe(2);
    expect(pattern.moves[0].weight).toBe(45);
    expect(pattern.maxConsecutive).toBe(2);
  });

  it('caso límite: maxConsecutive de 1 previene repetición inmediata', () => {
    const pattern: WeightedRandomPattern = {
      type: 'weighted-random',
      moves: [{ intent: buffIntent, weight: 100 }],
      maxConsecutive: 1,
    };

    expect(pattern.maxConsecutive).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ConditionalPattern
// ---------------------------------------------------------------------------

describe('ConditionalPattern', () => {
  it('debe construirse con reglas y fallback', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [
        {
          condition: { type: 'turn-equals', turn: 1 },
          intent: buffIntent,
        },
      ],
      fallback: strikeIntent,
    };

    expect(pattern.rules.length).toBe(1);
    expect(pattern.fallback.id).toBe('strike');
  });

  it('caso límite: sin reglas solo usa fallback', () => {
    const pattern: ConditionalPattern = {
      type: 'conditional',
      rules: [],
      fallback: strikeIntent,
    };

    expect(pattern.rules.length).toBe(0);
    expect(pattern.fallback).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PhasedPattern
// ---------------------------------------------------------------------------

describe('PhasedPattern', () => {
  it('debe construirse con fases y fase inicial', () => {
    const pattern: PhasedPattern = {
      type: 'phased',
      initialPhase: 0,
      phases: [
        {
          name: 'attack-mode',
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
          name: 'defense-mode',
          strategy: { type: 'cyclic', sequence: [buffIntent] },
        },
      ],
    };

    expect(pattern.phases.length).toBe(2);
    expect(pattern.phases[0].name).toBe('attack-mode');
    expect(pattern.phases[0].transitionTo![0].targetPhase).toBe(1);
    expect(pattern.phases[1].transitionTo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EnemyDefinition
// ---------------------------------------------------------------------------

describe('EnemyDefinition', () => {
  it('debe construirse con todos sus campos obligatorios', () => {
    const def: EnemyDefinition = {
      id: 'jaw-worm',
      name: 'Jaw Worm',
      tier: 'normal',
      baseHp: { min: 40, max: 44 },
      pattern: {
        type: 'weighted-random',
        moves: [{ intent: strikeIntent, weight: 100 }],
        maxConsecutive: 2,
      },
    };

    expect(def.id).toBe('jaw-worm');
    expect(def.tier).toBe('normal');
    expect(def.baseHp.min).toBe(40);
    expect(def.onDeath).toBeUndefined();
  });

  it('debe admitir onDeath de tipo split', () => {
    const def: EnemyDefinition = {
      id: 'acid-slime-l',
      name: 'Acid Slime (L)',
      tier: 'normal',
      baseHp: { min: 65, max: 69 },
      pattern: {
        type: 'conditional',
        rules: [
          {
            condition: { type: 'hp-below', percent: 50 },
            intent: { id: 'split', display: { type: 'unknown' }, actions: [{ type: 'split' }] },
          },
        ],
        fallback: strikeIntent,
      },
      onDeath: { type: 'split', spawnEnemyIds: ['acid-slime-m', 'acid-slime-m'] },
    };

    expect(def.onDeath?.type).toBe('split');
    if (def.onDeath?.type === 'split') {
      expect(def.onDeath.spawnEnemyIds.length).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// EnemyInstance
// ---------------------------------------------------------------------------

describe('EnemyInstance', () => {
  it('debe construirse con estado inicial de combate', () => {
    const instance: EnemyInstance = {
      definitionId: 'jaw-worm',
      hp: 42,
      maxHp: 44,
      block: 0,
      statusEffects: [],
      currentIntent: strikeIntent,
      aiState: {
        turnCount: 1,
        sequenceIndex: 0,
        lastMoves: [],
        currentPhase: 0,
      },
    };

    expect(instance.hp).toBe(42);
    expect(instance.block).toBe(0);
    expect(instance.currentIntent?.id).toBe('strike');
    expect(instance.aiState.turnCount).toBe(1);
  });

  it('caso límite: currentIntent null al inicio del combate', () => {
    const instance: EnemyInstance = {
      definitionId: 'cultist',
      hp: 50,
      maxHp: 50,
      block: 0,
      statusEffects: [],
      currentIntent: null,
      aiState: {
        turnCount: 0,
        sequenceIndex: 0,
        lastMoves: [],
        currentPhase: 0,
      },
    };

    expect(instance.currentIntent).toBeNull();
    expect(instance.aiState.turnCount).toBe(0);
  });

  it('debe admitir statusEffects con múltiples efectos activos', () => {
    const instance: EnemyInstance = {
      definitionId: 'the-guardian',
      hp: 200,
      maxHp: 240,
      block: 30,
      statusEffects: [
        { type: 'strength', stacks: 5 },
        { type: 'thorns', stacks: 3 },
      ],
      currentIntent: null,
      aiState: {
        turnCount: 3,
        sequenceIndex: 2,
        lastMoves: ['bash', 'whirlwind'],
        currentPhase: 1,
      },
    };

    expect(instance.statusEffects.length).toBe(2);
    expect(instance.aiState.currentPhase).toBe(1);
    expect(instance.aiState.lastMoves.length).toBe(2);
  });
});
