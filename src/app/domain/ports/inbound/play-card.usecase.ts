import type { Card } from '../../models/card.model';
import type { GameState } from '../../models/game-state.model';

/** Opciones opcionales para {@link PlayCardUseCase.execute}. */
export interface PlayCardPlayOptions {
  /**
   * Se invoca de forma síncrona en cuanto el combate ya refleja la carta jugada
   * (mano, energía, efectos), y antes de las animaciones del renderer.
   */
  onCombatCommitted?: (state: GameState) => void;
}

export interface PlayCardUseCase {
  /**
   * Juega una carta de la mano contra un objetivo.
   * Valida coste de energía, resuelve efectos, anima y retorna nuevo estado.
   *
   * @param card     - La carta a jugar (debe estar en la mano del jugador)
   * @param targetIdx - Índice del enemigo objetivo (ignorado para efectos de self/all-enemies)
   * @param state    - Estado del juego actual
   */
  execute(
    card: Card,
    targetIdx: number,
    state: GameState,
    options?: PlayCardPlayOptions,
  ): Promise<GameState>;
}
