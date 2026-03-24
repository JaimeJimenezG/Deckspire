import { Card, CardEffectTarget } from '../models/card.model';
import { CombatState, TurnPhase } from '../models/combat.model';
import { EnemyInstance } from '../models/enemy.model';
import { Player } from '../models/player.model';
import { StatusEffect, StatusType, STATUS_DEFINITIONS } from '../models/status-effect.model';
import { DeckManager, deckStateFromPlayer, playerWithDeckState } from './deck-manager';
import { SeededRandom } from './seeded-random';

// ---------------------------------------------------------------------------
// CombatEngine — pure domain service
// ---------------------------------------------------------------------------

/**
 * Resolves all combat mechanics: card effects, damage calculation, status
 * application, turn transitions and win/lose detection.
 *
 * Every public method is pure: it receives state and returns NEW state without
 * mutating any input. SeededRandom is required wherever randomness is needed
 * so that runs are fully reproducible given the same seed.
 */
export class CombatEngine {
  constructor(private readonly deckManager: DeckManager) {}

  // ── Initialization ────────────────────────────────────────────────────────

  /**
   * Builds the initial CombatState for a new encounter.
   * Shuffles the player's deck and draws the opening hand (5 cards).
   */
  initCombat(player: Player, enemies: EnemyInstance[], rng: SeededRandom): CombatState {
    const shuffled = this.deckManager.shuffle(player.deck, rng);
    const initialDeckState = this.deckManager.drawCards(
      { deck: shuffled, hand: [], discard: [], exhaust: [] },
      5,
      rng,
    );

    const combatPlayer: Player = {
      ...player,
      block: 0,
      energy: player.maxEnergy,
      hand: initialDeckState.hand,
      deck: initialDeckState.deck,
      piles: {
        discard: initialDeckState.discard,
        exhaust: initialDeckState.exhaust,
      },
    };

    return {
      player: combatPlayer,
      enemies,
      turn: 1,
      phase: 'player-turn',
      cardsPlayedThisTurn: [],
      damageDealt: 0,
    };
  }

  // ── Card resolution ───────────────────────────────────────────────────────

