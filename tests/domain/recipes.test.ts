import { describe, expect, it } from 'vitest';
import { BASIC_BY_ID, searchBasicFoods } from '@/data/basicFoods';
import { recipeNutrition } from '@/domain/nutrition';
import { ingredientFrom } from '@/pages/nutrition/Recipes';

describe('Rezepte: Stück, Grundnahrungsmittel, Fertiggewicht', () => {
  it('Eier in S/M/L/XL (essbarer Anteil), neue Zutat startet mit 1 Ei M', () => {
    const ei = BASIC_BY_ID.get('basic:ei')!;
    expect(ei.servings.map((s) => [s.label, s.grams, s.piece])).toEqual([
      ['Ei S', 45, true],
      ['Ei M', 52, true],
      ['Ei L', 60, true],
      ['Ei XL', 67, true],
    ]);
    expect(ingredientFrom(ei)).toMatchObject({ servingIdx: 1, count: 1, grams: 52 });
    expect(ingredientFrom(BASIC_BY_ID.get('basic:zwiebel')!)).toMatchObject({ servingIdx: 0, count: 1, grams: 80 });
    expect(ingredientFrom(BASIC_BY_ID.get('basic:weizenmehl')!)).toMatchObject({ grams: 100 });
    expect(ingredientFrom(BASIC_BY_ID.get('basic:weizenmehl')!).servingIdx).toBeUndefined();
  });
  it('Backen und Kochen: Mehl, Zucker, Sahne, Zwiebel … werden gefunden', () => {
    for (const q of ['mehl', 'zucker', 'sahne', 'zwiebel', 'knoblauch', 'käse', 'backpulver']) expect(searchBasicFoods(q).length, q).toBeGreaterThan(0);
    expect(searchBasicFoods('mehl').map((f) => f.name)).toContain('Weizenmehl Type 405');
  });
  it('Fertiggewicht: Portion und je 100 g beziehen sich auf das fertige Gericht', () => {
    const ing = [{ foodId: 'x', name: 'Reis', grams: 200, per100: { kcal: 350, protein: 7, carbs: 78, fat: 1 } }];
    const raw = recipeNutrition({ ingredients: ing, servings: 2 });
    const cooked = recipeNutrition({ ingredients: ing, servings: 2, cookedGrams: 560 });
    expect(raw.dishGrams).toBe(200);
    expect(cooked.dishGrams).toBe(560);
    expect(cooked.perServing.kcal).toBe(raw.perServing.kcal);
    expect(cooked.per100.kcal).toBe(125);
  });
});
