import type { GameState } from '../../domain/models/game-state.model';
import type { EndTurnUseCase } from '../../domain/ports/inbound/end-turn.usecase';
import type { CombatRendererPort } from '../../domain/ports/outbound/combat-renderer.port';
import { ENEMIES_BY_ID } from '../../domain/data/enemies.data';
import { CombatEngine } from '../../domain/services/combat-engine';
import { DeckManager } from '../../domain/services/deck-manager';
import { CombatContext, EnemyAI } from '../../domain/services/enemy-ai';
import { RelicEngine } from '../../domain/services/relic-engine';
import { SeededRandom } from '../../domain/services/seeded-random';

/**
 * Error thrown when there is no active combat.
 */
export class NoCombatActiveError extends Error {
  constructor() {
    super('No active combat state');
    this.name = 'NoCombatActiveError';
  }
}

/**
 * Error thrown when trying to end the turn outside of the player's turn phase.
 */
export class NotInPlayerTurnError extends Error {
  constructor(phase: string) {
    super(`Cannot end turn during phase: ${phase}`);
    this.name = 'NotInPlayerTurnError';
  }
}

/**
 * Implements EndTurnUseCase.
 *
 * Orchestration flow:
 *  1. Guard: active combat + player-turn phase
 *  2. CombatEngine.processEnemyTurn — discard hand, tick player turn-end status effects,
 *     reset enemy block, tick enemy turn-start status effects.
 *  3. Animate and apply status-effect deaths that occurred during transition.
 *  4. For each alive enemy: resolve currentIntent against the player via EnemyAI.
 *     Animate damage, block and deaths as they happen.
 *     Short-circuit if the player dies.
 *  5. If all enemies are dead (e.g. thorns kills), return combat-end-victory.
 *  6. Compute next intents for all alive enemies via EnemyAI.getNextIntent.
 *  7. CombatEngine.processPlayerTurn — reset block/energy, tick turn-start effects, draw 5 cards.
 *  8. Return updated GameState.
 */
export class EndTurnUseCaseImpl implements EndTurnUseCase {
  constructor(
    private readonly combatEngine: CombatEngine,
    private readonly enemyAI: EnemyAI,
    private readonly renderer: CombatRendererPort,
    private readonly relicEngine = new RelicEngine(new DeckManager()),
  ) {}

  async execute(state: GameState): Promise<GameState> {
    const combat = state.combat;

    if (!combat) {
      throw new NoCombatActiveError();
    }

    if (combat.phase !== 'player-turn') {
      throw new NotInPlayerTurnError(combat.phase);
    }

    // Offset from PlayCardUseCase's (seed + turn) to avoid producing identical sequences.
    const rng = new SeededRandom(state.seed + combat.turn * 997);

    // ── Step 1: transition to enemy-turn ────────────────────────────────────
    // Discards the player's hand, applies player turn-end and enemy turn-start
    // status effects (burn, poison, metallicize, etc.) and resets enemy block.
    const hpBeforeTransition = combat.enemies.map(e => e.hp);
    let currentCombat = this.combatEngine.processEnemyTurn(combat);
    currentCombat = this.relicEngine.applyPlayerTurnEndHooks(currentCombat, state.relics);

    // ── Step 2: animate deaths caused by status effects during transition ───
    for (let i = 0; i < currentCombat.enemies.length; i++) {
      const wasAlive = hpBeforeTransition[i] > 0;
      const isDead = currentCombat.enemies[i].hp <= 0;
      if (wasAlive && isDead) {
        await this.renderer.animateDeath(i + 1);
      }
    }

    // ── Step 3: resolve each alive enemy's currentIntent ────────────────────
    for (let i = 0; i < currentCombat.enemies.length; i++) {
      const enemy = currentCombat.enemies[i];

      if (enemy.hp <= 0 || enemy.currentIntent === null) {
        continue;
      }

      const prevPlayerHp = currentCombat.player.hp;
      const prevEnemyBlock = enemy.block;

      const { updatedPlayer, updatedEnemy } = this.enemyAI.resolveIntent(
        enemy,
        enemy.currentIntent,
        currentCombat.player,
      );

      // Animate player taking damage (targetIdx 0 = player).
      const damageTaken = prevPlayerHp - updatedPlayer.hp;
      if (damageTaken > 0) {
        await this.renderer.animateDamage(0, damageTaken);
      }

      // Animate enemy gaining block from its own intent (e.g. Jaw Worm Thrash).
      const blockGained = updatedEnemy.block - prevEnemyBlock;
      if (blockGained > 0) {
        await this.renderer.animateBlock(i + 1, blockGained);
      }

      // Animate enemy dying from thorns retaliation.
      if (enemy.hp > 0 && updatedEnemy.hp <= 0) {
        await this.renderer.animateDeath(i + 1);
      }

      // Persist the changes from this enemy's action into the working combat state.
      const updatedEnemies = currentCombat.enemies.map((e, idx) =>
        idx === i ? updatedEnemy : e,
      );
      currentCombat = { ...currentCombat, player: updatedPlayer, enemies: updatedEnemies };

      // Short-circuit: stop processing remaining enemies if the player died.
      const phaseCheck = this.combatEngine.checkWinLoseConditions(currentCombat);
      if (phaseCheck === 'combat-end-defeat') {
        return { ...state, combat: { ...currentCombat, phase: 'combat-end-defeat' } };
      }
    }

    // ── Step 4: check for victory (all enemies dead) ─────────────────────────
    // Can happen if thorns or combust killed the last enemy during their own turn.
    const phaseAfterEnemies = this.combatEngine.checkWinLoseConditions(currentCombat);
    if (phaseAfterEnemies !== 'enemy-turn') {
      const playerAfterVictoryHooks =
        phaseAfterEnemies === 'combat-end-victory'
          ? this.relicEngine.applyCombatEndVictoryHooks(currentCombat.player, state.relics)
          : currentCombat.player;
      return {
        ...state,
        player: { ...state.player, hp: playerAfterVictoryHooks.hp },
        combat: { ...currentCombat, player: playerAfterVictoryHooks, phase: phaseAfterEnemies },
      };
    }

    // ── Step 5: assign next intents for all alive enemies ────────────────────
    // cardsPlayedThisTurn still reflects the player's turn that just ended
    // because processEnemyTurn does not reset it; only processPlayerTurn does.
    const context: CombatContext = {
      turnNumber: currentCombat.turn,
      player: currentCombat.player,
      allEnemies: currentCombat.enemies,
      cardsPlayedThisTurn: currentCombat.cardsPlayedThisTurn,
      rng,
    };

    const enemiesWithNextIntent = currentCombat.enemies.map(enemy => {
      if (enemy.hp <= 0) return enemy;

      const definition = ENEMIES_BY_ID[enemy.definitionId];
      const { intent, updatedEnemy } = this.enemyAI.getNextIntent(
        enemy,
        definition.pattern,
        context,
      );
      return { ...updatedEnemy, currentIntent: intent };
    });

    currentCombat = { ...currentCombat, enemies: enemiesWithNextIntent };

    // ── Step 6: start the new player turn ────────────────────────────────────
    // Resets player block/energy, ticks turn-start status effects, draws 5 cards,
    // increments turn counter and clears cardsPlayedThisTurn.
    currentCombat = this.combatEngine.processPlayerTurn(currentCombat, rng);

    return { ...state, combat: currentCombat };
  }
}
