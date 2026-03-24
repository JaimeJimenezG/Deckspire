/**
 * Todos los tipos de efectos de estado posibles en el juego.
 *
 * Debuffs de jugador/enemigo:
 *   - vulnerable: recibe +50% de daño
 *   - weak: inflige -25% de daño
 *   - frail: gana -25% de bloqueo
 *   - poison: pierde N HP al inicio del turno (se reduce en 1 por turno)
 *   - burn: pierde N HP al final del turno (se reduce en 1 por turno)
 *   - daze: siguiente carta cuesta +1 de energía
 *   - shackled: pierde N de fuerza al inicio del turno
 *
 * Buffs de jugador/enemigo:
 *   - strength: +N de daño en todos los ataques
 *   - dexterity: +N de bloqueo en todas las cartas de bloqueo
 *   - thorns: devuelve N de daño al ser atacado en cuerpo a cuerpo
 *   - enrage: gana fuerza al recibir habilidades (Gremlin Nob)
 *   - metallicize: gana N de bloqueo al inicio de cada turno
 *   - ritual: gana N de fuerza al final de cada turno
 *   - regen: recupera N HP al final de cada turno (se reduce en 1)
 *   - intangible: reduce todo el daño recibido a 1
 *   - artifact: niega el siguiente debuff aplicado
 *   - barricade: el bloqueo no se pierde al inicio del turno
 *   - brutality: gana 1 energía y pierde 1 HP al inicio del turno
 *   - combust: al final del turno pierde 1 HP y los enemigos reciben N daño
 *   - corruption: las habilidades cuestan 0 pero hacen exhaust
 *   - evolve: roba 1 carta al recibir un status card
 *   - feelNoPain: gana bloqueo al exhaust de una carta
 *   - fireBreathing: inflige daño a todos los enemigos al robar un status/maldición
 *   - flameBarrier: inflige daño al atacante al ser atacado
 *   - juggernaut: inflige daño al ganar bloqueo
 *   - noDrawNextTurn: el jugador no roba cartas en el próximo turno
 *   - noDraw: el jugador no puede robar cartas este turno
 *   - constricted: pierde N HP al final del turno
 *   - slowness: el siguiente ataque pierde stacks
 */
export type StatusType =
  // Debuffs
  | 'vulnerable'
  | 'weak'
  | 'frail'
  | 'poison'
  | 'burn'
  | 'daze'
  | 'shackled'
  | 'constricted'
  | 'slowness'
  | 'no-draw'
  | 'no-draw-next-turn'
  // Buffs ofensivos
  | 'strength'
  | 'thorns'
  | 'enrage'
  | 'ritual'
  | 'combust'
  | 'fire-breathing'
  | 'juggernaut'
  | 'flame-barrier'
  | 'brutality'
  // Buffs defensivos
  | 'dexterity'
  | 'metallicize'
  | 'regen'
  | 'barricade'
  | 'feel-no-pain'
  // Buffs especiales
  | 'intangible'
  | 'artifact'
  | 'corruption'
  | 'evolve'
  | 'corruption-skill-exhaust';

/**
 * Categoría de un StatusType: si es beneficioso o perjudicial.
 * Usado para colorización en UI y lógica de Artifact.
 */
export type StatusCategory = 'buff' | 'debuff' | 'neutral';

/**
 * Descripción estática de un tipo de efecto de estado:
 * nombre visible, categoría y descripción de regla.
 */
export interface StatusDefinition {
  readonly type: StatusType;
  readonly name: string;
  readonly category: StatusCategory;
  readonly description: string;
  /** Si true, los stacks se reducen en 1 al final/inicio de cada turno. */
  readonly decreasing: boolean;
  /** Si true, el efecto se aplica al inicio del turno del portador. */
  readonly triggersOnTurnStart: boolean;
  /** Si true, el efecto se aplica al final del turno del portador. */
  readonly triggersOnTurnEnd: boolean;
}

/**
 * Instancia viva de un efecto de estado sobre un combatiente (jugador o enemigo).
 * El campo `stacks` representa la magnitud/duración del efecto.
 * Para efectos binarios (e.g. barricade, intangible) stacks = 1 mientras esté activo.
 */
export interface StatusEffect {
  readonly type: StatusType;
  /** Magnitud del efecto. >= 1 mientras el efecto esté activo. */
  readonly stacks: number;
  /**
   * Stacks que se ganarán al inicio del próximo turno (pre-procesamiento diferido).
   * Se usa internamente para aplicar efectos de Enrage, etc.
   * Normalmente 0.
   */
  readonly pendingStacks?: number;
}

