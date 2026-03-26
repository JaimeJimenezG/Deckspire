/**
 * Rutas estáticas bajo `public/sprites/` (copiadas a la raíz del sitio en build).
 *
 * Convención por categoría, p. ej. combate:
 * - `public/sprites/combat/<nombre>.png`
 * - `public/sprites/combat/<nombre>.manifest.json`
 */

export const SPRITES_PUBLIC_ROOT = '/sprites';

export function spriteCategoryUrl(category: string): string {
  const safe = category.replace(/^\/+|\/+$/g, '');
  return `${SPRITES_PUBLIC_ROOT}/${safe}`;
}

/** URL del manifiesto; `baseUrl` suele ser el resultado de `spriteCategoryUrl('combat')`. */
export function spriteManifestUrl(baseUrl: string, basename: string): string {
  const name = basename.replace(/\.manifest\.json$/i, '').replace(/\.json$/i, '');
  return `${baseUrl.replace(/\/+$/, '')}/${name}.manifest.json`;
}

/** Resuelve la URL de textura relativa al manifiesto (mismo directorio que el JSON). */
export function resolveTextureUrl(manifestUrl: string, textureRelative: string): string {
  const path = textureRelative.replace(/^\.\//, '');
  if (path.startsWith('/')) {
    return path;
  }
  const dirEnd = manifestUrl.lastIndexOf('/');
  const dir = dirEnd >= 0 ? manifestUrl.slice(0, dirEnd + 1) : '/';
  return `${dir}${path}`;
}
