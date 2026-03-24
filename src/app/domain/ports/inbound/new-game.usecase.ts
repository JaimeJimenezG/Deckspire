import type { GameState } from '../../models/game-state.model';

export interface NewGameUseCase {
  /**
   * Inicializa una nueva run con una seed opcional.
   * Retorna el GameState inicial con mazo de inicio, mapa del acto 1 y jugador a plena vida.
   */
  execute(seed?: number): Promise<GameState>;
}
