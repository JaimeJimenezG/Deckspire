import { Card } from '../models/card.model';
import {
  ConditionalPattern,
  CyclicPattern,
  EnemyInstance,
  EnemyPattern,
  Intent,
  IntentCondition,
  PhasedPattern,
  WeightedRandomPattern,
} from '../models/enemy.model';
import { Player } from '../models/player.model';
import { STATUS_DEFINITIONS, StatusEffect, StatusType } from '../models/status-effect.model';
import { SeededRandom } from './seeded-random';

// ---------------------------------------------------------------------------
// CombatContext — snapshot del estado del combate para evaluar condiciones
// ---------------------------------------------------------------------------

export interface CombatContext {
  readonly turnNumber: number;
  readonly player: Player;
  readonly allEnemies: readonly EnemyInstance[];
  /** Cartas jugadas por el jugador en el turno actual (para ConditionalStrategy). */
  readonly cardsPlayedThisTurn: readonly Card[];
  readonly rng: SeededRandom;
}

// ---------------------------------------------------------------------------
// EnemyAI — servicio de dominio puro
// ---------------------------------------------------------------------------

/**
 * Resuelve el comportamiento de los enemigos:
 * - `getNextIntent`: elige el próximo intent según la estrategia del enemigo y avanza su aiState.
 * - `resolveIntent`: aplica las acciones de un intent al jugador y al enemigo.
 *
 * Todas las operaciones son puras: reciben estado y devuelven nuevo estado sin mutarlo.
 */
export class EnemyAI {
  // ── API pública ────────────────────────────────────────────────────────────

  /**
   * Determina el próximo intent para el enemigo según su estrategia.
   *
   * Devuelve el intent seleccionado y una copia del enemigo con el `aiState`
   * actualizado (sequenceIndex, lastMoves, currentPhase) para que el caller
   * pueda persistir el nuevo estado.
   *
   * @param enemy   - Estado actual del enemigo.
   * @param pattern - Patrón de comportamiento extraído de su EnemyDefinition.
   * @param context - Snapshot del combate necesario para condiciones y RNG.
   */
  getNextIntent(
    enemy: EnemyInstance,
    pattern: EnemyPattern,
    context: CombatContext,
  ): { readonly intent: Intent; readonly updatedEnemy: EnemyInstance } {
    switch (pattern.type) {
      case 'cyclic':
        return this.nextCyclic(enemy, pattern);
      case 'weighted-random':
        return this.nextWeightedRandom(enemy, pattern, context);
      case 'conditional':
        return this.nextConditional(enemy, pattern, context);
      case 'phased':
        return this.nextPhased(enemy, pattern, context);
    }
  }

  /**
   * Aplica todas las acciones del intent al jugador y al enemigo.
   *
   * Gestiona: daño (con modificadores de strength/weak/vulnerable/intangible y thorns),
   * bloqueo, buffs al enemigo, debuffs al jugador, curación y split.
   * Las acciones `summon` son una señal para la capa de aplicación y no se resuelven aquí.
   */
  resolveIntent(
    enemy: EnemyInstance,
    intent: Intent,
    player: Player,
  ): { readonly updatedPlayer: Player; readonly updatedEnemy: EnemyInstance } {
    let currentPlayer = player;
    let currentEnemy = enemy;

    for (const action of intent.actions) {
      switch (action.type) {
        case 'damage': {
          const times = action.times ?? 1;
          // El daño base se calcula una vez por action; varía por los modificadores del momento.
          const baseDmg = this.calculateAttackDamage(
            action.value,
            currentEnemy.statusEffects,
            currentPlayer.statusEffects,
          );

          for (let i = 0; i < times; i++) {
            // Thorns: el jugador retalia al atacante cuando recibe un golpe.
            const thorns = this.getStacks(currentPlayer.statusEffects, 'thorns');
            if (thorns > 0 && baseDmg > 0) {
              currentEnemy = { ...currentEnemy, hp: Math.max(0, currentEnemy.hp - thorns) };
            }
            currentPlayer = this.applyDamageToPlayer(currentPlayer, baseDmg);
          }
          break;
        }

        case 'block': {
          currentEnemy = { ...currentEnemy, block: currentEnemy.block + action.value };
          break;
        }

        case 'buff': {
          currentEnemy = this.addStatusToEnemy(currentEnemy, action.status, action.stacks);
          break;
        }

        case 'debuff-player': {
          currentPlayer = this.addStatusToPlayer(currentPlayer, action.status, action.stacks);
          break;
        }

        case 'heal': {
          currentEnemy = {
            ...currentEnemy,
            hp: Math.min(currentEnemy.maxHp, currentEnemy.hp + action.value),
          };
          break;
        }

        case 'summon':
          // La invocación de nuevos enemigos es responsabilidad del EndTurnUseCase.
          // Esta acción actúa como señal; no hay estado que modificar aquí.
          break;

        case 'split':
          // Poner hp a 0 señaliza al EndTurnUseCase que debe aplicar el DeathEffect de split.
          currentEnemy = { ...currentEnemy, hp: 0 };
          break;
      }
    }

    return { updatedPlayer: currentPlayer, updatedEnemy: currentEnemy };
  }

