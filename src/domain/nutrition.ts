// Nährwertberechnung: Portionsskalierung, Summen, Rezepte, Vollständigkeit.
import type { DiaryEntry, Nutrients, Recipe, RecipeIngredient } from './types';
import { ValidationError } from './energy';

export const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt', 'satFat'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export const CORE_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const;

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  kcal: 'Kalorien',
  protein: 'Protein',
  carbs: 'Kohlenhydrate',
  fat: 'Fett',
  fiber: 'Ballaststoffe',
  sugar: 'Zucker',
  salt: 'Salz',
  satFat: 'Gesättigte Fettsäuren',
};

export const emptyNutrients = (): Nutrients => ({ kcal: null, protein: null, carbs: null, fat: null });
export const zeroNutrients = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0, satFat: 0 });

/** Rundung für Anzeige und Speicherung (eine Nachkommastelle, kcal ganzzahlig). */
export function roundNutrient(key: NutrientKey, v: number): number {
  if (key === 'kcal') return Math.round(v);
  if (key === 'salt') return Math.round(v * 100) / 100;
  return Math.round(v * 10) / 10;
}

/** Skaliert Werte pro 100 g/ml auf eine Menge. Unbekannte Werte bleiben unbekannt (null). */
export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  if (!Number.isFinite(grams) || grams <= 0) throw new ValidationError('Menge muss größer als 0 sein.');
  if (grams > 10000) throw new ValidationError('Menge ist unplausibel groß (max. 10 kg).');
  const out: Nutrients = emptyNutrients();
  for (const k of NUTRIENT_KEYS) {
    const v = per100[k];
    if (v === undefined) continue;
    out[k] = v === null ? null : roundNutrient(k, (v * grams) / 100);
  }
  return out;
}

export interface NutrientSum {
  totals: Required<{ [K in NutrientKey]: number }>;
  /** Anzahl Einträge, bei denen der jeweilige Wert unbekannt war. */
  unknown: Record<NutrientKey, number>;
  count: number;
}

export function sumNutrients(list: Nutrients[]): NutrientSum {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0, satFat: 0 };
  const unknown = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0, satFat: 0 };
  for (const n of list) {
    for (const k of NUTRIENT_KEYS) {
      const v = n[k];
      if (v === null || v === undefined) {
        if (k === 'kcal' || k === 'protein' || k === 'carbs' || k === 'fat' || v === null) unknown[k]++;
      } else totals[k] += v;
    }
  }
  for (const k of NUTRIENT_KEYS) totals[k] = roundNutrient(k, totals[k]);
  return { totals, unknown, count: list.length };
}

export function sumEntries(entries: Pick<DiaryEntry, 'nutrients'>[]): NutrientSum {
  return sumNutrients(entries.map((e) => e.nutrients));
}

/** kcal nach Atwater aus Makros (4/4/9). Ballaststoffe werden nicht berücksichtigt (EU: 2 kcal/g – siehe Doku). */
export function kcalFromMacros(n: Nutrients): number | null {
  if (n.protein == null || n.carbs == null || n.fat == null) return null;
  return Math.round(n.protein * 4 + n.carbs * 4 + n.fat * 9);
}

export interface KcalCheck {
  label: number | null;
  computed: number | null;
  diffPct: number | null;
  plausible: boolean;
}

/** Vergleicht Etikett-kcal mit Makro-kcal; Abweichung >15 % wird markiert, aber nicht "korrigiert". */
export function checkKcal(per100: Nutrients): KcalCheck {
  const computed = kcalFromMacros(per100);
  const label = per100.kcal;
  if (label == null || computed == null) return { label, computed, diffPct: null, plausible: true };
  if (label === 0 && computed === 0) return { label, computed, diffPct: 0, plausible: true };
  const diffPct = Math.round(((computed - label) / Math.max(label, 1)) * 100);
  return { label, computed, diffPct, plausible: Math.abs(diffPct) <= 15 || Math.abs(computed - label) <= 10 };
}

