import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { GameStateStore } from '../../game-state.store';
import type { EventChoice, EventChoiceCategory } from '../../../domain/models/event.model';

@Component({
  selector: 'app-event-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './event-view.component.html',
  styleUrl: './event-view.component.scss',
})
export class EventViewComponent {
  private readonly store = inject(GameStateStore);

  readonly eventState = this.store.event;

  readonly activeEvent = computed(() => this.eventState()?.event ?? null);

  readonly chosenId = computed(() => this.eventState()?.chosenId ?? null);

  readonly chosenChoice = computed(() => {
    const ev = this.activeEvent();
    const id = this.chosenId();
    if (!ev || !id) return null;
    return ev.choices.find(c => c.id === id) ?? null;
  });

  readonly isDone = computed(() => this.chosenId() !== null);

  categoryLabel(category: EventChoiceCategory): string {
    switch (category) {
      case 'good-now':   return '⚡ Ahora';
      case 'good-later': return '🌱 A largo plazo';
      case 'uncertain':  return '❓ Incierto';
    }
  }

  async choose(choice: EventChoice): Promise<void> {
    if (this.isDone()) return;
    await this.store.resolveEvent(choice.id);
  }

  leaveEvent(): void {
    this.store.leaveEvent();
  }
}