  /**
   * Applies all effects of `card` to the combat state.
   * Moves the card from hand to discard (or exhaust if exhaust-self is present),
   * spends its energy cost, and records it in cardsPlayedThisTurn.
   *
   * The returned CombatState has `damageDealt` set to the total HP damage dealt
   * to the primary target (used for animation triggers by the use case layer).
   */
  resolveCardEffects(
    card: Card,
    targetIdx: number,
    combat: CombatState,
    rng: SeededRandom,
  ): CombatState {
    let player = combat.player;
    let enemies = [...combat.enemies];
    let damageDealt = 0;

    // 1. Spend energy.
    player = { ...player, energy: player.energy - card.cost };

    // 2. Move card from hand to discard or exhaust.
    const hasExhaustSelf = card.effects.some(e => e.type === 'exhaust-self');
    let deckState = deckStateFromPlayer(player);
    deckState = hasExhaustSelf
      ? this.deckManager.exhaustCard(deckState, card)
      : this.deckManager.discardCard(deckState, card);
    player = playerWithDeckState(player, deckState);

    // 3. feel-no-pain triggers on any exhaust.
    if (hasExhaustSelf) {
      const feelNoPain = this.getStatusStacks(player.statusEffects, 'feel-no-pain');
      if (feelNoPain > 0) {
        player = { ...player, block: player.block + feelNoPain };
      }
    }

    // 4. Process each effect in order (exhaust-self already handled above).
    for (const effect of card.effects) {
      switch (effect.type) {
        case 'damage': {
          const effectTarget = effect.target ?? 'targeted-enemy';
          const times = effect.times ?? 1;
          const targetIndices = this.resolveEnemyTargets(effectTarget, targetIdx, enemies.length, rng);

          for (let hit = 0; hit < times; hit++) {
            for (const idx of targetIndices) {
              const dmg = this.calculateDamage(
                effect.value,
                player.statusEffects,
                enemies[idx].statusEffects,
              );

              // Thorns: attacker receives thorns damage when hitting (ignores block).
              const thorns = this.getStatusStacks(enemies[idx].statusEffects, 'thorns');
              if (thorns > 0 && dmg > 0) {
                player = this.applyDamageToPlayer(player, thorns, true);
              }

              const { updatedEnemy, actualDamage } = this.applyDamageToEnemy(enemies[idx], dmg);
              enemies = enemies.map((e, i) => (i === idx ? updatedEnemy : e));
              damageDealt += actualDamage;
            }
          }
          break;
        }

        case 'block': {
          const blockAmount = this.calculateBlock(effect.value, player.statusEffects);
          player = { ...player, block: player.block + blockAmount };

          // Juggernaut: deal damage to a random enemy when gaining block.
          if (blockAmount > 0) {
            const juggernaut = this.getStatusStacks(player.statusEffects, 'juggernaut');
            if (juggernaut > 0 && enemies.length > 0) {
              const randomIdx = rng.nextInt(0, enemies.length - 1);
              const { updatedEnemy } = this.applyDamageToEnemy(enemies[randomIdx], juggernaut);
              enemies = enemies.map((e, i) => (i === randomIdx ? updatedEnemy : e));
            }
          }
          break;
        }

        case 'apply-status': {
          if (effect.target === 'self') {
            player = this.addStatusToPlayer(player, effect.status, effect.stacks);
          } else {
            const targetIndices = this.resolveEnemyTargets(effect.target, targetIdx, enemies.length, rng);
            for (const idx of targetIndices) {
              enemies = enemies.map((e, i) =>
                i === idx ? this.addStatusToEnemy(e, effect.status, effect.stacks) : e,
              );
            }
          }
          break;
        }

        case 'draw': {
          const ds = deckStateFromPlayer(player);
          const newDs = this.deckManager.drawCards(ds, effect.value, rng);
          player = playerWithDeckState(player, newDs);
          break;
        }

        case 'gain-energy': {
          player = { ...player, energy: player.energy + effect.value };
          break;
        }

        case 'lose-hp': {
          player = this.applyDamageToPlayer(player, effect.value, true);
          break;
        }

        case 'exhaust-self':
          // Already handled before the loop.
          break;
      }
    }

    // 5. Enrage: skill cards cause enemies with Enrage to gain strength.
    if (card.type === 'skill') {
      enemies = enemies.map(e => {
        const enrageStacks = this.getStatusStacks(e.statusEffects, 'enrage');
        return enrageStacks > 0 ? this.addStatusToEnemy(e, 'strength', enrageStacks) : e;
      });
    }

    return {
      ...combat,
      player,
      enemies,
      damageDealt,
      cardsPlayedThisTurn: [...combat.cardsPlayedThisTurn, card],
    };
  }

  // ── Damage and block calculation ──────────────────────────────────────────

  /**
   * Computes final attack damage after applying strength, weak and vulnerable modifiers.
   * Intangible caps damage to 1. Result is always >= 0.
   *
   * @param baseDamage - Raw damage value from the card or intent.
   * @param attackerEffects - Status effects of the entity dealing damage.
   * @param targetEffects - Status effects of the entity receiving damage.
   */
  calculateDamage(
    baseDamage: number,
    attackerEffects: readonly StatusEffect[],
    targetEffects: readonly StatusEffect[],
  ): number {
    let damage = baseDamage + this.getStatusStacks(attackerEffects, 'strength');

    // Weak: attacker deals 25% less damage.
    if (this.getStatusStacks(attackerEffects, 'weak') > 0) {
      damage = Math.floor(damage * 0.75);
    }

    // Vulnerable: target takes 50% more damage.
    if (this.getStatusStacks(targetEffects, 'vulnerable') > 0) {
      damage = Math.floor(damage * 1.5);
    }

    // Intangible: all incoming damage is reduced to 1.
    if (this.getStatusStacks(targetEffects, 'intangible') > 0) {
      damage = Math.min(damage, 1);
    }

    return Math.max(0, damage);
  }

