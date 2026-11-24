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

import { HAIR_COLORS, bossRewards, normalizeLook, unlockStatus, type UnlockContext } from '@/domain/appearance';
import { TRAIT_LAYOUT } from '@/domain/traitLayout';
import { BODY_PARTS, HEAD_LAYOUT_EXTRA, SCAR_ASPECT } from '@/domain/bodyLayout';
import { SCAR_PLACE } from '@/domain/appearance';

const fresh: UnlockContext = { defeatedBossIds: [], rankLevel: 1, badges: [] };

describe('Frisuren, Bärte und Farben freischalten', () => {
  it('zum Start je 5 Frisuren, 5 Bärte und 5 gedeckte Farben', () => {
    const open = (cat: string) => TRAITS.filter((t) => t.category === cat && unlockStatus(t.unlock, fresh).unlocked).length;
    expect(open('hair')).toBe(5);
    expect(open('beard')).toBe(5);
    expect(HAIR_COLORS.filter((c) => unlockStatus(c.unlock, fresh).unlocked).map((c) => c.id)).toEqual(['schwarz', 'dunkelbraun', 'braun', 'hellbraun', 'dunkelblond']);
  });
  it('jede Kopf-Ebene hat eine Lage, jede Narbe einen Platz, jeder Körper seine Bereiche', () => {
    for (const t of TRAITS.filter((x) => ['hair', 'beard', 'eyes'].includes(x.category))) expect({ ...TRAIT_LAYOUT, ...HEAD_LAYOUT_EXTRA }[traitFile(t)], t.id).toBeDefined();
    for (const t of TRAITS.filter((x) => x.category === 'scar')) {
      expect(SCAR_PLACE[t.id], t.id).toBeDefined();
      expect(SCAR_ASPECT[t.id], t.id).toBeGreaterThan(0);
    }
    expect(Object.keys(BODY_PARTS)).toHaveLength(12);
    for (const parts of Object.values(BODY_PARTS)) for (const [l, t, w, h] of Object.values(parts)) {
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l + w).toBeLessThanOrEqual(100);
      expect(t + h).toBeLessThanOrEqual(100);
    }
  });
  it('zum Start 2 Tattoos, 3 Narben, 3 Brillen/Augenklappen; jeder Boss gibt ein Tattoo', () => {
    const open = (cat: string) => TRAITS.filter((t) => t.category === cat && unlockStatus(t.unlock, fresh).unlocked).length;
    expect([open('tattoo'), open('scar'), open('eyes')]).toEqual([2, 3, 3]);
    expect(TRAITS.filter((t) => t.category === 'tattoo' && t.unlock.kind === 'boss')).toHaveLength(13);
  });
  it('Boss, Rang und Abzeichen schalten frei; Hinweis nennt den Weg', () => {
    const w = TRAITS.find((t) => t.id === 'wellenmaehne')!;
    expect(unlockStatus(w.unlock, fresh)).toEqual({ unlocked: false, hint: 'Besiege Vercingetorix (Gallia)' });
    expect(unlockStatus(w.unlock, { ...fresh, defeatedBossIds: ['gallia'] }).unlocked).toBe(true);
    const u = TRAITS.find((t) => t.id === 'undercut')!;
    expect(unlockStatus(u.unlock, fresh).hint).toBe('Ab Rang Miles');
    expect(unlockStatus(u.unlock, { ...fresh, rankLevel: 2 }).unlocked).toBe(true);
    const k = TRAITS.find((t) => t.id === 'kasten')!;
    expect(unlockStatus(k.unlock, { ...fresh, badges: [{ id: 'workouts', name: 'Veteran', tier: 'bronze' }] })).toEqual({ unlocked: false, hint: 'Abzeichen Veteran Silber' });
    expect(unlockStatus(k.unlock, { ...fresh, badges: [{ id: 'workouts', name: 'Veteran', tier: 'gold' }] }).unlocked).toBe(true);
    expect(bossRewards('gallia')).toEqual(['Frisur „Wellenmähne“', 'Bart „Gallischer Zwirbel“', 'Tattoo „Kriegsrunen“', 'Farbe „Kupfer“']);
  });
  it('gesperrte Auswahl fällt auf Grundschnitt bzw. Dunkelbraun zurück, Bartfarbe folgt der Haarfarbe', () => {
    expect(normalizeLook({ hair: 'wellenmaehne', beard: 'vollbart', hairColor: 'kupfer' }, fresh)).toEqual({ hair: null, beard: 'vollbart', scar: null, tattoo: null, eyes: null, hairColor: 'dunkelbraun', beardColor: 'dunkelbraun' });
    expect(normalizeLook({ hair: 'locken', hairColor: 'schwarz', beardColor: 'braun' }, fresh)).toEqual({ hair: 'locken', beard: null, scar: null, tattoo: null, eyes: null, hairColor: 'schwarz', beardColor: 'braun' });
  });
});
