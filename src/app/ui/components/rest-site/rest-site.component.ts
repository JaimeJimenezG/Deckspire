import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CardComponent } from '../card/card.component';
import { GameStateStore } from '../../game-state.store';

/** Acción actualmente seleccionada por el jugador en la hoguera. */
export type RestAction = 'none' | 'rest' | 'smith';

/** Fracción del HP máximo que se recupera al descansar (debe coincidir con RestUseCaseImpl). */
const REST_HEAL_FRACTION = 0.3;

@Component({
  selector: 'app-rest-site',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  templateUrl: './rest-site.component.html',
  styleUrl: './rest-site.component.scss',
})
export class RestSiteComponent {
  private readonly store = inject(GameStateStore);

  readonly player = this.store.player;
  readonly deck = this.store.deck;

  /** Acción seleccionada antes de confirmar. */
  readonly selectedAction = signal<RestAction>('none');

  /** True una vez que el jugador ha ejecutado su acción; bloquea nuevas selecciones. */
  readonly actionDone = signal(false);

  /** Cartas del mazo que todavía pueden mejorarse (no están en `upgraded`). */
  readonly upgradableCards = computed(() =>
    this.deck()
      .map((card, idx) => ({ card, idx }))
      .filter(({ card }) => !card.upgraded),
  );

  /** Puntos de vida que se recuperarían al descansar. */
  readonly healAmount = computed(() =>
    Math.floor(this.player().maxHp * REST_HEAL_FRACTION),
  );

  /** HP resultante tras descansar (con tope en maxHp). */
  readonly healedHp = computed(() =>
    Math.min(this.player().hp + this.healAmount(), this.player().maxHp),
  );

  selectRest(): void {
    if (this.actionDone()) return;
    this.selectedAction.set('rest');
  }

  selectSmith(): void {
    if (this.actionDone()) return;
    this.selectedAction.set('smith');
  }

  cancelSelection(): void {
    if (this.actionDone()) return;
    this.selectedAction.set('none');
  }

  async confirmRest(): Promise<void> {
    await this.store.rest();
    this.actionDone.set(true);
  }

  async smithCard(idx: number): Promise<void> {
    await this.store.smith(idx);
    this.actionDone.set(true);
  }

  skipRestSite(): void {
    this.store.leaveRestSite();
  }

  continueJourney(): void {
    this.store.leaveRestSite();
  }
}
