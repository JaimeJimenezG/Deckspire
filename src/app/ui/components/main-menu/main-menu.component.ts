import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import type { GameStats } from '../../../domain/models/game-state.model';
import { GameStateStore } from '../../game-state.store';

/**
 * Pantalla de menú principal. Adaptador driving que delega todas las
 * acciones al GameStateStore.
 *
 * Responsabilidades:
 *  - Mostrar los botones "Nueva partida", "Continuar" y "Estadísticas".
 *  - Mostrar "Continuar" sólo si hay una partida guardada.
 *  - Mostrar un panel de estadísticas acumuladas entre runs.
 *  - Comunicar estado de carga mientras los use cases procesan.
 */
@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-menu.component.html',
  styleUrl: './main-menu.component.scss',
})
export class MainMenuComponent implements OnInit {
  private readonly store = inject(GameStateStore);

  readonly hasSave = signal(false);
  readonly stats = signal<GameStats | null>(null);
  readonly loading = signal(false);
  readonly showStats = signal(false);

  async ngOnInit(): Promise<void> {
    const [hasSave, stats] = await Promise.all([
      this.store.checkSavedGame(),
      this.store.getStats(),
    ]);
    this.hasSave.set(hasSave);
    this.stats.set(stats);
  }

  async onNewGame(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      await this.store.newGame();
    } finally {
      this.loading.set(false);
    }
  }

  async onContinue(): Promise<void> {
    if (this.loading() || !this.hasSave()) return;
    this.loading.set(true);
    try {
      await this.store.loadGame();
    } finally {
      this.loading.set(false);
    }
  }

  toggleStats(): void {
    this.showStats.update(v => !v);
  }
}