/** Mapa estático con las definiciones de todos los StatusType. */
export const STATUS_DEFINITIONS: Readonly<Record<StatusType, StatusDefinition>> = {
  // ── Debuffs ──────────────────────────────────────────────────────────────
  vulnerable: {
    type: 'vulnerable',
    name: 'Vulnerable',
    category: 'debuff',
    description: 'Recibe un 50% más de daño. Reduce en 1 por turno.',
    decreasing: true,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  weak: {
    type: 'weak',
    name: 'Débil',
    category: 'debuff',
    description: 'Inflige un 25% menos de daño. Reduce en 1 por turno.',
    decreasing: true,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  frail: {
    type: 'frail',
    name: 'Frágil',
    category: 'debuff',
    description: 'Gana un 25% menos de bloqueo. Reduce en 1 por turno.',
    decreasing: true,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  poison: {
    type: 'poison',
    name: 'Veneno',
    category: 'debuff',
    description: 'Pierde N HP al inicio del turno, luego reduce en 1.',
    decreasing: true,
    triggersOnTurnStart: true,
    triggersOnTurnEnd: false,
  },
  burn: {
    type: 'burn',
    name: 'Quemadura',
    category: 'debuff',
    description: 'Pierde N HP al final del turno, luego reduce en 1.',
    decreasing: true,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: true,
  },
  daze: {
    type: 'daze',
    name: 'Aturdimiento',
    category: 'debuff',
    description: 'Las cartas de ataque cuestan 1 energía adicional. Reduce en 1 por turno.',
    decreasing: true,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  shackled: {
    type: 'shackled',
    name: 'Encadenado',
    category: 'debuff',
    description: 'Reduce la fuerza en N al inicio del turno.',
    decreasing: false,
    triggersOnTurnStart: true,
    triggersOnTurnEnd: false,
  },
  constricted: {
    type: 'constricted',
    name: 'Constricción',
    category: 'debuff',
    description: 'Pierde N HP al final del turno.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: true,
  },
  slowness: {
    type: 'slowness',
    name: 'Lentitud',
    category: 'debuff',
    description: 'Las cartas cuestan 1 energía adicional por cada stack.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  'no-draw': {
    type: 'no-draw',
    name: 'Sin robo',
    category: 'debuff',
    description: 'No puede robar cartas este turno.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  'no-draw-next-turn': {
    type: 'no-draw-next-turn',
    name: 'Sin robo (próximo turno)',
    category: 'debuff',
    description: 'No robará cartas al inicio del próximo turno.',
    decreasing: true,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  // ── Buffs ofensivos ───────────────────────────────────────────────────────
  strength: {
    type: 'strength',
    name: 'Fuerza',
    category: 'buff',
    description: 'Aumenta el daño de los ataques en N.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  thorns: {
    type: 'thorns',
    name: 'Espinas',
    category: 'buff',
    description: 'Devuelve N de daño al atacante al recibir ataques cuerpo a cuerpo.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  enrage: {
    type: 'enrage',
    name: 'Enfurecimiento',
    category: 'buff',
    description: 'Gana N de fuerza cada vez que el jugador juega una habilidad.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  ritual: {
    type: 'ritual',
    name: 'Ritual',
    category: 'buff',
    description: 'Gana N de fuerza al final de cada turno.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: true,
  },
  combust: {
    type: 'combust',
    name: 'Combustión',
    category: 'buff',
    description: 'Al final del turno pierde 1 HP y los enemigos reciben N de daño.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: true,
  },
  'fire-breathing': {
    type: 'fire-breathing',
    name: 'Aliento de Fuego',
    category: 'buff',
    description: 'Al robar un status o maldición, inflige N de daño a todos los enemigos.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  juggernaut: {
    type: 'juggernaut',
    name: 'Juggernaut',
    category: 'buff',
    description: 'Al ganar bloqueo, inflige N de daño a un enemigo aleatorio.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  'flame-barrier': {
    type: 'flame-barrier',
    name: 'Barrera de Llamas',
    category: 'buff',
    description: 'Al ser atacado, inflige N de daño al atacante. Desaparece al inicio del turno.',
    decreasing: false,
    triggersOnTurnStart: true,
    triggersOnTurnEnd: false,
  },
  brutality: {
    type: 'brutality',
    name: 'Brutalidad',
    category: 'buff',
    description: 'Al inicio del turno, gana 1 de energía y pierde 1 HP.',
    decreasing: false,
    triggersOnTurnStart: true,
    triggersOnTurnEnd: false,
  },
  // ── Buffs defensivos ──────────────────────────────────────────────────────
  dexterity: {
    type: 'dexterity',
    name: 'Destreza',
    category: 'buff',
    description: 'Aumenta el bloqueo de las cartas de bloqueo en N.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  metallicize: {
    type: 'metallicize',
    name: 'Metalizar',
    category: 'buff',
    description: 'Gana N de bloqueo al inicio de cada turno.',
    decreasing: false,
    triggersOnTurnStart: true,
    triggersOnTurnEnd: false,
  },
  regen: {
    type: 'regen',
    name: 'Regeneración',
    category: 'buff',
    description: 'Recupera N HP al final del turno, luego reduce en 1.',
    decreasing: true,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: true,
  },
  barricade: {
    type: 'barricade',
    name: 'Barricada',
    category: 'buff',
    description: 'El bloqueo no se pierde al inicio del turno.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  'feel-no-pain': {
    type: 'feel-no-pain',
    name: 'Sin Dolor',
    category: 'buff',
    description: 'Al hacer exhaust de una carta, gana N de bloqueo.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  // ── Buffs especiales ──────────────────────────────────────────────────────
  intangible: {
    type: 'intangible',
    name: 'Intangible',
    category: 'buff',
    description: 'Todo el daño recibido se reduce a 1. Reduce en 1 por turno.',
    decreasing: true,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  artifact: {
    type: 'artifact',
    name: 'Artefacto',
    category: 'buff',
    description: 'Niega el siguiente debuff aplicado. Reduce en 1 por negación.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  corruption: {
    type: 'corruption',
    name: 'Corrupción',
    category: 'buff',
    description: 'Las habilidades cuestan 0 de energía pero se hacen exhaust al jugarse.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  evolve: {
    type: 'evolve',
    name: 'Evolucionar',
    category: 'buff',
    description: 'Al robar un status card, roba N cartas adicionales.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
  'corruption-skill-exhaust': {
    type: 'corruption-skill-exhaust',
    name: 'Exhaust por Corrupción',
    category: 'neutral',
    description: 'Marcador interno: esta carta hace exhaust debido a Corrupción.',
    decreasing: false,
    triggersOnTurnStart: false,
    triggersOnTurnEnd: false,
  },
} as const;
