import { animate, style, transition, trigger } from '@angular/animations';

/**
 * Trigger de animación para las transiciones entre fases del juego.
 * Se aplica a los wrappers `.phase-panel` dentro del @switch de GameContainerComponent.
 *
 * Cada elemento entra (void → estado) y sale (estado → void) de forma independiente,
 * permitiendo que el elemento saliente y el entrante coexistan brevemente en el DOM
 * gracias al posicionamiento absoluto del `.phase-panel`.
 *
 * Fases con comportamiento especial:
 *  - main-menu : fade lento y ceremonioso
 *  - combat    : deslizamiento desde la derecha (sensación de acción)
 *  - reward    : ascenso hacia arriba (victoria)
 *  - game-over : fade dramático con ligero zoom-in
 *
 * El resto de fases usan la transición genérica: fade + slide suave.
 *
 * IMPORTANTE: las transiciones específicas (void => combat, etc.) deben
 * declararse ANTES de las genéricas (:enter / :leave) para que Angular
 * las evalúe primero.
 */
export const PHASE_TRANSITION = trigger('phaseTransition', [

  // ── GAME OVER ────────────────────────────────────────────────────────────
  transition('void => game-over', [
    style({ opacity: 0, transform: 'scale(1.06)' }),
    animate(
      '700ms 80ms cubic-bezier(0.16, 1, 0.3, 1)',
      style({ opacity: 1, transform: 'scale(1)' }),
    ),
  ]),
  transition('game-over => void', [
    animate(
      '350ms ease-in',
      style({ opacity: 0, transform: 'scale(0.97)' }),
    ),
  ]),

  // ── MENÚ PRINCIPAL ───────────────────────────────────────────────────────
  transition('void => main-menu', [
    style({ opacity: 0 }),
    animate('650ms ease-out', style({ opacity: 1 })),
  ]),
  transition('main-menu => void', [
    animate('450ms ease-in', style({ opacity: 0 })),
  ]),

  // ── COMBATE ──────────────────────────────────────────────────────────────
  transition('void => combat', [
    style({ opacity: 0, transform: 'translateX(48px)' }),
    animate(
      '380ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateX(0)' }),
    ),
  ]),
  transition('combat => void', [
    animate(
      '260ms ease-in',
      style({ opacity: 0, transform: 'translateX(-32px)' }),
    ),
  ]),

  // ── RECOMPENSA ───────────────────────────────────────────────────────────
  transition('void => reward', [
    style({ opacity: 0, transform: 'translateY(36px)' }),
    animate(
      '400ms 40ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateY(0)' }),
    ),
  ]),
  transition('reward => void', [
    animate(
      '240ms ease-in',
      style({ opacity: 0, transform: 'translateY(-20px)' }),
    ),
  ]),

  // ── MAPA ─────────────────────────────────────────────────────────────────
  transition('void => map', [
    style({ opacity: 0, transform: 'scale(0.96)' }),
    animate(
      '420ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'scale(1)' }),
    ),
  ]),
  transition('map => void', [
    animate(
      '260ms ease-in',
      style({ opacity: 0, transform: 'scale(1.02)' }),
    ),
  ]),

  // ── GENÉRICO (shop, rest, event…) ────────────────────────────────────────
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(18px)' }),
    animate(
      '350ms 50ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateY(0)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      '220ms cubic-bezier(0.55, 0, 1, 0.45)',
      style({ opacity: 0, transform: 'translateY(-10px)' }),
    ),
  ]),
]);