  /**
   * Computes final block gain after applying dexterity and frail modifiers.
   * Result is always >= 0.
   */
  calculateBlock(baseBlock: number, playerEffects: readonly StatusEffect[]): number {
    let block = baseBlock + this.getStatusStacks(playerEffects, 'dexterity');

    // Frail: player gains 25% less block.
    if (this.getStatusStacks(playerEffects, 'frail') > 0) {
      block = Math.floor(block * 0.75);
    }

    return Math.max(0, block);
  }

  // ── Status effects ────────────────────────────────────────────────────────

  /**
   * Applies `stacks` of a status effect to the player (`to = 'player'`) or to
   * the enemy at index `to`. Handles Artifact negation for debuffs.
   */
  applyStatusEffect(
    combat: CombatState,
    to: 'player' | number,
    type: StatusType,
    stacks: number,
  ): CombatState {
    if (to === 'player') {
      return { ...combat, player: this.addStatusToPlayer(combat.player, type, stacks) };
    }

    const enemies = combat.enemies.map((e, i) =>
      i === to ? this.addStatusToEnemy(e, type, stacks) : e,
    );
    return { ...combat, enemies };
  }

  /**
   * Applies all triggering status effects for the given subject at the given turn phase.
   *
   * Player turn-start effects: metallicize (block), brutality (energy/hp),
   *   flame-barrier (remove stacks), poison (damage + decrement).
   * Player turn-end effects: burn (damage + decrement), regen (heal + decrement),
   *   constricted (hp loss), combust (player hp loss + enemy damage), ritual (strength).
   * Enemy turn-start effects: poison (damage + decrement), metallicize (block).
   * Enemy turn-end effects: burn (damage + decrement), regen (heal + decrement),
   *   ritual (strength).
   */
  tickStatusEffects(
    combat: CombatState,
    target: 'player' | 'enemies',
    phase: 'turn-start' | 'turn-end',
  ): CombatState {
    if (target === 'player') {
      let { player } = combat;
      let { enemies } = combat;

      for (const effect of [...combat.player.statusEffects]) {
        const def = STATUS_DEFINITIONS[effect.type];
        const triggers = phase === 'turn-start' ? def.triggersOnTurnStart : def.triggersOnTurnEnd;
        if (!triggers) continue;

        switch (effect.type) {
          case 'poison':
            if (phase === 'turn-start') {
              player = this.applyDamageToPlayer(player, effect.stacks, true);
              player = this.adjustStacks(player, 'poison', -1);
            }
            break;

          case 'burn':
            if (phase === 'turn-end') {
              player = this.applyDamageToPlayer(player, effect.stacks, true);
              player = this.adjustStacks(player, 'burn', -1);
            }
            break;

          case 'regen':
            if (phase === 'turn-end') {
              player = { ...player, hp: Math.min(player.maxHp, player.hp + effect.stacks) };
              player = this.adjustStacks(player, 'regen', -1);
            }
            break;

          case 'metallicize':
            if (phase === 'turn-start') {
              player = { ...player, block: player.block + effect.stacks };
            }
            break;

          case 'brutality':
            if (phase === 'turn-start') {
              player = { ...player, energy: player.energy + 1, hp: Math.max(0, player.hp - 1) };
            }
            break;

          case 'flame-barrier':
            if (phase === 'turn-start') {
              player = this.setStacks(player, 'flame-barrier', 0);
            }
            break;

          case 'ritual':
            if (phase === 'turn-end') {
              player = this.addStatusToPlayer(player, 'strength', effect.stacks);
            }
            break;

          case 'constricted':
            if (phase === 'turn-end') {
              player = this.applyDamageToPlayer(player, effect.stacks, true);
            }
            break;

          case 'combust':
            if (phase === 'turn-end') {
              player = this.applyDamageToPlayer(player, 1, true);
              enemies = enemies.map(e => ({
                ...e,
                hp: Math.max(0, e.hp - effect.stacks),
              }));
            }
            break;
        }
      }

      return { ...combat, player, enemies };
    }

    // target === 'enemies'
    const enemies = combat.enemies.map(enemy => {
      let e = enemy;
      for (const effect of [...enemy.statusEffects]) {
        const def = STATUS_DEFINITIONS[effect.type];
        const triggers = phase === 'turn-start' ? def.triggersOnTurnStart : def.triggersOnTurnEnd;
        if (!triggers) continue;

        switch (effect.type) {
          case 'poison':
            if (phase === 'turn-start') {
              e = { ...e, hp: Math.max(0, e.hp - effect.stacks) };
              e = this.adjustStacks(e, 'poison', -1);
            }
            break;

          case 'burn':
            if (phase === 'turn-end') {
              e = { ...e, hp: Math.max(0, e.hp - effect.stacks) };
              e = this.adjustStacks(e, 'burn', -1);
            }
            break;

          case 'regen':
            if (phase === 'turn-end') {
              e = { ...e, hp: Math.min(e.maxHp, e.hp + effect.stacks) };
              e = this.adjustStacks(e, 'regen', -1);
            }
            break;

          case 'metallicize':
            if (phase === 'turn-start') {
              e = { ...e, block: e.block + effect.stacks };
            }
            break;

          case 'ritual':
            if (phase === 'turn-end') {
              e = this.addStatusToEnemy(e, 'strength', effect.stacks);
            }
            break;
        }
      }
      return e;
    });

    return { ...combat, enemies };
  }

