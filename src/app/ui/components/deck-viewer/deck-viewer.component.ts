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
import { RELIC_DEFINITIONS } from '../../../domain/data/relics.data';

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

  readonly relics = this.store.relics;

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

  private formatRelicName(relicId: string): string {
    return relicId
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private hookLabel(
    hook:
      | 'combat-start'
      | 'player-turn-start'
      | 'player-turn-end'
      | 'combat-end-victory'
      | 'map-node-enter'
      | 'rest-site-enter',
  ): string {
    switch (hook) {
      case 'combat-start':
        return 'Inicio de combate';
      case 'player-turn-start':
        return 'Inicio de turno';
      case 'player-turn-end':
        return 'Fin de turno';
      case 'combat-end-victory':
        return 'Victoria';
      case 'map-node-enter':
        return 'Al entrar en un nodo';
      case 'rest-site-enter':
        return 'Al entrar al descanso';
    }
  }

  private effectToText(effect: (typeof RELIC_DEFINITIONS)[string]['passiveHooks'][number]['effect']): string {
    switch (effect.type) {
      case 'gain-energy':
        return `Gana ${effect.value} energía`;
      case 'gain-block':
        return `Gana ${effect.value} de bloque`;
      case 'draw-cards':
        return `Roba ${effect.value} cartas`;
      case 'heal':
        return `Cura ${effect.value} HP`;
      case 'apply-status':
        return `Aplica estado ${effect.status} (${effect.stacks} cargas) a ti`;
      case 'modify-relic-reward-count': {
        const sign = effect.value >= 0 ? '+' : '';
        return `Modifica recompensas (${effect.target}): ${sign}${effect.value}`;
      }
    }
  }

  private relicTooltip(relicId: string): string {
    const def = RELIC_DEFINITIONS[relicId];
    if (!def) return relicId;

    const passiveLines = def.passiveHooks.map(
      h => `${this.hookLabel(h.hook)}: ${this.effectToText(h.effect)}`,
    );

    const abilitiesPart = passiveLines.length
      ? `\n\nHabilidades:\n${passiveLines.join('\n')}`
      : '\n\nSin habilidades pasivas definidas.';

    return `${def.name}\n${def.description}${abilitiesPart}`;
  }

  readonly relicChips = computed<
    readonly { id: string; name: string; tooltip: string }[]
  >(() =>
    this.relics().map(id => {
      const def = RELIC_DEFINITIONS[id];
      return {
        id,
        name: def?.name ?? this.formatRelicName(id),
        tooltip: this.relicTooltip(id),
      };
    }),
  );

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
