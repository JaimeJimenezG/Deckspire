import type { LpcCreditLine } from '../../models/lpc-credit.model';

/**
 * Resultado opaco: la infra expone un lienzo u otra fuente raster; solo el adapter de canvas lo interpreta.
 */
export type LpcComposedTextureHandle = unknown;

export interface LpcComposeResult {
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly credits: readonly LpcCreditLine[];
  readonly textureHandle: LpcComposedTextureHandle;
}

/**
 * Puerto de salida: compone el spritesheet Universal LPC a partir del JSON de exportación (v2).
 */
export interface LpcSpriteComposerPort {
  /**
   * @param exportJsonString JSON completo como genera “Export to Clipboard (JSON)” (versión 2).
   */
  compose(exportJsonString: string): Promise<LpcComposeResult>;
}
