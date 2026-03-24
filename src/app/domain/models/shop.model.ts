import type { Card } from './card.model';

export type ShopItemType = 'card' | 'relic';

/**
 * A single item available for purchase in the shop.
 * Exactly one of `card` or `relicId` is defined depending on `type`.
 */
export interface ShopItem {
  /** Unique identifier within this shop instance (e.g. 'card-0', 'relic-1'). */
  readonly id: string;
  readonly type: ShopItemType;
  /** Present when type === 'card'. */
  readonly card?: Card;
  /** Present when type === 'relic'. */
  readonly relicId?: string;
  readonly price: number;
  readonly sold: boolean;
}

/**
 * Full state of the shop for the current floor.
 * Immutable snapshot — ShopManager returns new instances on each mutation.
 */
export interface ShopState {
  readonly items: readonly ShopItem[];
  /** Current cost (in gold) to purge one card from the deck. Increases per use. */
  readonly purgePrice: number;
  /** Number of purges performed in this shop visit (used to compute next purgePrice). */
  readonly purgeCount: number;
}
