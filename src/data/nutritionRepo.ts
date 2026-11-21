import { db } from './db';
import type { DiaryEntry, FoodItem, MealId, Nutrients, Recipe, SavedMeal } from '@/domain/types';
import { recipeNutrition, scaleNutrients, kcalFromMacros } from '@/domain/nutrition';
import { amountSchema, customFoodSchema } from '@/domain/schemas';
import { nowISO, uid } from '@/domain/dates';
import { z } from 'zod';

export async function upsertFood(food: FoodItem): Promise<FoodItem> {
  const existing = await db.foods.get(food.id);
  const merged: FoodItem = existing
    ? { ...food, favorite: existing.favorite, useCount: existing.useCount, lastUsedAt: existing.lastUsedAt, createdAt: existing.createdAt }
    : food;
  await db.foods.put(merged);
  return merged;
}

export type CustomFoodInput = z.input<typeof customFoodSchema>;

export async function createCustomFood(input: CustomFoodInput, id?: string): Promise<FoodItem> {
  const f = customFoodSchema.parse(input);
  const per100: Nutrients = { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber ?? null, sugar: f.sugar ?? null, salt: f.salt ?? null };
  const food: FoodItem = {
    id: id ?? 'custom:' + uid(),
    name: f.name,
    brand: f.brand || undefined,
    barcode: f.barcode,
    source: 'custom',
    unitBase: f.unitBase,
    per100,
    kcalOrigin: f.kcal != null ? 'label' : kcalFromMacros(per100) != null ? 'computed' : 'unknown',
    servings: f.servingGrams ? [{ label: f.servingLabel || 'Portion', grams: f.servingGrams }] : [],
    favorite: 0,
    useCount: 0,
    createdAt: nowISO(),
  };
  return upsertFood(food);
}

export async function findLocalByBarcode(code: string): Promise<FoodItem | undefined> {
  return db.foods.where('barcode').equals(code).first();
}

export async function searchLocalFoods(q: string, limit = 30): Promise<FoodItem[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const all = await db.foods.toArray();
  return all
    .filter((f) => (f.name + ' ' + (f.brand ?? '')).toLowerCase().includes(needle))
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, limit);
}

export async function toggleFavorite(foodId: string) {
  const f = await db.foods.get(foodId);
  if (!f) return;
  await db.foods.update(foodId, { favorite: f.favorite ? 0 : 1 });
}

export interface AddEntryInput {
  date: string;
  meal: MealId;
  food: FoodItem;
  amount: number;
  unit: 'g' | 'ml' | 'serving';
  servingLabel?: string;
  /** Gramm je Portion, wenn unit = serving */
  servingGrams?: number;
}

export function gramsFor(amount: number, unit: 'g' | 'ml' | 'serving', servingGrams?: number): number {
  amountSchema.parse(amount);
  if (unit === 'serving') {
    if (!servingGrams || servingGrams <= 0) throw new Error('Portionsgröße unbekannt.');
    return Math.round(amount * servingGrams * 100) / 100;
  }
  return amount;
}

