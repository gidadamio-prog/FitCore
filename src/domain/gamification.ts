// Gamification – vollständig aus echten Daten abgeleitet (nichts wird separat „gutgeschrieben“).
// Belohnt werden Regelmäßigkeit, Training und Zielnähe – ausdrücklich NICHT möglichst wenig Kalorien oder schnelles Abnehmen.
import { REGIONS, apBalance, bossOfRegion, nextRegion, regionIndex, replayWorld, type WorldEvent, type WorldState } from './world';
import { foeFor } from './combat';
import { bonusValue, bonusesAt, effectiveStepGoal, type BonusLogEntry, type SetBonus } from './armor';
import type { CardioSession, DiaryEntry, Exercise, GoalVersion, Measurement, Plan, RecoveryLog, Sex, WaterLog, Workout } from './types';
import type { MealDayHits } from './mealGame';
import { secretAchievements, type SecretAchievement } from './achievements';
import { CAMPAIGN, CLASS_TRAINING, XP_PER_DENAR, battleScore, campaign, colosseum, comebackDates, dayDamage, exerciseMastery, heroLevel, attributes, lifeWork, shadowDuel, type CampaignState, type Duel, type HeroClassId, type MasteryEntry } from './rpg';
import { addDays, rangeDates, startOfWeek } from './dates';
import { goalForDate } from './balance';
import { isCompletedSet, setVolume, epley1RM } from './training';
import { dailyQuest, pickedQuests, weeklyOffers, type QuestCtx, type QuestOffer } from './quests';

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
  questAll: { xp: 100, label: 'Alle drei gewählten Feldzüge der Woche erfüllt' },
  daily: { xp: 40, label: 'Tagesauftrag erfüllt' },
  steps: { xp: 10, label: 'Schrittziel erreicht' },
  season: { xp: 250, label: 'Saison-Herausforderung gemeistert' },
  mealHit: { xp: 5, label: 'Punktlandung bei einer Mahlzeit (± 10 %)' },
  perfectDay: { xp: 15, label: 'Perfekter Tag (alle Mahlzeiten getroffen)' },
  comeback: { xp: 50, label: 'Comeback nach mind. 7 Tagen Pause' },
  duel: { xp: 40, label: 'Schatten-Duell gewonnen (Woche)' },
  mastery: { xp: 25, label: 'Meisterschaftsstufe einer Übung' },
  boss: { xp: 150, label: 'Feldzugs-Boss besiegt' },
  colosseum: { xp: 200, label: 'Kolosseum-Champion des Monats' },
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
  /** Punktlandungen je Tag (aus Mahlzeitzielen) */
  mealHits?: Map<string, MealDayHits>;
  heroClass?: HeroClassId;
  sex?: Sex;
  /** Tägliches Schrittziel (Standard 8.000) */
  stepGoal?: number;
  /** Gewählte Wochen-Feldzüge je Woche (Montag → Quest-IDs) */
  questPicks?: Record<string, string[]>;
  /** Ab diesem Tag gibt es Tagesaufträge (keine rückwirkenden EP) */
  questBoardStart?: string;
  /** Wann welches komplette Rüstungs-Set getragen wurde (Set-Boni gelten nur an diesen Tagen) */
  setBonusLog?: BonusLogEntry[];
  /** Ereignisse auf der Weltkarte (Reisen, Kämpfe, Truhen, Belagerungen) */
  worldLog?: WorldEvent[];
  /** Krankentage (pausieren Serien, Tagesauftrag wird zum Heiltrank) */
  sickDays?: string[];
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
  mealHits: number;
  perfectDay: boolean;
  /** Bestleistungen an diesem Tag (max. 5 je Workout) */
  prs: number;
  /** Ziele des Tages (null = kein Ziel hinterlegt) */
  kcalTarget: number | null;
  proteinTarget: number | null;
  steps: number;
  stepsHit: boolean;
  sleepHours: number | null;
  /** Training begonnen vor 9 Uhr */
  earlyWorkout: boolean;
  /** Übungen, die an diesem Tag zum ersten Mal überhaupt gemacht wurden */
  newExercises: number;
}

