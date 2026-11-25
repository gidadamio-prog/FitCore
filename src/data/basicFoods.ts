// Grundnahrungsmittel mit Durchschnittswerten (pro 100 g Rohware bzw. wie verkauft), damit Suchen wie
// „Reis“ oder „Kartoffeln“ sofort – auch offline – einen sauberen Treffer liefern. Kohlenhydrate ohne Ballaststoffe (EU-Angabe).
import type { FoodItem, Nutrients, Serving } from '@/domain/types';

type Row = [id: string, name: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number, servings?: Serving[], aliases?: string];
/** zählbares Stück */
const pc = (label: string, grams: number): Serving => ({ label, grams, piece: true });

const ROWS: Row[] = [
  ['reis', 'Reis, weiß (Basmati/Langkorn)', 355, 7.5, 78, 0.7, 1.2, 0.1, [], 'rice jasmin parboiled'],
  ['vollkornreis', 'Vollkornreis (Naturreis)', 350, 7.5, 72, 2.7, 3.5, 0.7, [], 'naturreis brauner reis rice'],
  ['nudeln', 'Nudeln (Hartweizen)', 355, 12.5, 70, 1.5, 3, 3.5, [], 'pasta spaghetti penne fusilli'],
  ['vollkornnudeln', 'Vollkornnudeln', 345, 14, 63, 2.5, 8, 3, [], 'pasta spaghetti vollkorn'],
  ['kartoffeln', 'Kartoffeln', 70, 2, 15, 0.1, 2.1, 0.8, [pc('Kartoffel (mittel)', 150)], 'potato erdäpfel'],
  ['suesskartoffel', 'Süßkartoffel, roh', 83, 1.6, 17, 0.1, 3, 4.2, [pc('Süßkartoffel', 250)], 'sweet potato'],
  ['quinoa', 'Quinoa', 360, 14, 60, 6, 7, 2, [], ''],
  ['linsen', 'Linsen', 330, 24, 49, 1.5, 12, 2, [], 'rote linsen berglinsen'],
  ['kichererbsen', 'Kichererbsen (getrocknet)', 335, 20, 45, 6, 15, 10, [], ''],
  ['haferflocken', 'Haferflocken', 370, 13.5, 59, 7, 10, 1, [{ label: '1 EL', grams: 10 }], 'porridge oats'],
  ['vollkornbrot', 'Vollkornbrot', 220, 7, 38, 1.5, 7.5, 3, [pc('Scheibe', 50)], 'brot'],
  ['haehnchenbrust', 'Hähnchenbrust', 110, 23.5, 0, 1.5, 0, 0, [], 'hühnerbrust chicken'],
  ['putenbrust', 'Putenbrust', 105, 24, 0, 1, 0, 0, [], 'turkey'],
  ['rinderhack', 'Rinderhackfleisch, roh', 245, 19, 0, 18.5, 0, 0, [], 'hackfleisch hack'],
  ['lachs', 'Lachs, roh', 200, 20, 0, 13, 0, 0, [pc('Filet', 125)], 'salmon fisch'],
  ['thunfisch', 'Thunfisch im eigenen Saft, abgetropft', 115, 26, 0, 1, 0, 0, [pc('Dose', 150)], 'tuna dose'],
  // essbarer Anteil ohne Schale je Gewichtsklasse
  ['ei', 'Ei (Hühnerei)', 143, 12.6, 0.7, 9.5, 0, 0.4, [pc('Ei S', 45), pc('Ei M', 52), pc('Ei L', 60), pc('Ei XL', 67)], 'eier egg'],
  ['magerquark', 'Magerquark', 67, 12, 4, 0.2, 0, 4, [], 'quark'],
  ['skyr', 'Skyr natur', 63, 11, 4, 0.2, 0, 4, [], ''],
  ['milch15', 'Milch 1,5 % Fett', 47, 3.4, 4.8, 1.5, 0, 4.8, [{ label: '1 Glas', grams: 200 }], 'milch fettarm'],
  ['banane', 'Banane', 90, 1.1, 20, 0.2, 2, 17, [pc('Banane', 120)], ''],
  ['apfel', 'Apfel', 54, 0.3, 12, 0.2, 2.3, 10, [pc('Apfel', 150)], ''],
  ['brokkoli', 'Brokkoli', 30, 3.3, 2.7, 0.4, 3, 1.7, [], 'broccoli gemüse'],
  ['tomate', 'Tomate', 18, 0.9, 2.6, 0.2, 1.2, 2.6, [pc('Tomate', 100)], 'gemüse'],
  ['mandeln', 'Mandeln', 600, 21, 6, 52, 12, 4.4, [{ label: '1 Handvoll', grams: 30 }], 'nüsse'],
  ['erdnussbutter', 'Erdnussbutter', 600, 25, 13, 50, 6, 6, [{ label: '1 EL', grams: 15 }], 'peanut butter'],
  ['olivenoel', 'Olivenöl', 884, 0, 0, 100, 0, 0, [{ label: '1 EL', grams: 10 }], 'öl'],
  ['butter', 'Butter', 741, 0.7, 0.6, 82, 0, 0.6, [{ label: '1 TL', grams: 5 }, { label: '1 EL', grams: 15 }], ''],
  // Backen und Vorrat
  ['weizenmehl', 'Weizenmehl Type 405', 340, 10, 71, 1, 4, 0.5, [{ label: '1 EL', grams: 10 }], 'mehl weizen 550 auszugsmehl'],
  ['vollkornmehl', 'Weizenvollkornmehl', 320, 12, 60, 2.2, 10, 0.7, [{ label: '1 EL', grams: 10 }], 'mehl vollkorn'],
  ['dinkelmehl', 'Dinkelmehl Type 630', 345, 12, 69, 1.8, 4, 0.5, [{ label: '1 EL', grams: 10 }], 'mehl dinkel'],
  ['zucker', 'Zucker', 400, 0, 100, 0, 0, 100, [{ label: '1 TL', grams: 4 }, { label: '1 EL', grams: 12 }], 'haushaltszucker'],
  ['honig', 'Honig', 305, 0.4, 75, 0, 0, 75, [{ label: '1 TL', grams: 7 }], ''],
  ['backpulver', 'Backpulver', 120, 0, 29, 0, 0, 0, [pc('Päckchen', 15)], 'triebmittel'],
  ['kakao', 'Kakaopulver, schwach entölt', 360, 20, 11, 21, 30, 1, [{ label: '1 EL', grams: 6 }], 'kakao'],
  ['zartbitter', 'Zartbitterschokolade 70 %', 560, 8, 34, 41, 11, 29, [pc('Rippe', 10)], 'schokolade'],
  ['rapsoel', 'Rapsöl', 884, 0, 0, 100, 0, 0, [{ label: '1 EL', grams: 10 }], 'öl pflanzenöl sonnenblumenöl'],
  ['kokosmilch', 'Kokosmilch', 200, 2, 3, 20, 0, 2.5, [pc('Dose', 400)], ''],
  // Milchprodukte
  ['milch35', 'Vollmilch 3,5 % Fett', 64, 3.3, 4.8, 3.5, 0, 4.8, [{ label: '1 Glas', grams: 200 }], 'milch'],
  ['sahne', 'Schlagsahne 30 %', 290, 2.4, 3.2, 30, 0, 3.2, [{ label: '1 EL', grams: 15 }], 'sahne rahm'],
  ['joghurt', 'Naturjoghurt 3,5 %', 65, 3.8, 4.5, 3.5, 0, 4.5, [{ label: '1 EL', grams: 15 }], 'joghurt'],
  ['gouda', 'Gouda', 356, 25, 0, 28, 0, 0, [pc('Scheibe', 20)], 'käse'],
  ['mozzarella', 'Mozzarella', 250, 18, 1, 19.5, 0, 1, [pc('Kugel', 125)], 'käse'],
  ['parmesan', 'Parmesan', 390, 35, 0, 28, 0, 0, [{ label: '1 EL gerieben', grams: 5 }], 'käse hartkäse'],
  ['feta', 'Feta', 260, 16, 0.5, 21, 0, 0.5, [pc('Packung', 200)], 'käse schafskäse'],
  // Brot
  ['broetchen', 'Weizenbrötchen', 255, 8.5, 50, 1.5, 3, 2, [pc('Brötchen', 55)], 'semmel'],
  ['toast', 'Toastbrot', 260, 8, 47, 3.5, 3, 4, [pc('Scheibe', 25)], 'brot toast'],
  // Gemüse
  ['zwiebel', 'Zwiebel', 40, 1.2, 8, 0.2, 1.8, 5, [pc('Zwiebel', 80)], 'gemüse'],
  ['knoblauch', 'Knoblauch', 145, 6, 28, 0.5, 2, 1, [pc('Zehe', 4)], 'gemüse'],
  ['paprika', 'Paprika', 30, 1, 5, 0.3, 2, 5, [pc('Paprika', 160)], 'gemüse'],
  ['karotte', 'Karotte', 36, 0.9, 7, 0.2, 3, 5, [pc('Karotte', 80)], 'möhre mohrrübe gemüse'],
  ['gurke', 'Gurke', 13, 0.6, 2, 0.2, 0.5, 2, [pc('Gurke', 400)], 'gemüse salatgurke'],
  ['zucchini', 'Zucchini', 20, 1.6, 2.2, 0.4, 1, 2, [pc('Zucchini', 200)], 'gemüse'],
  ['spinat', 'Spinat', 23, 2.9, 0.6, 0.4, 2.2, 0.4, [], 'blattspinat gemüse'],
  ['champignons', 'Champignons', 22, 3, 0.5, 0.3, 2, 0.3, [], 'pilze gemüse'],
  ['kidneybohnen', 'Kidneybohnen (Dose), abgetropft', 100, 7, 13, 0.5, 7, 1, [pc('Dose (abgetropft)', 250)], 'bohnen dose'],
  ['mais', 'Mais (Dose), abgetropft', 80, 2.5, 14, 1.2, 2.5, 4, [pc('Dose (abgetropft)', 140)], 'dose'],
  ['passiertetomaten', 'Passierte Tomaten', 30, 1.4, 4.5, 0.2, 1, 4, [pc('Packung', 500)], 'tomatensoße dosentomaten'],
  // Obst
  ['orange', 'Orange', 47, 1, 9, 0.2, 2.4, 9, [pc('Orange', 180)], 'apfelsine obst'],
  ['erdbeeren', 'Erdbeeren', 32, 0.7, 5.5, 0.4, 2, 5.5, [], 'beeren obst'],
  ['heidelbeeren', 'Heidelbeeren', 42, 0.6, 7.4, 0.6, 5, 7.4, [], 'blaubeeren beeren obst'],
  ['avocado', 'Avocado', 160, 2, 1.8, 15, 6.7, 0.7, [pc('Avocado (ohne Kern)', 150)], ''],
  // Eiweiß
  ['tofu', 'Tofu natur', 130, 13, 1.5, 8, 1, 0.5, [pc('Packung', 200)], ''],
  ['schweinefilet', 'Schweinefilet', 120, 21, 0, 4, 0, 0, [], 'schwein filet fleisch'],
  ['walnuesse', 'Walnüsse', 650, 15, 7, 65, 6, 2.6, [{ label: '1 Handvoll', grams: 30 }], 'nüsse'],
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

export const BASIC_BY_ID = new Map(BASIC_FOODS.map((f) => [f.id, f]));

const ALIASES = new Map(ROWS.map((r) => [`basic:${r[0]}`, (r[1] + ' ' + (r[9] ?? '')).toLowerCase()]));

/** Grundnahrungsmittel, deren Name oder Stichwörter alle Suchwörter enthalten. */
export function searchBasicFoods(q: string): FoodItem[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return BASIC_FOODS.filter((f) => words.every((w) => ALIASES.get(f.id)!.includes(w)));
}
