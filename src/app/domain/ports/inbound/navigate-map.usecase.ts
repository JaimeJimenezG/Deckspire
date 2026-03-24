import type { GameState } from '../../models/game-state.model';

export interface NavigateMapUseCase {
  /**
   * Mueve al jugador al nodo del mapa indicado.
   * Solo permite navegar a nodos alcanzables desde la posición actual.
   * Actualiza la fase del juego según el tipo de nodo destino.
   *
   * @param nodeId - ID del nodo destino (formato "row-col", e.g. "3-2")
   * @param state  - Estado del juego actual
   */
  execute(nodeId: string, state: GameState): Promise<GameState>;
}
