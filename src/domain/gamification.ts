// Gamification – vollständig aus echten Daten abgeleitet (nichts wird separat „gutgeschrieben“).
// Belohnt werden Regelmäßigkeit, Training und Zielnähe – ausdrücklich NICHT möglichst wenig Kalorien oder schnelles Abnehmen.
import type { CardioSession, DiaryEntry, Exercise, GoalVersion, Measurement, Plan, RecoveryLog, WaterLog, Workout } from './types';
import { addDays, rangeDates, startOfWeek } from './dates';
import { goalForDate } from './balance';
import { isCompletedSet, setVolume, epley1RM } from './training';

// ---------- Punkte-Regeln ----------

export const XP_RULES = {
  logged: { xp: 10, label: 'Ernährung protokolliert' },
  threeMeals: { xp: 5, label: 'Mind. 3 Mahlzeiten erfasst' },
  protein: { xp: 10, label: 'Proteinziel erreicht (≥ 90 %)' },
  calories: { xp: 10, label: 'Kalorienziel getroffen (± 10 %)' },
  water: { xp: 5, label: 'Trinkziel erreicht' },
  weighIn: { xp: 5, label: 'Gewicht gemessen' },
  recovery: { xp: 5, label: 'Regeneration erfasst' },
  workout: { xp: 50, label: 'Krafttraining abgeschlossen' },
  cardio: { xp: 30, label: 'Ausdauer ≥ 20 min' },
  pr: { xp: 25, label: 'Neue Bestleistung' },
  quest: { xp: 100, label: 'Wochen-Feldzug erfüllt' },
  season: { xp: 250, label: 'Saison-Herausforderung gemeistert' },
} as const;
export type XpKey = keyof typeof XP_RULES;

export interface Rank {
  level: number;
  name: string;
  title: string;
  minXp: number;
}

export const RANKS: Rank[] = [
  { level: 1, name: 'Tiro', title: 'Rekrut', minXp: 0 },
  { level: 2, name: 'Miles', title: 'Legionär', minXp: 500 },
  { level: 3, name: 'Decanus', title: 'Zeltführer', minXp: 1500 },
  { level: 4, name: 'Signifer', title: 'Feldzeichenträger', minXp: 3000 },
  { level: 5, name: 'Optio', title: 'Stellvertreter', minXp: 5000 },
  { level: 6, name: 'Centurio', title: 'Hauptmann', minXp: 8000 },
  { level: 7, name: 'Primus Pilus', title: 'Erster Centurio', minXp: 12000 },
  { level: 8, name: 'Tribunus', title: 'Tribun', minXp: 17000 },
  { level: 9, name: 'Legatus', title: 'Legat', minXp: 23000 },
  { level: 10, name: 'Imperator', title: 'Feldherr', minXp: 30000 },
];

export function rankFor(xp: number) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i]!.minXp) idx = i;
  const rank = RANKS[idx]!;
  const next = RANKS[idx + 1];
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1;
  return { rank, next, progress: Math.max(0, Math.min(1, progress)), toNext: next ? next.minXp - xp : 0 };
}

// ---------- Eingaben ----------

export interface GameInput {
  today: string;
  entries: DiaryEntry[];
  goals: GoalVersion[];
  workouts: Workout[];
  cardio: CardioSession[];
  measurements: Measurement[];
  water: WaterLog[];
  recovery: RecoveryLog[];
  recipesCount: number;
  exercises: Exercise[];
  activePlan?: Plan;
  trainingDaysPerWeek: number;
  waterGoalMl: number;
  homeGym?: string;
}

export interface DayFacts {
  date: string;
  logged: boolean;
  meals: number;
  kcal: number;
  protein: number;
  proteinHit: boolean;
  caloriesHit: boolean;
  waterHit: boolean;
  weighIn: boolean;
  recovery: boolean;
  workouts: number;
  cardioMin: number;
  cardioSessions: number; // ≥ 20 min
  volume: number;
  mobilitySets: number;
}

const MOBILITY_EQUIP = new Set(['five', 'Dr. Wolff', 'DAVID', 'Sensopro', 'Arke']);

