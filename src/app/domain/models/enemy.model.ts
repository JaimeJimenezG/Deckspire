import { CardType } from './card.model';
import { StatusEffect, StatusType } from './status-effect.model';

// ---------------------------------------------------------------------------
// Rangos y efectos auxiliares
// ---------------------------------------------------------------------------

export interface HpRange {
  readonly min: number;
  readonly max: number;
}

export type DeathEffect =
  | { readonly type: 'split'; readonly spawnEnemyIds: readonly [string, string] }
  | { readonly type: 'none' };

// ---------------------------------------------------------------------------
// Intent: lo que el enemigo va a hacer en su turno
// ---------------------------------------------------------------------------

export type IntentDisplayType =
  | 'attack'
  | 'defend'
  | 'buff'
  | 'debuff'
  | 'attack-debuff'
  | 'unknown';

export interface IntentDisplay {
  readonly type: IntentDisplayType;
  /** Daño mostrado (solo para intents de ataque) */
  readonly value?: number;
  /** Multiplicador de golpes (x2, x3 para multi-hit) */
  readonly times?: number;
}

export type IntentAction =
  | { readonly type: 'damage'; readonly value: number; readonly times?: number }
  | { readonly type: 'block'; readonly value: number }
  | { readonly type: 'buff'; readonly status: StatusType; readonly stacks: number }
  | { readonly type: 'debuff-player'; readonly status: StatusType; readonly stacks: number }
  | { readonly type: 'heal'; readonly value: number }
  | { readonly type: 'summon'; readonly enemyId: string; readonly count: number }
  | { readonly type: 'split' };

export interface Intent {
  readonly id: string;
  readonly display: IntentDisplay;
  readonly actions: readonly IntentAction[];
}

// ---------------------------------------------------------------------------
// Condiciones para ConditionalStrategy y transiciones de fase
// ---------------------------------------------------------------------------

export type IntentCondition =
  | { readonly type: 'hp-below'; readonly percent: number }
  | { readonly type: 'hp-above'; readonly percent: number }
  | { readonly type: 'turn-equals'; readonly turn: number }
  | { readonly type: 'turn-greater'; readonly turn: number }
  | { readonly type: 'player-has-status'; readonly status: StatusType }
  | { readonly type: 'player-played-type'; readonly cardType: CardType }
  | { readonly type: 'and'; readonly conditions: readonly IntentCondition[] }
  | { readonly type: 'or'; readonly conditions: readonly IntentCondition[] }
  | { readonly type: 'not'; readonly condition: IntentCondition };

// ---------------------------------------------------------------------------
// Estrategias de comportamiento (EnemyPattern)
// ---------------------------------------------------------------------------

/** Rotación fija de intents que se repite en bucle */
export interface CyclicPattern {
  readonly type: 'cyclic';
  readonly sequence: readonly Intent[];
  /** Índice de inicio en la secuencia (por defecto 0) */
  readonly startIndex?: number;
}

export interface WeightedMove {
  readonly intent: Intent;
  /** Peso relativo (no necesita sumar 100) */
  readonly weight: number;
}

/** Selección aleatoria con pesos y restricciones de repetición */
export interface WeightedRandomPattern {
  readonly type: 'weighted-random';
  readonly moves: readonly WeightedMove[];
  /** Máximo de veces que se puede repetir el mismo intent consecutivamente */
  readonly maxConsecutive: number;
}

export interface ConditionalRule {
  readonly condition: IntentCondition;
  readonly intent: Intent;
}

/** Árbol de decisiones basado en el estado del combate */
export interface ConditionalPattern {
  readonly type: 'conditional';
  /** Reglas evaluadas en orden; la primera que coincide gana */
  readonly rules: readonly ConditionalRule[];
  /** Intent usado si ninguna regla coincide */
  readonly fallback: Intent;
}

export interface PhaseTransition {
  /** Índice de la fase destino */
  readonly targetPhase: number;
  readonly condition: IntentCondition;
  /** Si se reinicia la secuencia interna al entrar a la nueva fase */
  readonly resetSequence?: boolean;
}

export interface Phase {
  readonly name: string;
  readonly strategy: CyclicPattern | WeightedRandomPattern | ConditionalPattern;
  readonly transitionTo?: readonly PhaseTransition[];
}

/** Envuelve otras estrategias y transiciona entre ellas según condiciones */
export interface PhasedPattern {
  readonly type: 'phased';
  readonly phases: readonly Phase[];
  /** Índice de la fase inicial */
  readonly initialPhase: number;
}

export type EnemyPattern =
  | CyclicPattern
  | WeightedRandomPattern
  | ConditionalPattern
  | PhasedPattern;

// ---------------------------------------------------------------------------
// Definición estática del enemigo (datos)
// ---------------------------------------------------------------------------

export type EnemyTier = 'normal' | 'elite' | 'boss';

export interface EnemyDefinition {
  readonly id: string;
  readonly name: string;
  readonly tier: EnemyTier;
  /** Rango de HP: se randomiza al instanciar */
  readonly baseHp: HpRange;
  readonly pattern: EnemyPattern;
  readonly onDeath?: DeathEffect;
  /**
   * Ruta bajo `public/` (sin dominio), p. ej. `lpc-presets/enemies/bandit-hood.json`.
   * Si está definida, el combate rasteriza este preset LPC en lugar del vector.
   */
  readonly lpcPresetPath?: string;
}

// ---------------------------------------------------------------------------
// Estado de un enemigo durante combate (instancia viva)
// ---------------------------------------------------------------------------

export interface EnemyAiState {
  /** Número de turno actual del combate */
  readonly turnCount: number;
  /** Índice actual en la secuencia para CyclicStrategy */
  readonly sequenceIndex: number;
  /** Historial de IDs de intents ejecutados (para evitar repeticiones en WeightedRandom) */
  readonly lastMoves: readonly string[];
  /** Fase activa para PhasedStrategy */
  readonly currentPhase: number;
}

export interface EnemyInstance {
  readonly definitionId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly block: number;
  readonly statusEffects: readonly StatusEffect[];
  /** El intent visible al jugador (lo que el enemigo va a hacer este turno) */
  readonly currentIntent: Intent | null;
  readonly aiState: EnemyAiState;
}
