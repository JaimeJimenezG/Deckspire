import type { EventChoice, EventEffect, GameEvent } from '../models/event.model';

// ── Evento de primer nodo (Pacto de Origen) ──────────────────────────────────

/** ID del evento especial del primer nodo. */
export const FIRST_NODE_EVENT_ID = 'origin-pact' as const;

/**
 * Elecciones de la categoría "buena ahora mismo".
 * Se elige una al azar al generar el evento de primer nodo.
 */
export const FIRST_NODE_CHOICES_GOOD_NOW: readonly EventChoice[] = [
  {
    id: 'gold-now',
    category: 'good-now',
    text: 'Tomar las monedas del altar (100 de oro)',
    effects: [{ type: 'gain-gold', value: 100 }],
    outcomeText:
      'El altar de oro se desintegra entre tus dedos. Cien monedas caen en tu bolsa con un tintineo satisfactorio.',
  },
  {
    id: 'heal-now',
    category: 'good-now',
    text: 'Beber del cáliz luminoso (+35 HP)',
    effects: [{ type: 'gain-hp', value: 35 }],
    outcomeText:
      'El líquido dorado recorre tu garganta con calidez. Sientes tus heridas cerrarse y tu cuerpo rejuvenecer.',
  },
] as const;

/**
 * Elecciones de la categoría "buena a la larga".
 * Se elige una al azar al generar el evento de primer nodo.
 */
export const FIRST_NODE_CHOICES_GOOD_LATER: readonly EventChoice[] = [
  {
    id: 'relics-post-boss',
    category: 'good-later',
    text: 'Sellar el pacto con el custodio (2 reliquias al derrotar al boss)',
    effects: [{ type: 'gain-relic-post-boss', value: 2 }],
    outcomeText:
      'La entidad asiente solemnemente. Un vínculo invisible se forma. «Cuando caigas al guardián, lo pactado será tuyo.»',
  },
  {
    id: 'max-hp-later',
    category: 'good-later',
    text: 'Forjar tu esencia (+15 HP máximo permanente)',
    effects: [{ type: 'gain-max-hp', value: 15 }],
    outcomeText:
      'Doloroso, pero duradero. Tu cuerpo se reconfigura desde dentro, más capaz de resistir lo que viene.',
  },
] as const;

/**
 * Plantillas para la elección "incierta" del primer nodo.
 * La elección concreta (buen o mal resultado) se determina en tiempo de generación
 * usando RNG; el jugador solo ve el texto ambiguo.
 */
export interface UncertainTemplate {
  readonly id: string;
  /** Texto del botón mostrado al jugador — deliberadamente ambiguo. */
  readonly text: string;
  readonly goodEffects: readonly EventEffect[];
  readonly goodOutcomeText: string;
  readonly badEffects: readonly EventEffect[];
  readonly badOutcomeText: string;
}

export const FIRST_NODE_UNCERTAIN_TEMPLATES: readonly UncertainTemplate[] = [
  {
    id: 'uncertain-vial',
    text: 'Ingerir el vial plateado',
    goodEffects: [{ type: 'gain-max-hp', value: 12 }],
    goodOutcomeText:
      'El líquido plateado arde al bajar. Unos segundos de pánico… y luego una vitalidad extraña y duradera.',
    badEffects: [{ type: 'lose-hp', value: 25 }],
    badOutcomeText:
      'El líquido plateado arde al bajar. El dolor es real e inmediato. Caes al suelo jadeando, consumido por dentro.',
  },
  {
    id: 'uncertain-seal',
    text: 'Presionar el sello de piedra',
    goodEffects: [{ type: 'gain-gold', value: 90 }],
    goodOutcomeText:
      'El sello estalla en polvo dorado. Las monedas llenan el suelo a tus pies como si fuera magia.',
    badEffects: [{ type: 'lose-max-hp', value: 8 }],
    badOutcomeText:
      'El sello vibra y emite un pulso oscuro. Tu pecho se aprieta. Algo de tu vitalidad fue consumida por la piedra.',
  },
  {
    id: 'uncertain-voice',
    text: 'Escuchar la voz del abismo',
    goodEffects: [{ type: 'gain-max-hp', value: 8 }, { type: 'gain-gold', value: 50 }],
    goodOutcomeText:
      'La voz te susurra secretos del ascenso. Sales del trance más completo, más preparado.',
    badEffects: [{ type: 'lose-hp', value: 15 }, { type: 'lose-gold', value: 30 }],
    badOutcomeText:
      'La voz es un lamento que te drena. Sales del trance con menos energía y el oro desvanecido entre los dedos.',
  },
] as const;

// ── Catálogo general de eventos ───────────────────────────────────────────────

/**
 * Catálogo estático de eventos de encuentro aleatorio.
 * Cada evento ofrece al menos dos opciones con efectos distintos.
 */