export function dayFacts(i: GameInput): Map<string, DayFacts> {
  const map = new Map<string, DayFacts>();
  const get = (date: string) => {
    let f = map.get(date);
    if (!f) {
      f = { date, logged: false, meals: 0, kcal: 0, protein: 0, proteinHit: false, caloriesHit: false, waterHit: false, weighIn: false, recovery: false, workouts: 0, cardioMin: 0, cardioSessions: 0, volume: 0, mobilitySets: 0 };
      map.set(date, f);
    }
    return f;
  };
  const mealsByDay = new Map<string, Set<string>>();
  for (const e of i.entries) {
    const f = get(e.date);
    f.logged = true;
    f.kcal += e.nutrients.kcal ?? 0;
    f.protein += e.nutrients.protein ?? 0;
    const s = mealsByDay.get(e.date) ?? new Set();
    s.add(e.meal);
    mealsByDay.set(e.date, s);
  }
  for (const [d, s] of mealsByDay) get(d).meals = s.size;
  for (const f of map.values()) {
    if (!f.logged) continue;
    const g = goalForDate(i.goals, f.date);
    if (g) {
      f.proteinHit = f.protein >= g.proteinG * 0.9;
      f.caloriesHit = Math.abs(f.kcal - g.calorieTarget) <= g.calorieTarget * 0.1;
    }
  }
  const waterByDay = new Map<string, number>();
  for (const w of i.water) waterByDay.set(w.date, (waterByDay.get(w.date) ?? 0) + w.ml);
  for (const [d, ml] of waterByDay) if (ml >= i.waterGoalMl) get(d).waterHit = true;
  for (const m of i.measurements) if (m.weightKg != null) get(m.date).weighIn = true;
  for (const r of i.recovery) if (r.sleepHours != null || r.sleepQuality != null || r.energy != null || r.soreness != null) get(r.date).recovery = true;
  const exById = new Map(i.exercises.map((e) => [e.id, e]));
  for (const w of i.workouts) {
    const f = get(w.date);
    f.workouts++;
    for (const e of w.exercises) {
      const done = e.sets.filter(isCompletedSet);
      f.volume += done.reduce((a, s) => a + setVolume(s), 0);
      if (MOBILITY_EQUIP.has(exById.get(e.exerciseId)?.equipment ?? '') || exById.get(e.exerciseId)?.kind === 'mobility') f.mobilitySets += done.length;
    }
  }
  for (const c of i.cardio) {
    const f = get(c.date);
    f.cardioMin += c.durationMin;
    if (c.durationMin >= 20) f.cardioSessions++;
  }
  return map;
}

// ---------- Bestleistungen (Ereignisse) ----------

const kg = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 1 });

export interface PrEvent {
  date: string;
  workoutId: string;
  exerciseId: string;
  name: string;
  detail: string;
  value: number;
}

