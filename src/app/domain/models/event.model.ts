/** Tipos de efecto que puede aplicar la elección de un evento. */
export type EventEffectType =
  | 'gain-gold'
  | 'lose-gold'
  | 'gain-hp'
  | 'lose-hp'
  | 'gain-max-hp'
  | 'lose-max-hp'
  /** Concede N reliquias aleatorias al jugador cuando derrota al boss del acto. */
  | 'gain-relic-post-boss';

/**
 * Categoría visual de una elección de evento.
 * Solo se establece para las elecciones del evento de primer nodo.
 */
export type EventChoiceCategory = 'good-now' | 'good-later' | 'uncertain';

/** Efecto concreto que aplica una elección de evento. */
export interface EventEffect {
  readonly type: EventEffectType;
  readonly value: number;
}

/** Una opción que el jugador puede elegir en un evento. */
export interface EventChoice {
  readonly id: string;
  /** Texto del botón de elección. */
  readonly text: string;
  /** Efectos aplicados al elegir esta opción. */
  readonly effects: readonly EventEffect[];
  /** Texto narrativo mostrado tras confirmar la elección. */
  readonly outcomeText: string;
  /**
   * Categoría visual de la elección.
   * Solo presente en las elecciones del evento de primer nodo ('origin-pact').
   */
  readonly category?: EventChoiceCategory;
}

/** Definición estática de un evento del juego. */
export interface GameEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly choices: readonly EventChoice[];
}

/**
 * Estado del evento activo durante la fase 'event'.
 * `chosenId` es null mientras el jugador no ha elegido ninguna opción.
 */
export interface EventState {
  readonly event: GameEvent;
  readonly chosenId: string | null;
}
