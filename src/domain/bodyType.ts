// Grundkörper des Helden: wählt aus Körperfett (KFA) und Muskelmasse eines von 12 Körperbildern.
// Der Körper ist unabhängig vom Rang – Rang und Erfolge zeigt die Ausrüstung.
import type { Measurement, Profile, Sex } from './types';
import { dailySeries, dayIndex, movingAverage } from './body';

export const BODY_TYPES = [
  { id: 'duenn', label: 'Dünn' },
  { id: 'schlank', label: 'Schlank' },
  { id: 'durchschnitt', label: 'Durchschnitt' },
  { id: 'uebergewichtig', label: 'Übergewichtig' },
  { id: 'adipoes', label: 'Adipös' },
  { id: 'fit', label: 'Fit' },
  { id: 'athletisch', label: 'Athletisch' },
  { id: 'kraeftig', label: 'Kräftig' },
  { id: 'muskuloes-bauch', label: 'Muskulös mit Bauch' },
  { id: 'bodybuilder', label: 'Bodybuilder' },
  { id: 'strongman', label: 'Strongman' },
  { id: 'koloss', label: 'Koloss' },
] as const;
export type BodyTypeId = (typeof BODY_TYPES)[number]['id'];

export const bodyTypeLabel = (id: BodyTypeId) => BODY_TYPES.find((b) => b.id === id)!.label;
/** Dateiname in src/assets/rpg (ohne Endung) */
export const bodyFile = (id: BodyTypeId) => `koerper_${id}`;

/** Obergrenzen der Fettstufen F1–F4 (exklusiv) für Männer; alles darüber = F5. */
export const KFA_STUFEN = [12, 18, 25, 32] as const;
/** Frauen liegen bei gleicher Optik ca. 9 Prozentpunkte höher. */
export const KFA_OFFSET_FRAU = 9;
/** Obergrenzen der Muskelstufen M1–M4 (Muskel-Score); alles darüber = M5. */
export const MUSKEL_STUFEN = [19, 21.5, 23.5, 25.5] as const;
/** Puffer, um den ein Wert eine Grenze überschreiten muss, bevor der Körper wechselt. */
export const PUFFER = { kfa: 0.7, muskel: 0.3 } as const;

// Zeilen: Muskelstufe M1 (untrainiert) … M5 (extrem); Spalten: Fettstufe F1 (<12 %) … F5 (≥32 %)
export const BODY_GRID: readonly (readonly BodyTypeId[])[] = [
  ['duenn', 'schlank', 'durchschnitt', 'uebergewichtig', 'adipoes'],
  ['fit', 'fit', 'kraeftig', 'uebergewichtig', 'adipoes'],
  ['athletisch', 'athletisch', 'muskuloes-bauch', 'kraeftig', 'adipoes'],
  ['bodybuilder', 'bodybuilder', 'muskuloes-bauch', 'strongman', 'strongman'],
  ['bodybuilder', 'bodybuilder', 'strongman', 'koloss', 'koloss'],
];

/** Normalisierter FFMI: fettfreie Masse / Größe², korrigiert auf 1,80 m (Kouri et al. 1995). */
export function ffmi(weightKg: number, heightCm: number, bodyFatPct: number) {
  const h = heightCm / 100;
  return (weightKg * (1 - bodyFatPct / 100)) / (h * h) + 6.1 * (1.8 - h);
}

/**
 * Wer mehr Fett trägt, hat auch ohne Training mehr fettfreie Masse (Organe, Wasser, tragende Muskulatur).
 * Dieser Anteil wird abgezogen (+0,2 FFMI je KFA-Punkt über 15 %), damit schwere Untrainierte nicht als
 * „Strongman“ erscheinen.
 */
export function muscleScore(ffmiValue: number, bodyFatPct: number) {
  return ffmiValue - 0.2 * Math.max(0, bodyFatPct - 15);
}

