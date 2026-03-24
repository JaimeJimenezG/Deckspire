import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import type { Card } from '../../../domain/models/card.model';
import { CardComponent } from '../card/card.component';
import { GameStateStore } from '../../game-state.store';

@Component({
  selector: 'app-reward',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  templateUrl: './reward.component.html',
  styleUrl: './reward.component.scss',
})
export class RewardComponent {
  private readonly store = inject(GameStateStore);

  /** Estado de la recompensa activa. null fuera de la fase reward. */
  readonly reward = this.store.reward;

  async pickCard(card: Card): Promise<void> {
    await this.store.pickRewardCard(card);
  }

  async skip(): Promise<void> {
    await this.store.skipReward();
  }
}
