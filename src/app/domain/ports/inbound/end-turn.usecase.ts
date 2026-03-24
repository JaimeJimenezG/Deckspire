import type { GameState } from '../../models/game-state.model';

export interface EndTurnUseCase {
  /**
   * Finaliza el turno del jugador y ejecuta el turno enemigo.
   * Orden: descarte de mano → tick de status del jugador → intents enemigos →
   * calcular siguiente intent → robo de nueva mano → reset de energía.
   */
  execute(state: GameState): Promise<GameState>;
}
