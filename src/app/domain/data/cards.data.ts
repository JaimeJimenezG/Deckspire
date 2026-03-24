import type { Card } from '../models/card.model';

// ---------------------------------------------------------------------------
// Cartas de Ataque (~13 cartas)
// ---------------------------------------------------------------------------

export const ATTACK_CARDS = [
  // --- Básicas ---
  {
    id: 'strike',
    name: 'Strike',
    type: 'attack',
    rarity: 'basic',
    cost: 1,
    upgraded: false,
    description: 'Deal 6 damage.',
    effects: [{ type: 'damage', value: 6 }],
  },

  // --- Comunes ---
  {
    id: 'bash',
    name: 'Bash',
    type: 'attack',
    rarity: 'common',
    cost: 2,
    upgraded: false,
    description: 'Deal 8 damage. Apply 2 Vulnerable.',
    effects: [
      { type: 'damage', value: 8 },
      { type: 'apply-status', target: 'targeted-enemy', status: 'vulnerable', stacks: 2 },
    ],
  },
  {
    id: 'cleave',
    name: 'Cleave',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    upgraded: false,
    description: 'Deal 8 damage to ALL enemies.',
    effects: [{ type: 'damage', value: 8, target: 'all-enemies' }],
  },
  {
    id: 'clothesline',
    name: 'Clothesline',
    type: 'attack',
    rarity: 'common',
    cost: 2,
    upgraded: false,
    description: 'Deal 12 damage. Apply 2 Weak.',
    effects: [
      { type: 'damage', value: 12 },
      { type: 'apply-status', target: 'targeted-enemy', status: 'weak', stacks: 2 },
    ],
  },
  {
    id: 'heavy-blow',
    name: 'Heavy Blow',
    type: 'attack',
    rarity: 'common',
    cost: 2,
    upgraded: false,
    description: 'Deal 14 damage.',
    effects: [{ type: 'damage', value: 14 }],
  },
  {
    id: 'iron-wave',
    name: 'Iron Wave',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    upgraded: false,
    description: 'Deal 5 damage. Gain 5 Block.',
    effects: [
      { type: 'damage', value: 5 },
      { type: 'block', value: 5 },
    ],
  },
  {
    id: 'pommel-strike',
    name: 'Pommel Strike',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    upgraded: false,
    description: 'Deal 9 damage. Draw 1 card.',
    effects: [
      { type: 'damage', value: 9 },
      { type: 'draw', value: 1 },
    ],
  },
  {
    id: 'twin-strike',
    name: 'Twin Strike',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    upgraded: false,
    description: 'Deal 5 damage twice.',
    effects: [{ type: 'damage', value: 5, times: 2 }],
  },

  // --- Infrecuentes ---
  {
    id: 'carnage',
    name: 'Carnage',
    type: 'attack',
    rarity: 'uncommon',
    cost: 2,
    upgraded: false,
    description: 'Deal 20 damage. Exhaust.',
    effects: [
      { type: 'damage', value: 20 },
      { type: 'exhaust-self' },
    ],
  },
  {
    id: 'sword-boomerang',
    name: 'Sword Boomerang',
    type: 'attack',
    rarity: 'uncommon',
    cost: 1,
    upgraded: false,
    description: 'Deal 3 damage to a random enemy 3 times.',
    effects: [{ type: 'damage', value: 3, times: 3, target: 'random-enemy' }],
  },
  {
    id: 'uppercut',
    name: 'Uppercut',
    type: 'attack',
    rarity: 'uncommon',
    cost: 2,
    upgraded: false,
    description: 'Deal 13 damage. Apply 1 Weak. Apply 1 Vulnerable.',
    effects: [
      { type: 'damage', value: 13 },
      { type: 'apply-status', target: 'targeted-enemy', status: 'weak', stacks: 1 },
      { type: 'apply-status', target: 'targeted-enemy', status: 'vulnerable', stacks: 1 },
    ],
  },
  {
    id: 'whirlwind',
    name: 'Whirlwind',
    type: 'attack',
    rarity: 'uncommon',
    cost: 1,
    upgraded: false,
    description: 'Deal 5 damage to ALL enemies 3 times.',
    effects: [{ type: 'damage', value: 5, times: 3, target: 'all-enemies' }],
  },

  // --- Raras ---
  {
    id: 'fiend-fire',
    name: 'Fiend Fire',
    type: 'attack',
    rarity: 'rare',
    cost: 2,
    upgraded: false,
    description: 'Deal 7 damage 3 times. Exhaust.',
    effects: [
      { type: 'damage', value: 7, times: 3 },
      { type: 'exhaust-self' },
    ],
  },
] as const satisfies readonly Card[];

