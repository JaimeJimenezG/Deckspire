import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { ShopItem } from '../../../domain/models/shop.model';
import { CardComponent } from '../card/card.component';
import { GameStateStore } from '../../game-state.store';
import { RELIC_DEFINITIONS } from '../../../domain/data/relics.data';

@Component({
  selector: 'app-shop',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss',
})
export class ShopComponent {
  private readonly store = inject(GameStateStore);

  readonly shop = this.store.shop;
  readonly gold = this.store.gold;
  readonly deck = this.store.deck;

  /** Activo cuando el jugador está eligiendo una carta para eliminar del mazo. */
  readonly purgeMode = signal(false);

  readonly cardItems = computed(() =>
    this.shop()?.items.filter(i => i.type === 'card') ?? [],
  );

  readonly relicItems = computed(() =>
    this.shop()?.items.filter(i => i.type === 'relic') ?? [],
  );

  readonly purgePrice = computed(() => this.shop()?.purgePrice ?? 75);

  readonly deckWithIndex = computed(() =>
    this.deck().map((card, idx) => ({ card, idx })),
  );

  canAfford(price: number): boolean {
    return this.gold() >= price;
  }

  formatRelicName(relicId: string): string {
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

  private effectToText(
    effect: (typeof RELIC_DEFINITIONS)[string]['passiveHooks'][number]['effect'],
  ): string {
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

  relicTooltip(relicId: string): string {
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

  async buyCard(item: ShopItem): Promise<void> {
    if (item.sold || !this.canAfford(item.price)) return;
    await this.store.buyCard(item.id);
  }

  async buyRelic(item: ShopItem): Promise<void> {
    if (item.sold || !this.canAfford(item.price)) return;
    await this.store.buyRelic(item.id);
  }

  togglePurgeMode(): void {
    this.purgeMode.update(v => !v);
  }

  async purgeCard(idx: number): Promise<void> {
    await this.store.purgeCard(idx);
    this.purgeMode.set(false);
  }

  leave(): void {
    this.store.leaveShop();
  }
}
