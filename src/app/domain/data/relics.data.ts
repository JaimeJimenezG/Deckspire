import type { RelicDefinition } from '../models/relic.model';

/**
 * Catálogo tipado de reliquias.
 * En esta primera integración se prioriza tener definición estructural y hooks
 * básicos para las reliquias más inmediatas del combate.
 */
export const RELIC_DEFINITIONS: Readonly<Record<string, RelicDefinition>> = {
  'burning-blood': {
    id: 'burning-blood',
    name: 'Burning Blood',
    description: 'Al ganar un combate, cura 6 HP.',
    rarity: 'starter',
    passiveHooks: [{ hook: 'combat-end-victory', effect: { type: 'heal', value: 6 } }],
  },
  'cracked-core': {
    id: 'cracked-core',
    name: 'Cracked Core',
    description: 'Reliquia inicial base.',
    rarity: 'starter',
    passiveHooks: [{ hook: 'player-turn-start', effect: { type: 'gain-energy', value: 1 } }],
  },
  'pure-water': {
    id: 'pure-water',
    name: 'Pure Water',
    description: 'Reliquia inicial base.',
    rarity: 'starter',
    passiveHooks: [{ hook: 'rest-site-enter', effect: { type: 'heal', value: 6 } }],
  },
  vajra: {
    id: 'vajra',
    name: 'Vajra',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [
      {
        hook: 'map-node-enter',
        effect: { type: 'apply-status', status: 'strength', stacks: 1, target: 'self' },
      },
    ],
  },
  akabeko: {
    id: 'akabeko',
    name: 'Akabeko',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'player-turn-start', effect: { type: 'gain-block', value: 2 } }],
  },
  anchor: {
    id: 'anchor',
    name: 'Anchor',
    description: 'Al inicio del combate, gana 10 de bloque.',
    rarity: 'common',
    passiveHooks: [{ hook: 'combat-start', effect: { type: 'gain-block', value: 10 } }],
  },
  'ancient-tea-set': {
    id: 'ancient-tea-set',
    name: 'Ancient Tea Set',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'map-node-enter', effect: { type: 'gain-energy', value: 1 } }],
  },
  'art-of-war': {
    id: 'art-of-war',
    name: 'Art of War',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'rest-site-enter', effect: { type: 'gain-block', value: 3 } }],
  },
  'bag-of-marbles': {
    id: 'bag-of-marbles',
    name: 'Bag of Marbles',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'player-turn-start', effect: { type: 'draw-cards', value: 1 } }],
  },
  'bag-of-preparation': {
    id: 'bag-of-preparation',
    name: 'Bag of Preparation',
    description: 'Al inicio del combate, roba 2 cartas.',
    rarity: 'common',
    passiveHooks: [{ hook: 'combat-start', effect: { type: 'draw-cards', value: 2 } }],
  },
  'blood-vial': {
    id: 'blood-vial',
    name: 'Blood Vial',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'rest-site-enter', effect: { type: 'draw-cards', value: 1 } }],
  },
  'bronze-scales': {
    id: 'bronze-scales',
    name: 'Bronze Scales',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'map-node-enter', effect: { type: 'gain-block', value: 2 } }],
  },
  'centennial-puzzle': {
    id: 'centennial-puzzle',
    name: 'Centennial Puzzle',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [
      {
        hook: 'map-node-enter',
        effect: { type: 'modify-relic-reward-count', target: 'elite', value: 1 },
      },
    ],
  },
  'ceramic-fish': {
    id: 'ceramic-fish',
    name: 'Ceramic Fish',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [
      {
        hook: 'player-turn-start',
        effect: { type: 'apply-status', status: 'thorns', stacks: 2, target: 'self' },
      },
    ],
  },
  'dream-catcher': {
    id: 'dream-catcher',
    name: 'Dream Catcher',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'rest-site-enter', effect: { type: 'gain-energy', value: 1 } }],
  },
  'happy-flower': {
    id: 'happy-flower',
    name: 'Happy Flower',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'map-node-enter', effect: { type: 'draw-cards', value: 1 } }],
  },
  'juzu-bracelet': {
    id: 'juzu-bracelet',
    name: 'Juzu Bracelet',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'player-turn-start', effect: { type: 'gain-block', value: 1 } }],
  },
  lantern: {
    id: 'lantern',
    name: 'Lantern',
    description: 'Al inicio del combate, gana 1 de energía.',
    rarity: 'common',
    passiveHooks: [{ hook: 'combat-start', effect: { type: 'gain-energy', value: 1 } }],
  },
  'meat-on-the-bone': {
    id: 'meat-on-the-bone',
    name: 'Meat on the Bone',
    description: 'Bonus pasivo.',
    rarity: 'uncommon',
    passiveHooks: [{ hook: 'rest-site-enter', effect: { type: 'heal', value: 8 } }],
  },
  'oddly-smooth-stone': {
    id: 'oddly-smooth-stone',
    name: 'Oddly Smooth Stone',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'map-node-enter', effect: { type: 'gain-energy', value: 1 } }],
  },
  omamori: {
    id: 'omamori',
    name: 'Omamori',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [
      { hook: 'rest-site-enter', effect: { type: 'apply-status', status: 'artifact', stacks: 1, target: 'self' } },
    ],
  },
  orichalcum: {
    id: 'orichalcum',
    name: 'Orichalcum',
    description: 'Si terminas turno sin bloque, ganas 6 de bloque.',
    rarity: 'common',
    passiveHooks: [{ hook: 'player-turn-end', effect: { type: 'gain-block', value: 6 } }],
  },
  'pen-nib': {
    id: 'pen-nib',
    name: 'Pen Nib',
    description: 'Bonus pasivo.',
    rarity: 'uncommon',
    passiveHooks: [{ hook: 'player-turn-start', effect: { type: 'draw-cards', value: 2 } }],
  },
  'preserved-insect': {
    id: 'preserved-insect',
    name: 'Preserved Insect',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'map-node-enter', effect: { type: 'gain-block', value: 2 } }],
  },
  'regal-pillow': {
    id: 'regal-pillow',
    name: 'Regal Pillow',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'rest-site-enter', effect: { type: 'heal', value: 5 } }],
  },
  'smiling-mask': {
    id: 'smiling-mask',
    name: 'Smiling Mask',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'player-turn-start', effect: { type: 'gain-energy', value: 1 } }],
  },
  'the-boot': {
    id: 'the-boot',
    name: 'The Boot',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'map-node-enter', effect: { type: 'gain-block', value: 1 } }],
  },
  'toy-ornithopter': {
    id: 'toy-ornithopter',
    name: 'Toy Ornithopter',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'map-node-enter', effect: { type: 'draw-cards', value: 1 } }],
  },
  whetstone: {
    id: 'whetstone',
    name: 'Whetstone',
    description: 'Bonus pasivo.',
    rarity: 'common',
    passiveHooks: [{ hook: 'rest-site-enter', effect: { type: 'gain-block', value: 2 } }],
  },
} as const;

/**
 * Pool de IDs de reliquias disponibles en el juego.
 * Se deriva del catálogo tipado para mantener consistencia.
 */
export const ALL_RELIC_IDS: readonly string[] = Object.keys(RELIC_DEFINITIONS);
