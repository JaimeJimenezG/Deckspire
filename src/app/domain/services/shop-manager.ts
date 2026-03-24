import type { Card, CardRarity } from '../models/card.model';
import type { Player } from '../models/player.model';
import type { ShopItem, ShopState } from '../models/shop.model';
import { SeededRandom } from './seeded-random';

// ---------------------------------------------------------------------------
// Configuración de precios
// ---------------------------------------------------------------------------

/** Precio base en oro por rareza de carta. Las básicas nunca aparecen en tienda. */
const CARD_PRICE_BASE: Readonly<Record<Exclude<CardRarity, 'basic'>, number>> = {
  common:   50,
  uncommon: 75,
  rare:     150,
};

/** Variación aleatoria máxima del precio (±jitter sobre la base). */
const CARD_PRICE_JITTER: Readonly<Record<Exclude<CardRarity, 'basic'>, number>> = {
  common:   5,
  uncommon: 7,
  rare:     15,
};

/** Precio base de una reliquia en la tienda. */
const RELIC_PRICE_BASE = 143;
const RELIC_PRICE_JITTER = 15;

/** Coste inicial de purgar (eliminar) una carta del mazo. */
const INITIAL_PURGE_PRICE = 75;
/** Incremento del coste de purga por cada uso en la misma tienda. */
const PURGE_PRICE_INCREMENT = 25;

/** Número de huecos de carta en la tienda. */
const SHOP_CARD_SLOTS = 3;
/** Número de huecos de reliquia en la tienda. */
const SHOP_RELIC_SLOTS = 2;

/** Pesos de rareza para la selección aleatoria de cartas en la tienda. */
const RARITY_WEIGHTS: ReadonlyArray<{ readonly rarity: Exclude<CardRarity, 'basic'>; readonly weight: number }> = [
  { rarity: 'common',   weight: 50 },
  { rarity: 'uncommon', weight: 35 },
  { rarity: 'rare',     weight: 15 },
];

// ---------------------------------------------------------------------------
// ShopManager — servicio de dominio puro
// ---------------------------------------------------------------------------

/**
 * Gestiona la lógica de la tienda: generación de ofertas, precios por rareza,
 * compra de cartas/reliquias y eliminación (purga) de cartas del mazo.
 *
 * Todas las operaciones son puras: reciben estado e inmutables y devuelven
 * nuevo estado sin mutar el original.
 */
export class ShopManager {
  /**
   * Genera las ofertas de la tienda para un piso dado.
   *
   * Selecciona `SHOP_CARD_SLOTS` cartas del pool (excluyendo básicas) mediante
   * selección ponderada por rareza y `SHOP_RELIC_SLOTS` reliquias del pool
   * (excluyendo las ya obtenidas por el jugador).
   *
   * @param cardPool       - Pool completo de cartas del juego (sin básicas idealmente).
   * @param relicPool      - IDs de todas las reliquias disponibles.
   * @param ownedRelicIds  - IDs de reliquias que el jugador ya posee (no se repiten).
   * @param rng            - Generador determinista para reproducibilidad.
   */
  generateOfferings(
    cardPool: readonly Card[],
    relicPool: readonly string[],
    ownedRelicIds: readonly string[],
    rng: SeededRandom,
  ): ShopState {
    const items: ShopItem[] = [];

    // ── Cartas ────────────────────────────────────────────────────────────────
    const nonBasicCards = cardPool.filter(c => c.rarity !== 'basic');
    const byRarity = this.groupByRarity(nonBasicCards);
    const selectedCards = this.pickCards(byRarity, rng);

    for (let i = 0; i < selectedCards.length; i++) {
      const card = selectedCards[i];
      items.push({
        id: `card-${i}`,
        type: 'card',
        card,
        price: this.calculatePrice(card, rng),
        sold: false,
      });
    }

    // ── Reliquias ─────────────────────────────────────────────────────────────
    const availableRelics = relicPool.filter(id => !ownedRelicIds.includes(id));
    const shuffledRelics = this.shuffleArray([...availableRelics], rng);
    const selectedRelics = shuffledRelics.slice(0, Math.min(SHOP_RELIC_SLOTS, shuffledRelics.length));

    for (let i = 0; i < selectedRelics.length; i++) {
      items.push({
        id: `relic-${i}`,
        type: 'relic',
        relicId: selectedRelics[i],
        price: this.calculateRelicPrice(rng),
        sold: false,
      });
    }

    return {
      items,
      purgePrice: INITIAL_PURGE_PRICE,
      purgeCount: 0,
    };
  }