export type Completeness = 'complete' | 'partial' | 'insufficient';

export function completeness(per100: Nutrients): Completeness {
  const core = CORE_KEYS.filter((k) => per100[k] != null).length;
  if (core === 4) return 'complete';
  if (per100.kcal != null) return 'partial';
  return 'insufficient';
}

// ---------- Rezepte ----------

export interface RecipeNutrition {
  totalGrams: number;
  total: Nutrients;
  perServing: Nutrients;
  per100: Nutrients;
  unknownIngredients: string[];
}

export function recipeNutrition(recipe: Pick<Recipe, 'ingredients' | 'servings'>): RecipeNutrition {
  if (recipe.ingredients.length === 0) throw new ValidationError('Ein Rezept braucht mindestens eine Zutat.');
  if (!Number.isFinite(recipe.servings) || recipe.servings <= 0) throw new ValidationError('Portionen müssen größer als 0 sein.');
  const unknownIngredients: string[] = [];
  const scaled = recipe.ingredients.map((i: RecipeIngredient) => {
    const s = scaleNutrients(i.per100, i.grams);
    if (CORE_KEYS.some((k) => s[k] == null)) unknownIngredients.push(i.name);
    return s;
  });
  const totalGrams = recipe.ingredients.reduce((a, i) => a + i.grams, 0);
  const total: Nutrients = emptyNutrients();
  for (const k of NUTRIENT_KEYS) {
    const values = scaled.map((s) => s[k]);
    if (values.every((v) => v === undefined)) continue;
    // Ist der Wert bei irgendeiner Zutat unbekannt, ist die Summe unvollständig → null für Kernwerte nur, wenn ALLE unbekannt
    const known = values.filter((v): v is number => typeof v === 'number');
    total[k] = known.length === 0 ? null : roundNutrient(k, known.reduce((a, b) => a + b, 0));
  }
  const perServing: Nutrients = emptyNutrients();
  const per100: Nutrients = emptyNutrients();
  for (const k of NUTRIENT_KEYS) {
    const v = total[k];
    if (v === undefined) continue;
    perServing[k] = v === null ? null : roundNutrient(k, v / recipe.servings);
    per100[k] = v === null || totalGrams === 0 ? null : roundNutrient(k, (v / totalGrams) * 100);
  }
  return { totalGrams, total, perServing, per100, unknownIngredients };
}

// ---------- Einheiten-Normalisierung ----------

/** Wandelt Energieangaben in kcal um. */
export function toKcal(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === 'kj') return value / 4.184;
  if (u === 'kcal') return value;
  throw new ValidationError(`Unbekannte Energieeinheit: ${unit}`);
}

/** Wandelt Massenangaben in Gramm um. */
export function toGrams(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === 'g') return value;
  if (u === 'mg') return value / 1000;
  if (u === 'µg' || u === 'ug' || u === 'mcg') return value / 1_000_000;
  if (u === 'kg') return value * 1000;
  throw new ValidationError(`Unbekannte Masseneinheit: ${unit}`);
}

/** Salz aus Natrium (EU: Salz = Natrium × 2,5). */
export function saltFromSodium(sodiumG: number): number {
  return Math.round(sodiumG * 2.5 * 100) / 100;
}

