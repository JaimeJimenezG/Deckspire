import type { GameState } from '../../domain/models/game-state.model';
import type { ShopUseCase } from '../../domain/ports/inbound/shop.usecase';
import { ShopManager } from '../../domain/services/shop-manager';

// ---------------------------------------------------------------------------
// Errores de dominio de la capa aplicación
// ---------------------------------------------------------------------------

export class NotInShopPhaseError extends Error {
  constructor(phase: string) {
    super(`Cannot perform shop action during phase: ${phase}`);
    this.name = 'NotInShopPhaseError';
  }
}

export class ShopNotAvailableError extends Error {
  constructor() {
    super('No active shop state');
    this.name = 'ShopNotAvailableError';
  }
}

export class RelicItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Shop relic item not found: ${itemId}`);
    this.name = 'RelicItemNotFoundError';
  }
}

export class ItemNotARelicError extends Error {
  constructor(itemId: string) {
    super(`Item ${itemId} is not a relic`);
    this.name = 'ItemNotARelicError';
  }
}

export class RelicAlreadySoldError extends Error {
  constructor(itemId: string) {
    super(`Relic item ${itemId} is already sold`);
    this.name = 'RelicAlreadySoldError';
  }
}

export class InsufficientGoldError extends Error {
  constructor(required: number, available: number) {
    super(`Not enough gold (need ${required}, have ${available})`);
    this.name = 'InsufficientGoldError';
  }
}

// ---------------------------------------------------------------------------
// Implementación del caso de uso
// ---------------------------------------------------------------------------

/**
 * Orquesta las acciones disponibles en la tienda:
 *   - buyCard: compra una carta de la tienda y la añade al mazo maestro.
 *   - purgeCard: elimina una carta del mazo maestro pagando el coste de purga.
 *   - buyRelic: compra una reliquia de la tienda y la añade a las reliquias del jugador.
 *
 * Fuentes canónicas fuera de combate:
 *   - `state.deck`  → mazo maestro del jugador.
 *   - `state.gold`  → oro acumulado del jugador.
 *   - `state.relics` → IDs de reliquias equipadas.
 */
export class ShopUseCaseImpl implements ShopUseCase {
  constructor(private readonly shopManager: ShopManager) {}

  async buyCard(itemId: string, state: GameState): Promise<GameState> {
    this.assertShopPhase(state);

    // Delegar validación y lógica al servicio de dominio.
    // Creamos un jugador temporal que usa las fuentes canónicas (state.gold, state.deck)
    // para que ShopManager opere sobre los valores correctos fuera de combate.
    const tempPlayer = { ...state.player, gold: state.gold, deck: state.deck };
    const { player: updated, shop: updatedShop } = this.shopManager.purchaseCard(
      itemId,
      state.shop!,
      tempPlayer,
    );

    return {
      ...state,
      gold: updated.gold,
      deck: updated.deck,
      shop: updatedShop,
      player: { ...state.player, gold: updated.gold },
    };
  }

  async purgeCard(cardInstanceIdx: number, state: GameState): Promise<GameState> {
    this.assertShopPhase(state);

    const tempPlayer = { ...state.player, gold: state.gold, deck: state.deck };
    const { player: updated, shop: updatedShop } = this.shopManager.removeCardFromDeck(
      cardInstanceIdx,
      tempPlayer,
      state.shop!,
    );

    return {
      ...state,
      gold: updated.gold,
      deck: updated.deck,
      shop: updatedShop,
      player: { ...state.player, gold: updated.gold },
    };
  }

  async buyRelic(itemId: string, state: GameState): Promise<GameState> {
    this.assertShopPhase(state);

    const shop = state.shop!;
    const item = shop.items.find(i => i.id === itemId);

    if (!item) throw new RelicItemNotFoundError(itemId);
    if (item.type !== 'relic' || !item.relicId) throw new ItemNotARelicError(itemId);
    if (item.sold) throw new RelicAlreadySoldError(itemId);
    if (state.gold < item.price) throw new InsufficientGoldError(item.price, state.gold);

    const updatedItems = shop.items.map(i =>
      i.id === itemId ? { ...i, sold: true } : i,
    );
    const newGold = state.gold - item.price;

    return {
      ...state,
      gold: newGold,
      relics: [...state.relics, item.relicId],
      shop: { ...shop, items: updatedItems },
      player: { ...state.player, gold: newGold },
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private assertShopPhase(state: GameState): void {
    if (state.phase !== 'shop') throw new NotInShopPhaseError(state.phase);
    if (!state.shop) throw new ShopNotAvailableError();
  }
}
