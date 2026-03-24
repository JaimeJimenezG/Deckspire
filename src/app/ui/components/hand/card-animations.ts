import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';

/**
 * Angular Animations trigger applied to the inner card wrapper (.hand__card-inner)
 * inside each fan slot in HandComponent.
 *
 * ── States ──────────────────────────────────────────────────────────────────
 *  'visible' – carta en mano (estado único mientras está en la lista)
 *
 * ── Transitions ─────────────────────────────────────────────────────────────
 *  void → visible   : robo (entra desde abajo con stagger por carta)
 *  visible → void   : descarte al final del turno (cae con stagger)
 */
export const CARD_WRAP_ANIM = trigger('cardWrap', [
  state('visible', style({ opacity: 1, transform: 'none' })),

  // ── DRAW: void → visible ────────────────────────────────────────────────
  transition(
    'void => visible',
    [
      style({ opacity: 0, transform: 'translateY(52px) scale(0.78)' }),
      animate(
        '360ms {{drawDelay}}ms cubic-bezier(0.22, 1, 0.36, 1)',
        style({ opacity: 1, transform: 'none' }),
      ),
    ],
    { params: { drawDelay: 0, discardDelay: 0 } },
  ),

  // ── DISCARD: visible → void (end of turn) ───────────────────────────────
  transition(
    'visible => void',
    [
      animate(
        '220ms {{discardDelay}}ms ease-in',
        style({ opacity: 0, transform: 'translateY(38px) scale(0.86)' }),
      ),
    ],
    { params: { drawDelay: 0, discardDelay: 0 } },
  ),
]);
