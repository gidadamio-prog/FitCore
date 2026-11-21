// Trainingsauswertung: Volumen, Muskelgruppen, Bestleistungen, Progression, Energieschätzung.
import type { CardioActivity, CardioSession, Workout, WorkoutExercise, WorkoutSet } from './types';
import { ValidationError } from './energy';

export const isCompletedSet = (s: WorkoutSet) => s.done && s.reps != null && s.reps > 0;

/** Volumen = Σ Gewicht × Wiederholungen über abgeschlossene Sätze (Körpergewichtssätze ohne Gewicht zählen 0). */
export function setVolume(s: WorkoutSet): number {
  if (!isCompletedSet(s)) return 0;
  return (s.weightKg ?? 0) * (s.reps ?? 0);
}

export function exerciseVolume(e: WorkoutExercise): number {
  return e.sets.reduce((a, s) => a + setVolume(s), 0);
}

export function workoutVolume(w: Pick<Workout, 'exercises'>): number {
  return Math.round(w.exercises.reduce((a, e) => a + exerciseVolume(e), 0) * 10) / 10;
}

export function completedSets(w: Pick<Workout, 'exercises'>): number {
  return w.exercises.reduce((a, e) => a + e.sets.filter(isCompletedSet).length, 0);
}

export function totalReps(w: Pick<Workout, 'exercises'>): number {
  return w.exercises.reduce((a, e) => a + e.sets.filter(isCompletedSet).reduce((b, s) => b + (s.reps ?? 0), 0), 0);
}

/** Sätze pro Muskelgruppe: primär = 1, sekundär = 0,5. */
export function setsPerMuscle(workouts: Pick<Workout, 'exercises'>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of workouts)
    for (const e of w.exercises) {
      const n = e.sets.filter(isCompletedSet).length;
      if (!n) continue;
      out[e.primaryMuscle] = (out[e.primaryMuscle] ?? 0) + n;
      for (const m of e.secondaryMuscles) out[m] = (out[m] ?? 0) + n * 0.5;
    }
  return out;
}

