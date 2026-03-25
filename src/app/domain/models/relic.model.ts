import type { StatusType } from './status-effect.model';

export type RelicRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'boss' | 'shop';

export type RelicHook =
  | 'combat-start'
  | 'player-turn-start'
  | 'player-turn-end'
  | 'combat-end-victory'
  | 'map-node-enter'
  | 'rest-site-enter';

export type RelicPassiveEffect =
  | { readonly type: 'gain-energy'; readonly value: number }
  | { readonly type: 'gain-block'; readonly value: number }
  | { readonly type: 'draw-cards'; readonly value: number }
  | { readonly type: 'heal'; readonly value: number }
  | {
      readonly type: 'apply-status';
      readonly status: StatusType;
      readonly stacks: number;
      readonly target: 'self';
    };

export interface RelicPassiveHook {
  readonly hook: RelicHook;
  readonly effect: RelicPassiveEffect;
}

export interface RelicActiveEffect {
  readonly type: 'gain-energy' | 'gain-block' | 'draw-cards' | 'heal';
  readonly value: number;
}

export interface RelicActiveConfig {
  readonly effect: RelicActiveEffect;
  readonly cooldownTurns?: number;
  readonly maxCharges?: number;
}

export interface RelicDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly rarity: RelicRarity;
  readonly passiveHooks: readonly RelicPassiveHook[];
  readonly active?: RelicActiveConfig;
}

export interface RelicInstance {
  readonly id: string;
  readonly cooldownRemaining: number;
  readonly chargesRemaining: number | null;
}
