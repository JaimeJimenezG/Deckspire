import { Inject, Injectable } from '@angular/core';
import { AppAssetUrlResolver } from '../app-asset-url.resolver';
import { LPC_SPRITESHEET_BASE_URL } from '../../di/tokens';
import type { LpcComposeResult } from '../../domain/ports/outbound/lpc-sprite-composer.port';
import type { LpcSpriteComposerPort } from '../../domain/ports/outbound/lpc-sprite-composer.port';
import type { LpcCreditLine } from '../../domain/models/lpc-credit.model';
import { fingerprintExportJson } from '../../domain/models/lpc-export.model';

function scriptLoadId(src: string): string {
  return `lpc-script-${fingerprintExportJson(src)}`;
}

type ComposeModule = {
  composeFromExportJson: (input: string) => Promise<{
    canvas: HTMLCanvasElement;
    credits: unknown[];
    sheetWidth: number;
    sheetHeight: number;
  }>;
};

/**
 * Carga `item-metadata.js` y el módulo `deckspire-compose.js` servidos bajo `/lpc-generator/`,
 * fija `window.__DECKSPIRE_LPC_BASE__` al origen de los PNG y compone el sheet en un lienzo offscreen.
 */
@Injectable({ providedIn: 'root' })
export class LpcBrowserComposerService implements LpcSpriteComposerPort {
  private metadataReady: Promise<void> | null = null;
  private composeModule: Promise<ComposeModule> | null = null;
  private readonly cache = new Map<string, LpcComposeResult>();

  constructor(
    @Inject(LPC_SPRITESHEET_BASE_URL) private readonly spriteSheetsBase: string,
    private readonly appAssets: AppAssetUrlResolver,
  ) {}

  async compose(exportJsonString: string): Promise<LpcComposeResult> {
    const key = fingerprintExportJson(exportJsonString);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const w = globalThis as unknown as {
      __DECKSPIRE_LPC_BASE__?: string;
      itemMetadata?: unknown;
    };
    w.__DECKSPIRE_LPC_BASE__ = this.normalizeBase(this.spriteSheetsBase);

    await this.ensureItemMetadata();
    const mod = await this.ensureComposeModule();
    const out = await mod.composeFromExportJson(exportJsonString);

    /**
     * El generador Universal LPC reutiliza un único lienzo global por composición.
     * Sin copia, el jugador y cada enemigo apuntarían al mismo elemento y el último
     * `renderCharacter` pisa los píxeles de los demás.
     */
    const textureHandle = this.snapshotLpcSheet(out.canvas);

    const credits = (out.credits ?? []) as LpcCreditLine[];
    const result: LpcComposeResult = {
      sheetWidth: out.sheetWidth,
      sheetHeight: out.sheetHeight,
      credits,
      textureHandle,
    };
    this.cache.set(key, result);
    return result;
  }

  private snapshotLpcSheet(source: HTMLCanvasElement): HTMLCanvasElement {
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('LPC: no se pudo crear el contexto para copiar el spritesheet');
    }
    ctx.drawImage(source, 0, 0);
    return copy;
  }

  private normalizeBase(url: string): string {
    const t = url.trim();
    return t.endsWith('/') ? t : `${t}/`;
  }

  private ensureItemMetadata(): Promise<void> {
    if (this.metadataReady) {
      return this.metadataReady;
    }
    const src = this.appAssets.resolve('lpc-generator/item-metadata.js');
    this.metadataReady = this.loadScriptOnce(src).then(() => {
      const w = globalThis as unknown as { itemMetadata?: unknown };
      if (!w.itemMetadata || typeof w.itemMetadata !== 'object') {
        throw new Error('LPC itemMetadata missing after script load');
      }
    });
    return this.metadataReady;
  }

  private ensureComposeModule(): Promise<ComposeModule> {
    if (this.composeModule) {
      return this.composeModule;
    }
    const url = this.appAssets.resolve('lpc-generator/sources/deckspire-compose.js');
    this.composeModule = import(/* webpackIgnore: true */ url).then(
      (m) => m as ComposeModule,
    );
    return this.composeModule;
  }

  private loadScriptOnce(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = scriptLoadId(src);
      if (document.getElementById(id)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`LPC: failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
}