  /**
   * Removes all status effects with stacks <= 0 from the player and every enemy.
   */
  expireStatusEffects(combat: CombatState): CombatState {
    const player = {
      ...combat.player,
      statusEffects: combat.player.statusEffects.filter(s => s.stacks > 0),
    };
    const enemies = combat.enemies.map(e => ({
      ...e,
      statusEffects: e.statusEffects.filter(s => s.stacks > 0),
    }));
    return { ...combat, player, enemies };
  }

  // ── Turn transitions ──────────────────────────────────────────────────────

  /**
   * Handles the start of the player's turn:
   * 1. Resets player block (unless Barricade is active).
   * 2. Restores energy to maxEnergy.
   * 3. Applies player turn-start status effects (metallicize, brutality, poison, etc.).
   * 4. Decrements passive decreasing statuses on the player.
   * 5. Applies enemy turn-end status effects (burn, regen, ritual).
   * 6. Decrements passive decreasing statuses on enemies.
   * 7. Expires zero-stack statuses on both sides.
   * 8. Draws 5 cards (unless no-draw or no-draw-next-turn is active).
   * 9. Increments turn counter and resets cardsPlayedThisTurn.
   */
  processPlayerTurn(combat: CombatState, rng: SeededRandom): CombatState {
    let state = combat;

    // 1. Reset player block.
    const hasBarricade = this.getStatusStacks(state.player.statusEffects, 'barricade') > 0;
    if (!hasBarricade) {
      state = { ...state, player: { ...state.player, block: 0 } };
    }

    // 2. Restore energy.
    state = { ...state, player: { ...state.player, energy: state.player.maxEnergy } };

    // 3. Player turn-start status effects.
    state = this.tickStatusEffects(state, 'player', 'turn-start');

    // 4. Decrement passive decreasing statuses on the player.
    state = { ...state, player: this.decrementPassiveStatuses(state.player) };

    // 5. Enemy turn-end status effects (enemy turn just ended).
    state = this.tickStatusEffects(state, 'enemies', 'turn-end');

    // 6. Decrement passive decreasing statuses on enemies.
    state = {
      ...state,
      enemies: state.enemies.map(e => this.decrementPassiveStatuses(e)),
    };

    // 7. Expire zero-stack statuses.
    state = this.expireStatusEffects(state);

    // 8. Draw cards (unless no-draw status is present).
    const noDraw =
      this.getStatusStacks(state.player.statusEffects, 'no-draw') > 0 ||
      this.getStatusStacks(state.player.statusEffects, 'no-draw-next-turn') > 0;

    if (!noDraw) {
      const ds = this.deckManager.drawCards(deckStateFromPlayer(state.player), 5, rng);
      state = { ...state, player: playerWithDeckState(state.player, ds) };
    }

    return {
      ...state,
      turn: combat.turn + 1,
      phase: 'player-turn',
      cardsPlayedThisTurn: [],
      damageDealt: 0,
    };
  }

