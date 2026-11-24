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

const fresh: UnlockContext = { defeatedBossIds: [], rankLevel: 1, badges: [] };

describe('Frisuren, Bärte und Farben freischalten', () => {
  it('zum Start je 5 Frisuren, 5 Bärte und 5 gedeckte Farben', () => {
    const open = (cat: string) => TRAITS.filter((t) => t.category === cat && unlockStatus(t.unlock, fresh).unlocked).length;
    expect(open('hair')).toBe(5);
    expect(open('beard')).toBe(5);
    expect(HAIR_COLORS.filter((c) => unlockStatus(c.unlock, fresh).unlocked).map((c) => c.id)).toEqual(['schwarz', 'dunkelbraun', 'braun', 'hellbraun', 'dunkelblond']);
  });
  it('jede Frisur und jeder Bart hat eine Lage auf dem Kopf', () => {
    for (const t of TRAITS.filter((x) => x.category === 'hair' || x.category === 'beard')) expect(TRAIT_LAYOUT[traitFile(t)], t.id).toBeDefined();
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
    expect(bossRewards('gallia')).toEqual(['Frisur „Wellenmähne“', 'Bart „Gallischer Zwirbel“', 'Farbe „Kupfer“']);
  });
  it('gesperrte Auswahl fällt auf Grundschnitt bzw. Dunkelbraun zurück, Bartfarbe folgt der Haarfarbe', () => {
    expect(normalizeLook({ hair: 'wellenmaehne', beard: 'vollbart', hairColor: 'kupfer' }, fresh)).toEqual({ hair: null, beard: 'vollbart', hairColor: 'dunkelbraun', beardColor: 'dunkelbraun' });
    expect(normalizeLook({ hair: 'locken', hairColor: 'schwarz', beardColor: 'braun' }, fresh)).toEqual({ hair: 'locken', beard: null, hairColor: 'schwarz', beardColor: 'braun' });
  });
});
