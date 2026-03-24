import { EnemyDefinition, Intent } from '../models/enemy.model';

// ─────────────────────────────────────────────────────────────────────────────
// Intents — enemigos normales
// ─────────────────────────────────────────────────────────────────────────────

// ── Jaw Worm ──────────────────────────────────────────────────────────────────

const jawWormChomp: Intent = {
  id: 'jaw-worm-chomp',
  display: { type: 'attack', value: 11 },
  actions: [{ type: 'damage', value: 11 }],
} as const;

const jawWormThrash: Intent = {
  id: 'jaw-worm-thrash',
  display: { type: 'attack', value: 7 },
  actions: [
    { type: 'damage', value: 7 },
    { type: 'block', value: 5 },
  ],
} as const;

const jawWormBellow: Intent = {
  id: 'jaw-worm-bellow',
  display: { type: 'buff' },
  actions: [
    { type: 'buff', status: 'strength', stacks: 3 },
    { type: 'block', value: 6 },
  ],
} as const;

// ── Cultist ───────────────────────────────────────────────────────────────────

const cultistIncantation: Intent = {
  id: 'cultist-incantation',
  display: { type: 'buff' },
  actions: [{ type: 'buff', status: 'ritual', stacks: 3 }],
} as const;

const cultistDarkStrike: Intent = {
  id: 'cultist-dark-strike',
  display: { type: 'attack', value: 6 },
  actions: [{ type: 'damage', value: 6 }],
} as const;

// ── Red Louse ─────────────────────────────────────────────────────────────────

const louseBite: Intent = {
  id: 'louse-bite',
  display: { type: 'attack', value: 6 },
  actions: [{ type: 'damage', value: 6 }],
} as const;

const louseGrow: Intent = {
  id: 'louse-grow',
  display: { type: 'buff' },
  actions: [{ type: 'buff', status: 'strength', stacks: 3 }],
} as const;

// ── Acid Slime M ──────────────────────────────────────────────────────────────

const slimeTackle: Intent = {
  id: 'slime-tackle',
  display: { type: 'attack', value: 10 },
  actions: [{ type: 'damage', value: 10 }],
} as const;

const slimeLick: Intent = {
  id: 'slime-lick',
  display: { type: 'debuff' },
  actions: [{ type: 'debuff-player', status: 'weak', stacks: 1 }],
} as const;

/** Corrosive Spit: daño moderado + aplica Weak (aproxima el mecanismo de añadir cartas Slimed). */
const slimeCorrosiveSpit: Intent = {
  id: 'slime-corrosive-spit',
  display: { type: 'attack-debuff', value: 7 },
  actions: [
    { type: 'damage', value: 7 },
    { type: 'debuff-player', status: 'weak', stacks: 1 },
  ],
} as const;

// ── Fungi Beast ───────────────────────────────────────────────────────────────

const fungiBite: Intent = {
  id: 'fungi-bite',
  display: { type: 'attack', value: 6 },
  actions: [{ type: 'damage', value: 6 }],
} as const;

