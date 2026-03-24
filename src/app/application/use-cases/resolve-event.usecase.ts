import type { GameState } from '../../domain/models/game-state.model';
import type { Player } from '../../domain/models/player.model';
import type { EventEffect } from '../../domain/models/event.model';
import type { ResolveEventUseCase } from '../../domain/ports/inbound/resolve-event.usecase';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';

// ── Errores de dominio ────────────────────────────────────────────────────────

export class NoActiveEventError extends Error {
  constructor() {
    super('No active event in the current game state');
    this.name = 'NoActiveEventError';
  }
}

export class InvalidEventChoiceError extends Error {
  constructor(choiceId: string) {
    super(`Choice "${choiceId}" does not exist in the active event`);
    this.name = 'InvalidEventChoiceError';
  }
}

export class EventAlreadyResolvedError extends Error {
  constructor() {
    super('The active event has already been resolved');
    this.name = 'EventAlreadyResolvedError';
  }
}

// ── Aplicación de efectos ─────────────────────────────────────────────────────

function applyEffects(
  player: Player,
  gold: number,
  effects: readonly EventEffect[],
): { player: Player; gold: number; pendingBossRelicsGain: number } {
  let newGold = gold;
  let newPlayer = player;
  let pendingBossRelicsGain = 0;

  for (const effect of effects) {
    switch (effect.type) {
      case 'gain-gold':
        newGold = newGold + effect.value;
        break;
      case 'lose-gold':
        newGold = Math.max(0, newGold - effect.value);
        break;
      case 'gain-hp':
        newPlayer = { ...newPlayer, hp: Math.min(newPlayer.maxHp, newPlayer.hp + effect.value) };
        break;
      case 'lose-hp':
        newPlayer = { ...newPlayer, hp: Math.max(0, newPlayer.hp - effect.value) };
        break;
      case 'gain-max-hp':
        newPlayer = { ...newPlayer, maxHp: newPlayer.maxHp + effect.value };
        break;
      case 'lose-max-hp':
        newPlayer = {
          ...newPlayer,
          maxHp: Math.max(1, newPlayer.maxHp - effect.value),
          hp: Math.min(newPlayer.hp, Math.max(1, newPlayer.maxHp - effect.value)),
        };
        break;
      case 'gain-relic-post-boss':
        pendingBossRelicsGain += effect.value;
        break;
    }
  }

  return { player: newPlayer, gold: newGold, pendingBossRelicsGain };
}

// ── Implementación ────────────────────────────────────────────────────────────

/**
 * Resuelve la elección del jugador en el evento activo.
 *
 * Flujo:
 *  1. Guard: el estado tiene un evento activo.
 *  2. Guard: el evento no ha sido resuelto ya.
 *  3. Guard: la elección existe en el evento.
 *  4. Aplicar efectos de la elección sobre player y gold.
 *  5. Marcar el evento como resuelto (chosenId).
 *  6. Guardar estado.
 *  7. Retornar nuevo GameState.
 */
export class ResolveEventUseCaseImpl implements ResolveEventUseCase {
  constructor(private readonly repository: GameRepository) {}

  async execute(choiceId: string, state: GameState): Promise<GameState> {
    if (!state.event) {
      throw new NoActiveEventError();
    }

    if (state.event.chosenId !== null) {
      throw new EventAlreadyResolvedError();
    }

    const choice = state.event.event.choices.find(c => c.id === choiceId);
    if (!choice) {
      throw new InvalidEventChoiceError(choiceId);
    }

    const { player, gold, pendingBossRelicsGain } = applyEffects(
      state.player,
      state.gold,
      choice.effects,
    );

    const newState: GameState = {
      ...state,
      player,
      gold,
      pendingBossRelics: (state.pendingBossRelics ?? 0) + pendingBossRelicsGain,
      event: { ...state.event, chosenId: choiceId },
    };

    await this.repository.save(newState);

    return newState;
  }
}