// ---------------------------------------------------------------------------
// Cartas de Habilidad (~12 cartas)
// ---------------------------------------------------------------------------

export const SKILL_CARDS = [
  // --- Básicas ---
  {
    id: 'defend',
    name: 'Defend',
    type: 'skill',
    rarity: 'basic',
    cost: 1,
    upgraded: false,
    description: 'Gain 5 Block.',
    effects: [{ type: 'block', value: 5 }],
  },

  // --- Comunes ---
  {
    id: 'flex',
    name: 'Flex',
    type: 'skill',
    rarity: 'common',
    cost: 0,
    upgraded: false,
    description: 'Gain 2 Strength. At the end of your turn, lose 2 Strength.',
    effects: [{ type: 'apply-status', target: 'self', status: 'strength', stacks: 2 }],
  },
  {
    id: 'shrug-it-off',
    name: 'Shrug It Off',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    upgraded: false,
    description: 'Gain 8 Block. Draw 1 card.',
    effects: [
      { type: 'block', value: 8 },
      { type: 'draw', value: 1 },
    ],
  },
  {
    id: 'warcry',
    name: 'War Cry',
    type: 'skill',
    rarity: 'common',
    cost: 0,
    upgraded: false,
    description: 'Draw 2 cards. Exhaust.',
    effects: [
      { type: 'draw', value: 2 },
      { type: 'exhaust-self' },
    ],
  },

  // --- Infrecuentes ---
  {
    id: 'battle-trance',
    name: 'Battle Trance',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    upgraded: false,
    description: 'Draw 3 cards. You cannot draw any more cards this turn.',
    effects: [
      { type: 'draw', value: 3 },
      { type: 'apply-status', target: 'self', status: 'no-draw', stacks: 1 },
    ],
  },
  {
    id: 'bloodletting',
    name: 'Bloodletting',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    upgraded: false,
    description: 'Lose 3 HP. Gain 2 Energy.',
    effects: [
      { type: 'lose-hp', value: 3 },
      { type: 'gain-energy', value: 2 },
    ],
  },
  {
    id: 'disarm',
    name: 'Disarm',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    upgraded: false,
    description: 'Enemy loses 2 Strength. Exhaust.',
    effects: [
      { type: 'apply-status', target: 'targeted-enemy', status: 'shackled', stacks: 2 },
      { type: 'exhaust-self' },
    ],
  },
  {
    id: 'rage',
    name: 'Rage',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    upgraded: false,
    description: 'Whenever you play an Attack this turn, gain 3 Block.',
    effects: [{ type: 'apply-status', target: 'self', status: 'juggernaut', stacks: 3 }],
  },
  {
    id: 'seeing-red',
    name: 'Seeing Red',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    upgraded: false,
    description: 'Gain 2 Energy. Exhaust.',
    effects: [
      { type: 'gain-energy', value: 2 },
      { type: 'exhaust-self' },
    ],
  },
  {
    id: 'true-grit',
    name: 'True Grit',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    upgraded: false,
    description: 'Gain 7 Block. Exhaust.',
    effects: [
      { type: 'block', value: 7 },
      { type: 'exhaust-self' },
    ],
  },

  // --- Raras ---
  {
    id: 'entrench',
    name: 'Entrench',
    type: 'skill',
    rarity: 'rare',
    cost: 2,
    upgraded: false,
    description: 'Double your current Block.',
    effects: [{ type: 'block', value: 14 }],
  },
  {
    id: 'impervious',
    name: 'Impervious',
    type: 'skill',
    rarity: 'rare',
    cost: 2,
    upgraded: false,
    description: 'Gain 30 Block. Exhaust.',
    effects: [
      { type: 'block', value: 30 },
      { type: 'exhaust-self' },
    ],
  },
] as const satisfies readonly Card[];

