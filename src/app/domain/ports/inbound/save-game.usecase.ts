import type { GameState } from '../../models/game-state.model';

export interface SaveGameUseCase {
  /**
   * Persiste el estado del juego actual en el repositorio (IndexedDB).
   */
  execute(state: GameState): Promise<void>;
}
