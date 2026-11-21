// Körperanalyse: US-Navy-Methode, Fett-/fettfreie Masse, Gewichtstrend.
import type { Measurement, Sex } from './types';
import { ValidationError, round1 } from './energy';

const CM_PER_INCH = 2.54;

export interface NavyInput {
  sex: Sex;
  heightCm: number;
  neckCm: number;
  /** Männer: Bauchumfang auf Nabelhöhe; Frauen: Taille an der schmalsten Stelle */
  waistCm: number;
  /** nur Frauen */
  hipCm?: number;
}

export interface NavyResult {
  bodyFatPct: number;
  formula: string;
}

function check(v: number | undefined, min: number, max: number, label: string): number {
  if (v === undefined || !Number.isFinite(v)) throw new ValidationError(`${label} fehlt.`);
  if (v < min || v > max) throw new ValidationError(`${label} muss zwischen ${min} und ${max} cm liegen.`);
  return v;
}

/**
 * Klassische US-Navy-Umfangsmethode (Hodgdon & Beckett 1984, DoD Instruction 1308.3), Formel in Zoll:
 *  Männer: %KF = 86,010·log10(Bauch − Hals) − 70,041·log10(Größe) + 36,76
 *  Frauen: %KF = 163,205·log10(Taille + Hüfte − Hals) − 97,684·log10(Größe) − 78,387
 */
export function navyBodyFat(i: NavyInput): NavyResult {
  const h = check(i.heightCm, 120, 230, 'Körpergröße') / CM_PER_INCH;
  const n = check(i.neckCm, 20, 70, 'Halsumfang') / CM_PER_INCH;
  const w = check(i.waistCm, 40, 200, i.sex === 'male' ? 'Bauchumfang' : 'Taillenumfang') / CM_PER_INCH;
  let pct: number;
  if (i.sex === 'male') {
    if (w - n <= 0) throw new ValidationError('Bauchumfang muss größer als der Halsumfang sein.');
    pct = 86.01 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76;
  } else {
    const hip = check(i.hipCm, 50, 200, 'Hüftumfang') / CM_PER_INCH;
    if (w + hip - n <= 0) throw new ValidationError('Taille + Hüfte muss größer als der Halsumfang sein.');
    pct = 163.205 * Math.log10(w + hip - n) - 97.684 * Math.log10(h) - 78.387;
  }
  if (!Number.isFinite(pct) || pct < 2 || pct > 65) {
    throw new ValidationError('Ergebnis außerhalb des plausiblen Bereichs (2–65 %). Bitte Messwerte prüfen.');
  }
  return { bodyFatPct: round1(pct), formula: i.sex === 'male' ? 'US-Navy (Männer, Zoll-Formel)' : 'US-Navy (Frauen, Zoll-Formel)' };
}

export function fatMass(weightKg: number, bodyFatPct: number) {
  if (!(weightKg > 0)) throw new ValidationError('Gewicht muss größer als 0 sein.');
  if (!(bodyFatPct >= 0 && bodyFatPct <= 100)) throw new ValidationError('Körperfett muss zwischen 0 und 100 % liegen.');
  const fat = (weightKg * bodyFatPct) / 100;
  return { fatMassKg: round1(fat), leanMassKg: round1(weightKg - fat) };
}

// ---------- Gewichtstrend ----------

export interface Point {
  date: string;
  value: number;
}

const DAY = 86400000;
export const dayIndex = (d: string) => Math.round(new Date(d + 'T00:00:00Z').getTime() / DAY);

/** Ein Wert pro Tag (Mittel mehrerer Messungen am selben Tag), chronologisch sortiert. */
export function dailySeries(ms: Pick<Measurement, 'date' | 'weightKg'>[]): Point[] {
  const byDay = new Map<string, number[]>();
  for (const m of ms) {
    if (m.weightKg == null) continue;
    const list = byDay.get(m.date) ?? [];
    list.push(m.weightKg);
    byDay.set(m.date, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({ date, value: v.reduce((a, b) => a + b, 0) / v.length }));
}

/**
 * Zeitgewichteter exponentieller gleitender Durchschnitt (EMA, α = 0,1 pro Tag).
 * Bei Lücken von Δ Tagen: α_eff = 1 − (1 − α)^Δ. Es werden keine Werte für fehlende Tage erzeugt.
 */
export function emaTrend(points: Point[], alpha = 0.1): Point[] {
  const out: Point[] = [];
  let prev: Point | null = null;
  for (const p of points) {
    if (!prev) {
      prev = { date: p.date, value: p.value };
    } else {
      const gap = Math.max(1, dayIndex(p.date) - dayIndex(prev.date));
      const a = 1 - Math.pow(1 - alpha, gap);
      prev = { date: p.date, value: prev.value + a * (p.value - prev.value) };
    }
    out.push({ date: p.date, value: Math.round(prev.value * 100) / 100 });
  }
  return out;
}

/** Einfacher gleitender Durchschnitt über ein Kalenderfenster (nur echte Messungen). */
export function movingAverage(points: Point[], windowDays = 7): Point[] {
  return points.map((p) => {
    const end = dayIndex(p.date);
    const win = points.filter((q) => dayIndex(q.date) > end - windowDays && dayIndex(q.date) <= end);
    return { date: p.date, value: Math.round((win.reduce((a, b) => a + b.value, 0) / win.length) * 100) / 100 };
  });
}

export interface Regression {
  slopePerDay: number;
  intercept: number;
  n: number;
  spanDays: number;
  stdErrSlope: number | null;
}

export function linearRegression(points: Point[]): Regression | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => dayIndex(p.date));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i]! - (intercept + slope * xs[i]!)) ** 2;
  const stdErrSlope = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : null;
  return { slopePerDay: slope, intercept, n, spanDays: Math.max(...xs) - Math.min(...xs), stdErrSlope };
}

