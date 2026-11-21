import { describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { freshDb, onboard } from './helpers';
import { addEntry, copyDay, copyMeal, createCustomFood, deleteEntry, logRecipe, quickAdd, saveRecipe, searchLocalFoods, toggleFavorite, updateEntryAmount, logSavedMeal, saveMealFromEntries } from '@/data/nutritionRepo';
import { loadDaySummary } from '@/data/daySummary';
import { sumEntries } from '@/domain/nutrition';

async function foods() {
  const oat = await createCustomFood({ name: 'Haferflocken', unitBase: 'g', kcal: 372, protein: 13.5, carbs: 58.7, fat: 7, servingLabel: 'Portion', servingGrams: 50 });
  const milk = await createCustomFood({ name: 'Milch 3,5 %', unitBase: 'ml', kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.5 });
  return { oat, milk };
}

describe('Tagebuch (AK-024/029–033/038)', () => {
  it('eigene Lebensmittel erstellen und wiederfinden', async () => {
    await freshDb();
    const { oat } = await foods();
    expect((await searchLocalFoods('hafer'))[0]!.id).toBe(oat.id);
    await expect(createCustomFood({ name: '', unitBase: 'g', kcal: 1, protein: 0, carbs: 0, fat: 0 })).rejects.toThrow(/Namen/);
    await expect(createCustomFood({ name: 'x', unitBase: 'g', kcal: 100, protein: 60, carbs: 60, fat: 0 })).rejects.toThrow(/100 g/);
  });
  it('Zuordnung zu allen Mahlzeiten inkl. eigener; Summen aktualisieren sich', async () => {
    await freshDb();
    await onboard();
    const { oat, milk } = await foods();
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snack', 'custom-preworkout']) await addEntry({ date: '2026-01-01', meal, food: oat, amount: 100, unit: 'g' });
    let s = await loadDaySummary('2026-01-01');
    expect(s.sum.totals.kcal).toBe(1860);
    expect(new Set(s.entries.map((e) => e.meal)).size).toBe(5);
    const e = await addEntry({ date: '2026-01-01', meal: 'breakfast', food: milk, amount: 200, unit: 'ml' });
    s = await loadDaySummary('2026-01-01');
    expect(s.sum.totals.kcal).toBe(1860 + 128);
    await deleteEntry(e.id);
    s = await loadDaySummary('2026-01-01');
    expect(s.sum.totals.kcal).toBe(1860);
  });
  it('AK-031: Mengenänderung korrigiert Summen; Portionseinheit', async () => {
    await freshDb();
    const { oat } = await foods();
    const e = await addEntry({ date: '2026-01-01', meal: 'breakfast', food: oat, amount: 2, unit: 'serving', servingGrams: 50, servingLabel: 'Portion' });
    expect(e.grams).toBe(100);
    expect(e.nutrients.kcal).toBe(372);
    await updateEntryAmount(e.id, 150, 'g');
    const s = await loadDaySummary('2026-01-01');
    expect(s.sum.totals.kcal).toBe(558);
    expect(s.entries[0]!.grams).toBe(150);
  });
  it('AK-032: Mahlzeit/Tag kopieren ohne Originale zu verändern', async () => {
    await freshDb();
    const { oat, milk } = await foods();
    await addEntry({ date: '2026-01-01', meal: 'breakfast', food: oat, amount: 80, unit: 'g' });
    await addEntry({ date: '2026-01-01', meal: 'breakfast', food: milk, amount: 200, unit: 'ml' });
    await addEntry({ date: '2026-01-01', meal: 'dinner', food: oat, amount: 50, unit: 'g' });
    const before = await db.diary.where('date').equals('2026-01-01').toArray();
    expect(await copyMeal('2026-01-01', 'breakfast', '2026-01-02')).toBe(2);
    expect(await copyDay('2026-01-01', '2026-01-03')).toBe(3);
    const copied = await db.diary.where('date').equals('2026-01-02').toArray();
    await updateEntryAmount(copied[0]!.id, 10, 'g');
    const after = await db.diary.where('date').equals('2026-01-01').toArray();
    expect(after).toEqual(before);
    expect(sumEntries(await db.diary.where('date').equals('2026-01-03').toArray()).totals.kcal).toBe(sumEntries(before).totals.kcal);
  });
  it('AK-033: Favoriten und erneutes Buchen; Häufigkeit', async () => {
    await freshDb();
    const { oat } = await foods();
    await toggleFavorite(oat.id);
    const fav = await db.foods.where('favorite').equals(1).toArray();
    expect(fav.map((f) => f.id)).toEqual([oat.id]);
    await addEntry({ date: '2026-01-05', meal: 'snack', food: fav[0]!, amount: 30, unit: 'g' });
    expect((await db.foods.get(oat.id))!.useCount).toBe(1);
  });
  it('Schnellbuchung und gespeicherte Mahlzeiten', async () => {
    await freshDb();
    const { oat } = await foods();
    await quickAdd('2026-01-01', 'snack', 'Kuchen', { kcal: 350, protein: null, carbs: null, fat: null });
    await expect(quickAdd('2026-01-01', 'snack', 'x', { kcal: null, protein: null, carbs: null, fat: null })).rejects.toThrow();
    const e = await addEntry({ date: '2026-01-01', meal: 'breakfast', food: oat, amount: 80, unit: 'g' });
    const saved = await saveMealFromEntries('Frühstück Standard', [e]);
    await logSavedMeal(saved, '2026-01-09', 'breakfast');
    expect((await db.diary.where('date').equals('2026-01-09').toArray())[0]!.nutrients.kcal).toBe(e.nutrients.kcal);
  });
});

describe('Rezepte (AK-034–037)', () => {
  it('Rezept mit 2 Zutaten; Buchung bleibt bei späterer Änderung historisch stabil', async () => {
    await freshDb();
    const { oat, milk } = await foods();
    const r = await saveRecipe({
      name: 'Porridge', category: 'Frühstück', servings: 2, instructions: 'Kochen',
      ingredients: [
        { foodId: oat.id, name: oat.name, grams: 100, per100: oat.per100 },
        { foodId: milk.id, name: milk.name, grams: 300, per100: milk.per100 },
      ],
    });
    const e = await logRecipe('2026-01-01', 'breakfast', r, 1);
    expect(e.nutrients.kcal).toBe(282);
    await saveRecipe({ ...r, ingredients: [...r.ingredients, { foodId: oat.id, name: 'Extra Hafer', grams: 100, per100: oat.per100 }] });
    const stored = await db.diary.get(e.id);
    expect(stored!.nutrients.kcal).toBe(282);
    // Neu gebuchte Portion nutzt die neue Rezeptversion
    const r2 = (await db.recipes.get(r.id))!;
    expect((await logRecipe('2026-01-02', 'breakfast', r2, 1)).nutrients.kcal).toBe(468);
    // Mengenänderung eines historischen Rezepteintrags nutzt den Snapshot
    await updateEntryAmount(e.id, 2, 'serving');
    expect((await db.diary.get(e.id))!.nutrients.kcal).toBe(564);
  });
  it('Validierung', async () => {
    await freshDb();
    await expect(saveRecipe({ name: '', category: '', servings: 1, instructions: '', ingredients: [] })).rejects.toThrow();
  });
});
