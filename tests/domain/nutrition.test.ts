import { describe, expect, it } from 'vitest';
import { checkKcal, completeness, kcalFromMacros, parseServingSize, recipeNutrition, saltFromSodium, scaleNutrients, sumNutrients, toGrams, toKcal } from '@/domain/nutrition';
import { ValidationError } from '@/domain/energy';

const p = { kcal: 150, protein: 10, carbs: 20, fat: 3.3 };

describe('Portionsskalierung', () => {
  it('AK-023: 200 g bei 150 kcal/100 g → 300 kcal', () => {
    expect(scaleNutrients(p, 200).kcal).toBe(300);
    expect(scaleNutrients(p, 200).fat).toBe(6.6);
  });
  it('Rundung: 33 g', () => {
    const s = scaleNutrients(p, 33);
    expect(s.kcal).toBe(50); // 49,5 → 50
    expect(s.protein).toBe(3.3);
  });
  it('AK-022: unbekannte Werte bleiben null', () => {
    const s = scaleNutrients({ kcal: 100, protein: null, carbs: 5, fat: null }, 50);
    expect(s.protein).toBeNull();
    expect(s.fat).toBeNull();
    expect(s.kcal).toBe(50);
  });
  it('ungültige Mengen', () => {
    expect(() => scaleNutrients(p, 0)).toThrow(ValidationError);
    expect(() => scaleNutrients(p, -1)).toThrow(ValidationError);
    expect(() => scaleNutrients(p, 20000)).toThrow(ValidationError);
  });
});

describe('Summen', () => {
  it('AK-038: Summe entspricht Einzelwerten, unbekannte werden gezählt', () => {
    const s = sumNutrients([{ kcal: 100, protein: 5, carbs: 10, fat: 2 }, { kcal: 250, protein: null, carbs: 30, fat: 10 }]);
    expect(s.totals.kcal).toBe(350);
    expect(s.totals.protein).toBe(5);
    expect(s.unknown.protein).toBe(1);
  });
});

describe('Kalorien aus Makros', () => {
  it('Atwater 4/4/9', () => {
    expect(kcalFromMacros({ kcal: null, protein: 10, carbs: 20, fat: 5 })).toBe(165);
    expect(kcalFromMacros({ kcal: null, protein: null, carbs: 20, fat: 5 })).toBeNull();
  });
  it('Abweichung Etikett vs. Makros wird markiert', () => {
    expect(checkKcal({ kcal: 100, protein: 10, carbs: 10, fat: 1 }).plausible).toBe(true); // 89
    expect(checkKcal({ kcal: 100, protein: 20, carbs: 30, fat: 10 }).plausible).toBe(false); // 290
  });
  it('Vollständigkeit', () => {
    expect(completeness(p)).toBe('complete');
    expect(completeness({ kcal: 50, protein: null, carbs: null, fat: null })).toBe('partial');
    expect(completeness({ kcal: null, protein: 1, carbs: null, fat: null })).toBe('insufficient');
  });
});

describe('Rezepte', () => {
  const recipe = {
    servings: 2,
    ingredients: [
      { foodId: 'a', name: 'Haferflocken', grams: 100, per100: { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 } },
      { foodId: 'b', name: 'Milch', grams: 300, per100: { kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.5 } },
    ],
  };
  it('AK-035: Nährwerte aus Zutaten', () => {
    const r = recipeNutrition(recipe);
    expect(r.total.kcal).toBe(372 + 192);
    expect(r.total.protein).toBeCloseTo(13.5 + 9.9, 5);
    expect(r.perServing.kcal).toBe(282);
    expect(r.totalGrams).toBe(400);
    expect(r.per100.kcal).toBe(141);
  });
  it('AK-036: Portionsanzahl ändert nur pro Portion', () => {
    const a = recipeNutrition(recipe);
    const b = recipeNutrition({ ...recipe, servings: 4 });
    expect(b.total.kcal).toBe(a.total.kcal);
    expect(b.perServing.kcal).toBe(141);
  });
  it('unbekannte Zutatenwerte werden ausgewiesen', () => {
    const r = recipeNutrition({ servings: 1, ingredients: [...recipe.ingredients, { foodId: 'c', name: 'Gewürz', grams: 5, per100: { kcal: null, protein: null, carbs: null, fat: null } }] });
    expect(r.unknownIngredients).toEqual(['Gewürz']);
  });
  it('ungültige Rezepte', () => {
    expect(() => recipeNutrition({ servings: 1, ingredients: [] })).toThrow(ValidationError);
    expect(() => recipeNutrition({ ...recipe, servings: 0 })).toThrow(ValidationError);
  });
});

describe('Einheiten', () => {
  it('kJ → kcal, mg → g, Natrium → Salz, Portionstext', () => {
    expect(toKcal(418.4, 'kJ')).toBeCloseTo(100, 5);
    expect(toGrams(500, 'mg')).toBe(0.5);
    expect(saltFromSodium(0.4)).toBe(1);
    expect(parseServingSize('1 Riegel (45 g)')).toBe(45);
    expect(parseServingSize('250ml')).toBe(250);
    expect(parseServingSize('1 Stück')).toBeNull();
    expect(() => toKcal(1, 'cal?')).toThrow();
  });
});