export interface WindowTrend {
  days: number;
  changeKg: number | null; // Veränderung des EMA-Trends über das Fenster
  kgPerWeek: number | null; // Regressionssteigung
  n: number;
}

/** Trend über die letzten `days` Kalendertage bis `asOf` (inkl.). Liefert null bei < 2 Messungen. */
export function windowTrend(points: Point[], days: number, asOf: string): WindowTrend {
  const end = dayIndex(asOf);
  const win = points.filter((p) => dayIndex(p.date) > end - days && dayIndex(p.date) <= end);
  const reg = linearRegression(win);
  const first = win[0];
  const last = win[win.length - 1];
  return {
    days,
    n: win.length,
    changeKg: win.length >= 2 && first && last ? Math.round((last.value - first.value) * 100) / 100 : null,
    kgPerWeek: reg ? Math.round(reg.slopePerDay * 7 * 100) / 100 : null,
  };
}

export interface GoalProgress {
  startKg: number;
  currentKg: number;
  targetKg: number;
  pct: number; // 0–100
  remainingKg: number;
}

export function goalProgress(startKg: number, currentKg: number, targetKg: number): GoalProgress {
  const total = targetKg - startKg;
  const done = currentKg - startKg;
  const pct = total === 0 ? 100 : Math.max(0, Math.min(100, (done / total) * 100));
  return { startKg, currentKg, targetKg, pct: Math.round(pct), remainingKg: round1(targetKg - currentKg) };
}

export interface Forecast {
  etaDays: number | null;
  etaLowDays: number | null;
  etaHighDays: number | null;
  reason?: string;
}

/** Zielprognose aus Regressionssteigung ± 1,96·Standardfehler. Nur bei ausreichender Datenlage. */
export function forecastGoal(points: Point[], targetKg: number): Forecast {
  const reg = linearRegression(points);
  if (!reg || reg.n < 7 || reg.spanDays < 14) return { etaDays: null, etaLowDays: null, etaHighDays: null, reason: 'Mindestens 7 Messungen über 14 Tage erforderlich.' };
  const trend = emaTrend(points);
  const current = trend[trend.length - 1]!.value;
  const delta = targetKg - current;
  const s = reg.slopePerDay;
  if (s === 0 || Math.sign(s) !== Math.sign(delta)) return { etaDays: null, etaLowDays: null, etaHighDays: null, reason: 'Aktueller Trend führt nicht zum Ziel.' };
  const eta = delta / s;
  const se = reg.stdErrSlope ?? 0;
  const fast = s + Math.sign(s) * 1.96 * se;
  const slow = s - Math.sign(s) * 1.96 * se;
  return {
    etaDays: Math.round(eta),
    etaLowDays: Math.round(delta / fast),
    etaHighDays: Math.sign(slow) === Math.sign(s) && slow !== 0 ? Math.round(delta / slow) : null,
  };
}

/** Vergleich zweier Messungen: Differenzen aller gemeinsam vorhandenen Felder. */
export const MEASUREMENT_FIELDS = [
  ['weightKg', 'Gewicht', 'kg'],
  ['bodyFatPct', 'Körperfett', '%'],
  ['muscleMassKg', 'Muskelmasse', 'kg'],
  ['abdomenCm', 'Bauch', 'cm'],
  ['waistCm', 'Taille', 'cm'],
  ['hipCm', 'Hüfte', 'cm'],
  ['neckCm', 'Hals', 'cm'],
  ['chestCm', 'Brust', 'cm'],
  ['armCm', 'Oberarm', 'cm'],
  ['thighCm', 'Oberschenkel', 'cm'],
  ['heightCm', 'Größe', 'cm'],
] as const;

export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number][0];

export function compareMeasurements(a: Measurement, b: Measurement) {
  const rows: { field: string; label: string; unit: string; a: number | null; b: number | null; diff: number | null }[] = [];
  for (const [f, label, unit] of MEASUREMENT_FIELDS) {
    const va = a[f] ?? null;
    const vb = b[f] ?? null;
    if (va == null && vb == null) continue;
    rows.push({ field: f, label, unit, a: va, b: vb, diff: va != null && vb != null ? round1(vb - va) : null });
  }
  const keys = new Set([...Object.keys(a.custom ?? {}), ...Object.keys(b.custom ?? {})]);
  for (const k of keys) {
    const va = a.custom?.[k] ?? null;
    const vb = b.custom?.[k] ?? null;
    rows.push({ field: 'custom:' + k, label: k, unit: '', a: va, b: vb, diff: va != null && vb != null ? round1(vb - va) : null });
  }
  return rows;
}
