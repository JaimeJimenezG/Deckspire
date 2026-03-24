import type { NodeType } from '../models/map.model';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Tipo de nodo que puede tener encuentros con enemigos. */
export type EncounterNodeType = Extract<NodeType, 'combat' | 'elite' | 'boss'>;

/**
 * Una composición de enemigos que puede aparecer en un nodo.
 * `enemies` lista los IDs de `EnemyDefinition` que participan simultáneamente.
 * `weight` controla la probabilidad relativa de selección dentro del pool.
 */
export interface EncounterDefinition {
  readonly id: string;
  readonly enemies: readonly string[];
  readonly weight: number;
}

/** Pool de encuentros para un acto y tipo de nodo concretos. */
export interface EncounterPool {
  readonly act: number;
  readonly nodeType: EncounterNodeType;
  readonly encounters: readonly EncounterDefinition[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Acto 1 — Combate normal
// ─────────────────────────────────────────────────────────────────────────────

const act1CombatEncounters: readonly EncounterDefinition[] = [
  { id: 'act1-jaw-worm',      enemies: ['jaw-worm'],                         weight: 20 },
  { id: 'act1-cultist',       enemies: ['cultist'],                           weight: 20 },
  { id: 'act1-two-louses',    enemies: ['red-louse', 'red-louse'],            weight: 20 },
  { id: 'act1-acid-slime-m',  enemies: ['acid-slime-m'],                      weight: 15 },
  { id: 'act1-fungi-beast',   enemies: ['fungi-beast'],                       weight: 10 },
  { id: 'act1-jaw-louse',     enemies: ['jaw-worm', 'red-louse'],             weight: 10 },
  { id: 'act1-cultist-fungi', enemies: ['cultist', 'fungi-beast'],            weight: 5  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Acto 1 — Elite
// ─────────────────────────────────────────────────────────────────────────────

const act1EliteEncounters: readonly EncounterDefinition[] = [
  { id: 'act1-gremlin-nob', enemies: ['gremlin-nob'],                           weight: 33 },
  { id: 'act1-lagavulin',   enemies: ['lagavulin'],                             weight: 34 },
  { id: 'act1-sentries',    enemies: ['sentry-a', 'sentry-b', 'sentry-c'],      weight: 33 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Acto 1 — Boss
// ─────────────────────────────────────────────────────────────────────────────

const act1BossEncounters: readonly EncounterDefinition[] = [
  { id: 'act1-the-guardian', enemies: ['the-guardian'], weight: 50 },
  { id: 'act1-hexaghost',    enemies: ['hexaghost'],    weight: 50 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Acto 2 — Combate normal
// ─────────────────────────────────────────────────────────────────────────────

const act2CombatEncounters: readonly EncounterDefinition[] = [
  { id: 'act2-jaw-cultist',   enemies: ['jaw-worm', 'cultist'],                weight: 20 },
  { id: 'act2-three-louses',  enemies: ['red-louse', 'red-louse', 'red-louse'],weight: 20 },
  { id: 'act2-slime-fungi',   enemies: ['acid-slime-m', 'fungi-beast'],        weight: 20 },
  { id: 'act2-two-cultists',  enemies: ['cultist', 'cultist'],                 weight: 20 },
  { id: 'act2-jaw-slime',     enemies: ['jaw-worm', 'acid-slime-m'],           weight: 20 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Acto 2 — Elite
// ─────────────────────────────────────────────────────────────────────────────

const act2EliteEncounters: readonly EncounterDefinition[] = [
  { id: 'act2-gremlin-nob', enemies: ['gremlin-nob'],                           weight: 33 },
  { id: 'act2-lagavulin',   enemies: ['lagavulin'],                             weight: 34 },
  { id: 'act2-sentries',    enemies: ['sentry-a', 'sentry-b', 'sentry-c'],      weight: 33 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Acto 2 — Boss
// ─────────────────────────────────────────────────────────────────────────────

const act2BossEncounters: readonly EncounterDefinition[] = [
  { id: 'act2-the-guardian', enemies: ['the-guardian'], weight: 50 },
  { id: 'act2-hexaghost',    enemies: ['hexaghost'],    weight: 50 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Acto 3 — Combate normal
// ─────────────────────────────────────────────────────────────────────────────

const act3CombatEncounters: readonly EncounterDefinition[] = [
  { id: 'act3-jaw-cultist-louse', enemies: ['jaw-worm', 'cultist', 'red-louse'],          weight: 20 },
  { id: 'act3-slime-fungi-louse', enemies: ['acid-slime-m', 'fungi-beast', 'red-louse'],  weight: 20 },
  { id: 'act3-two-jaw-worms',     enemies: ['jaw-worm', 'jaw-worm'],                       weight: 20 },
  { id: 'act3-two-slimes-fungi',  enemies: ['acid-slime-m', 'acid-slime-m', 'fungi-beast'],weight: 20 },
  { id: 'act3-cultist-two-louses',enemies: ['cultist', 'red-louse', 'red-louse'],          weight: 20 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Acto 3 — Elite
// ─────────────────────────────────────────────────────────────────────────────

const act3EliteEncounters: readonly EncounterDefinition[] = [
  { id: 'act3-gremlin-nob', enemies: ['gremlin-nob'],                           weight: 33 },
  { id: 'act3-lagavulin',   enemies: ['lagavulin'],                             weight: 34 },
  { id: 'act3-sentries',    enemies: ['sentry-a', 'sentry-b', 'sentry-c'],      weight: 33 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Acto 3 — Boss
// ─────────────────────────────────────────────────────────────────────────────

const act3BossEncounters: readonly EncounterDefinition[] = [
  { id: 'act3-the-guardian', enemies: ['the-guardian'], weight: 50 },
  { id: 'act3-hexaghost',    enemies: ['hexaghost'],    weight: 50 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pools completos por acto
// ─────────────────────────────────────────────────────────────────────────────

export const ENCOUNTER_POOLS: readonly EncounterPool[] = [
  { act: 1, nodeType: 'combat', encounters: act1CombatEncounters },
  { act: 1, nodeType: 'elite',  encounters: act1EliteEncounters  },
  { act: 1, nodeType: 'boss',   encounters: act1BossEncounters   },
  { act: 2, nodeType: 'combat', encounters: act2CombatEncounters },
  { act: 2, nodeType: 'elite',  encounters: act2EliteEncounters  },
  { act: 2, nodeType: 'boss',   encounters: act2BossEncounters   },
  { act: 3, nodeType: 'combat', encounters: act3CombatEncounters },
  { act: 3, nodeType: 'elite',  encounters: act3EliteEncounters  },
  { act: 3, nodeType: 'boss',   encounters: act3BossEncounters   },
] as const;

/**
 * Índice de pools por clave `"act-nodeType"` para búsqueda O(1).
 *
 * @example
 * const pool = ENCOUNTER_POOLS_BY_KEY['1-combat'];
 */
export const ENCOUNTER_POOLS_BY_KEY: Readonly<Record<string, EncounterPool>> =
  ENCOUNTER_POOLS.reduce<Record<string, EncounterPool>>((acc, pool) => {
    acc[`${pool.act}-${pool.nodeType}`] = pool;
    return acc;
  }, {});

/**
 * Todos los encuentros individuales del juego indexados por ID.
 * Útil para validar referencias o recuperar un encuentro concreto.
 */
export const ENCOUNTERS_BY_ID: Readonly<Record<string, EncounterDefinition>> =
  ENCOUNTER_POOLS.flatMap(pool => pool.encounters).reduce<
    Record<string, EncounterDefinition>
  >((acc, enc) => {
    acc[enc.id] = enc;
    return acc;
  }, {});
