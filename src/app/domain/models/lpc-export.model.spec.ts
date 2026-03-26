import {
  isLpcExportJsonV2,
  fingerprintExportJson,
  LPC_EXPORT_JSON_VERSION,
} from './lpc-export.model';

describe('isLpcExportJsonV2', () => {
  const valid = {
    version: LPC_EXPORT_JSON_VERSION,
    bodyType: 'male',
    selections: {
      body: { itemId: 'body', variant: 'light', name: 'Body color (light)' },
      head: {
        itemId: 'heads_human_male',
        variant: 'light',
        name: 'Human male (light)',
      },
      expression: { itemId: 'face_neutral', variant: 'light', name: 'Neutral (light)' },
    },
  };

  it('should accept a minimal v2 export', () => {
    expect(isLpcExportJsonV2(valid)).toBe(true);
  });

  it('should reject wrong version', () => {
    expect(isLpcExportJsonV2({ ...valid, version: 1 })).toBe(false);
  });

  it('should reject missing selections', () => {
    expect(isLpcExportJsonV2({ version: 2, bodyType: 'male', selections: {} })).toBe(false);
  });
});

describe('fingerprintExportJson', () => {
  it('should be deterministic', () => {
    const s = '{"a":1}';
    expect(fingerprintExportJson(s)).toBe(fingerprintExportJson(s));
  });

  it('should differ for different strings', () => {
    expect(fingerprintExportJson('a')).not.toBe(fingerprintExportJson('b'));
  });
});
