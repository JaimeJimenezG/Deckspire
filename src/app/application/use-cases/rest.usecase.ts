import type { Card, CardEffect } from '../../domain/models/card.model';
import type { GameState } from '../../domain/models/game-state.model';
import type { RestUseCase } from '../../domain/ports/inbound/rest.usecase';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Porcentaje del HP máximo recuperado al descansar. */
const REST_HEAL_FRACTION = 0.3;

// ---------------------------------------------------------------------------
// Errores de dominio de la capa aplicación
// ---------------------------------------------------------------------------

export class NotAtRestSiteError extends Error {
  constructor(phase: string) {
    super(`Cannot perform rest action during phase: ${phase}`);
    this.name = 'NotAtRestSiteError';
  }
}

export class InvalidCardIndexError extends Error {
  constructor(idx: number, deckSize: number) {
    super(`Invalid card index: ${idx} (deck size: ${deckSize})`);
    this.name = 'InvalidCardIndexError';
  }
}

export class CardAlreadyUpgradedError extends Error {
  constructor(cardId: string) {
    super(`Card is already upgraded: ${cardId}`);
    this.name = 'CardAlreadyUpgradedError';
  }
}

// ---------------------------------------------------------------------------
// Lógica de mejora de carta
// ---------------------------------------------------------------------------

/**
 * Genera la versión mejorada de una carta aplicando las siguientes reglas:
 *   - `damage`       → +3 al valor base.
 *   - `block`        → +3 al valor base.
 *   - `draw`         → +1 al valor base.
 *   - `apply-status` → +1 al número de stacks.
 *   - resto de efectos → sin cambios.
 *
 * Establece `upgraded: true` en la carta resultante.
 */
export function buildUpgradedCard(card: Card): Card {
  const upgradedEffects: readonly CardEffect[] = card.effects.map(effect => {
    switch (effect.type) {
      case 'damage':
        return { ...effect, value: effect.value + 3 };
      case 'block':
        return { ...effect, value: effect.value + 3 };
      case 'draw':
        return { ...effect, value: effect.value + 1 };
      case 'apply-status':
        return { ...effect, stacks: effect.stacks + 1 };
      default:
        return effect;
    }
  });

  return { ...card, upgraded: true, effects: upgradedEffects };
}

// ---------------------------------------------------------------------------
// Implementación del caso de uso
// ---------------------------------------------------------------------------

/**
 * Orquesta las acciones disponibles en el sitio de descanso (hoguera):
 *   - rest: recupera el 30% del HP máximo del jugador.
 *   - smith: mejora (upgrade) una carta del mazo maestro.
 *
 * Fuente canónica: `state.deck` para el mazo maestro, `state.player.hp` para la salud.
 */
export class RestUseCaseImpl implements RestUseCase {
  async rest(state: GameState): Promise<GameState> {
    this.assertRestPhase(state);

    const healAmount = Math.floor(state.player.maxHp * REST_HEAL_FRACTION);
    const newHp = Math.min(state.player.hp + healAmount, state.player.maxHp);

    return {
      ...state,
      player: { ...state.player, hp: newHp },
    };
  }

  async smith(cardInstanceIdx: number, state: GameState): Promise<GameState> {
    this.assertRestPhase(state);

    if (cardInstanceIdx < 0 || cardInstanceIdx >= state.deck.length) {
      throw new InvalidCardIndexError(cardInstanceIdx, state.deck.length);
    }

    const card = state.deck[cardInstanceIdx];
    if (card.upgraded) throw new CardAlreadyUpgradedError(card.id);

    const upgradedCard = buildUpgradedCard(card);
    const newDeck: readonly Card[] = [
      ...state.deck.slice(0, cardInstanceIdx),
      upgradedCard,
      ...state.deck.slice(cardInstanceIdx + 1),
    ];

    return {
      ...state,
      deck: newDeck,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private assertRestPhase(state: GameState): void {
    if (state.phase !== 'rest') throw new NotAtRestSiteError(state.phase);
  }
}
