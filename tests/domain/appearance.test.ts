import { describe, expect, it } from 'vitest';
import { HEAD_ITEMS, TRAITS, figureFile, helmetHidesHair, traitFile } from '@/domain/appearance';

describe('Merkmal- und Helm-Ebenen', () => {
  it('haben eindeutige, saubere Dateinamen', () => {
    const files = [...TRAITS.map(traitFile), ...HEAD_ITEMS.map(figureFile)];
    expect(new Set(files).size).toBe(files.length);
    for (const f of files) expect(f).toMatch(/^[a-z0-9_-]+$/);
  });
  it('Helme verdecken die Frisur, Kränze und Diademe nicht', () => {
    expect(helmetHidesHair(HEAD_ITEMS.find((i) => i.id === 'galea')!)).toBe(true);
    expect(helmetHidesHair(HEAD_ITEMS.find((i) => i.id === 'lorbeerkranz-triumphator')!)).toBe(false);
  });
});
