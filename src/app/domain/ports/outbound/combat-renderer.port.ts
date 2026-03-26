import type { Card } from '../../models/card.model';
import type { CombatState } from '../../models/combat.model';

/** Opciones extra para `animateDamage` (p. ej. qué enemigo ataca al jugador). */
export interface AnimateDamageOptions {
  /** Índice 0-based en `CombatState.enemies` del atacante; solo aplica si el objetivo es el jugador. */
  readonly attackerEnemyIdx?: number;
}

/**
 * Puerto de salida para el renderizado del combate.
 *
 * Define el contrato que cualquier adaptador de renderizado debe implementar
 * (p.ej. CanvasCombatRenderer en la capa de infraestructura).
 * Los casos de uso de la capa de aplicación dependen de esta interfaz,
 * nunca de la implementación concreta.
 */
export interface CombatRendererPort {
  /**
   * Dibuja el estado completo de la escena de combate (enemigos, jugador, mano, energía).
   * Se llama una vez al entrar al combate y tras cada cambio de estado significativo.
   */
  renderScene(combat: CombatState): void;

  /**
   * Anima el impacto de daño sobre el combatiente en la posición indicada.
   * @param targetIdx - 0 = jugador; >= 1 = índice del enemigo en el array de enemigos.
   * @param amount    - Cantidad de daño infligido (ya descontado bloqueo).
   */
  animateDamage(
    targetIdx: number,
    amount: number,
    options?: AnimateDamageOptions,
  ): Promise<void>;

  /**
   * Anima la ganancia de bloqueo sobre el combatiente en la posición indicada.
   * @param targetIdx - 0 = jugador; >= 1 = índice del enemigo.
   * @param amount    - Cantidad de bloqueo ganado.
   */
  animateBlock(targetIdx: number, amount: number): Promise<void>;

  /**
   * Anima la muerte del combatiente en la posición indicada
   * (desvanecimiento, efecto de partículas, etc.).
   * @param targetIdx - 0 = jugador; >= 1 = índice del enemigo.
   */
  animateDeath(targetIdx: number): Promise<void>;

  /**
   * Anima el uso de una carta desde la mano del jugador.
   * Se reproduce antes de resolver los efectos de la carta.
   * @param card - La carta que se está jugando.
   */
  animateCardPlay(card: Card): Promise<void>;
}
