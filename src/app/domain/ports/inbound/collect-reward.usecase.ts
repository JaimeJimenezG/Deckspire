import type { Card } from '../../models/card.model';
import type { GameState } from '../../models/game-state.model';

export interface CollectRewardUseCase {
  /**
   * El jugador elige una carta de las ofrecidas como recompensa de combate.
   *
   * @param card  - Carta elegida de las opciones de recompensa
   * @param state - Estado del juego actual
   */
  pickCard(card: Card, state: GameState): Promise<GameState>;

  /**
   * El jugador descarta todas las cartas de recompensa sin elegir ninguna.
   */
  skip(state: GameState): Promise<GameState>;
}