export const emptyDayFacts = (date: string): DayFacts => ({ date, logged: false, meals: 0, kcal: 0, protein: 0, proteinHit: false, caloriesHit: false, waterHit: false, weighIn: false, recovery: false, workouts: 0, cardioMin: 0, cardioSessions: 0, volume: 0, mobilitySets: 0, mealHits: 0, perfectDay: false, prs: 0, kcalTarget: null, proteinTarget: null, steps: 0, stepsHit: false, sleepHours: null, earlyWorkout: false, newExercises: 0 });

const MOBILITY_EQUIP = new Set(['five', 'Dr. Wolff', 'DAVID', 'Sensopro', 'Arke']);

export function dayFacts(i: GameInput): Map<string, DayFacts> {
  const map = new Map<string, DayFacts>();
  const get = (date: string) => {
    let f = map.get(date);
    if (!f) {
      f = emptyDayFacts(date);
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
  for (const [d, h] of i.mealHits ?? []) {
    const f = map.get(d);
    if (!f) continue;
    f.mealHits = h.hits;
    f.perfectDay = h.perfect;
  }
  for (const f of map.values()) {
    if (!f.logged) continue;
    const g = goalForDate(i.goals, f.date);
    if (g) {
      f.kcalTarget = g.calorieTarget;
      f.proteinTarget = g.proteinG;
      f.proteinHit = f.protein >= g.proteinG * 0.9;
      f.caloriesHit = Math.abs(f.kcal - g.calorieTarget) <= g.calorieTarget * 0.1;
    }
  }
  const waterByDay = new Map<string, number>();
  for (const w of i.water) waterByDay.set(w.date, (waterByDay.get(w.date) ?? 0) + w.ml);
  for (const [d, ml] of waterByDay) if (ml >= i.waterGoalMl) get(d).waterHit = true;
  for (const m of i.measurements) if (m.weightKg != null) get(m.date).weighIn = true;
  for (const r of i.recovery) {
    if (r.sleepHours != null || r.sleepQuality != null || r.energy != null || r.soreness != null) get(r.date).recovery = true;
    if (r.sleepHours != null) get(r.date).sleepHours = r.sleepHours;
    if (r.steps != null && r.steps > 0) {
      const f = get(r.date);
      f.steps = r.steps;
      f.stepsHit = r.steps >= effectiveStepGoal(i.stepGoal ?? 8000, bonusesAt(i.setBonusLog, r.date));
    }
  }
  const exById = new Map(i.exercises.map((e) => [e.id, e]));
  const seenExercises = new Set<string>();
  for (const w of [...i.workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const f = get(w.date);
    f.workouts++;
    if (new Date(w.startedAt).getHours() < 9) f.earlyWorkout = true;
    for (const e of w.exercises) {
      if (!e.sets.some(isCompletedSet) || seenExercises.has(e.exerciseId)) continue;
      if (seenExercises.size) f.newExercises++; // das allererste Training zählt nicht als „neu“
      seenExercises.add(e.exerciseId);
    }
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

/** Eine Woche gilt als „krank pausiert“, wenn sie mindestens so viele Krankentage hat. */
export const SICK_WEEK_MIN = 2;

/**
 * Tages-Serie mit „Schild“: pro Kalenderwoche (Mo–So) darf ein Tag fehlen, ohne dass die Serie reißt.
 * Der heutige Tag zählt erst, wenn er erfüllt ist – ein noch leerer heutiger Tag bricht nichts.
 * Krankentage (`paused`) zählen nicht mit, brechen die Serie aber auch nicht.
 */
export function dayStreak(activeDays: Set<string>, today: string, paused: Set<string> = new Set()): StreakInfo {
  const days = [...activeDays].filter((d) => d <= today).sort();
  const run = (from: string, limitToStart?: string) => {
    let count = 0;
    const shieldWeeks = new Set<string>();
    let d = from;
    for (let i = 0; i < 1000; i++) {
      if (limitToStart && d < limitToStart) break;
      if (activeDays.has(d)) count++;
      else if (paused.has(d)) {
        // krank: überspringen
      } else {
        const wk = startOfWeek(d);
        if (shieldWeeks.has(wk)) break;
        // ein Schild darf nur genutzt werden, wenn davor noch etwas kommt
        const prev = addDays(d, -1);
        if (!activeDays.has(prev) && !paused.has(prev)) break;
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

/**
 * Wochen-Serie: aufeinanderfolgende Kalenderwochen mit mind. einer Trainingseinheit (laufende Woche zählt, sobald erfüllt).
 * Wochen mit mindestens {@link SICK_WEEK_MIN} Krankentagen ohne Training zählen nicht, brechen die Serie aber auch nicht.
 */
export function weekStreak(trainingDates: string[], today: string, sickDays: string[] = []) {
  const weeks = new Set(trainingDates.filter((d) => d <= today).map(startOfWeek));
  const sickCount = new Map<string, number>();
  for (const d of sickDays) if (d <= today) sickCount.set(startOfWeek(d), (sickCount.get(startOfWeek(d)) ?? 0) + 1);
  const paused = (w: string) => !weeks.has(w) && (sickCount.get(w) ?? 0) >= SICK_WEEK_MIN;
  const thisWeek = startOfWeek(today);
  let w = weeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let current = 0;
  for (let i = 0; i < 520; i++) {
    if (weeks.has(w)) current++;
    else if (!paused(w)) break;
    w = addDays(w, -7);
  }
  let best = 0;
  const sorted = [...weeks].sort();
  let run = 0;
  if (sorted.length) {
    for (let k = sorted[0]!; k <= thisWeek; k = addDays(k, 7)) {
      if (weeks.has(k)) run++;
      else if (!paused(k)) run = 0;
      best = Math.max(best, run);
    }
  }
  return { current, best, activeThisWeek: weeks.has(thisWeek), pausedThisWeek: (sickCount.get(thisWeek) ?? 0) > 0 };
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

export function questsForWeek(weekStart: string, facts: Map<string, DayFacts>, prs: PrEvent[], i: Pick<GameInput, 'activePlan' | 'trainingDaysPerWeek' | 'homeGym' | 'today' | 'heroClass'>): Quest[] {
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
  // Klassen-Feldzug: passend zum Trainingsfokus der Klasse
  if (i.heroClass) {
    const c = CLASS_TRAINING[i.heroClass].quest;
    const progress =
      c.metric === 'strength'
        ? f.reduce((a, x) => a + x.workouts, 0)
        : c.metric === 'sessions'
          ? sessions
          : c.metric === 'cardio'
            ? Math.round(f.reduce((a, x) => a + x.cardioMin, 0))
            : f.filter((x) => x.proteinHit && x.waterHit).length;
    quests.push(q(c.id, c.title, c.description, c.target, progress, c.unit));
  }
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
  /** Heute als krank gemeldet */
  sickToday: boolean;
  trainStreak: ReturnType<typeof weekStreak>;
  quests: Quest[];
  /** Montag der laufenden Woche */
  weekStart: string;
  /** Angebote der laufenden Woche, solange noch nicht gewählt (sonst leer) */
  questOffers: QuestOffer[];
  /** Feldzug der Woche gewählt */
  questsPicked: boolean;
  /** Tagesauftrag für heute (null = heute keiner) */
  dailyQuest: Quest | null;
  questsCompletedTotal: number;
  season: { month: string; name: string; challenges: SeasonChallenge[]; won: boolean };
  seasonsWon: number;
  badges: BadgeStatus[];
  prs: PrEvent[];
  // RPG
  level: ReturnType<typeof heroLevel>;
  attributes: ReturnType<typeof attributes>;
  campaign: CampaignState;
  colosseum: ReturnType<typeof colosseum>;
  colosseumWins: { month: string; name: string; date: string }[];
  duel: Duel;
  duelsWon: number;
  duelWeeksWon: string[];
  comebacks: string[];
  mastery: MasteryEntry[];
  lifework: ReturnType<typeof lifeWork>;
  battle: ReturnType<typeof battleScore>;
  mealHitsTotal: number;
  perfectDays: number;
  secrets: SecretAchievement[];
  /** Denare aus Erfolgen */
  bonusDenare: number;
  /** Weltkarte: Spielstand und Aktionspunkte */
  world: { state: WorldState; ap: number; apToday: number; apByDay: Map<string, number> };
  /** Alter Feldzug aus Trainingsschaden (nur für die Übernahme in die Weltkarte) */
  legacyDefeated: { bossId: string; date: string }[];
  /** Aktive Set-Boni heute */
  setBonus: SetBonus[];
  /** Schrittziel heute (mit Set-Bonus) */
  stepGoalToday: number;
  facts: Map<string, DayFacts>;
  xpByDay: Map<string, number>;
  damageByDay: Map<string, number>;
}

/** Aktionspunkte je EP-Ereignis */
const AP_BY_XP: Partial<Record<XpKey, number>> = { logged: 1, workout: 2, cardio: 1, steps: 1, daily: 1, quest: 1, questAll: 2 };

/** Feldzug aus der Weltkarte: eroberte Hauptstädte und der nächste Boss mit seinen Belagerungs-Lebenspunkten */
function worldCampaign(w: WorldState): CampaignState {
  const defeated = REGIONS.filter((r) => w.conquered.has(r.id))
    .map((r) => ({ boss: bossOfRegion(r), date: w.conquered.get(r.id)! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = nextRegion(w) ?? REGIONS[REGIONS.length - 1]!;
  const foe = foeFor(next.id, 'hauptstadt', bossOfRegion(next).name);
  const boss = { ...bossOfRegion(next), province: next.name, hp: foe.hp };
  const dealt = nextRegion(w) ? Math.min(foe.hp, w.bossDmg.get(next.id) ?? 0) : foe.hp;
  return { defeated, current: { boss, index: regionIndex(next.id), dealt, remaining: foe.hp - dealt }, totalDamage: 0 };
}

const TRAINING_XP = new Set<XpKey>(['workout', 'cardio', 'pr']);
const NUTRITION_XP = new Set<XpKey>(['logged', 'threeMeals', 'protein', 'calories', 'mealHit', 'perfectDay', 'water']);

/** Zusätzliche Denare aus Set-Bonus: Anteil der an diesen Tagen verdienten EP */
function setBonusDenare(xpByDay: Map<string, number>, log: BonusLogEntry[] | undefined): number {
  if (!log?.length) return 0;
  let extra = 0;
  for (const [d, xp] of xpByDay) extra += (xp * bonusValue(bonusesAt(log, d), 'denare')) / 100;
  return Math.floor(extra / XP_PER_DENAR);
}

export function computeGame(i: GameInput): GameState {
  const facts = dayFacts(i);
  const prs = prEvents(i.workouts);
  const breakdown = Object.fromEntries(Object.keys(XP_RULES).map((k) => [k, { count: 0, xp: 0 }])) as GameState['breakdown'];
  const xpByDay = new Map<string, number>();
  /** EP buchen – immer mit dem Tag, an dem sie verdient wurden (Grundlage des Kampfwerts) */
  const apByDay = new Map<string, number>();
  const add = (k: XpKey, n: number, date: string) => {
    if (n <= 0 || date > i.today) return;
    const ap = AP_BY_XP[k];
    if (ap) apByDay.set(date, (apByDay.get(date) ?? 0) + ap * n);
    const bs = i.setBonusLog?.length ? bonusesAt(i.setBonusLog, date) : [];
    const pct = TRAINING_XP.has(k) ? bonusValue(bs, 'xpTraining') : NUTRITION_XP.has(k) ? bonusValue(bs, 'xpNutrition') : 0;
    const xp = Math.round(n * XP_RULES[k].xp * (1 + pct / 100));
    breakdown[k].count += n;
    breakdown[k].xp += xp;
    xpByDay.set(date, (xpByDay.get(date) ?? 0) + xp);
  };
  // Bestleistungen je Tag (max. 5 pro Workout)
  const prsByWorkout = new Map<string, number>();
  for (const p of prs) {
    if (p.date > i.today) continue;
    const n = prsByWorkout.get(p.workoutId) ?? 0;
    if (n < 5) {
      add('pr', 1, p.date);
      const f = facts.get(p.date);
      if (f) f.prs++;
    }
    prsByWorkout.set(p.workoutId, n + 1);
  }
  for (const f of facts.values()) {
    if (f.date > i.today) continue;
    if (f.logged) add('logged', 1, f.date);
    if (f.meals >= 3) add('threeMeals', 1, f.date);
    if (f.proteinHit) add('protein', 1, f.date);
    if (f.caloriesHit) add('calories', 1, f.date);
    if (f.waterHit) add('water', 1, f.date);
    if (f.weighIn) add('weighIn', 1, f.date);
    if (f.recovery) add('recovery', 1, f.date);
    add('workout', Math.min(2, f.workouts), f.date);
    add('cardio', Math.min(2, f.cardioSessions), f.date);
    add('mealHit', Math.min(4, f.mealHits), f.date);
    if (f.perfectDay) add('perfectDay', 1, f.date);
    if (f.stepsHit) add('steps', 1, f.date);
  }
  const allDates = [...facts.keys()].filter((d) => d <= i.today).sort();
  const minDate = (a: string, b: string) => (a < b ? a : b);
  // Feldzüge aller Wochen seit Beginn: gewählte Feldzüge (Quest-Brett), ältere Wochen nach altem Schema
  const qctx: QuestCtx = { facts, prs, today: i.today, stepGoal: i.stepGoal ?? 8000, heroClass: i.heroClass, planWeekdays: i.activePlan ? [...new Set(i.activePlan.days.flatMap((d) => d.weekdays))] : undefined, sickDays: new Set(i.sickDays ?? []) };
  const currentWeek = startOfWeek(i.today);
  const weekQuests = (w: string): Quest[] => {
    const picks = i.questPicks?.[w];
    if (picks?.length) return pickedQuests(w, picks, qctx);
    // Altes Schema für Wochen vor dem Quest-Brett (ohne Quest-Brett: immer)
    return !i.questBoardStart || w < startOfWeek(i.questBoardStart) ? questsForWeek(w, facts, prs, i) : [];
  };
  let questsCompletedTotal = 0;
  const duelWeeksWon: string[] = [];
  if (allDates.length) {
    for (let w = startOfWeek(allDates[0]!); w <= i.today; w = addDays(w, 7)) {
      const qs = weekQuests(w);
      const done = qs.filter((q) => q.done).length;
      questsCompletedTotal += done;
      add('quest', done, minDate(addDays(w, 6), i.today));
      if (i.questPicks?.[w]?.length && qs.length >= 3 && done === qs.length) add('questAll', 1, minDate(addDays(w, 6), i.today));
      const d = shadowDuel(w, facts, i.today);
      if (d.complete && d.won) {
        duelWeeksWon.push(w);
        add('duel', 1, addDays(w, 6));
      }
    }
  }
  // Tagesaufträge (erst ab Start des Quest-Bretts, keine rückwirkenden EP)
  if (i.questBoardStart) for (const d of rangeDates(i.questBoardStart, i.today)) if (dailyQuest(d, qctx)?.done) add('daily', 1, d);
  // Saisons aller Monate
  let seasonsWon = 0;
  const months = [...new Set(allDates.map((d) => d.slice(0, 7)))];
  for (const m of months) {
    const c = seasonFor(m, facts, i.today);
    const done = c.filter((x) => x.done).length;
    const monthEnd = addDays(addDays(m + '-01', 32).slice(0, 7) + '-01', -1);
    add('season', done, minDate(monthEnd, i.today));
    if (done === c.length) seasonsWon++;
  }
  // Schaden, Feldzug, Kolosseum
  const damageByDay = new Map<string, number>();
  for (const f of facts.values()) if (f.date <= i.today) damageByDay.set(f.date, Math.round(dayDamage(f, i.heroClass).total * (1 + bonusValue(bonusesAt(i.setBonusLog, f.date), 'damage') / 100)));
  const dmgList = [...damageByDay].map(([date, dmg]) => ({ date, dmg }));
  const legacy = campaign(dmgList);
  const world = replayWorld(i.worldLog);
  const camp = worldCampaign(world);
  for (const d of camp.defeated) add('boss', 1, d.date);
  const colosseumWins: GameState['colosseumWins'] = [];
  for (const m of months) {
    const c = colosseum(m, dmgList, i.today);
    if (c.defeatedOn) {
      colosseumWins.push({ month: m, name: c.name, date: c.defeatedOn });
      add('colosseum', 1, c.defeatedOn);
    }
  }
  // Comebacks
  const trainingDates = [...facts.values()].filter((f) => f.workouts + f.cardioSessions > 0).map((f) => f.date);
  const comebacks = comebackDates(trainingDates).filter((d) => d <= i.today);
  for (const d of comebacks) add('comeback', 1, d);
  // Übungs-Meisterschaft
  const mastery = exerciseMastery(i.workouts.filter((w) => w.date <= i.today), i.measurements, i.sex);
  for (const m of mastery) for (const r of m.reached) add('mastery', 1, r.date);

  const xp = Object.values(breakdown).reduce((a, b) => a + b.xp, 0);
  // Neuer Rang → +3 AP am Tag des Aufstiegs
  {
    let cum = 0;
    let rank = 1;
    for (const d of [...xpByDay.keys()].sort()) {
      cum += xpByDay.get(d)!;
      const r = rankFor(cum).rank.level;
      if (r > rank) apByDay.set(d, (apByDay.get(d) ?? 0) + 3 * (r - rank));
      rank = Math.max(rank, r);
    }
  }
  const ap = apBalance(world.startDate, apByDay, world.spentByDate, i.today);

  const sick = new Set(i.sickDays ?? []);
  const logStreak = dayStreak(new Set([...facts.values()].filter((f) => f.logged).map((f) => f.date)), i.today, sick);
  const trainStreak = weekStreak(trainingDates, i.today, i.sickDays);
  const month = i.today.slice(0, 7);
  const challenges = seasonFor(month, facts, i.today);

  const factList = [...facts.values()].filter((f) => f.date <= i.today);
  const totalVolume = factList.reduce((a, f) => a + f.volume, 0);
  const proteinDays = factList.filter((f) => f.proteinHit).length;
  const waterDays = factList.filter((f) => f.waterHit).length;
  const mealHitsTotal = factList.reduce((a, f) => a + f.mealHits, 0);
  const perfectDays = factList.filter((f) => f.perfectDay).length;
  const cardioKm = i.cardio.reduce((a, c) => a + (c.distanceKm ?? 0), 0);
  const usedExercises = new Set(i.workouts.flatMap((w) => w.exercises.filter((e) => e.sets.some(isCompletedSet)).map((e) => e.exerciseId)));
  const exById = new Map(i.exercises.map((e) => [e.id, e]));
  const studioUsed = i.homeGym ? [...usedExercises].filter((id) => exById.get(id)?.gyms?.includes(i.homeGym!)).length : 0;
  const milonStations = i.exercises.filter((e) => e.equipment === 'milon' && e.kind === 'strength');
  const milonUsed = milonStations.filter((e) => usedExercises.has(e.id)).length;
  const masteryTiers = mastery.reduce((a, m) => a + m.tier, 0);

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
    { id: 'mealhits', name: 'Punktlandung', description: (t) => `${t} Mahlzeiten auf ± 10 % getroffen`, tiers: [10, 100, 500], value: mealHitsTotal },
    { id: 'perfect', name: 'Tafel des Kaisers', description: (t) => `${t} perfekte Tage (alle Mahlzeiten getroffen)`, tiers: [1, 10, 50], value: perfectDays, unit: 'Tage' },
    { id: 'bosses', name: 'Eroberer', description: (t) => `${t} Feldzugs-Bosse besiegt`, tiers: [1, 5, 12], value: camp.defeated.length },
    { id: 'colosseum', name: 'Champion der Arena', description: (t) => `${t}× Kolosseum-Champion des Monats`, tiers: [1, 3, 12], value: colosseumWins.length },
    { id: 'duels', name: 'Schattenbezwinger', description: (t) => `${t} Schatten-Duelle gewonnen`, tiers: [1, 8, 26], value: duelWeeksWon.length },
    { id: 'mastery', name: 'Meister der Waffen', description: (t) => `${t} Meisterschaftsstufen erreicht`, tiers: [3, 10, 25], value: masteryTiers, unit: 'Stufen' },
    { id: 'comeback', name: 'Phönix', description: (t) => `${t}× nach einer Pause zurückgekehrt`, tiers: [1, 3, 10], value: comebacks.length },
  ];
  if (i.homeGym) {
    defs.push({ id: 'studio', name: 'Kenner des Studios', description: (t) => `${t} verschiedene Studio-Geräte genutzt`, tiers: [10, 25, 40], value: studioUsed, unit: 'Geräte' });
    if (milonStations.length) defs.push({ id: 'milon', name: 'Zirkelmeister', description: (t) => `${t} von ${milonStations.length} milon-Stationen genutzt`, tiers: [4, 8, milonStations.length], value: milonUsed, unit: 'Stationen' });
  }
  const badges = defs.map(badgeStatus);

  const secrets = secretAchievements({ workouts: i.workouts, facts, prs, comebacks, today: i.today, sickDays: new Set(i.sickDays ?? []) });

  const xpLast7 = rangeDates(addDays(i.today, -6), i.today).map((d) => ({ date: d, xp: xpByDay.get(d) ?? 0 }));
  return {
    xp,
    breakdown,
    xpLast7,
    rank: rankFor(xp),
    logStreak,
    sickToday: (i.sickDays ?? []).includes(i.today),
    trainStreak,
    quests: weekQuests(currentWeek),
    weekStart: currentWeek,
    questOffers: i.questBoardStart && !i.questPicks?.[currentWeek]?.length ? weeklyOffers(currentWeek, qctx) : [],
    questsPicked: !!i.questPicks?.[currentWeek]?.length,
    dailyQuest: i.questBoardStart && i.today >= i.questBoardStart ? dailyQuest(i.today, qctx) : null,
    questsCompletedTotal,
    season: { month, name: MONTH_NAMES[Number(month.slice(5, 7)) - 1]!, challenges, won: challenges.every((c) => c.done) },
    seasonsWon,
    badges,
    prs,
    level: heroLevel(xp),
    attributes: attributes({ facts: factList, prCount: prs.filter((p) => p.date <= i.today).length, questsDone: questsCompletedTotal, cardioKm, classId: i.heroClass }),
    campaign: camp,
    world: { state: world, ap: ap.balance, apToday: ap.earnedToday, apByDay },
    legacyDefeated: legacy.defeated.filter((d) => CAMPAIGN.some((b) => b.id === d.boss.id)).map((d) => ({ bossId: d.boss.id, date: d.date })),
    colosseum: colosseum(month, dmgList, i.today),
    colosseumWins,
    duel: shadowDuel(startOfWeek(i.today), facts, i.today),
    duelsWon: duelWeeksWon.length,
    duelWeeksWon,
    comebacks,
    mastery,
    lifework: lifeWork(factList, i.workouts.filter((w) => w.date <= i.today), i.cardio.filter((c) => c.date <= i.today)),
    battle: battleScore(xpByDay, i.today),
    mealHitsTotal,
    perfectDays,
    secrets,
    bonusDenare: secrets.filter((x) => x.achieved).reduce((a, x) => a + x.reward.denare, 0) + setBonusDenare(xpByDay, i.setBonusLog) + world.denare,
    setBonus: bonusesAt(i.setBonusLog, i.today),
    stepGoalToday: effectiveStepGoal(i.stepGoal ?? 8000, bonusesAt(i.setBonusLog, i.today)),
    facts,
    xpByDay,
    damageByDay,
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

