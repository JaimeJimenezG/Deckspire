import { RELIC_DEFINITIONS } from '../data/relics.data';
import type { CombatState } from '../models/combat.model';
import type { Player } from '../models/player.model';
import { DeckManager, deckStateFromPlayer, playerWithDeckState } from './deck-manager';
import { SeededRandom } from './seeded-random';

/**
 * Motor de reliquias para ejecutar hooks pasivos en momentos concretos.
 * Mantiene el dominio puro: recibe estado y retorna nuevo estado inmutable.
 */
export class RelicEngine {
  constructor(private readonly deckManager: DeckManager) {}

  applyCombatStartHooks(
    combat: CombatState,
    relicIds: readonly string[],
    rng: SeededRandom,
  ): CombatState {
    let nextCombat = combat;

    for (const relicId of relicIds) {
      const def = RELIC_DEFINITIONS[relicId];
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
      const def = RELIC_DEFINITIONS[relicId];
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
      const def = RELIC_DEFINITIONS[relicId];
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
}