export const ALL_EVENTS: readonly GameEvent[] = [
  {
    id: 'wounded-traveler',
    title: 'El Viajero Herido',
    icon: '🧙',
    description:
      'Un anciano mago yace junto al camino, sus ropas manchadas de sangre. Te mira con ojos suplicantes y extiende una mano temblorosa.',
    choices: [
      {
        id: 'help',
        text: 'Ayudarle (−20 de oro)',
        effects: [
          { type: 'lose-gold', value: 20 },
          { type: 'gain-max-hp', value: 3 },
        ],
        outcomeText:
          'El anciano acepta tu ayuda agradecido. Antes de desaparecer entre los árboles, te bendice con un susurro antiguo. Sientes tu cuerpo fortalecido.',
      },
      {
        id: 'ignore',
        text: 'Ignorarle y seguir el camino',
        effects: [],
        outcomeText:
          'Apartas la mirada y continúas tu ascenso. Sus gemidos se desvanecen a tu espalda. No todo en la Aguja puede salvarse.',
      },
    ],
  },
  {
    id: 'blood-altar',
    title: 'El Altar Sangriento',
    icon: '🩸',
    description:
      'Una estructura de piedra negra bloquea el paso. Inscripciones en un idioma olvidado rodean un cuenco de obsidiana. El cuenco parece… esperar.',
    choices: [
      {
        id: 'sacrifice',
        text: 'Ofrecer tu sangre (−20 HP)',
        effects: [
          { type: 'lose-hp', value: 20 },
          { type: 'gain-gold', value: 250 },
        ],
        outcomeText:
          'Aprietas el puño sobre el cuenco. La sangre toca la piedra y una lluvia de monedas de oro emerge del altar. El dolor vale lo que vale el poder.',
      },
      {
        id: 'ignore',
        text: 'Rodear el altar',
        effects: [],
        outcomeText:
          'Pasas de largo sin tocar la piedra. El altar emite un zumbido grave mientras te alejás, como si lamentara tu decisión.',
      },
    ],
  },
  {
    id: 'trapped-chest',
    title: 'El Cofre Trampa',
    icon: '📦',
    description:
      'Un cofre de madera sin cerradura descansa en medio del corredor, demasiado obvio para ser inofensivo. Pero el brillo que asoma por las ranuras es tentador.',
    choices: [
      {
        id: 'open',
        text: 'Abrir el cofre (−10 HP)',
        effects: [
          { type: 'lose-hp', value: 10 },
          { type: 'gain-gold', value: 75 },
        ],
        outcomeText:
          'El cofre explota en tu cara con una pequeña carga mágica. Maldiciendo, recogés del suelo un montón de monedas de oro salpicadas de ceniza.',
      },
      {
        id: 'ignore',
        text: 'Dejar el cofre donde está',
        effects: [],
        outcomeText:
          'Tu instinto de conservación vence a la codicia. Mientras te alejás, escuchás un clic seco y una pequeña explosión. Diste la elección correcta.',
      },
    ],
  },
  {
    id: 'cursed-well',
    title: 'El Pozo Maldito',
    icon: '🌀',
    description:
      'Un pozo de piedra emana un brillo violáceo. Una nota oxidada colgada del borde dice: «El que bebe gana y pierde a partes iguales». El agua oscila en calma.',
    choices: [
      {
        id: 'drink',
        text: 'Beber del pozo (−8 HP actual, +5 HP máximo)',
        effects: [
          { type: 'lose-hp', value: 8 },
          { type: 'gain-max-hp', value: 5 },
        ],
        outcomeText:
          'El agua quema en la garganta como hielo. Caés de rodillas unos segundos, pero cuando te levantás sentís una vitalidad extraña y duradera corriendo por tus venas.',
      },
      {
        id: 'ignore',
        text: 'No tocar el pozo',
        effects: [],
        outcomeText:
          'Decides que ninguna oferta que mezcle ganancia y pérdida merece la pena. Seguís tu camino con tu HP intacto.',
      },
    ],
  },
  {
    id: 'explorers-corpse',
    title: 'El Cadáver del Explorador',
    icon: '💀',
    description:
      'Un aventurero menos afortunado que vos yace contra la pared, su equipo aún intacto. El bolso a su lado parece pesado. Nadie lo reclamará.',
    choices: [
      {
        id: 'search',
        text: 'Registrar el cadáver',
        effects: [{ type: 'gain-gold', value: 100 }],
        outcomeText:
          'El bolso contiene monedas, un mapa inútil de este lugar y una nota que dice «cuidado con el cuarto piso». Te quedás con las monedas.',
      },
      {
        id: 'ignore',
        text: 'Dejarlo en paz',
        effects: [],
        outcomeText:
          'Respetás los restos del caído y seguís adelante. Quizá algún día alguien te devuelva el favor.',
      },
    ],
  },
  {
    id: 'ancient-writing',
    title: 'Las Inscripciones Antiguas',
    icon: '📜',
    description:
      'Ante vos aparece una pared cubierta de runas que pulsan con una tenue luz dorada. Una voz interior te urge a tocarlas. Otra te advierte que te comportés con prudencia.',
    choices: [
      {
        id: 'touch',
        text: 'Tocar las runas (arriesgar)',
        effects: [
          { type: 'lose-hp', value: 15 },
          { type: 'gain-gold', value: 175 },
          { type: 'gain-max-hp', value: 4 },
        ],
        outcomeText:
          'Las runas te atraviesan con un choque de energía pura. Caés al suelo jadeando, pero cuando te incorporás sentís algo dentro de vos diferente: más grande, más resistente.',
      },
      {
        id: 'study',
        text: 'Estudiarlas sin tocar (+5 HP)',
        effects: [{ type: 'gain-hp', value: 5 }],
        outcomeText:
          'Pasás varios minutos descifrandolas. No entendés todo, pero la contemplación serena llena tus pulmones de algo parecido a la esperanza. Sentís energía renovada.',
      },
    ],
  },
];
