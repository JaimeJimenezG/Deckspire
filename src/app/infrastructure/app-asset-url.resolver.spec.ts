import { TestBed } from '@angular/core/testing';
import { APP_BASE_HREF } from '@angular/common';
import { AppAssetUrlResolver } from './app-asset-url.resolver';

describe('AppAssetUrlResolver', () => {
  it('should prefix path when base href is a subpath', () => {
    TestBed.configureTestingModule({
      providers: [AppAssetUrlResolver, { provide: APP_BASE_HREF, useValue: '/game/' }],
    });
    const r = TestBed.inject(AppAssetUrlResolver);
    expect(r.resolve('lpc-presets/x.json')).toBe(
      `${globalThis.location.origin}/game/lpc-presets/x.json`,
    );
  });

  it('should resolve from root when base is /', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AppAssetUrlResolver, { provide: APP_BASE_HREF, useValue: '/' }],
    });
    const r = TestBed.inject(AppAssetUrlResolver);
    expect(r.resolve('lpc-generator/item-metadata.js')).toBe(
      `${globalThis.location.origin}/lpc-generator/item-metadata.js`,
    );
  });
});
