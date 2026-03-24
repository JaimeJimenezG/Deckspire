import type { StatusType } from './status-effect.model';

export type CardType = 'attack' | 'skill' | 'power';

export type CardRarity = 'basic' | 'common' | 'uncommon' | 'rare';

/**
 * Target selector for card effects that affect enemies.
 * 'self' targets the player themselves.
 */
export type CardEffectTarget =
  | 'self'
  | 'targeted-enemy'
  | 'all-enemies'
  | 'random-enemy';

/**
 * Discriminated union of all possible per-card effects.
 * CombatEngine iterates over this array when resolving a played card.
 */
export type CardEffect =
  | { readonly type: 'damage'; readonly value: number; readonly times?: number; readonly target?: CardEffectTarget }
  | { readonly type: 'block'; readonly value: number }
  | { readonly type: 'apply-status'; readonly target: CardEffectTarget; readonly status: StatusType; readonly stacks: number }
  | { readonly type: 'draw'; readonly value: number }
  | { readonly type: 'gain-energy'; readonly value: number }
  | { readonly type: 'lose-hp'; readonly value: number }
  | { readonly type: 'exhaust-self' };

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly type: CardType;
  readonly rarity: CardRarity;
  readonly cost: number;
  readonly description: string;
  readonly upgraded: boolean;
  /** Effects applied in order when the card is played. */
  readonly effects: readonly CardEffect[];
}
