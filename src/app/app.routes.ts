import { Routes } from '@angular/router';
import { GameContainerComponent } from './ui/components/game-container/game-container.component';
import { CreditsViewComponent } from './ui/components/credits-view/credits-view.component';

export const routes: Routes = [
  { path: '', component: GameContainerComponent },
  { path: 'credits', component: CreditsViewComponent },
];
