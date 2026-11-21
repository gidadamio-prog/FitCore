// Statistikaggregation. Fehlende Tage werden als null (nicht 0) ausgewiesen.
import type { CardioSession, DiaryEntry, GoalVersion, Measurement, Workout } from './types';
import { sumEntries } from './nutrition';
import { goalForDate } from './balance';
import { rangeDates, startOfWeek } from './dates';
import { completedSets, totalReps, workoutVolume } from './training';

export interface DailyNutrition {
  date: string;
  logged: boolean;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  target: number | null;
  proteinTarget: number | null;
  trainingDay: boolean;
}

export function dailyNutrition(
  entries: DiaryEntry[],
  goals: GoalVersion[],
  from: string,
  to: string,
  trainingDates: Set<string> = new Set(),
): DailyNutrition[] {
  const byDate = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    const l = byDate.get(e.date) ?? [];
    l.push(e);
    byDate.set(e.date, l);
  }
  return rangeDates(from, to).map((date) => {
    const list = byDate.get(date);
    const g = goalForDate(goals, date);
    const base = { date, target: g?.calorieTarget ?? null, proteinTarget: g?.proteinG ?? null, trainingDay: trainingDates.has(date) };
    if (!list || list.length === 0) return { ...base, logged: false, kcal: null, protein: null, carbs: null, fat: null };
    const s = sumEntries(list).totals;
    return { ...base, logged: true, kcal: s.kcal, protein: s.protein, carbs: s.carbs, fat: s.fat };
  });
}

export interface GoalRate {
  evaluableDays: number;
  totalDays: number;
  hitDays: number;
  rate: number | null; // 0–1, null wenn keine auswertbaren Tage
  missingDates: string[];
}

/** Zielerreichung: Tage mit Eintrag & Ziel, deren kcal innerhalb ±tolerance des Ziels liegen. */
export function calorieGoalRate(days: DailyNutrition[], tolerance = 0.1): GoalRate {
  const evaluable = days.filter((d) => d.logged && d.target != null && d.kcal != null);
  const hit = evaluable.filter((d) => Math.abs(d.kcal! - d.target!) <= d.target! * tolerance);
  return {
    evaluableDays: evaluable.length,
    totalDays: days.length,
    hitDays: hit.length,
    rate: evaluable.length ? hit.length / evaluable.length : null,
    missingDates: days.filter((d) => !d.logged).map((d) => d.date),
  };
}

export function proteinGoalRate(days: DailyNutrition[], minShare = 0.9): GoalRate {
  const evaluable = days.filter((d) => d.logged && d.proteinTarget != null && d.protein != null);
  const hit = evaluable.filter((d) => d.protein! >= d.proteinTarget! * minShare);
  return {
    evaluableDays: evaluable.length,
    totalDays: days.length,
    hitDays: hit.length,
    rate: evaluable.length ? hit.length / evaluable.length : null,
    missingDates: days.filter((d) => !d.logged).map((d) => d.date),
  };
}

export function average(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export function macroDistribution(days: DailyNutrition[]) {
  const logged = days.filter((d) => d.logged);
  const p = logged.reduce((a, d) => a + (d.protein ?? 0) * 4, 0);
  const c = logged.reduce((a, d) => a + (d.carbs ?? 0) * 4, 0);
  const f = logged.reduce((a, d) => a + (d.fat ?? 0) * 9, 0);
  const t = p + c + f;
  if (!t) return null;
  return { protein: Math.round((p / t) * 100), carbs: Math.round((c / t) * 100), fat: Math.round((f / t) * 100) };
}

export interface DailyTraining {
  date: string;
  workouts: number;
  cardio: number;
  volume: number;
  sets: number;
  reps: number;
  durationMin: number;
}

export function dailyTraining(workouts: Workout[], cardio: CardioSession[], from: string, to: string): DailyTraining[] {
  return rangeDates(from, to).map((date) => {
    const ws = workouts.filter((w) => w.date === date);
    const cs = cardio.filter((c) => c.date === date);
    return {
      date,
      workouts: ws.length,
      cardio: cs.length,
      volume: Math.round(ws.reduce((a, w) => a + workoutVolume(w), 0)),
      sets: ws.reduce((a, w) => a + completedSets(w), 0),
      reps: ws.reduce((a, w) => a + totalReps(w), 0),
      durationMin: Math.round(ws.reduce((a, w) => a + w.durationSec / 60, 0) + cs.reduce((a, c) => a + c.durationMin, 0)),
    };
  });
}

export function trainingSummary(days: DailyTraining[]) {
  return {
    sessions: days.reduce((a, d) => a + d.workouts + d.cardio, 0),
    strengthSessions: days.reduce((a, d) => a + d.workouts, 0),
    cardioSessions: days.reduce((a, d) => a + d.cardio, 0),
    trainingDays: days.filter((d) => d.workouts + d.cardio > 0).length,
    volume: days.reduce((a, d) => a + d.volume, 0),
    sets: days.reduce((a, d) => a + d.sets, 0),
    reps: days.reduce((a, d) => a + d.reps, 0),
    durationMin: days.reduce((a, d) => a + d.durationMin, 0),
  };
}

/** Wöchentliche Aggregation (Wochenbeginn Montag). */
export function weekly<T extends { date: string }>(rows: T[], reducer: (rows: T[]) => number | null) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const w = startOfWeek(r.date);
    const l = map.get(w) ?? [];
    l.push(r);
    map.set(w, l);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, rs]) => ({ week, value: reducer(rs) }));
}

export interface WeeklyReport {
  from: string;
  to: string;
  avgKcal: number | null;
  avgProtein: number | null;
  loggedDays: number;
  sessions: number;
  volume: number;
  avgWeight: number | null;
  prev: { avgKcal: number | null; avgProtein: number | null; sessions: number; volume: number; avgWeight: number | null };
  delta: { avgKcal: number | null; avgProtein: number | null; sessions: number; volume: number; avgWeight: number | null };
}

const diff = (a: number | null, b: number | null) => (a != null && b != null ? Math.round((a - b) * 10) / 10 : null);

export function weeklyReport(
  entries: DiaryEntry[],
  goals: GoalVersion[],
  workouts: Workout[],
  cardio: CardioSession[],
  measurements: Measurement[],
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
): WeeklyReport {
  const calc = (f: string, t: string) => {
    const n = dailyNutrition(entries, goals, f, t);
    const tr = trainingSummary(dailyTraining(workouts, cardio, f, t));
    const ws = measurements.filter((m) => m.date >= f && m.date <= t && m.weightKg != null).map((m) => m.weightKg!);
    return {
      avgKcal: average(n.map((d) => d.kcal)),
      avgProtein: average(n.map((d) => d.protein)),
      loggedDays: n.filter((d) => d.logged).length,
      sessions: tr.sessions,
      volume: tr.volume,
      avgWeight: ws.length ? Math.round((ws.reduce((a, b) => a + b, 0) / ws.length) * 10) / 10 : null,
    };
  };
  const cur = calc(from, to);
  const prev = calc(prevFrom, prevTo);
  return {
    from,
    to,
    ...cur,
    prev: { avgKcal: prev.avgKcal, avgProtein: prev.avgProtein, sessions: prev.sessions, volume: prev.volume, avgWeight: prev.avgWeight },
    delta: {
      avgKcal: diff(cur.avgKcal, prev.avgKcal),
      avgProtein: diff(cur.avgProtein, prev.avgProtein),
      sessions: cur.sessions - prev.sessions,
      volume: cur.volume - prev.volume,
      avgWeight: diff(cur.avgWeight, prev.avgWeight),
    },
  };
}
