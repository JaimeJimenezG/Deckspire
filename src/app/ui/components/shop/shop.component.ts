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
