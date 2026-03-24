import { Component } from '@angular/core';
import { GameContainerComponent } from './ui/components/game-container/game-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GameContainerComponent],
  template: '<app-game-container />',
  styles: [':host { display: block; width: 100%; height: 100%; }'],
})
export class AppComponent {}