const fungiGrow: Intent = {
  id: 'fungi-grow',
  display: { type: 'buff' },
  actions: [{ type: 'buff', status: 'strength', stacks: 3 }],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Intents — enemigos elite
// ─────────────────────────────────────────────────────────────────────────────

// ── Gremlin Nob ───────────────────────────────────────────────────────────────

/**
 * Bellow: el Nob gana Fuerza y Enrage (gana más Fuerza cada vez que el jugador
 * juega una Habilidad).
 */
const nobBellow: Intent = {
  id: 'nob-bellow',
  display: { type: 'buff' },
  actions: [
    { type: 'buff', status: 'strength', stacks: 2 },
    { type: 'buff', status: 'enrage', stacks: 2 },
  ],
} as const;

const nobSkullBash: Intent = {
  id: 'nob-skull-bash',
  display: { type: 'attack-debuff', value: 6 },
  actions: [
    { type: 'damage', value: 6 },
    { type: 'debuff-player', status: 'vulnerable', stacks: 2 },
  ],
} as const;

const nobRush: Intent = {
  id: 'nob-rush',
  display: { type: 'attack', value: 14 },
  actions: [{ type: 'damage', value: 14 }],
} as const;

// ── Lagavulin ─────────────────────────────────────────────────────────────────

/** Sleep: Lagavulin no hace nada mientras está dormido. */
const lagavulinSleep: Intent = {
  id: 'lagavulin-sleep',
  display: { type: 'unknown' },
  actions: [],
} as const;

const lagavulinAttack: Intent = {
  id: 'lagavulin-attack',
  display: { type: 'attack', value: 18 },
  actions: [{ type: 'damage', value: 18 }],
} as const;

/**
 * Sap: drena 1 punto de Fuerza y 1 de Destreza del jugador.
 * Shackled aproxima la reducción de Fuerza; Frail aproxima la reducción de Destreza
 * (penaliza el bloqueo de forma similar).
 */
const lagavulinSap: Intent = {
  id: 'lagavulin-sap',
  display: { type: 'debuff' },
  actions: [
    { type: 'debuff-player', status: 'shackled', stacks: 1 },
    { type: 'debuff-player', status: 'frail', stacks: 1 },
  ],
} as const;

// ── Sentries ──────────────────────────────────────────────────────────────────

const sentryBolt: Intent = {
  id: 'sentry-bolt',
  display: { type: 'attack', value: 9 },
  actions: [{ type: 'damage', value: 9 }],
} as const;

/** Daze: el jugador obtiene 2 stacks de Aturdimiento (cartas cuestan más energía). */
const sentryDaze: Intent = {
  id: 'sentry-daze',
  display: { type: 'debuff' },
  actions: [{ type: 'debuff-player', status: 'daze', stacks: 2 }],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Intents — bosses
// ─────────────────────────────────────────────────────────────────────────────

// ── The Guardian ──────────────────────────────────────────────────────────────

const guardianBash: Intent = {
  id: 'guardian-bash',
  display: { type: 'attack', value: 32 },
  actions: [{ type: 'damage', value: 32 }],
} as const;

const guardianWhirlwind: Intent = {
  id: 'guardian-whirlwind',
  display: { type: 'attack', value: 5, times: 4 },
  actions: [{ type: 'damage', value: 5, times: 4 }],
} as const;

const guardianCharge: Intent = {
  id: 'guardian-charge',
  display: { type: 'defend' },
  actions: [{ type: 'block', value: 9 }],
} as const;

/**
 * Shield Bash: el Guardian gana un bloqueo masivo y activa Espinas como respuesta
 * a cualquier ataque durante la fase de defensa.
 */
const guardianShieldBash: Intent = {
  id: 'guardian-shield-bash',
  display: { type: 'defend' },
  actions: [
    { type: 'block', value: 36 },
    { type: 'buff', status: 'thorns', stacks: 3 },
  ],
} as const;

const guardianRollAttack: Intent = {
  id: 'guardian-roll-attack',
  display: { type: 'attack', value: 9 },
  actions: [{ type: 'damage', value: 9 }],
} as const;

// ── Hexaghost ────────────────────────────────────────────────────────────────

/** Activate: primer turno, el Hexaghost "despierta" sin realizar ninguna acción visible. */
const hexaghostActivate: Intent = {
  id: 'hexaghost-activate',
  display: { type: 'unknown' },
  actions: [],
} as const;

/** Divider: 6 golpes de 6 de daño cada uno. */
const hexaghostDivider: Intent = {
  id: 'hexaghost-divider',
  display: { type: 'attack', value: 6, times: 6 },
  actions: [{ type: 'damage', value: 6, times: 6 }],
} as const;

/**
 * Inferno: 6 golpes de 2 de daño + aplica Quemadura al jugador
 * (aproxima el mecanismo de añadir cartas Burn al mazo).
 */
const hexaghostInferno: Intent = {
  id: 'hexaghost-inferno',
  display: { type: 'attack-debuff', value: 2, times: 6 },
  actions: [
    { type: 'damage', value: 2, times: 6 },
    { type: 'debuff-player', status: 'burn', stacks: 3 },
  ],
} as const;

/** Sear: daño moderado + Quemadura. */
const hexaghostSear: Intent = {
  id: 'hexaghost-sear',
  display: { type: 'attack-debuff', value: 6 },
  actions: [
    { type: 'damage', value: 6 },
    { type: 'debuff-player', status: 'burn', stacks: 1 },
  ],
} as const;

const hexaghostTackle: Intent = {
  id: 'hexaghost-tackle',
  display: { type: 'attack', value: 5, times: 2 },
  actions: [{ type: 'damage', value: 5, times: 2 }],
} as const;

/** Inflame: el Hexaghost gana Fuerza y Bloqueo. */
const hexaghostInflame: Intent = {
  id: 'hexaghost-inflame',
  display: { type: 'buff' },
  actions: [
    { type: 'buff', status: 'strength', stacks: 2 },
    { type: 'block', value: 12 },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Definiciones de enemigos normales
// ─────────────────────────────────────────────────────────────────────────────

const jawWorm: EnemyDefinition = {
  id: 'jaw-worm',
  name: 'Jaw Worm',
  tier: 'normal',
  baseHp: { min: 40, max: 44 },
  pattern: {
    type: 'weighted-random',
    moves: [
      { intent: jawWormChomp, weight: 45 },
      { intent: jawWormThrash, weight: 30 },
      { intent: jawWormBellow, weight: 25 },
    ],
    maxConsecutive: 2,
  },
} as const;

/**
 * Cultist: turno 1 siempre Incantation (gana Ritual +3 fuerza/turno), luego
 * DarkStrike en bucle (startIndex: 1 hace que el loop omita el primer move).
 */
const cultist: EnemyDefinition = {
  id: 'cultist',
  name: 'Cultist',
  tier: 'normal',
  baseHp: { min: 48, max: 54 },
  pattern: {
    type: 'cyclic',
    sequence: [cultistIncantation, cultistDarkStrike],
    startIndex: 1,
  },
} as const;

/**
 * Red Louse: mayoritariamente Bite; Grow no puede repetirse consecutivamente
 * (maxConsecutive: 1 impide que cualquier movimiento se repita dos veces seguidas).
 */
const redLouse: EnemyDefinition = {
  id: 'red-louse',
  name: 'Red Louse',
  tier: 'normal',
  baseHp: { min: 10, max: 15 },
  pattern: {
    type: 'weighted-random',
    moves: [
      { intent: louseBite, weight: 75 },
      { intent: louseGrow, weight: 25 },
    ],
    maxConsecutive: 1,
  },
} as const;

const acidSlimeM: EnemyDefinition = {
  id: 'acid-slime-m',
  name: 'Acid Slime (M)',
  tier: 'normal',
  baseHp: { min: 28, max: 32 },
  pattern: {
    type: 'weighted-random',
    moves: [
      { intent: slimeTackle, weight: 40 },
      { intent: slimeLick, weight: 30 },
      { intent: slimeCorrosiveSpit, weight: 30 },
    ],
    maxConsecutive: 2,
  },
} as const;

const fungiBeast: EnemyDefinition = {
  id: 'fungi-beast',
  name: 'Fungi Beast',
  tier: 'normal',
  baseHp: { min: 22, max: 28 },
  pattern: {
    type: 'cyclic',
    sequence: [fungiBite, fungiGrow],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Definiciones de enemigos elite
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gremlin Nob:
 * - Turno 1: siempre Bellow (gana Fuerza + Enrage).
 * - Si el jugador jugó una Skill este turno: Skull Bash (el efecto Enrage ya
 *   activa la ganancia de fuerza automáticamente en la capa de dominio).
 * - Fallback: Rush (ataque poderoso cuando el jugador no juega Skills).
 */
const gremlinNob: EnemyDefinition = {
  id: 'gremlin-nob',
  name: 'Gremlin Nob',
  tier: 'elite',
  baseHp: { min: 82, max: 86 },
  pattern: {
    type: 'conditional',
    rules: [
      {
        condition: { type: 'turn-equals', turn: 1 },
        intent: nobBellow,
      },
      {
        condition: { type: 'player-played-type', cardType: 'skill' },
        intent: nobSkullBash,
      },
    ],
    fallback: nobRush,
  },
} as const;

/**
 * Lagavulin:
 * - Fase 0 (dormido): Sleep hasta que el jugador lo ataque (hp < 100%) o supere
 *   el turno 3.
 * - Fase 1 (despierto): alterna Attack (18dmg) y Sap (drena fuerza y destreza).
 */
const lagavulin: EnemyDefinition = {
  id: 'lagavulin',
  name: 'Lagavulin',
  tier: 'elite',
  baseHp: { min: 109, max: 111 },
  pattern: {
    type: 'phased',
    initialPhase: 0,
    phases: [
      {
        name: 'dormido',
        strategy: {
          type: 'cyclic',
          sequence: [lagavulinSleep],
        },
        transitionTo: [
          {
            targetPhase: 1,
            resetSequence: true,
            condition: {
              type: 'or',
              conditions: [
                { type: 'turn-greater', turn: 3 },
                // hp-below: 100 se cumple en cuanto recibe cualquier daño (HP < 100%)
                { type: 'hp-below', percent: 100 },
              ],
            },
          },
        ],
      },
      {
        name: 'despierto',
        strategy: {
          type: 'cyclic',
          sequence: [lagavulinAttack, lagavulinSap],
        },
      },
    ],
  },
} as const;

/**
 * Sentries: tres centinelas con secuencias desincronizadas.
 * Sentry A y C comienzan con Bolt; Sentry B comienza con Daze.
 * Cuando se usan juntos en un encuentro, sus ataques no coinciden en el mismo turno.
 */
const sentryA: EnemyDefinition = {
  id: 'sentry-a',
  name: 'Sentry',
  tier: 'elite',
  baseHp: { min: 38, max: 42 },
  pattern: {
    type: 'cyclic',
    sequence: [sentryBolt, sentryDaze],
  },
} as const;

const sentryB: EnemyDefinition = {
  id: 'sentry-b',
  name: 'Sentry',
  tier: 'elite',
  baseHp: { min: 38, max: 42 },
  pattern: {
    type: 'cyclic',
    sequence: [sentryDaze, sentryBolt],
  },
} as const;

const sentryC: EnemyDefinition = {
  id: 'sentry-c',
  name: 'Sentry',
  tier: 'elite',
  baseHp: { min: 38, max: 42 },
  pattern: {
    type: 'cyclic',
    sequence: [sentryBolt, sentryDaze],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Definiciones de bosses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Guardian:
 * - Fase AttackMode: secuencia cíclica [Bash, Whirlwind, Charge].
 *   Transición a DefenseMode cuando HP cae por debajo del 75% (≈ recibir ~60 dmg).
 * - Fase DefenseMode: [ShieldBash, RollAttack].
 *   Transición de vuelta a AttackMode al superar el umbral de HP-above 74
 *   no se produce (el HP no sube), por lo que la transición usa `turn-greater`
 *   respecto al turno global: tras varios turnos en DefenseMode, vuelve a atacar.
 *   Se usa turn-greater: 6 como aproximación conservadora del momento de retorno.
 */
const theGuardian: EnemyDefinition = {
  id: 'the-guardian',
  name: 'The Guardian',
  tier: 'boss',
  baseHp: { min: 235, max: 250 },
  pattern: {
    type: 'phased',
    initialPhase: 0,
    phases: [
      {
        name: 'attack-mode',
        strategy: {
          type: 'cyclic',
          sequence: [guardianBash, guardianWhirlwind, guardianCharge],
        },
        transitionTo: [
          {
            targetPhase: 1,
            resetSequence: true,
            condition: { type: 'hp-below', percent: 75 },
          },
        ],
      },
      {
        name: 'defense-mode',
        strategy: {
          type: 'cyclic',
          sequence: [guardianShieldBash, guardianRollAttack],
        },
        transitionTo: [
          {
            targetPhase: 0,
            resetSequence: true,
            // Vuelve a modo ataque tras suficientes turnos en modo defensa.
            // turn-greater: 6 es una aproximación; en el juego real el umbral
            // es estructural (2 turnos en fase defensa), aquí se usa el turno
            // global como proxy conservador.
            condition: { type: 'turn-greater', turn: 6 },
          },
        ],
      },
    ],
  },
} as const;

/**
 * Hexaghost:
 * - Fase 0 (dormido/activate): ejecuta Activate en el turno 1.
 *   Transición a Fase 1 cuando turn-greater: 1 (a partir del turno 2).
 * - Fase 1 (activo): ciclo de 6 movimientos —
 *   Divider → Inferno → Sear → Tackle → Sear → Inflame → (vuelve a Divider).
 */
const hexaghost: EnemyDefinition = {
  id: 'hexaghost',
  name: 'Hexaghost',
  tier: 'boss',
  baseHp: { min: 250, max: 250 },
  pattern: {
    type: 'phased',
    initialPhase: 0,
    phases: [
      {
        name: 'dormant',
        strategy: {
          type: 'cyclic',
          sequence: [hexaghostActivate],
        },
        transitionTo: [
          {
            targetPhase: 1,
            resetSequence: true,
            condition: { type: 'turn-greater', turn: 1 },
          },
        ],
      },
      {
        name: 'active',
        strategy: {
          type: 'cyclic',
          sequence: [
            hexaghostDivider,
            hexaghostInferno,
            hexaghostSear,
            hexaghostTackle,
            hexaghostSear,
            hexaghostInflame,
          ],
        },
      },
    ],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export const NORMAL_ENEMIES: readonly EnemyDefinition[] = [
  jawWorm,
  cultist,
  redLouse,
  acidSlimeM,
  fungiBeast,
] as const;

export const ELITE_ENEMIES: readonly EnemyDefinition[] = [
  gremlinNob,
  lagavulin,
  sentryA,
  sentryB,
  sentryC,
] as const;

export const BOSS_ENEMIES: readonly EnemyDefinition[] = [
  theGuardian,
  hexaghost,
] as const;

/** Todos los enemigos del juego indexados por ID para búsqueda O(1). */
export const ENEMIES_BY_ID: Readonly<Record<string, EnemyDefinition>> = [
  ...NORMAL_ENEMIES,
  ...ELITE_ENEMIES,
  ...BOSS_ENEMIES,
].reduce<Record<string, EnemyDefinition>>((acc, enemy) => {
  acc[enemy.id] = enemy;
  return acc;
}, {});