/** Ein PR-Ereignis = höheres Gewicht oder höheres e1RM als in allen früheren Einheiten derselben Übung (max. 1 pro Übung & Workout). */
export function prEvents(workouts: Workout[]): PrEvent[] {
  const bestW = new Map<string, number>();
  const bestE = new Map<string, number>();
  const out: PrEvent[] = [];
  for (const w of [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    for (const e of w.exercises) {
      const sets = e.sets.filter((s) => isCompletedSet(s) && s.weightKg != null && s.weightKg > 0);
      if (!sets.length) continue;
      const topW = Math.max(...sets.map((s) => s.weightKg!));
      const e1 = Math.max(0, ...sets.filter((s) => s.reps! <= 12).map((s) => epley1RM(s.weightKg!, s.reps!)));
      const prevW = bestW.get(e.exerciseId);
      const prevE = bestE.get(e.exerciseId);
      if (prevW !== undefined && (topW > prevW || (prevE !== undefined && e1 > prevE))) {
        const top = sets.find((s) => s.weightKg === topW)!;
        out.push({ date: w.date, workoutId: w.id, exerciseId: e.exerciseId, name: e.name, detail: topW > prevW ? `${kg(topW)} kg × ${top.reps} (vorher ${kg(prevW)} kg)` : `e1RM ${kg(e1)} kg (vorher ${kg(prevE!)} kg)`, value: topW });
      }
      bestW.set(e.exerciseId, Math.max(prevW ?? 0, topW));
      if (e1 > 0) bestE.set(e.exerciseId, Math.max(prevE ?? 0, e1));
    }
  }
  return out;
}

// ---------- Serien ----------

export interface StreakInfo {
  current: number;
  best: number;
  shieldUsedThisWeek: boolean;
  activeToday: boolean;
}

/**
 * Tages-Serie mit „Schild“: pro Kalenderwoche (Mo–So) darf ein Tag fehlen, ohne dass die Serie reißt.
 * Der heutige Tag zählt erst, wenn er erfüllt ist – ein noch leerer heutiger Tag bricht nichts.
 */
export function dayStreak(activeDays: Set<string>, today: string): StreakInfo {
  const days = [...activeDays].filter((d) => d <= today).sort();
  const run = (from: string, limitToStart?: string) => {
    let count = 0;
    const shieldWeeks = new Set<string>();
    let d = from;
    for (let i = 0; i < 1000; i++) {
      if (limitToStart && d < limitToStart) break;
      if (activeDays.has(d)) count++;
      else {
        const wk = startOfWeek(d);
        if (shieldWeeks.has(wk)) break;
        // ein Schild darf nur genutzt werden, wenn davor noch etwas kommt
        const prev = addDays(d, -1);
        if (!activeDays.has(prev)) break;
        shieldWeeks.add(wk);
      }
      d = addDays(d, -1);
    }
    return { count, shieldWeeks };
  };
  const activeToday = activeDays.has(today);
  const start = activeToday ? today : addDays(today, -1);
  const cur = run(start);
  // beste Serie: von jedem aktiven Tag rückwärts (begrenzt auf Datenbestand)
  let best = cur.count;
  const first = days[0];
  if (first) {
    const ends = days.filter((d) => !activeDays.has(addDays(d, 1)) || d === today);
    for (const e of ends) best = Math.max(best, run(e, first).count);
  }
  return { current: cur.count, best, shieldUsedThisWeek: cur.shieldWeeks.has(startOfWeek(today)), activeToday };
}

/** Wochen-Serie: aufeinanderfolgende Kalenderwochen mit mind. einer Trainingseinheit (laufende Woche zählt, sobald erfüllt). */
export function weekStreak(trainingDates: string[], today: string) {
  const weeks = new Set(trainingDates.filter((d) => d <= today).map(startOfWeek));
  const thisWeek = startOfWeek(today);
  let w = weeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let current = 0;
  while (weeks.has(w)) {
    current++;
    w = addDays(w, -7);
  }
  let best = 0;
  const sorted = [...weeks].sort();
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    run = prev && addDays(prev, 7) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best, activeThisWeek: weeks.has(thisWeek) };
}

// ---------- Wochen-Feldzüge ----------

export interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  done: boolean;
  unit: string;
}

function weekIndex(weekStart: string) {
  return Math.round(new Date(weekStart + 'T12:00:00Z').getTime() / (7 * 86400000));
}

