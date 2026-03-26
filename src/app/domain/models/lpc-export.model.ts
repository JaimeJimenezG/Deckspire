/**
 * Subconjunto del JSON exportado por Universal LPC (versión 2).
 * @see third-party/Universal-LPC-Spritesheet-Character-Generator/sources/state/json.js
 */

export const LPC_EXPORT_JSON_VERSION = 2 as const;

/** Una pieza seleccionada en el generador LPC. */
export interface LpcSelectionEntry {
  readonly itemId: string;
  readonly variant: string;
  readonly name: string;
}

export interface LpcExportJsonV2 {
  readonly version: typeof LPC_EXPORT_JSON_VERSION;
  readonly bodyType: string;
  readonly selections: Readonly<Record<string, LpcSelectionEntry>>;
  readonly selectedAnimation?: string;
}

export function isLpcSelectionEntry(value: unknown): value is LpcSelectionEntry {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o['itemId'] === 'string' &&
    o['itemId'].length > 0 &&
    typeof o['variant'] === 'string' &&
    typeof o['name'] === 'string'
  );
}

export function isLpcExportJsonV2(value: unknown): value is LpcExportJsonV2 {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  if (o['version'] !== LPC_EXPORT_JSON_VERSION) return false;
  if (typeof o['bodyType'] !== 'string' || o['bodyType'].length === 0) return false;
  const sel = o['selections'];
  if (typeof sel !== 'object' || sel === null) return false;
  const entries = Object.values(sel as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every(isLpcSelectionEntry);
}

/**
 * Huella estable para caché de composición (no criptográfica).
 */
export function fingerprintExportJson(jsonString: string): string {
  let h = 5381;
  for (let i = 0; i < jsonString.length; i++) {
    h = (h * 33) ^ jsonString.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}
