import type { GameState } from '../../models/game-state.model';

export interface LoadGameUseCase {
  /**
   * Carga el estado del juego persistido desde el repositorio.
   * Retorna null si no hay ninguna partida guardada.
   */
  execute(): Promise<GameState | null>;
}