export function questsForWeek(weekStart: string, facts: Map<string, DayFacts>, prs: PrEvent[], i: Pick<GameInput, 'activePlan' | 'trainingDaysPerWeek' | 'homeGym' | 'today'>): Quest[] {
  const days = rangeDates(weekStart, addDays(weekStart, 6)).filter((d) => d <= i.today);
  const f = days.map((d) => facts.get(d)).filter((x): x is DayFacts => !!x);
  const planned = i.activePlan ? new Set(i.activePlan.days.flatMap((d) => d.weekdays)).size : i.trainingDaysPerWeek;
  const trainTarget = Math.max(2, Math.min(6, planned || 3));
  const sessions = f.reduce((a, x) => a + x.workouts + x.cardioSessions, 0);
  const q = (id: string, title: string, description: string, target: number, progress: number, unit: string): Quest => ({ id, title, description, target, progress: Math.min(progress, target), done: progress >= target, unit });
  const quests: Quest[] = [
    q('train', `${trainTarget}× trainieren`, 'Krafttraining oder Ausdauer ab 20 Minuten.', trainTarget, sessions, 'Einheiten'),
    q('protein', 'Proteinziel an 5 Tagen', 'Mindestens 90 % deines Proteinziels.', 5, f.filter((x) => x.proteinHit).length, 'Tage'),
  ];
  const rotating = [
    () => q('log6', 'Diszipliniert protokollieren', 'An 6 Tagen Ernährung erfassen.', 6, f.filter((x) => x.logged).length, 'Tage'),
    () => q('water4', 'Wasser des Lebens', 'An 4 Tagen dein Trinkziel erreichen.', 4, f.filter((x) => x.waterHit).length, 'Tage'),
    () => q('weigh3', 'Waage des Senats', '3× Gewicht messen.', 3, f.filter((x) => x.weighIn).length, 'Messungen'),
    () => q('pr1', 'Neuer Rekord', 'Eine neue Bestleistung aufstellen.', 1, prs.filter((p) => p.date >= weekStart && p.date <= addDays(weekStart, 6)).length, 'Bestleistung'),
    () => q('cardio60', 'Marsch der Legion', '60 Minuten Ausdauer in der Woche.', 60, Math.round(f.reduce((a, x) => a + x.cardioMin, 0)), 'Minuten'),
    () => q('mobility', 'Rücken & Beweglichkeit', '6 Sätze an five, Dr. Wolff, DAVID, Sensopro, Arke oder Mobility-Übungen.', 6, f.reduce((a, x) => a + x.mobilitySets, 0), 'Sätze'),
  ].filter((fn) => i.homeGym || fn().id !== 'mobility');
  quests.push(rotating[Math.abs(weekIndex(weekStart)) % rotating.length]!());
  return quests;
}

// ---------- Saison (Kalendermonat) ----------

export type SeasonChallenge = Quest;

export const MONTH_NAMES = ['Januarius', 'Februarius', 'Martius', 'Aprilis', 'Maius', 'Iunius', 'Iulius', 'Augustus', 'September', 'October', 'November', 'December'];

export function seasonFor(month: string /* YYYY-MM */, facts: Map<string, DayFacts>, today: string): SeasonChallenge[] {
  const f = [...facts.values()].filter((x) => x.date.startsWith(month) && x.date <= today);
  const q = (id: string, title: string, description: string, target: number, progress: number, unit: string) => ({ id, title, description, target, progress: Math.min(progress, target), done: progress >= target, unit });
  return [
    q('s-sessions', '15 Einheiten', 'Krafttraining oder Ausdauer ab 20 Minuten im Monat.', 15, f.reduce((a, x) => a + x.workouts + x.cardioSessions, 0), 'Einheiten'),
    q('s-volume', '50 Tonnen bewegt', 'Gesamtvolumen im Krafttraining.', 50000, Math.round(f.reduce((a, x) => a + x.volume, 0)), 'kg'),
    q('s-log', '20 Tage protokolliert', 'Ernährung an 20 Tagen erfassen.', 20, f.filter((x) => x.logged).length, 'Tage'),
  ];
}

// ---------- Abzeichen ----------

export type Tier = 'bronze' | 'silver' | 'gold';
export interface BadgeDef {
  id: string;
  name: string;
  description: (t: number) => string;
  tiers: [number, number, number];
  value: number;
  unit?: string;
}
export interface BadgeStatus extends BadgeDef {
  tier: Tier | null;
  nextTarget: number | null;
}

export const TIERS: Tier[] = ['bronze', 'silver', 'gold'];
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' };

export function badgeStatus(def: BadgeDef): BadgeStatus {
  let tier: Tier | null = null;
  def.tiers.forEach((t, i) => {
    if (def.value >= t) tier = TIERS[i]!;
  });
  const nextIdx = tier ? TIERS.indexOf(tier) + 1 : 0;
  return { ...def, tier, nextTarget: nextIdx < 3 ? def.tiers[nextIdx]! : null };
}

// ---------- Gesamtauswertung ----------