  // ── Estrategias privadas ───────────────────────────────────────────────────

  private nextCyclic(
    enemy: EnemyInstance,
    pattern: CyclicPattern,
  ): { intent: Intent; updatedEnemy: EnemyInstance } {
    const { sequence, startIndex = 0 } = pattern;
    const currentIndex = enemy.aiState.sequenceIndex;
    const intent = sequence[currentIndex];

    // Al llegar al final de la secuencia, vuelve a startIndex (no a 0).
    // Esto permite un "preámbulo" inicial seguido de un bucle reducido (ej. Cultist).
    const nextIndex = currentIndex + 1 >= sequence.length ? startIndex : currentIndex + 1;

    return {
      intent,
      updatedEnemy: {
        ...enemy,
        aiState: { ...enemy.aiState, sequenceIndex: nextIndex },
      },
    };
  }

  private nextWeightedRandom(
    enemy: EnemyInstance,
    pattern: WeightedRandomPattern,
    context: CombatContext,
  ): { intent: Intent; updatedEnemy: EnemyInstance } {
    const { lastMoves } = enemy.aiState;
    const { maxConsecutive } = pattern;

    // Si los últimos `maxConsecutive` movimientos son el mismo intent, excluirlo.
    let eligibleMoves = pattern.moves;
    if (lastMoves.length >= maxConsecutive) {
      const lastId = lastMoves[lastMoves.length - 1];
      const allSame = lastMoves.slice(-maxConsecutive).every(id => id === lastId);
      if (allSame) {
        const filtered = pattern.moves.filter(m => m.intent.id !== lastId);
        // Solo aplicar filtro si quedan opciones alternativas.
        if (filtered.length > 0) {
          eligibleMoves = filtered;
        }
      }
    }

    const items = eligibleMoves.map(m => ({ item: m.intent, weight: m.weight }));
    const intent = context.rng.weightedChoice(items);

    // Ventana deslizante: guardar solo los últimos `maxConsecutive` IDs.
    const updatedLastMoves = [...lastMoves, intent.id].slice(-maxConsecutive);

    return {
      intent,
      updatedEnemy: {
        ...enemy,
        aiState: { ...enemy.aiState, lastMoves: updatedLastMoves },
      },
    };
  }

  private nextConditional(
    enemy: EnemyInstance,
    pattern: ConditionalPattern,
    context: CombatContext,
  ): { intent: Intent; updatedEnemy: EnemyInstance } {
    for (const rule of pattern.rules) {
      if (this.evaluateCondition(rule.condition, enemy, context)) {
        return { intent: rule.intent, updatedEnemy: enemy };
      }
    }
    return { intent: pattern.fallback, updatedEnemy: enemy };
  }

  private nextPhased(
    enemy: EnemyInstance,
    pattern: PhasedPattern,
    context: CombatContext,
  ): { intent: Intent; updatedEnemy: EnemyInstance } {
    const currentPhaseIdx = enemy.aiState.currentPhase;
    const currentPhase = pattern.phases[currentPhaseIdx];

    // Comprobar transiciones en orden; la primera que se cumpla gana.
    if (currentPhase.transitionTo) {
      for (const transition of currentPhase.transitionTo) {
        if (this.evaluateCondition(transition.condition, enemy, context)) {
          const newPhaseIdx = transition.targetPhase;
          const newSeqIdx = transition.resetSequence ? 0 : enemy.aiState.sequenceIndex;
          const transitionedEnemy: EnemyInstance = {
            ...enemy,
            aiState: {
              ...enemy.aiState,
              currentPhase: newPhaseIdx,
              sequenceIndex: newSeqIdx,
            },
          };
          // Recursión con la nueva fase activa.
          return this.nextPhased(transitionedEnemy, pattern, context);
        }
      }
    }

    // Delegar a la sub-estrategia de la fase actual.
    const subPattern = currentPhase.strategy;
    const { intent, updatedEnemy: afterSub } = this.getNextIntentFromSubPattern(
      enemy,
      subPattern,
      context,
    );

    // Preservar currentPhase en el aiState resultante (la sub-estrategia no lo toca).
    return {
      intent,
      updatedEnemy: {
        ...afterSub,
        aiState: { ...afterSub.aiState, currentPhase: currentPhaseIdx },
      },
    };
  }

