import { Inject, Injectable, Optional } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';

/**
 * Resuelve rutas de assets públicos respetando `<base href>` (p. ej. despliegue bajo /game/).
 * Evita `fetch('/lpc-presets/...')` roto cuando la app vive en un subpath.
 */
@Injectable({ providedIn: 'root' })
export class AppAssetUrlResolver {
  private readonly origin =
    typeof globalThis !== 'undefined' && 'location' in globalThis
      ? globalThis.location.origin
      : 'http://localhost';

  constructor(@Optional() @Inject(APP_BASE_HREF) private readonly appBaseHref: string | null) {}

  /**
   * @param path Ruta desde la raíz de la app sin dominio, p. ej. `lpc-presets/x.json`
   */
  resolve(path: string): string {
    const raw = (this.appBaseHref ?? '/').trim() || '/';
    const withSlash = raw.endsWith('/') ? raw : `${raw}/`;
    const relative = path.replace(/^\/+/, '');
    return new URL(relative, new URL(withSlash, this.origin)).href;
  }
}
