import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateStore } from '../../game-state.store';

/**
 * Pantalla de fin de partida. Se muestra cuando la fase llega a 'game-over'.
 * Soporta dos outcomes:
 *  - 'defeat'  → pantalla roja con calavera
 *  - 'victory' → pantalla dorada con corona
 * Muestra estadísticas de la run: planta, acto, mazo, reliquias, oro e HP final.
 */
@Component({
  selector: 'app-game-over',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-over.component.html',
  styleUrl: './game-over.component.scss',
})
export class GameOverComponent {
  private readonly store = inject(GameStateStore);

  // ── Outcome ──────────────────────────────────────────────────────────────
  readonly outcome = this.store.gameOutcome;
  readonly isVictory = computed(() => this.outcome() === 'victory');

  // ── Estadísticas de la run ────────────────────────────────────────────────
  readonly floor    = this.store.floor;
  readonly act      = this.store.act;
  readonly gold     = this.store.gold;
  readonly deckSize = computed(() => this.store.deck().length);
  readonly relicCount = computed(() => this.store.relics().length);

  /** HP del jugador al final (relevante en victoria). */
  readonly playerHp = computed(() => {
    const p = this.store.player();
    return { current: p.hp, max: p.maxHp };
  });

  // ── Acciones ──────────────────────────────────────────────────────────────

  /** Vuelve al menú principal (el save ya fue borrado por declareGameOver). */
  onReturnToMenu(): void {
    this.store.returnToMenu();
  }

  /** Inicia una nueva partida directamente desde la pantalla de game-over. */
  async onNewGame(): Promise<void> {
    await this.store.newGame();
  }
}