  /** Delega a la estrategia interna de una fase (excluye PhasedPattern para evitar anidamiento). */
  private getNextIntentFromSubPattern(
    enemy: EnemyInstance,
    pattern: CyclicPattern | WeightedRandomPattern | ConditionalPattern,
    context: CombatContext,
  ): { intent: Intent; updatedEnemy: EnemyInstance } {
    switch (pattern.type) {
      case 'cyclic':
        return this.nextCyclic(enemy, pattern);
      case 'weighted-random':
        return this.nextWeightedRandom(enemy, pattern, context);
      case 'conditional':
        return this.nextConditional(enemy, pattern, context);
    }
  }

  // ── Evaluación de condiciones ──────────────────────────────────────────────

  private evaluateCondition(
    condition: IntentCondition,
    enemy: EnemyInstance,
    context: CombatContext,
  ): boolean {
    switch (condition.type) {
      case 'hp-below':
        return enemy.hp / enemy.maxHp < condition.percent / 100;
      case 'hp-above':
        return enemy.hp / enemy.maxHp > condition.percent / 100;
      case 'turn-equals':
        return context.turnNumber === condition.turn;
      case 'turn-greater':
        return context.turnNumber > condition.turn;
      case 'player-has-status':
        return this.getStacks(context.player.statusEffects, condition.status) > 0;
      case 'player-played-type':
        return context.cardsPlayedThisTurn.some(c => c.type === condition.cardType);
      case 'and':
        return condition.conditions.every(c => this.evaluateCondition(c, enemy, context));
      case 'or':
        return condition.conditions.some(c => this.evaluateCondition(c, enemy, context));
      case 'not':
        return !this.evaluateCondition(condition.condition, enemy, context);
    }
  }

  // ── Cálculo de daño y estados ──────────────────────────────────────────────

  /**
   * Calcula el daño de un ataque enemigo aplicando:
   * - strength del atacante (+N por stack)
   * - weak del atacante (×0.75, redondeado hacia abajo)
   * - vulnerable del objetivo (×1.5, redondeado hacia abajo)
   * - intangible del objetivo (limita a 1)
   */
  private calculateAttackDamage(
    baseDamage: number,
    attackerEffects: readonly StatusEffect[],
    targetEffects: readonly StatusEffect[],
  ): number {
    let damage = baseDamage + this.getStacks(attackerEffects, 'strength');

    if (this.getStacks(attackerEffects, 'weak') > 0) {
      damage = Math.floor(damage * 0.75);
    }

    if (this.getStacks(targetEffects, 'vulnerable') > 0) {
      damage = Math.floor(damage * 1.5);
    }

    if (this.getStacks(targetEffects, 'intangible') > 0) {
      damage = Math.min(damage, 1);
    }

    return Math.max(0, damage);
  }

  private applyDamageToPlayer(player: Player, damage: number): Player {
    const blockAbsorbed = Math.min(player.block, damage);
    const remainingDamage = damage - blockAbsorbed;
    return {
      ...player,
      block: player.block - blockAbsorbed,
      hp: Math.max(0, player.hp - remainingDamage),
    };
  }

  private getStacks(effects: readonly StatusEffect[], type: StatusType): number {
    return effects.find(e => e.type === type)?.stacks ?? 0;
  }

  private mergeStatus(
    effects: readonly StatusEffect[],
    type: StatusType,
    stacks: number,
    isDebuff: boolean,
  ): readonly StatusEffect[] {
    // Artifact niega la siguiente aplicación de un debuff.
    if (isDebuff) {
      const artifactIdx = effects.findIndex(e => e.type === 'artifact');
      if (artifactIdx !== -1) {
        const newArtifactStacks = effects[artifactIdx].stacks - 1;
        return newArtifactStacks <= 0
          ? [...effects.slice(0, artifactIdx), ...effects.slice(artifactIdx + 1)]
          : effects.map((e, i) =>
              i === artifactIdx ? { ...e, stacks: newArtifactStacks } : e,
            );
      }
    }

    const existing = effects.find(e => e.type === type);
    if (existing) {
      return effects.map(e => (e.type === type ? { ...e, stacks: e.stacks + stacks } : e));
    }
    return [...effects, { type, stacks }];
  }

  private addStatusToPlayer(player: Player, type: StatusType, stacks: number): Player {
    const isDebuff = STATUS_DEFINITIONS[type].category === 'debuff';
    return {
      ...player,
      statusEffects: this.mergeStatus(player.statusEffects, type, stacks, isDebuff),
    };
  }

  private addStatusToEnemy(enemy: EnemyInstance, type: StatusType, stacks: number): EnemyInstance {
    const isDebuff = STATUS_DEFINITIONS[type].category === 'debuff';
    return {
      ...enemy,
      statusEffects: this.mergeStatus(enemy.statusEffects, type, stacks, isDebuff),
    };
  }
}