  /**
   * Handles the start of the enemy's turn (called when the player ends their turn):
   * 1. Discards the player's entire hand.
   * 2. Applies player turn-end status effects (burn, regen, constricted, combust, ritual).
   * 3. Decrements passive decreasing statuses on the player.
   * 4. Resets all enemy block values.
   * 5. Applies enemy turn-start status effects (poison, metallicize, etc.).
   * 6. Decrements passive decreasing statuses on enemies.
   * 7. Expires zero-stack statuses on both sides.
   * 8. Sets phase to 'enemy-turn'.
   */
  processEnemyTurn(combat: CombatState): CombatState {
    let state = combat;

    // 1. Discard player's entire hand.
    const ds = deckStateFromPlayer(state.player);
    const handDiscarded = {
      ...ds,
      hand: [],
      discard: [...ds.discard, ...ds.hand],
    };
    state = { ...state, player: playerWithDeckState(state.player, handDiscarded) };

    // 2. Player turn-end status effects.
    state = this.tickStatusEffects(state, 'player', 'turn-end');

    // 3. Decrement passive decreasing statuses on the player.
    state = { ...state, player: this.decrementPassiveStatuses(state.player) };

    // 4. Reset all enemy block.
    state = {
      ...state,
      enemies: state.enemies.map(e => ({ ...e, block: 0 })),
    };

    // 5. Enemy turn-start status effects.
    state = this.tickStatusEffects(state, 'enemies', 'turn-start');

    // 6. Decrement passive decreasing statuses on enemies.
    state = {
      ...state,
      enemies: state.enemies.map(e => this.decrementPassiveStatuses(e)),
    };

    // 7. Expire zero-stack statuses.
    state = this.expireStatusEffects(state);

    return { ...state, phase: 'enemy-turn' };
  }

