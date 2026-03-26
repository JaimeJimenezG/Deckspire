import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Créditos obligatorios para arte LPC y nota sobre licencia del generador (GPL-3.0).
 */
@Component({
  selector: 'app-credits-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './credits-view.component.html',
  styleUrl: './credits-view.component.scss',
})
export class CreditsViewComponent {}