  /**
   * Calcula el precio de una carta según su rareza con variación aleatoria.
   * Las cartas básicas devuelven 0 (no se venden en tienda).
   */
  calculatePrice(card: Card, rng: SeededRandom): number {
    if (card.rarity === 'basic') return 0;
    const base = CARD_PRICE_BASE[card.rarity];
    const jitter = CARD_PRICE_JITTER[card.rarity];
    return base + rng.nextInt(-jitter, jitter);
  }

  /**
   * Calcula el precio de una reliquia con variación aleatoria.
   */
  calculateRelicPrice(rng: SeededRandom): number {
    return RELIC_PRICE_BASE + rng.nextInt(-RELIC_PRICE_JITTER, RELIC_PRICE_JITTER);
  }

  /**
   * Compra una carta de la tienda.
   * Descuenta el oro del jugador y añade la carta al mazo maestro.
   * Marca el ítem como vendido en la tienda.
   *
   * @throws Si el ítem no existe, no es una carta, ya está vendido o el jugador
   *         no tiene oro suficiente.
   */
  purchaseCard(
    itemId: string,
    shop: ShopState,
    player: Player,
  ): { readonly player: Player; readonly shop: ShopState } {
    const itemIdx = shop.items.findIndex(i => i.id === itemId);
    if (itemIdx === -1) {
      throw new Error(`Shop item not found: ${itemId}`);
    }

    const item = shop.items[itemIdx];
    if (item.type !== 'card' || !item.card) {
      throw new Error(`Item ${itemId} is not a card`);
    }
    if (item.sold) {
      throw new Error(`Item ${itemId} is already sold`);
    }
    if (player.gold < item.price) {
      throw new Error(
        `Not enough gold to purchase ${itemId} (need ${item.price}, have ${player.gold})`,
      );
    }

    const updatedItems: readonly ShopItem[] = [
      ...shop.items.slice(0, itemIdx),
      { ...item, sold: true },
      ...shop.items.slice(itemIdx + 1),
    ];

    return {
      player: {
        ...player,
        gold: player.gold - item.price,
        deck: [...player.deck, item.card],
      },
      shop: { ...shop, items: updatedItems },
    };
  }

  /**
   * Elimina una carta del mazo del jugador (purga) pagando `shop.purgePrice`.
   * El coste de purga aumenta en `PURGE_PRICE_INCREMENT` por cada uso.
   *
   * @param cardIdx - Índice de la carta en `player.deck`.
   * @throws Si el índice es inválido o el jugador no tiene oro suficiente.
   */
  removeCardFromDeck(
    cardIdx: number,
    player: Player,
    shop: ShopState,
  ): { readonly player: Player; readonly shop: ShopState } {
    if (cardIdx < 0 || cardIdx >= player.deck.length) {
      throw new Error(
        `Invalid card index: ${cardIdx} (deck size: ${player.deck.length})`,
      );
    }
    if (player.gold < shop.purgePrice) {
      throw new Error(
        `Not enough gold to purge (need ${shop.purgePrice}, have ${player.gold})`,
      );
    }

    const newDeck: readonly Card[] = [
      ...player.deck.slice(0, cardIdx),
      ...player.deck.slice(cardIdx + 1),
    ];

    return {
      player: {
        ...player,
        gold: player.gold - shop.purgePrice,
        deck: newDeck,
      },
      shop: {
        ...shop,
        purgePrice: shop.purgePrice + PURGE_PRICE_INCREMENT,
        purgeCount: shop.purgeCount + 1,
      },
    };
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  private groupByRarity(
    cards: readonly Card[],
  ): Map<Exclude<CardRarity, 'basic'>, Card[]> {
    const map = new Map<Exclude<CardRarity, 'basic'>, Card[]>();
    for (const card of cards) {
      if (card.rarity === 'basic') continue;
      const group = map.get(card.rarity) ?? [];
      group.push(card);
      map.set(card.rarity, group);
    }
    return map;
  }

  private pickCards(
    byRarity: Map<Exclude<CardRarity, 'basic'>, Card[]>,
    rng: SeededRandom,
  ): Card[] {
    const picked: Card[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < SHOP_CARD_SLOTS; i++) {
      const eligibleWeights = RARITY_WEIGHTS.filter(
        ({ rarity }) => (byRarity.get(rarity)?.filter(c => !usedIds.has(c.id)).length ?? 0) > 0,
      ).map(({ rarity, weight }) => ({ item: rarity, weight }));

      if (eligibleWeights.length === 0) break;

      const chosenRarity = rng.weightedChoice(eligibleWeights);
      const pool = (byRarity.get(chosenRarity) ?? []).filter(c => !usedIds.has(c.id));
      if (pool.length === 0) continue;

      const card = pool[rng.nextInt(0, pool.length - 1)];
      usedIds.add(card.id);
      picked.push(card);
    }

    return picked;
  }

  private shuffleArray<T>(arr: T[], rng: SeededRandom): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
