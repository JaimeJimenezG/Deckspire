import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateStore } from '../../game-state.store';
import { MainMenuComponent } from '../main-menu/main-menu.component';
import { MapViewComponent } from '../map-view/map-view.component';
import { CombatViewComponent } from '../combat-view/combat-view.component';
import { ShopComponent } from '../shop/shop.component';
import { RestSiteComponent } from '../rest-site/rest-site.component';
import { RewardComponent } from '../reward/reward.component';
import { GameOverComponent } from '../game-over/game-over.component';
import { EventViewComponent } from '../event-view/event-view.component';
import { DeckViewerComponent } from '../deck-viewer/deck-viewer.component';
import { PlayerStatusBarComponent } from '../player-status-bar/player-status-bar.component';
import { PHASE_TRANSITION } from '../../phase-transition.animations';

/**
 * Contenedor raíz del juego. Renderiza la vista correspondiente a la fase
 * activa del GameStateStore mediante un switch reactivo sobre el signal `phase`.
 *
 * Fases:
 *  - 'main-menu'  → MainMenuComponent
 *  - 'map'        → MapViewComponent
 *  - 'combat'     → CombatViewComponent
 *  - 'shop'       → ShopComponent
 *  - 'rest'       → RestSiteComponent
 *  - 'reward'     → RewardComponent
 *  - 'event'      → EventViewComponent
 *  - 'game-over'  → GameOverComponent
 *
 * Cada fase envuelve su componente en un `.phase-panel` con el trigger
 * `@phaseTransition`, que aplica animaciones de entrada/salida adaptadas
 * al contexto narrativo de la transición (combate → deslizamiento lateral,
 * recompensa → ascenso, game-over → zoom oscuro, etc.).
 */
@Component({
  selector: 'app-game-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MainMenuComponent,
    MapViewComponent,
    CombatViewComponent,
    ShopComponent,
    RestSiteComponent,
    RewardComponent,
    GameOverComponent,
    EventViewComponent,
    DeckViewerComponent,
    PlayerStatusBarComponent,
  ],
  templateUrl: './game-container.component.html',
  styleUrl: './game-container.component.scss',
  animations: [PHASE_TRANSITION],
})
export class GameContainerComponent {
  private readonly store = inject(GameStateStore);

  readonly phase = this.store.phase;

  /** La barra de estado se muestra en todas las fases excepto el menú principal. */
  readonly showStatusBar = computed(() => this.phase() !== 'main-menu');

  /** El botón "Ver Mazo" se muestra en todas las fases excepto menú principal y game-over. */
  readonly showDeckButton = computed(() => {
    const p = this.phase();
    return p !== 'main-menu' && p !== 'game-over';
  });

  openDeckViewer(): void {
    this.store.openDeckViewer();
  }
}