// ---------------------------------------------------------------------------
// Cartas de Poder (~8 cartas)
// ---------------------------------------------------------------------------

export const POWER_CARDS = [
  // --- Comunes ---
  {
    id: 'inflame',
    name: 'Inflame',
    type: 'power',
    rarity: 'common',
    cost: 1,
    upgraded: false,
    description: 'Gain 2 Strength.',
    effects: [{ type: 'apply-status', target: 'self', status: 'strength', stacks: 2 }],
  },

  // --- Infrecuentes ---
  {
    id: 'brutality',
    name: 'Brutality',
    type: 'power',
    rarity: 'uncommon',
    cost: 0,
    upgraded: false,
    description: 'At the start of each turn, lose 1 HP and draw 1 card.',
    effects: [{ type: 'apply-status', target: 'self', status: 'brutality', stacks: 1 }],
  },
  {
    id: 'combust',
    name: 'Combust',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    upgraded: false,
    description: 'At the end of each turn, lose 1 HP and deal 5 damage to ALL enemies.',
    effects: [{ type: 'apply-status', target: 'self', status: 'combust', stacks: 5 }],
  },
  {
    id: 'feel-no-pain',
    name: 'Feel No Pain',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    upgraded: false,
    description: 'Whenever a card is Exhausted, gain 3 Block.',
    effects: [{ type: 'apply-status', target: 'self', status: 'feel-no-pain', stacks: 3 }],
  },
  {
    id: 'metallicize',
    name: 'Metallicize',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    upgraded: false,
    description: 'At the end of your turn, gain 3 Block.',
    effects: [{ type: 'apply-status', target: 'self', status: 'metallicize', stacks: 3 }],
  },

  // --- Raras ---
  {
    id: 'barricade',
    name: 'Barricade',
    type: 'power',
    rarity: 'rare',
    cost: 3,
    upgraded: false,
    description: 'Block is no longer removed at the start of your turn.',
    effects: [{ type: 'apply-status', target: 'self', status: 'barricade', stacks: 1 }],
  },
  {
    id: 'corruption',
    name: 'Corruption',
    type: 'power',
    rarity: 'rare',
    cost: 3,
    upgraded: false,
    description: 'Skills cost 0. Whenever you play a Skill, Exhaust it.',
    effects: [{ type: 'apply-status', target: 'self', status: 'corruption-skill-exhaust', stacks: 1 }],
  },
  {
    id: 'demon-form',
    name: 'Demon Form',
    type: 'power',
    rarity: 'rare',
    cost: 3,
    upgraded: false,
    description: 'At the start of each turn, gain 2 Strength.',
    effects: [{ type: 'apply-status', target: 'self', status: 'ritual', stacks: 2 }],
  },
] as const satisfies readonly Card[];

// ---------------------------------------------------------------------------
// Catálogo completo y helpers
// ---------------------------------------------------------------------------

export const ALL_CARDS = [
  ...ATTACK_CARDS,
  ...SKILL_CARDS,
  ...POWER_CARDS,
] as const satisfies readonly Card[];

/** Mazo inicial del jugador: 5× Strike + 4× Defend. */
const _strike = ATTACK_CARDS.find(c => c.id === 'strike')!;
const _defend = SKILL_CARDS.find(c => c.id === 'defend')!;
export const STARTER_DECK: readonly Card[] = [
  ...Array.from({ length: 5 }, () => ({ ..._strike })),
  ...Array.from({ length: 4 }, () => ({ ..._defend })),
];
