import type { GameState } from '../../models/game-state.model';

/**
 * Puerto inbound para resolver la elección del jugador en un evento.
 *
 * Aplica los efectos de la opción elegida sobre el GameState y marca
 * el evento como resuelto (chosenId != null). La transición de vuelta
 * al mapa la gestiona el store con `leaveEvent()`.
 */
export interface ResolveEventUseCase {
  execute(choiceId: string, state: GameState): Promise<GameState>;
}