/** Schätzung ohne gemessenen KFA aus BMI und Alter (Deurenberg et al. 1991). */
export function estimateBodyFat(weightKg: number, heightCm: number, age: number, sex: Sex) {
  const bmi = weightKg / (heightCm / 100) ** 2;
  return 1.2 * bmi + 0.23 * age - (sex === 'male' ? 16.2 : 5.4);
}

export interface Stages {
  m: number;
  f: number;
}

function stage(value: number, limits: readonly number[]) {
  const i = limits.findIndex((g) => value < g);
  return i === -1 ? limits.length : i;
}

/** Stufe mit Hysterese: ein Wechsel erst, wenn die Grenze um `buffer` überschritten ist. */
export function stageWithHysteresis(value: number, limits: readonly number[], prev: number | null | undefined, buffer: number) {
  const next = stage(value, limits);
  if (prev == null || next === prev) return next;
  if (next > prev) return value >= limits[next - 1]! + buffer ? next : prev;
  return value < limits[next]! - buffer ? next : prev;
}

export interface BodyInput {
  weightKg: number;
  heightCm: number;
  sex: Sex;
  /** gemessener KFA; fehlt er, wird geschätzt */
  bodyFatPct?: number;
  age: number;
  prev?: Stages | null;
}

export interface BodyTypeResult {
  id: BodyTypeId;
  stages: Stages;
  bodyFatPct: number;
  ffmi: number;
  muscleScore: number;
  estimated: boolean;
}

export function classifyBody(i: BodyInput): BodyTypeResult {
  const estimated = i.bodyFatPct == null;
  const kfa = i.bodyFatPct ?? estimateBodyFat(i.weightKg, i.heightCm, i.age, i.sex);
  const ff = ffmi(i.weightKg, i.heightCm, kfa);
  const score = muscleScore(ff, kfa);
  // TODO Update-Idee: eigene weibliche Basiskörper. Bis dahin nur verschobene Fettgrenzen.
  const kfaLimits = i.sex === 'female' ? KFA_STUFEN.map((g) => g + KFA_OFFSET_FRAU) : KFA_STUFEN;
  const f = stageWithHysteresis(kfa, kfaLimits, i.prev?.f, PUFFER.kfa);
  const m = stageWithHysteresis(score, MUSKEL_STUFEN, i.prev?.m, PUFFER.muskel);
  return { id: BODY_GRID[m]![f]!, stages: { m, f }, bodyFatPct: round1(kfa), ffmi: round1(ff), muscleScore: round1(score), estimated };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function ageOn(birthDate: string, date: string) {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/**
 * Aktueller Grundkörper aus der Messhistorie. Gewicht als 7-Tage-Durchschnitt, KFA und Größe = letzter
 * bekannter Wert. Die Tage werden chronologisch durchlaufen, damit die Hysterese ohne gespeicherten
 * Zustand reproduzierbar greift. Ohne Gewicht oder Profil: null.
 */
export function bodyTypeFromHistory(measurements: Measurement[], profile: Pick<Profile, 'sex' | 'heightCm' | 'birthDate' | 'bodyFatPct'> | null | undefined): BodyTypeResult | null {
  if (!profile) return null;
  const weights = movingAverage(dailySeries(measurements), 7);
  if (!weights.length) return null;
  const sorted = [...measurements].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  let k = 0;
  let kfa: number | undefined = profile.bodyFatPct;
  let height = profile.heightCm;
  let result: BodyTypeResult | null = null;
  for (const w of weights) {
    const day = dayIndex(w.date);
    while (k < sorted.length && dayIndex(sorted[k]!.date) <= day) {
      const m = sorted[k++]!;
      if (m.bodyFatPct != null) kfa = m.bodyFatPct;
      if (m.heightCm != null) height = m.heightCm;
    }
    if (!(height > 0)) continue;
    result = classifyBody({ weightKg: w.value, heightCm: height, sex: profile.sex, bodyFatPct: kfa, age: ageOn(profile.birthDate, w.date), prev: result?.stages });
  }
  return result;
}
