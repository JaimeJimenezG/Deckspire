import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { Card, CardType } from '../../../domain/models/card.model';
import { CardComponent } from '../card/card.component';
import { GameStateStore } from '../../game-state.store';

type DeckFilter = 'all' | CardType;

const FILTER_LABELS: Record<DeckFilter, string> = {
  all: 'Todas',
  attack: 'Ataques',
  skill: 'Habilidades',
  power: 'Poderes',
};

@Component({
  selector: 'app-deck-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  templateUrl: './deck-viewer.component.html',
  styleUrl: './deck-viewer.component.scss',
})
export class DeckViewerComponent {
  private readonly store = inject(GameStateStore);

  readonly visible = this.store.deckViewerOpen;

  /** Filtro de tipo activo. */
  readonly activeFilter = signal<DeckFilter>('all');

  readonly filters: DeckFilter[] = ['all', 'attack', 'skill', 'power'];

  /**
   * Mazo a mostrar: durante combate combina mano + pila de robo + descarte + exhaust
   * para que el jugador vea todas sus cartas. Fuera de combate usa el mazo maestro.
   */
  readonly allCards = computed<readonly Card[]>(() => {
    const combat = this.store.combat();
    if (combat) {
      const p = combat.player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.piles.discard,
        ...p.piles.exhaust,
      ];
    }
    return this.store.deck();
  });

  readonly filteredCards = computed<readonly Card[]>(() => {
    const filter = this.activeFilter();
    const cards = this.allCards();
    if (filter === 'all') return cards;
    return cards.filter(c => c.type === filter);
  });

  readonly cardCount = computed(() => this.allCards().length);

  readonly filteredCount = computed(() => this.filteredCards().length);

  /** Cuenta de cartas por tipo para mostrar badges en los botones de filtro. */
  readonly countByType = computed(() => {
    const cards = this.allCards();
    return {
      attack: cards.filter(c => c.type === 'attack').length,
      skill: cards.filter(c => c.type === 'skill').length,
      power: cards.filter(c => c.type === 'power').length,
    };
  });

  filterLabel(f: DeckFilter): string {
    return FILTER_LABELS[f];
  }

  filterCount(f: DeckFilter): number {
    if (f === 'all') return this.cardCount();
    return this.countByType()[f];
  }

  setFilter(f: DeckFilter): void {
    this.activeFilter.set(f);
  }

  close(): void {
    this.store.closeDeckViewer();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('deck-viewer__backdrop')) {
      this.close();
    }
  }
}