export async function addEntry(i: AddEntryInput): Promise<DiaryEntry> {
  const grams = gramsFor(i.amount, i.unit, i.servingGrams);
  const ts = nowISO();
  const entry: DiaryEntry = {
    id: uid(),
    date: i.date,
    meal: i.meal,
    foodId: i.food.id,
    name: i.food.name,
    brand: i.food.brand,
    source: i.food.source,
    amount: i.amount,
    unit: i.unit,
    servingLabel: i.servingLabel,
    grams,
    per100: { ...i.food.per100 },
    nutrients: scaleNutrients(i.food.per100, grams),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.transaction('rw', db.diary, db.foods, async () => {
    if (!(await db.foods.get(i.food.id))) await db.foods.put(i.food);
    await db.diary.add(entry);
    await db.foods.where('id').equals(i.food.id).modify((f) => {
      f.useCount = (f.useCount ?? 0) + 1;
      f.lastUsedAt = ts;
    });
  });
  return entry;
}

/** Menge eines Eintrags ändern – Neuberechnung aus dem gespeicherten Snapshot (nicht aus geänderter Vorlage). */
export async function updateEntryAmount(id: string, amount: number, unit: 'g' | 'ml' | 'serving', servingGrams?: number, meal?: MealId) {
  const e = await db.diary.get(id);
  if (!e) throw new Error('Eintrag nicht gefunden.');
  let grams: number;
  if (e.recipeId && unit === 'serving') {
    // Rezepteinträge: Portionsgröße aus dem ursprünglichen Snapshot (grams/amount)
    const perServing = e.grams / e.amount;
    grams = gramsFor(amount, 'serving', perServing);
  } else grams = gramsFor(amount, unit, servingGrams ?? (e.unit === 'serving' ? e.grams / e.amount : undefined));
  await db.diary.update(id, { amount, unit, grams, nutrients: scaleNutrients(e.per100, grams), meal: meal ?? e.meal, updatedAt: nowISO() });
}

export async function deleteEntry(id: string) {
  await db.diary.delete(id);
}

export async function quickAdd(date: string, meal: MealId, name: string, n: Nutrients) {
  if (n.kcal == null || !(n.kcal >= 0) || n.kcal > 10000) throw new Error('Bitte gültige Kalorien angeben (0–10000).');
  const ts = nowISO();
  const e: DiaryEntry = {
    id: uid(),
    date,
    meal,
    name: name.trim() || 'Schnellbuchung',
    source: 'quick',
    amount: 1,
    unit: 'serving',
    servingLabel: 'Eintrag',
    grams: 100,
    per100: n,
    nutrients: { ...n },
    createdAt: ts,
    updatedAt: ts,
  };
  await db.diary.add(e);
  return e;
}

function cloneEntry(e: DiaryEntry, date: string, meal: MealId): DiaryEntry {
  const ts = nowISO();
  return { ...structuredClone(e), id: uid(), date, meal, createdAt: ts, updatedAt: ts };
}

export async function copyMeal(fromDate: string, fromMeal: MealId, toDate: string, toMeal: MealId = fromMeal) {
  const src = await db.diary.where('[date+meal]').equals([fromDate, fromMeal]).toArray();
  const copies = src.map((e) => cloneEntry(e, toDate, toMeal));
  await db.diary.bulkAdd(copies);
  return copies.length;
}

export async function copyDay(fromDate: string, toDate: string) {
  const src = await db.diary.where('date').equals(fromDate).toArray();
  const copies = src.map((e) => cloneEntry(e, toDate, e.meal));
  await db.diary.bulkAdd(copies);
  return copies.length;
}

export async function copyEntry(id: string, toDate: string, toMeal?: MealId) {
  const e = await db.diary.get(id);
  if (!e) return;
  await db.diary.add(cloneEntry(e, toDate, toMeal ?? e.meal));
}

// ---------- Rezepte ----------

export async function saveRecipe(r: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Recipe> {
  if (!r.name.trim()) throw new Error('Bitte einen Rezeptnamen angeben.');
  if (r.ingredients.length < 1) throw new Error('Ein Rezept braucht mindestens eine Zutat.');
  recipeNutrition(r); // validiert Mengen & Portionen
  const ts = nowISO();
  const existing = r.id ? await db.recipes.get(r.id) : undefined;
  const recipe: Recipe = { ...r, id: r.id ?? uid(), createdAt: existing?.createdAt ?? ts, updatedAt: ts };
  await db.recipes.put(recipe);
  return recipe;
}

export async function deleteRecipe(id: string) {
  await db.recipes.delete(id);
}

/** Bucht Rezeptportionen als Snapshot – spätere Rezeptänderungen ändern diesen Eintrag nicht. */
export async function logRecipe(date: string, meal: MealId, recipe: Recipe, servings: number) {
  amountSchema.parse(servings);
  const n = recipeNutrition(recipe);
  const gramsPerServing = n.totalGrams / recipe.servings;
  const grams = Math.round(gramsPerServing * servings * 100) / 100;
  const ts = nowISO();
  const e: DiaryEntry = {
    id: uid(),
    date,
    meal,
    recipeId: recipe.id,
    name: recipe.name,
    source: 'recipe',
    amount: servings,
    unit: 'serving',
    servingLabel: 'Portion',
    grams,
    per100: n.per100,
    nutrients: scaleNutrients(n.per100, grams),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.diary.add(e);
  return e;
}

// ---------- Gespeicherte Mahlzeiten ----------

export async function saveMealFromEntries(name: string, entries: DiaryEntry[]) {
  if (!name.trim()) throw new Error('Bitte einen Namen angeben.');
  if (!entries.length) throw new Error('Die Mahlzeit ist leer.');
  const m: SavedMeal = {
    id: uid(),
    name: name.trim(),
    items: entries.map(({ id: _i, date: _d, meal: _m, createdAt: _c, updatedAt: _u, ...rest }) => structuredClone(rest)),
    createdAt: nowISO(),
  };
  await db.savedMeals.add(m);
  return m;
}

export async function logSavedMeal(saved: SavedMeal, date: string, meal: MealId) {
  const ts = nowISO();
  const entries: DiaryEntry[] = saved.items.map((i) => ({ ...structuredClone(i), id: uid(), date, meal, createdAt: ts, updatedAt: ts }));
  await db.diary.bulkAdd(entries);
  return entries.length;
}

// ---------- Wasser ----------

export async function addWater(date: string, ml: number) {
  if (!(ml > 0 && ml <= 5000)) throw new Error('Menge muss zwischen 1 und 5000 ml liegen.');
  await db.water.add({ id: uid(), date, ml, createdAt: nowISO() });
}

export async function undoLastWater(date: string) {
  const list = await db.water.where('date').equals(date).sortBy('createdAt');
  const last = list[list.length - 1];
  if (last) await db.water.delete(last.id);
}

// ---------- Wochenplanung & Einkaufsliste ----------

export async function addMealPlanItem(item: Omit<import('@/domain/types').MealPlanItem, 'id'>) {
  await db.mealPlan.add({ ...item, id: uid() });
}

export async function generateShoppingList(from: string, to: string) {
  const items = await db.mealPlan.where('date').between(from, to, true, true).toArray();
  const totals = new Map<string, number>();
  for (const it of items) {
    if (it.recipeId) {
      const r = await db.recipes.get(it.recipeId);
      if (!r) continue;
      const factor = (it.servings ?? 1) / r.servings;
      for (const ing of r.ingredients) totals.set(ing.name, (totals.get(ing.name) ?? 0) + ing.grams * factor);
    } else if (it.name) totals.set(it.name, (totals.get(it.name) ?? 0) + (it.grams ?? 0));
  }
  const ts = nowISO();
  const list = [...totals.entries()].map(([name, grams]) => ({ id: uid(), name, grams: Math.round(grams) || undefined, checked: false, createdAt: ts }));
  await db.shopping.bulkAdd(list);
  return list.length;
}