export interface GameState {
  xp: number;
  breakdown: Record<XpKey, { count: number; xp: number }>;
  xpLast7: { date: string; xp: number }[];
  rank: ReturnType<typeof rankFor>;
  logStreak: StreakInfo;
  trainStreak: ReturnType<typeof weekStreak>;
  quests: Quest[];
  questsCompletedTotal: number;
  season: { month: string; name: string; challenges: SeasonChallenge[]; won: boolean };
  seasonsWon: number;
  badges: BadgeStatus[];
  prs: PrEvent[];
}

export function computeGame(i: GameInput): GameState {
  const facts = dayFacts(i);
  const prs = prEvents(i.workouts);
  const breakdown = Object.fromEntries(Object.keys(XP_RULES).map((k) => [k, { count: 0, xp: 0 }])) as GameState['breakdown'];
  const add = (k: XpKey, n = 1) => {
    if (n <= 0) return;
    breakdown[k].count += n;
    breakdown[k].xp += n * XP_RULES[k].xp;
  };
  const xpByDay = new Map<string, number>();
  const addDay = (d: string, xp: number) => xpByDay.set(d, (xpByDay.get(d) ?? 0) + xp);
  for (const f of facts.values()) {
    if (f.date > i.today) continue;
    const before = Object.values(breakdown).reduce((a, b) => a + b.xp, 0);
    if (f.logged) add('logged');
    if (f.meals >= 3) add('threeMeals');
    if (f.proteinHit) add('protein');
    if (f.caloriesHit) add('calories');
    if (f.waterHit) add('water');
    if (f.weighIn) add('weighIn');
    if (f.recovery) add('recovery');
    add('workout', Math.min(2, f.workouts));
    add('cardio', Math.min(2, f.cardioSessions));
    addDay(f.date, Object.values(breakdown).reduce((a, b) => a + b.xp, 0) - before);
  }
  const prsByWorkout = new Map<string, number>();
  for (const p of prs) {
    if (p.date > i.today) continue;
    const n = prsByWorkout.get(p.workoutId) ?? 0;
    if (n < 5) {
      add('pr');
      addDay(p.date, XP_RULES.pr.xp);
    }
    prsByWorkout.set(p.workoutId, n + 1);
  }
  // Feldzüge aller Wochen seit Beginn
  const allDates = [...facts.keys()].filter((d) => d <= i.today).sort();
  let questsCompletedTotal = 0;
  if (allDates.length) {
    for (let w = startOfWeek(allDates[0]!); w <= i.today; w = addDays(w, 7)) {
      const done = questsForWeek(w, facts, prs, i).filter((q) => q.done).length;
      questsCompletedTotal += done;
      add('quest', done);
    }
  }
  // Saisons aller Monate
  let seasonsWon = 0;
  if (allDates.length) {
    const months = new Set(allDates.map((d) => d.slice(0, 7)));
    for (const m of months) {
      const c = seasonFor(m, facts, i.today);
      const done = c.filter((x) => x.done).length;
      add('season', done);
      if (done === c.length) seasonsWon++;
    }
  }
  const xp = Object.values(breakdown).reduce((a, b) => a + b.xp, 0);

  const logStreak = dayStreak(new Set([...facts.values()].filter((f) => f.logged).map((f) => f.date)), i.today);
  const trainStreak = weekStreak([...facts.values()].filter((f) => f.workouts + f.cardioSessions > 0).map((f) => f.date), i.today);
  const month = i.today.slice(0, 7);
  const challenges = seasonFor(month, facts, i.today);

  const totalVolume = [...facts.values()].reduce((a, f) => a + f.volume, 0);
  const proteinDays = [...facts.values()].filter((f) => f.proteinHit).length;
  const waterDays = [...facts.values()].filter((f) => f.waterHit).length;
  const cardioKm = i.cardio.reduce((a, c) => a + (c.distanceKm ?? 0), 0);
  const usedExercises = new Set(i.workouts.flatMap((w) => w.exercises.filter((e) => e.sets.some(isCompletedSet)).map((e) => e.exerciseId)));
  const exById = new Map(i.exercises.map((e) => [e.id, e]));
  const studioUsed = i.homeGym ? [...usedExercises].filter((id) => exById.get(id)?.gyms?.includes(i.homeGym!)).length : 0;
  const milonStations = i.exercises.filter((e) => e.equipment === 'milon' && e.kind === 'strength');
  const milonUsed = milonStations.filter((e) => usedExercises.has(e.id)).length;

  const defs: BadgeDef[] = [
    { id: 'workouts', name: 'Veteran', description: (t) => `${t} Krafteinheiten abgeschlossen`, tiers: [1, 25, 100], value: i.workouts.length },
    { id: 'prs', name: 'Rekordjäger', description: (t) => `${t} Bestleistungen aufgestellt`, tiers: [1, 10, 50], value: prs.length },
    { id: 'volume', name: 'Atlas', description: (t) => `${t.toLocaleString('de-DE')} kg Gesamtvolumen bewegt`, tiers: [10000, 100000, 1000000], value: Math.round(totalVolume), unit: 'kg' },
    { id: 'logstreak', name: 'Chronist', description: (t) => `${t} Tage Ernährungs-Serie`, tiers: [7, 30, 100], value: logStreak.best, unit: 'Tage' },
    { id: 'trainstreak', name: 'Eiserne Legion', description: (t) => `${t} Wochen in Folge trainiert`, tiers: [4, 12, 26], value: trainStreak.best, unit: 'Wochen' },
    { id: 'protein', name: 'Proteinkönig', description: (t) => `An ${t} Tagen Proteinziel erreicht`, tiers: [7, 30, 100], value: proteinDays, unit: 'Tage' },
    { id: 'water', name: 'Aquädukt', description: (t) => `An ${t} Tagen Trinkziel erreicht`, tiers: [7, 30, 100], value: waterDays, unit: 'Tage' },
    { id: 'measure', name: 'Vermesser', description: (t) => `${t} Körpermessungen`, tiers: [5, 25, 100], value: i.measurements.length },
    { id: 'cardio', name: 'Marathon von Marathon', description: (t) => `${t} km Ausdauer zurückgelegt`, tiers: [10, 100, 500], value: Math.round(cardioKm), unit: 'km' },
    { id: 'recipes', name: 'Koch des Kaisers', description: (t) => `${t} Rezepte angelegt`, tiers: [1, 5, 20], value: i.recipesCount },
    { id: 'quests', name: 'Feldherr', description: (t) => `${t} Wochen-Feldzüge erfüllt`, tiers: [1, 10, 50], value: questsCompletedTotal },
    { id: 'seasons', name: 'Triumphator', description: (t) => `${t} Saison(s) komplett gewonnen`, tiers: [1, 3, 6], value: seasonsWon },
  ];
  if (i.homeGym) {
    defs.push({ id: 'studio', name: 'Kenner des Studios', description: (t) => `${t} verschiedene Studio-Geräte genutzt`, tiers: [10, 25, 40], value: studioUsed, unit: 'Geräte' });
    if (milonStations.length) defs.push({ id: 'milon', name: 'Zirkelmeister', description: (t) => `${t} von ${milonStations.length} milon-Stationen genutzt`, tiers: [4, 8, milonStations.length], value: milonUsed, unit: 'Stationen' });
  }
  const badges = defs.map(badgeStatus);

  const xpLast7 = rangeDates(addDays(i.today, -6), i.today).map((d) => ({ date: d, xp: xpByDay.get(d) ?? 0 }));
  return {
    xp,
    breakdown,
    xpLast7,
    rank: rankFor(xp),
    logStreak,
    trainStreak,
    quests: questsForWeek(startOfWeek(i.today), facts, prs, i),
    questsCompletedTotal,
    season: { month, name: MONTH_NAMES[Number(month.slice(5, 7)) - 1]!, challenges, won: challenges.every((c) => c.done) },
    seasonsWon,
    badges,
    prs,
  };
}

/** Schlüssel erreichter Abzeichenstufen, z. B. "prs:silver" – für „Neu!“-Hinweise. */
export function earnedBadgeKeys(badges: BadgeStatus[]): string[] {
  const out: string[] = [];
  for (const b of badges) {
    if (!b.tier) continue;
    const upto = TIERS.indexOf(b.tier);
    for (let k = 0; k <= upto; k++) out.push(`${b.id}:${TIERS[k]}`);
  }
  return out;
}

