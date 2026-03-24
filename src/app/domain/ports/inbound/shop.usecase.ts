import type { GameState } from '../../models/game-state.model';

export interface ShopUseCase {
  /**
   * Compra una carta de la tienda. Descuenta el oro y añade la carta al mazo.
   *
   * @param itemId - ID del ítem de tienda a comprar
   * @param state  - Estado del juego actual
   */
  buyCard(itemId: string, state: GameState): Promise<GameState>;

  /**
   * Elimina una carta del mazo pagando el coste de purga.
   *
   * @param cardInstanceIdx - Índice de la carta en el mazo del jugador
   * @param state           - Estado del juego actual
   */
  purgeCard(cardInstanceIdx: number, state: GameState): Promise<GameState>;

  /**
   * Compra una reliquia de la tienda. Descuenta el oro y aplica el efecto de la reliquia.
   *
   * @param itemId - ID del ítem de tienda a comprar
   * @param state  - Estado del juego actual
   */
  buyRelic(itemId: string, state: GameState): Promise<GameState>;
}
