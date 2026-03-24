import type { GameState } from '../../models/game-state.model';

export interface RestUseCase {
  /**
   * El jugador descansa y recupera el 30% de su HP máximo.
   */
  rest(state: GameState): Promise<GameState>;

  /**
   * El jugador mejora (upgrade) una carta de su mazo en la hoguera.
   *
   * @param cardInstanceIdx - Índice de la carta en el mazo del jugador
   * @param state           - Estado del juego actual
   */
  smith(cardInstanceIdx: number, state: GameState): Promise<GameState>;
}
