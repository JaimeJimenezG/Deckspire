import type { GameState } from '../../models/game-state.model';

export interface StartCombatUseCase {
  /**
   * Inicializa un combate para el nodo actual del mapa.
   * Baraja el mazo, roba la mano inicial y selecciona los enemigos del encuentro.
   */
  execute(state: GameState): Promise<GameState>;
}
