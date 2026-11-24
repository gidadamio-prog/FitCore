import { describe, expect, it } from 'vitest';
import { baseState, per100For, prepProfile } from '@/domain/preparation';
import { searchBasicFoods } from '@/data/basicFoods';

const food = (name: string, kcal: number) => ({ name, unitBase: 'g' as const, per100: { kcal, protein: 7, carbs: 78, fat: 0.7 } });

describe('Zubereitung von Grundnahrungsmitteln', () => {
  it('erkennt Reis, Nudeln, Kartoffeln – aber keine Reiswaffeln, Kartoffelchips oder Tortellini', () => {
    expect(prepProfile(food('Basmati Reis', 350))?.id).toBe('rice');
    expect(prepProfile(food('Langkornreis', 350))?.id).toBe('rice');
    expect(prepProfile(food('Spaghetti No. 5', 360))?.id).toBe('pasta');
    expect(prepProfile(food('Kartoffeln festkochend', 70))?.id).toBe('potato');
    expect(prepProfile(food('Hähnchenbrustfilet', 110))?.id).toBe('poultry');
    expect(prepProfile(food('Reiswaffeln', 390))).toBeUndefined();
    expect(prepProfile(food('Kartoffelchips', 530))).toBeUndefined();
    expect(prepProfile(food('Tortellini Ricotta', 280))).toBeUndefined();
    expect(prepProfile({ ...food('Reisdrink', 50), unitBase: 'ml' })).toBeUndefined();
  });
  it('Bezugszustand: Packung trocken, gekochte Datensätze an kcal oder Namen erkennbar', () => {
    const rice = prepProfile(food('Reis', 350))!;
    expect(baseState(rice, food('Reis', 355)).id).toBe('raw');
    expect(baseState(rice, food('Reis', 130)).id).toBe('cooked');
    expect(baseState(rice, food('Rice, white, cooked', 400)).id).toBe('cooked');
  });
  it('rechnet trocken → gekocht (Reis ≈ 1/2,8 der Energie pro Gramm) und zurück', () => {
    const rice = prepProfile(food('Reis', 365))!;
    const [raw, cooked] = rice.states as [never, never];
    const c = per100For({ kcal: 365, protein: 7.1, carbs: 80, fat: 0.7, fiber: null }, raw, cooked);
    expect(c.kcal).toBeCloseTo(130.36, 1); // USDA gekocht: 130 kcal
    expect(c.fiber).toBeNull();
    expect(per100For({ kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, cooked, raw).kcal).toBeCloseTo(364, 0);
    const pasta = prepProfile(food('Penne', 371))!;
    expect(per100For({ kcal: 371, protein: 13, carbs: 75, fat: 1.5 }, pasta.states[0]!, pasta.states[1]!).kcal).toBeCloseTo(157.9, 0); // USDA gekocht: 158
  });
  it('Grundnahrungsmittel sind offline mit allen Suchwörtern findbar', () => {
    expect(searchBasicFoods('reis').map((f) => f.id)).toEqual(['basic:reis', 'basic:vollkornreis']);
    expect(searchBasicFoods('spaghetti')[0]?.id).toBe('basic:nudeln');
    expect(searchBasicFoods('hähnchen')[0]?.name).toBe('Hähnchenbrust');
    expect(searchBasicFoods('')).toEqual([]);
  });
});
