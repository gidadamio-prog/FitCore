// Grundnahrungsmittel mit Durchschnittswerten (pro 100 g Rohware bzw. wie verkauft), damit Suchen wie
// „Reis“ oder „Kartoffeln“ sofort – auch offline – einen sauberen Treffer liefern. Kohlenhydrate ohne Ballaststoffe (EU-Angabe).
import type { FoodItem, Nutrients, Serving } from '@/domain/types';

type Row = [id: string, name: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number, servings?: Serving[], aliases?: string];

const ROWS: Row[] = [
  ['reis', 'Reis, weiß (Basmati/Langkorn)', 355, 7.5, 78, 0.7, 1.2, 0.1, [], 'rice jasmin parboiled'],
  ['vollkornreis', 'Vollkornreis (Naturreis)', 350, 7.5, 72, 2.7, 3.5, 0.7, [], 'naturreis brauner reis rice'],
  ['nudeln', 'Nudeln (Hartweizen)', 355, 12.5, 70, 1.5, 3, 3.5, [], 'pasta spaghetti penne fusilli'],
  ['vollkornnudeln', 'Vollkornnudeln', 345, 14, 63, 2.5, 8, 3, [], 'pasta spaghetti vollkorn'],
  ['kartoffeln', 'Kartoffeln', 70, 2, 15, 0.1, 2.1, 0.8, [{ label: '1 mittelgroße Kartoffel', grams: 150 }], 'potato erdäpfel'],
  ['suesskartoffel', 'Süßkartoffel, roh', 83, 1.6, 17, 0.1, 3, 4.2, [{ label: '1 Süßkartoffel', grams: 250 }], 'sweet potato'],
  ['quinoa', 'Quinoa', 360, 14, 60, 6, 7, 2, [], ''],
  ['linsen', 'Linsen', 330, 24, 49, 1.5, 12, 2, [], 'rote linsen berglinsen'],
  ['kichererbsen', 'Kichererbsen (getrocknet)', 335, 20, 45, 6, 15, 10, [], ''],
  ['haferflocken', 'Haferflocken', 370, 13.5, 59, 7, 10, 1, [{ label: '1 EL', grams: 10 }], 'porridge oats'],
  ['vollkornbrot', 'Vollkornbrot', 220, 7, 38, 1.5, 7.5, 3, [{ label: '1 Scheibe', grams: 50 }], 'brot'],
  ['haehnchenbrust', 'Hähnchenbrust', 110, 23.5, 0, 1.5, 0, 0, [], 'hühnerbrust chicken'],
  ['putenbrust', 'Putenbrust', 105, 24, 0, 1, 0, 0, [], 'turkey'],
  ['rinderhack', 'Rinderhackfleisch, roh', 245, 19, 0, 18.5, 0, 0, [], 'hackfleisch hack'],
  ['lachs', 'Lachs, roh', 200, 20, 0, 13, 0, 0, [{ label: '1 Filet', grams: 125 }], 'salmon fisch'],
  ['thunfisch', 'Thunfisch im eigenen Saft, abgetropft', 115, 26, 0, 1, 0, 0, [{ label: '1 Dose', grams: 150 }], 'tuna dose'],
  ['ei', 'Ei (Hühnerei)', 143, 12.6, 0.7, 9.5, 0, 0.4, [{ label: '1 Ei (M)', grams: 55 }], 'eier'],
  ['magerquark', 'Magerquark', 67, 12, 4, 0.2, 0, 4, [], 'quark'],
  ['skyr', 'Skyr natur', 63, 11, 4, 0.2, 0, 4, [], ''],
  ['milch15', 'Milch 1,5 % Fett', 47, 3.4, 4.8, 1.5, 0, 4.8, [{ label: '1 Glas', grams: 200 }], 'milch fettarm'],
  ['banane', 'Banane', 90, 1.1, 20, 0.2, 2, 17, [{ label: '1 Banane', grams: 120 }], ''],
  ['apfel', 'Apfel', 54, 0.3, 12, 0.2, 2.3, 10, [{ label: '1 Apfel', grams: 150 }], ''],
  ['brokkoli', 'Brokkoli', 30, 3.3, 2.7, 0.4, 3, 1.7, [], 'broccoli gemüse'],
  ['tomate', 'Tomate', 18, 0.9, 2.6, 0.2, 1.2, 2.6, [{ label: '1 Tomate', grams: 100 }], 'gemüse'],
  ['mandeln', 'Mandeln', 600, 21, 6, 52, 12, 4.4, [{ label: '1 Handvoll', grams: 30 }], 'nüsse'],
  ['erdnussbutter', 'Erdnussbutter', 600, 25, 13, 50, 6, 6, [{ label: '1 EL', grams: 15 }], 'peanut butter'],
  ['olivenoel', 'Olivenöl', 884, 0, 0, 100, 0, 0, [{ label: '1 EL', grams: 10 }], 'öl'],
  ['butter', 'Butter', 741, 0.7, 0.6, 82, 0, 0.6, [{ label: '1 TL', grams: 5 }], ''],
];

export const BASIC_LICENSE = 'Richtwerte (Durchschnitt aus gängigen Nährwerttabellen) – Packungsangaben können abweichen.';

export const BASIC_FOODS: FoodItem[] = ROWS.map(([id, name, kcal, protein, carbs, fat, fiber, sugar, servings]) => {
  const per100: Nutrients = { kcal, protein, carbs, fat, fiber, sugar, salt: 0 };
  return {
    id: `basic:${id}`,
    name,
    source: 'basic',
    license: BASIC_LICENSE,
    unitBase: 'g',
    per100,
    kcalOrigin: 'label',
    servings: servings ?? [],
    favorite: 0,
    useCount: 0,
    createdAt: '2026-11-24T00:00:00.000Z',
  };
});

const ALIASES = new Map(ROWS.map((r) => [`basic:${r[0]}`, (r[1] + ' ' + (r[9] ?? '')).toLowerCase()]));

/** Grundnahrungsmittel, deren Name oder Stichwörter alle Suchwörter enthalten. */
export function searchBasicFoods(q: string): FoodItem[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return BASIC_FOODS.filter((f) => words.every((w) => ALIASES.get(f.id)!.includes(w)));
}