/** Parst Portionsangaben wie "30 g", "250ml", "1 Riegel (45 g)". */
export function parseServingSize(text?: string | null): number | null {
  if (!text) return null;
  const m = /([\d]+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(text);
  if (!m || !m[1]) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

// ---------------------------------------------------------------------------
// Kalorienziel je Mahlzeit
// ---------------------------------------------------------------------------

/** Standardaufteilung in Prozent des Tagesziels. Eigene Mahlzeiten starten mit 0 %. */
export const DEFAULT_MEAL_SPLIT: Record<string, number> = { breakfast: 25, lunch: 35, dinner: 30, snack: 10 };

export interface MealShare {
  id: string;
  pct: number;
}

/** Effektive Prozentanteile: gespeicherter Wert, sonst Standard, sonst 0. Negative/ungültige Werte → 0. */
export function effectiveSplit(mealIds: string[], stored: Record<string, number> | undefined): MealShare[] {
  return mealIds.map((id) => {
    const raw = stored?.[id] ?? DEFAULT_MEAL_SPLIT[id] ?? 0;
    return { id, pct: Number.isFinite(raw) && raw > 0 ? raw : 0 };
  });
}

/**
 * Verteilt `total` kcal ganzzahlig auf die Anteile (Methode der größten Reste).
 * Die Anteile werden auf ihre Summe normiert; die Ergebnisse ergeben immer exakt `total`.
 * Summe 0 → gleichmäßige Verteilung.
 */
export function splitKcal(total: number, shares: MealShare[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!shares.length) return out;
  const t = Math.max(0, Math.round(total));
  const sum = shares.reduce((s, x) => s + x.pct, 0);
  const weights = shares.map((x) => (sum > 0 ? x.pct / sum : 1 / shares.length));
  const exact = weights.map((w) => w * t);
  const floors = exact.map(Math.floor);
  let rest = t - floors.reduce((s, x) => s + x, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    rest--;
  }
  shares.forEach((x, i) => out.set(x.id, floors[i] ?? 0));
  return out;
}

export interface MealTarget {
  id: string;
  /** Geplantes Ziel laut Aufteilung */
  planned: number;
  /** Gültiges Ziel: bei gegessenen Mahlzeiten das Ziel zum Zeitpunkt des ersten Eintrags, bei offenen das aktuelle */
  target: number;
  /** target, falls es vom geplanten Ziel abweicht, sonst null */
  adjusted: number | null;
  /** Bereits gegessen (null = noch nichts eingetragen) */
  eaten: number | null;
  /** Punktlandung: gegessen innerhalb ±10 % (mind. ±20 kcal) des gültigen Ziels */
  hit: boolean;
}

/** Toleranz für eine Punktlandung */
export function mealHitTolerance(target: number) {
  return Math.max(20, target * 0.1);
}

/**
 * Ziele je Mahlzeit, die zum Tagesbudget passen.
 * `eatenByMeal` in der Reihenfolge, in der die Mahlzeiten begonnen wurden (erster Eintrag).
 * Jede gegessene Mahlzeit behält das Ziel, das galt, als sie begonnen wurde; danach wird das
 * verbleibende Budget auf die noch offenen Mahlzeiten im Verhältnis ihrer Anteile neu verteilt (nie negativ).
 */
export function mealTargets(total: number, shares: MealShare[], eatenByMeal: Map<string, number>): MealTarget[] {
  const planned = splitKcal(total, shares);
  const known = new Set(shares.map((s) => s.id));
  const targetAtStart = new Map<string, number>();
  const closed = new Set<string>();
  let eatenSoFar = 0;
  const distribute = () => {
    const open = shares.filter((s) => !closed.has(s.id));
    if (!open.length) return new Map<string, number>();
    if (!closed.size) return planned;
    const weighted = open.some((o) => o.pct > 0) ? open : open.map((o) => ({ ...o, pct: 1 }));
    return splitKcal(Math.max(0, total - eatenSoFar), weighted);
  };
  for (const [id, kcal] of eatenByMeal) {
    if (!known.has(id)) continue;
    targetAtStart.set(id, distribute().get(id) ?? 0);
    closed.add(id);
    eatenSoFar += kcal;
  }
  const openTargets = distribute();
  return shares.map((s) => {
    const p = planned.get(s.id) ?? 0;
    const isClosed = closed.has(s.id);
    const target = isClosed ? targetAtStart.get(s.id) ?? 0 : openTargets.get(s.id) ?? 0;
    const eaten = isClosed ? Math.round(eatenByMeal.get(s.id) ?? 0) : null;
    return {
      id: s.id,
      planned: p,
      target,
      adjusted: target !== p ? target : null,
      eaten,
      hit: eaten != null && target > 0 && Math.abs(eaten - target) <= mealHitTolerance(target),
    };
  });
}
