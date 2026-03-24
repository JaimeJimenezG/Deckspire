import { Card } from './card.model';
import { StatusEffect } from './status-effect.model';

export interface PlayerPiles {
  readonly discard: readonly Card[];
  readonly exhaust: readonly Card[];
}

export interface Player {
  readonly hp: number;
  readonly maxHp: number;
  readonly block: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly gold: number;
  readonly deck: readonly Card[];
  readonly hand: readonly Card[];
  readonly piles: PlayerPiles;
  readonly statusEffects: readonly StatusEffect[];
}