  /**
   * Evaluates win/lose conditions from the given CombatState.
   *
   * - 'combat-end-defeat'  — player HP reached 0 (checked first; simultaneous kills favour player death).
   * - 'combat-end-victory' — all enemies are dead.
   * - current phase        — combat is still ongoing.
   */
  checkWinLoseConditions(combat: CombatState): TurnPhase {
    if (combat.player.hp <= 0) {
      return 'combat-end-defeat';
    }
    if (combat.enemies.length > 0 && combat.enemies.every(e => e.hp <= 0)) {
      return 'combat-end-victory';
    }
    return combat.phase;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private resolveEnemyTargets(
    target: CardEffectTarget,
    primaryIdx: number,
    enemyCount: number,
    rng: SeededRandom,
  ): number[] {
    switch (target) {
      case 'self':
        return [];
      case 'targeted-enemy':
        return enemyCount > 0 ? [primaryIdx] : [];
      case 'all-enemies':
        return Array.from({ length: enemyCount }, (_, i) => i);
      case 'random-enemy':
        return enemyCount > 0 ? [rng.nextInt(0, enemyCount - 1)] : [];
    }
  }

  private getStatusStacks(effects: readonly StatusEffect[], type: StatusType): number {
    return effects.find(e => e.type === type)?.stacks ?? 0;
  }

  private mergeStatus(
    effects: readonly StatusEffect[],
    type: StatusType,
    stacks: number,
    isDebuff: boolean,
  ): readonly StatusEffect[] {
    // Artifact negates one debuff application.
    if (isDebuff) {
      const artifactIdx = effects.findIndex(e => e.type === 'artifact');
      if (artifactIdx !== -1) {
        const newArtifactStacks = effects[artifactIdx].stacks - 1;
        const updated =
          newArtifactStacks <= 0
            ? [...effects.slice(0, artifactIdx), ...effects.slice(artifactIdx + 1)]
            : effects.map((e, i) =>
                i === artifactIdx ? { ...e, stacks: newArtifactStacks } : e,
              );
        return updated;
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

  private applyDamageToEnemy(
    enemy: EnemyInstance,
    damage: number,
  ): { updatedEnemy: EnemyInstance; actualDamage: number } {
    const blockAbsorbed = Math.min(enemy.block, damage);
    const remainingDamage = damage - blockAbsorbed;
    const updatedEnemy: EnemyInstance = {
      ...enemy,
      block: enemy.block - blockAbsorbed,
      hp: Math.max(0, enemy.hp - remainingDamage),
    };
    return { updatedEnemy, actualDamage: remainingDamage };
  }

  /**
   * Applies `damage` to the player.
   * @param ignoresBlock - When true (e.g. thorns, poison, constricted), bypasses block.
   */
  private applyDamageToPlayer(player: Player, damage: number, ignoresBlock = false): Player {
    if (ignoresBlock) {
      return { ...player, hp: Math.max(0, player.hp - damage) };
    }
    const blockAbsorbed = Math.min(player.block, damage);
    const remainingDamage = damage - blockAbsorbed;
    return {
      ...player,
      block: player.block - blockAbsorbed,
      hp: Math.max(0, player.hp - remainingDamage),
    };
  }

  /**
   * Adds `delta` to the stacks of a single status type on the player.
   * Used for self-decrementing statuses (poison, burn, regen).
   */
  private adjustStacks(player: Player, type: StatusType, delta: number): Player;
  private adjustStacks(enemy: EnemyInstance, type: StatusType, delta: number): EnemyInstance;
  private adjustStacks(
    target: Player | EnemyInstance,
    type: StatusType,
    delta: number,
  ): Player | EnemyInstance {
    return {
      ...target,
      statusEffects: target.statusEffects.map(s =>
        s.type === type ? { ...s, stacks: s.stacks + delta } : s,
      ),
    };
  }

  private setStacks(player: Player, type: StatusType, value: number): Player;
  private setStacks(enemy: EnemyInstance, type: StatusType, value: number): EnemyInstance;
  private setStacks(
    target: Player | EnemyInstance,
    type: StatusType,
    value: number,
  ): Player | EnemyInstance {
    return {
      ...target,
      statusEffects: target.statusEffects.map(s =>
        s.type === type ? { ...s, stacks: value } : s,
      ),
    };
  }

  /**
   * Decrements by 1 all "passive" decreasing statuses — those with `decreasing: true`
   * but no turn trigger (e.g. vulnerable, weak, frail, daze, intangible).
   * Self-decrementing statuses (poison, burn, regen) are excluded because they handle
   * their own decrement when they trigger.
   */
  private decrementPassiveStatuses(player: Player): Player;
  private decrementPassiveStatuses(enemy: EnemyInstance): EnemyInstance;
  private decrementPassiveStatuses(
    target: Player | EnemyInstance,
  ): Player | EnemyInstance {
    const newEffects = target.statusEffects.map(e => {
      const def = STATUS_DEFINITIONS[e.type];
      if (def.decreasing && !def.triggersOnTurnStart && !def.triggersOnTurnEnd) {
        return { ...e, stacks: e.stacks - 1 };
      }
      return e;
    });
    return { ...target, statusEffects: newEffects };
  }
}
