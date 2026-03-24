import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import type { Card } from '../../../domain/models/card.model';

const TYPE_LABELS: Record<string, string> = {
  attack: 'Ataque',
  skill: 'Habilidad',
  power: 'Poder',
};

const TYPE_SYMBOLS: Record<string, string> = {
  attack: '⚔',
  skill: '🛡',
  power: '✨',
};

@Component({
  selector: 'app-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  /** La carta a renderizar. */
  readonly card = input.required<Card>();

  /**
   * Si es true, la carta muestra un cursor de pointer y emite `cardClick`
   * al hacer clic. Usar false para vistas de solo lectura (mazo, tienda).
   */
  readonly playable = input<boolean>(false);

  /** Emitido cuando el jugador hace clic en una carta jugable. */
  readonly cardClick = output<Card>();

  /** Etiqueta visible del tipo de carta, derivada reactivamente del input. */
  readonly typeLabel = computed(() => TYPE_LABELS[this.card().type] ?? this.card().type);

  /** Símbolo que representa el tipo de carta en el área de arte. */
  readonly typeSymbol = computed(() => TYPE_SYMBOLS[this.card().type] ?? '?');

  onCardClick(): void {
    if (this.playable()) {
      this.cardClick.emit(this.card());
    }
  }
}
