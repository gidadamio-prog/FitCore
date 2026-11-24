// Zubereitung von Grundnahrungsmitteln: Gewicht ändert sich beim Kochen (Wasser rein bzw. raus),
// die Nährstoffe nicht. Nährwerte pro 100 g „wie gewogen“ = Bezugswerte × Ausbeute(Bezug) / Ausbeute(gewählt).
// Ausbeute = Gewicht nach Zubereitung / Rohgewicht (Richtwerte nach USDA-Nährwerten roh vs. gegart).
import type { FoodItem, Nutrients } from './types';

export interface PrepState {
  id: string;
  label: string;
  /** Gewicht nach Zubereitung je 1 g Rohware */
  yield: number;
}

export interface PrepProfile {
  id: string;
  label: string;
  match: RegExp;
  exclude?: RegExp;
  states: PrepState[];
  /** Bezugswerte ab dieser kcal/100 g gelten als Rohware, darunter als zubereitet (erster nicht-rohe Zustand) */
  rawMinKcal?: number;
}

const RAW = (label = 'roh'): PrepState => ({ id: 'raw', label, yield: 1 });

export const PREP_PROFILES: PrepProfile[] = [
  {
    id: 'rice',
    label: 'Reis',
    match: /\b(reis|basmati|jasmin|rice)\b|reis\b|^reis/i,
    exclude: /waffel|cracker|drink|milch|mehl|nudel|noodle|kuchen|riegel|puffreis|essig|wein|pudding|chips|sirup|reisig/i,
    states: [RAW('trocken'), { id: 'cooked', label: 'gekocht', yield: 2.8 }],
    rawMinKcal: 230,
  },
  {
    id: 'pasta',
    label: 'Nudeln',
    match: /nudel|pasta|spaghetti|penne|fusilli|farfalle|makkaroni|maccheroni|tagliatelle|linguine|rigatoni|spirelli|hörnchen|bandnudel|eierspätzle|orzo|fettuccine/i,
    exclude: /frisch|tortellini|ravioli|gnocchi|suppe|salat|sauce|soße|fertig|auflauf|snack|chips/i,
    states: [RAW('trocken'), { id: 'cooked', label: 'gekocht', yield: 2.35 }],
    rawMinKcal: 250,
  },
  {
    id: 'potato',
    label: 'Kartoffeln',
    match: /kartoffel|potato|erdäpfel/i,
    exclude: /chips|pommes|püree|puree|puffer|krokette|gnocchi|stärke|salat|rösti|knödel|kloß|wedges|suppe|fries|mehl/i,
    states: [RAW(), { id: 'boiled', label: 'gekocht', yield: 0.9 }, { id: 'baked', label: 'aus dem Ofen', yield: 0.8 }],
  },
  {
    id: 'quinoa',
    label: 'Quinoa',
    match: /quinoa/i,
    exclude: /riegel|chips|pops|flocken|mehl/i,
    states: [RAW('trocken'), { id: 'cooked', label: 'gekocht', yield: 3 }],
    rawMinKcal: 240,
  },
  {
    id: 'lentils',
    label: 'Linsen',
    match: /linsen|lentil/i,
    exclude: /dose|glas|konserve|suppe|eintopf|chips|nudel|pasta|mehl|dal\b|curry|aufstrich/i,
    states: [RAW('trocken'), { id: 'cooked', label: 'gekocht', yield: 3 }],
    rawMinKcal: 230,
  },
  {
    id: 'chickpeas',
    label: 'Kichererbsen',
    match: /kichererbse|chickpea/i,
    exclude: /dose|glas|konserve|hummus|humus|chips|mehl|snack|geröstet|nudel|pasta/i,
    states: [RAW('trocken'), { id: 'cooked', label: 'gekocht', yield: 2.3 }],
    rawMinKcal: 250,
  },
  {
    id: 'poultry',
    label: 'Geflügelbrust',
    match: /(hähnchen|hühner|puten|chicken|turkey)[\s-]*(brust|filet|breast)/i,
    exclude: /aufschnitt|wurst|nuggets|paniert|geräuchert|schnitzel|döner|salami|gegrillt.*dose|aufstrich/i,
    states: [RAW(), { id: 'cooked', label: 'gebraten/gegart', yield: 0.73 }],
    rawMinKcal: 0,
  },
];

const COOKED_WORDS = /gekocht|gegart|cooked|boiled|gebraten|gebacken|roasted|baked/i;

export function prepProfile(food: Pick<FoodItem, 'name' | 'unitBase'>): PrepProfile | undefined {
  if (food.unitBase !== 'g') return undefined;
  return PREP_PROFILES.find((p) => p.match.test(food.name) && !p.exclude?.test(food.name));
}

/** In welchem Zustand gelten die Bezugswerte des Lebensmittels? */
export function baseState(profile: PrepProfile, food: Pick<FoodItem, 'name' | 'per100'>): PrepState {
  const raw = profile.states[0]!;
  const prepared = profile.states[1]!;
  if (COOKED_WORDS.test(food.name)) return prepared;
  if (profile.rawMinKcal && food.per100.kcal != null && food.per100.kcal < profile.rawMinKcal) return prepared;
  return raw;
}

/** Bezugswerte pro 100 g in dem Zustand, in dem gewogen wird. */
export function per100For(per100: Nutrients, base: PrepState, weighed: PrepState): Nutrients {
  const f = base.yield / weighed.yield;
  if (f === 1) return { ...per100 };
  const out: Record<string, number | null | undefined> = {};
  for (const [k, v] of Object.entries(per100) as [string, number | null | undefined][]) out[k] = v == null ? v : Math.round(v * f * 100) / 100;
  return out as unknown as Nutrients;
}

/** Kurzer Hinweis zur Umrechnung, z. B. „Gekocht wiegt Reis etwa 2,8 × so viel wie trocken.“ */
export function prepHint(profile: PrepProfile, base: PrepState, weighed: PrepState): string {
  if (base.id === weighed.id) return `Die Nährwerte gelten für ${profile.label} ${base.label}.`;
  const r = weighed.yield / base.yield;
  const fmt = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  return r > 1
    ? `${weighed.label[0]!.toUpperCase()}${weighed.label.slice(1)} wiegt ${profile.label} etwa ${fmt(r)} × so viel wie ${base.label} – die Nährwerte pro Gramm sind entsprechend niedriger.`
    : `${weighed.label[0]!.toUpperCase()}${weighed.label.slice(1)} wiegt ${profile.label} nur etwa ${fmt(r)} × so viel wie ${base.label} (Wasser verdunstet) – pro Gramm also mehr Nährwerte.`;
}
