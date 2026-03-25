import { ALL_RELIC_IDS } from '../data/relics.data';
import { RELIC_DEFINITIONS } from '../data/relics.data';
import type { CombatState } from '../models/combat.model';
import type { Player } from '../models/player.model';
import type { RelicDefinition } from '../models/relic.model';
import { DeckManager, deckStateFromPlayer, playerWithDeckState } from './deck-manager';
import { SeededRandom } from './seeded-random';

/**
 * Motor de reliquias para ejecutar hooks pasivos en momentos concretos.
 * Mantiene el dominio puro: recibe estado y retorna nuevo estado inmutable.
 */
export class RelicEngine {
  constructor(
    private readonly deckManager: DeckManager,
    private readonly relicDefinitions: Readonly<Record<string, RelicDefinition>> = RELIC_DEFINITIONS,
    private readonly allRelicIds: readonly string[] = ALL_RELIC_IDS,
  ) {}

  applyCombatStartHooks(
    combat: CombatState,
    relicIds: readonly string[],
    rng: SeededRandom,
  ): CombatState {
    let nextCombat = combat;

    for (const relicId of relicIds) {
      const def = this.relicDefinitions[relicId];
      if (!def) continue;

      for (const hook of def.passiveHooks) {
        if (hook.hook !== 'combat-start') continue;

        switch (hook.effect.type) {
          case 'gain-energy':
            nextCombat = {
              ...nextCombat,
              player: { ...nextCombat.player, energy: nextCombat.player.energy + hook.effect.value },
            };
            break;
          case 'gain-block':
            nextCombat = {
              ...nextCombat,
              player: { ...nextCombat.player, block: nextCombat.player.block + hook.effect.value },
            };
            break;
          case 'draw-cards': {
            const ds = this.deckManager.drawCards(
              deckStateFromPlayer(nextCombat.player),
              hook.effect.value,
              rng,
            );
            nextCombat = { ...nextCombat, player: playerWithDeckState(nextCombat.player, ds) };
            break;
          }
          case 'heal':
            nextCombat = {
              ...nextCombat,
              player: {
                ...nextCombat.player,
                hp: Math.min(nextCombat.player.maxHp, nextCombat.player.hp + hook.effect.value),
              },
            };
            break;
          case 'apply-status':
            // En esta iteración no hay reliquias con apply-status en combat-start.
            break;
        }
      }
    }

    return nextCombat;
  }

  applyPlayerTurnEndHooks(combat: CombatState, relicIds: readonly string[]): CombatState {
    let nextCombat = combat;

    for (const relicId of relicIds) {
      const def = this.relicDefinitions[relicId];
      if (!def) continue;

      for (const hook of def.passiveHooks) {
        if (hook.hook !== 'player-turn-end') continue;

        if (relicId === 'orichalcum' && nextCombat.player.block > 0) {
          continue;
        }

        if (hook.effect.type === 'gain-block') {
          nextCombat = {
            ...nextCombat,
            player: { ...nextCombat.player, block: nextCombat.player.block + hook.effect.value },
          };
        }
      }
    }

    return nextCombat;
  }

  applyCombatEndVictoryHooks(player: Player, relicIds: readonly string[]): Player {
    let nextPlayer = player;

    for (const relicId of relicIds) {
      const def = this.relicDefinitions[relicId];
      if (!def) continue;

      for (const hook of def.passiveHooks) {
        if (hook.hook !== 'combat-end-victory') continue;
        if (hook.effect.type !== 'heal') continue;

        nextPlayer = {
          ...nextPlayer,
          hp: Math.min(nextPlayer.maxHp, nextPlayer.hp + hook.effect.value),
        };
      }
    }

    return nextPlayer;
  }

  /**
   * Calculates the number of relics to grant after defeating a node
   * of type `elite` or `boss`.
   *
   * Base comes from game rules; equipped relics can modify it via:
   * `passiveHooks: [{ hook: 'combat-end-victory', effect: { type:
   *   'modify-relic-reward-count', target: 'elite'|'boss', value } }]`
   */
  calculateRelicRewardCount(
    nodeType: 'elite' | 'boss',
    baseCount: number,
    relicIds: readonly string[],
  ): number {
    let delta = 0;

    for (const relicId of relicIds) {
      const def = this.relicDefinitions[relicId];
      if (!def) continue;

      for (const hook of def.passiveHooks) {
        if (hook.hook !== 'combat-end-victory') continue;
        if (hook.effect.type !== 'modify-relic-reward-count') continue;
        if (hook.effect.target !== nodeType) continue;

        delta += hook.effect.value;
      }
    }

    return Math.max(0, baseCount + delta);
  }

  /**
   * Grants up to `count` random relics that are not already owned.
   * Deterministic with the provided `rng` (SeededRandom).
   */
  grantRandomRelics(
    ownedRelicIds: readonly string[],
    count: number,
    rng: SeededRandom,
  ): { readonly relics: readonly string[]; readonly granted: readonly string[] } {
    const resultRelics = [...ownedRelvicIds];
    const available = this.allRelicIds.filter(id => !resultRelics.includes(id));

    const safeCount = Math.max(0, Math.min(count, available.length));
    const granted: string[] = [];

    for (let i = 0; i < safeCount; i++) {
      const idx = rng.nextInt(0, available.length - 1);
      const relicId = available[idx];
      resultRelics.push(relicId);
      granted.push(relicId);
      available.splice(idx, 1);
    }

    return { relics: resultRelics, granted };
  }
}
