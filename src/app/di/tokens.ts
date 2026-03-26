import { InjectionToken } from '@angular/core';
import type { LpcSpriteComposerPort } from '../domain/ports/outbound/lpc-sprite-composer.port';

/** URL absoluta o relativa al host donde están los PNG bajo `spritesheets/` (p. ej. GitHub Pages del generador). */
export const LPC_SPRITESHEET_BASE_URL = new InjectionToken<string>('LPC_SPRITESHEET_BASE_URL', {
  providedIn: 'root',
  factory: () =>
    'https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/',
});

/** JSON export v2 bajo `public/`. null desactiva la carga del sprite LPC del jugador. */
export const PLAYER_LPC_PRESET_URL = new InjectionToken<string | null>('PLAYER_LPC_PRESET_URL', {
  providedIn: 'root',
  factory: () => '/lpc-presets/default-player.json',
});

export const LPC_SPRITE_COMPOSER = new InjectionToken<LpcSpriteComposerPort>('LPC_SPRITE_COMPOSER');
