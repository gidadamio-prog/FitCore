import { describe, expect, it } from 'vitest';
import { effectiveSplit, mealTargets, splitKcal } from '@/domain/nutrition';

const ids = ['breakfast', 'lunch', 'dinner', 'snack'];
const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('Kalorienziel je Mahlzeit', () => {
  it('Standardaufteilung 25/35/30/10 ergibt exakt das Tagesziel', () => {
    const m = splitKcal(2350, effectiveSplit(ids, {}));
    expect(Object.fromEntries(m)).toEqual({ breakfast: 588, lunch: 822, dinner: 705, snack: 235 });
    expect(sum(m)).toBe(2350);
  });

  it('Rundung verteilt Reste so, dass die Summe immer stimmt', () => {
    for (const total of [1, 999, 1777, 2001, 3333]) {
      const m = splitKcal(total, [{ id: 'a', pct: 1 }, { id: 'b', pct: 1 }, { id: 'c', pct: 1 }]);
      expect(sum(m)).toBe(total);
    }
  });

  it('Summe ≠ 100 % wird normiert, Summe 0 gleichmäßig verteilt', () => {
    expect(Object.fromEntries(splitKcal(2000, [{ id: 'a', pct: 30 }, { id: 'b', pct: 30 }]))).toEqual({ a: 1000, b: 1000 });
    expect(Object.fromEntries(splitKcal(2000, [{ id: 'a', pct: 0 }, { id: 'b', pct: 0 }]))).toEqual({ a: 1000, b: 1000 });
  });

  it('eigene Mahlzeiten starten mit 0 %, gespeicherte Werte gewinnen, negative Werte zählen als 0', () => {
    expect(effectiveSplit(['breakfast', 'custom-x'], { breakfast: -5 })).toEqual([
      { id: 'breakfast', pct: 0 },
      { id: 'custom-x', pct: 0 },
    ]);
    expect(effectiveSplit(['custom-x'], { 'custom-x': 15 })).toEqual([{ id: 'custom-x', pct: 15 }]);
  });

  it('ohne Einträge gibt es keine Anpassung', () => {
    const t = mealTargets(2000, effectiveSplit(ids, {}), new Map());
    expect(t.every((x) => x.adjusted == null && x.eaten == null)).toBe(true);
    expect(t.reduce((a, x) => a + x.planned, 0)).toBe(2000);
  });

  it('zu viel beim Frühstück senkt die offenen Ziele, sodass der Tag aufgeht', () => {
    const t = mealTargets(2000, effectiveSplit(ids, {}), new Map([['breakfast', 800]]));
    const open = t.filter((x) => x.id !== 'breakfast');
    expect(open.reduce((a, x) => a + (x.adjusted ?? x.planned), 0)).toBe(1200);
    expect(t.find((x) => x.id === 'lunch')?.adjusted).toBe(560); // 1200 × 35/75
    expect(t.find((x) => x.id === 'breakfast')).toMatchObject({ eaten: 800, adjusted: null });
  });

  it('Budget aufgebraucht → offene Ziele 0, nie negativ', () => {
    const t = mealTargets(2000, effectiveSplit(ids, {}), new Map([['breakfast', 2500]]));
    expect(t.filter((x) => x.id !== 'breakfast').every((x) => x.adjusted === 0)).toBe(true);
  });

  it('offene Mahlzeiten nur mit 0 % teilen sich den Rest gleichmäßig', () => {
    const shares = [{ id: 'a', pct: 100 }, { id: 'b', pct: 0 }, { id: 'c', pct: 0 }];
    const t = mealTargets(1000, shares, new Map([['a', 600]]));
    expect(t.find((x) => x.id === 'b')?.adjusted).toBe(200);
    expect(t.find((x) => x.id === 'c')?.adjusted).toBe(200);
  });

  it('gegessene Mahlzeiten behalten das Ziel, das beim Beginn galt (Reihenfolge zählt)', () => {
    // Frühstück 800 (Ziel 500), danach Mittag 560 (Ziel zu diesem Zeitpunkt 1200 × 35/75 = 560)
    const t = mealTargets(2000, effectiveSplit(ids, {}), new Map([['breakfast', 800], ['lunch', 560]]));
    const lunch = t.find((x) => x.id === 'lunch')!;
    expect(lunch).toMatchObject({ planned: 700, target: 560, adjusted: 560, eaten: 560, hit: true });
    expect(t.find((x) => x.id === 'breakfast')).toMatchObject({ target: 500, hit: false });
    // Rest 640 auf Abend:Snack = 30:10
    expect(t.find((x) => x.id === 'dinner')?.target).toBe(480);
    expect(t.find((x) => x.id === 'snack')?.target).toBe(160);
  });

  it('Punktlandung: ±10 %, mindestens ±20 kcal; Ziel 0 ist nie eine Punktlandung', () => {
    const shares = effectiveSplit(ids, {});
    const hit = (kcal: number) => mealTargets(2000, shares, new Map([['breakfast', kcal]])).find((x) => x.id === 'breakfast')!.hit;
    expect(hit(450)).toBe(true);
    expect(hit(550)).toBe(true);
    expect(hit(449)).toBe(false);
    expect(hit(551)).toBe(false);
    const small = mealTargets(150, shares, new Map([['snack', 34]])).find((x) => x.id === 'snack')!;
    expect(small.target).toBe(15);
    expect(small.hit).toBe(true); // |34 − 15| ≤ 20
    const zero = mealTargets(1000, shares, new Map([['breakfast', 1500], ['lunch', 0]])).find((x) => x.id === 'lunch')!;
    expect(zero).toMatchObject({ target: 0, hit: false });
  });

  it('unbekannte Mahlzeiten werden ignoriert', () => {
    const t = mealTargets(2000, effectiveSplit(ids, {}), new Map([['geloescht', 300]]));
    expect(t.every((x) => x.eaten == null && x.adjusted == null)).toBe(true);
  });
});