/** Geschätztes 1RM nach Epley: w · (1 + r/30). Für r = 1 gilt 1RM = w. Nur bis 12 Wdh. sinnvoll. */
export function epley1RM(weightKg: number, reps: number): number {
  if (!(weightKg >= 0) || !(reps >= 1)) throw new ValidationError('Ungültige Satzwerte.');
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export interface ExerciseSessionStat {
  workoutId: string;
  date: string;
  topWeight: number | null;
  bestE1RM: number | null;
  volume: number;
  sets: number;
  reps: number;
}

export function exerciseHistory(workouts: Workout[], exerciseId: string): ExerciseSessionStat[] {
  const out: ExerciseSessionStat[] = [];
  for (const w of [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const items = w.exercises.filter((e) => e.exerciseId === exerciseId);
    if (!items.length) continue;
    const sets = items.flatMap((e) => e.sets.filter(isCompletedSet));
    if (!sets.length) continue;
    const weighted = sets.filter((s) => s.weightKg != null && s.weightKg > 0);
    out.push({
      workoutId: w.id,
      date: w.date,
      topWeight: weighted.length ? Math.max(...weighted.map((s) => s.weightKg!)) : null,
      bestE1RM: weighted.length ? Math.max(...weighted.filter((s) => s.reps! <= 12).map((s) => epley1RM(s.weightKg!, s.reps!)), 0) || null : null,
      volume: sets.reduce((a, s) => a + setVolume(s), 0),
      sets: sets.length,
      reps: sets.reduce((a, s) => a + (s.reps ?? 0), 0),
    });
  }
  return out;
}

export type PRKind = 'weight' | 'e1rm' | 'reps' | 'volume';

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  kind: PRKind;
  value: number;
  detail: string;
  date: string;
  workoutId: string;
}

/** Bestleistungen je Übung aus tatsächlich dokumentierten, abgeschlossenen Sätzen. */
export function personalRecords(workouts: Workout[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  const sorted = [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const consider = (pr: PersonalRecord) => {
    const key = pr.exerciseId + '|' + pr.kind;
    const cur = best.get(key);
    if (!cur || pr.value > cur.value) best.set(key, pr);
  };
  for (const w of sorted)
    for (const e of w.exercises) {
      let sessionVol = 0;
      for (const s of e.sets.filter(isCompletedSet)) {
        const base = { exerciseId: e.exerciseId, name: e.name, date: w.date, workoutId: w.id };
        if (s.weightKg != null && s.weightKg > 0) {
          consider({ ...base, kind: 'weight', value: s.weightKg, detail: `${s.weightKg} kg × ${s.reps}` });
          if (s.reps! <= 12) consider({ ...base, kind: 'e1rm', value: epley1RM(s.weightKg, s.reps!), detail: `aus ${s.weightKg} kg × ${s.reps}` });
        }
        consider({ ...base, kind: 'reps', value: s.reps!, detail: s.weightKg ? `${s.reps} Wdh. mit ${s.weightKg} kg` : `${s.reps} Wdh.` });
        sessionVol += setVolume(s);
      }
      if (sessionVol > 0) consider({ exerciseId: e.exerciseId, name: e.name, date: w.date, workoutId: w.id, kind: 'volume', value: sessionVol, detail: `${sessionVol} kg Volumen` });
    }
  return [...best.values()];
}

/** Prüft, ob ein Workout neue Rekorde gegenüber früheren Workouts aufstellt. */
export function newRecordsIn(workout: Workout, previous: Workout[]): PersonalRecord[] {
  const before = new Map(personalRecords(previous.filter((w) => w.id !== workout.id)).map((p) => [p.exerciseId + '|' + p.kind, p.value]));
  return personalRecords([workout]).filter((p) => {
    const prev = before.get(p.exerciseId + '|' + p.kind);
    return prev !== undefined && p.value > prev;
  });
}

export interface ProgressionSuggestion {
  action: 'increase' | 'hold' | 'decrease';
  nextWeightKg: number | null;
  reason: string;
}

/**
 * Doppelte Progression: Wurden in der letzten Einheit alle Sätze mit ≥ repMax Wdh. abgeschlossen,
 * Gewicht um `step` erhöhen. Liegen Sätze unter repMin, Gewicht halten; fiel die Leistung zweimal in Folge
 * unter repMin, Gewicht um ca. 10 % reduzieren.
 */
export function suggestProgression(history: WorkoutExercise[], repMin: number, repMax: number, step = 2.5): ProgressionSuggestion {
  const last = history[history.length - 1];
  if (!last) return { action: 'hold', nextWeightKg: null, reason: 'Noch keine Daten für diese Übung.' };
  const sets = last.sets.filter(isCompletedSet);
  if (!sets.length) return { action: 'hold', nextWeightKg: null, reason: 'Letzte Einheit ohne abgeschlossene Sätze.' };
  const w = Math.max(...sets.map((s) => s.weightKg ?? 0));
  const allTop = sets.every((s) => (s.reps ?? 0) >= repMax);
  const anyLow = sets.some((s) => (s.reps ?? 0) < repMin);
  if (allTop && w > 0) return { action: 'increase', nextWeightKg: w + step, reason: `Alle ${sets.length} Sätze mit ≥ ${repMax} Wdh. bei ${w} kg geschafft.` };
  const prev = history[history.length - 2];
  if (anyLow && prev && prev.sets.filter(isCompletedSet).some((s) => (s.reps ?? 0) < repMin) && w > 0) {
    return { action: 'decrease', nextWeightKg: Math.round(w * 0.9 * 2) / 2 * 1, reason: `Zwei Einheiten in Folge unter ${repMin} Wdh. – leichte Entlastung.` };
  }
  return { action: 'hold', nextWeightKg: w || null, reason: anyLow ? `Noch nicht alle Sätze im Zielbereich (${repMin}–${repMax}).` : `Wiederholungen steigern bis ${repMax} in allen Sätzen.` };
}

// ---------- Energieschätzung (MET) ----------
// Quelle: Ainsworth et al., Compendium of Physical Activities (2011/2024). Netto-kcal = (MET − 1) · kg · h,
// damit der Ruheumsatz, der bereits im Grundumsatz steckt, nicht doppelt gezählt wird.

export const STRENGTH_MET = 5.0;

export const CARDIO_LABELS: Record<CardioActivity, string> = {
  running: 'Laufen',
  walking: 'Gehen',
  cycling: 'Radfahren',
  swimming: 'Schwimmen',
  rowing: 'Rudern',
  elliptical: 'Crosstrainer',
  custom: 'Benutzerdefiniert',
};

export function cardioMET(activity: CardioActivity, speedKmh?: number | null, rpe?: number | null): number {
  switch (activity) {
    case 'running':
      if (speedKmh) return Math.max(6, Math.min(16, speedKmh * 1.0));
      return 9.8;
    case 'walking':
      if (speedKmh) return speedKmh < 4 ? 2.8 : speedKmh < 5.5 ? 3.5 : speedKmh < 6.5 ? 4.3 : 5.0;
      return 3.5;
    case 'cycling':
      if (speedKmh) return speedKmh < 16 ? 4.0 : speedKmh < 19 ? 6.8 : speedKmh < 22 ? 8.0 : speedKmh < 26 ? 10.0 : 12.0;
      return 7.5;
    case 'swimming':
      return 7.0;
    case 'rowing':
      return 7.0;
    case 'elliptical':
      return 5.0;
    case 'custom':
      return rpe ? 2 + rpe * 0.7 : 5.0;
  }
}

export function netKcal(met: number, weightKg: number, minutes: number): number {
  if (!(weightKg > 0) || !(minutes > 0)) return 0;
  return Math.round(Math.max(0, met - 1) * weightKg * (minutes / 60));
}

export function estimateCardioKcal(s: Pick<CardioSession, 'activity' | 'durationMin' | 'distanceKm' | 'rpe'>, weightKg: number): number {
  if (!(s.durationMin > 0) || s.durationMin > 24 * 60) throw new ValidationError('Dauer muss zwischen 1 und 1440 Minuten liegen.');
  const speed = s.distanceKm && s.durationMin ? s.distanceKm / (s.durationMin / 60) : null;
  return netKcal(cardioMET(s.activity, speed, s.rpe), weightKg, s.durationMin);
}

/** Krafttraining: aktive Zeit ≈ Dauer; Netto-MET 5 → (5−1)·kg·h. */
export function estimateStrengthKcal(durationSec: number, weightKg: number | null): number {
  if (!weightKg) return 0;
  return netKcal(STRENGTH_MET, weightKg, Math.min(durationSec, 4 * 3600) / 60);
}

export function pace(distanceKm?: number, durationMin?: number): string | null {
  if (!distanceKm || !durationMin) return null;
  const minPerKm = durationMin / distanceKm;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')} min/km`;
}

export function speedKmh(distanceKm?: number, durationMin?: number): number | null {
  if (!distanceKm || !durationMin) return null;
  return Math.round((distanceKm / (durationMin / 60)) * 10) / 10;
}

/** Duplikatprüfung für Ausdauer: gleiche Sportart, Start ≤ 5 min auseinander und gleiche Dauer. */
export function isDuplicateCardio(candidate: Pick<CardioSession, 'activity' | 'startedAt' | 'durationMin'>, existing: CardioSession[]): boolean {
  const t = new Date(candidate.startedAt).getTime();
  return existing.some(
    (e) => e.activity === candidate.activity && Math.abs(new Date(e.startedAt).getTime() - t) <= 5 * 60000 && Math.abs(e.durationMin - candidate.durationMin) < 1,
  );
}
