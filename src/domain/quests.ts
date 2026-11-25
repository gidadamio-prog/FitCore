// Quest-Brett: Jede Woche 5 Feldzug-Angebote, du wählst 3. Ziele orientieren sich an deinem Schnitt der
// letzten 4 Wochen und fordern etwas mehr. Dazu an manchen Tagen ein Tagesauftrag.
// Alles wird aus echten Daten berechnet; Zufall ist an Woche/Tag gebunden (gleiche Woche = gleiche Angebote).
import { addDays, rangeDates } from './dates';
import type { DayFacts, PrEvent, Quest } from './gamification';
import { CLASS_TRAINING, type HeroClassId } from './rpg';

/** Ab hier gilt das Quest-Brett (vorher alte Wochen-Feldzüge, keine rückwirkenden Tagesaufträge). */
export const QUEST_BOARD_START = '2026-11-23';

export type QuestCategory = 'training' | 'ernaehrung' | 'alltag';

export interface QuestOffer extends Quest {
  category: QuestCategory;
}

export interface QuestCtx {
  facts: Map<string, DayFacts>;
  prs: PrEvent[];
  today: string;
  stepGoal: number;
  heroClass?: HeroClassId;
  /** Wochentage (1=Mo … 7=So), an denen der aktive Plan Training vorsieht */
  planWeekdays?: number[];
  /** Krankentage: Tagesauftrag wird zum Heiltrank (Trinkziel) */
  sickDays?: Set<string>;
}

// ---------- Zufall, an Woche/Tag gebunden ----------

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(list: T[], r: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const de = (n: number) => n.toLocaleString('de-DE');

// ---------- Dein Schnitt (4 Wochen vor der Woche) ----------

export interface Baseline {
  sessions: number;
  strength: number;
  cardioMin: number;
  volume: number;
  proteinDays: number;
  logDays: number;
  waterDays: number;
  calDays: number;
  mealHits: number;
  stepDays: number;
  steps: number;
  prs: number;
  kcalTarget: number | null;
  proteinTarget: number | null;
}

export function baseline(weekStart: string, ctx: QuestCtx): Baseline {
  const days = rangeDates(addDays(weekStart, -28), addDays(weekStart, -1));
  const f = days.map((d) => ctx.facts.get(d)).filter((x): x is DayFacts => !!x);
  const per = (fn: (x: DayFacts) => number) => f.reduce((a, x) => a + fn(x), 0) / 4;
  const latest = [...ctx.facts.values()].filter((x) => x.date <= ctx.today && x.kcalTarget != null).sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    sessions: per((x) => x.workouts + x.cardioSessions),
    strength: per((x) => x.workouts),
    cardioMin: per((x) => x.cardioMin),
    volume: per((x) => x.volume),
    proteinDays: per((x) => (x.proteinHit ? 1 : 0)),
    logDays: per((x) => (x.logged ? 1 : 0)),
    waterDays: per((x) => (x.waterHit ? 1 : 0)),
    calDays: per((x) => (x.caloriesHit ? 1 : 0)),
    mealHits: per((x) => x.mealHits),
    stepDays: per((x) => (x.stepsHit ? 1 : 0)),
    steps: per((x) => x.steps),
    prs: ctx.prs.filter((p) => p.date >= days[0]! && p.date <= days[days.length - 1]!).length / 4,
    kcalTarget: latest?.kcalTarget ?? null,
    proteinTarget: latest?.proteinTarget ?? null,
  };
}

// ---------- Wochen-Feldzüge ----------

interface WeekTpl {
  id: string;
  category: QuestCategory;
  eligible?: (b: Baseline, ctx: QuestCtx) => boolean;
  make: (b: Baseline, ctx: QuestCtx) => { title: string; description: string; target: number; unit: string };
  progress: (f: DayFacts[], ctx: QuestCtx, week: { start: string; end: string }) => number;
}

const sum = (f: DayFacts[], fn: (x: DayFacts) => number) => f.reduce((a, x) => a + fn(x), 0);
const count = (f: DayFacts[], fn: (x: DayFacts) => boolean) => f.filter(fn).length;
/** Abgeschlossene Tage: zählen erst, wenn der Tag vorbei ist (z. B. Kalorien) */
const closed = (f: DayFacts[], ctx: QuestCtx) => f.filter((x) => x.date < ctx.today);

const WEEK_POOL: WeekTpl[] = [
  {
    id: 'w-train',
    category: 'training',
    make: (b) => {
      const t = clamp(Math.round(b.sessions) + 1, 2, 6);
      return { title: `Marschbefehl: ${t}× trainieren`, description: `Krafttraining oder Ausdauer ab 20 Min. – einmal mehr als dein Schnitt (${de(Math.round(b.sessions * 10) / 10)}).`, target: t, unit: 'Einheiten' };
    },
    progress: (f) => sum(f, (x) => x.workouts + x.cardioSessions),
  },
  {
    id: 'w-strength',
    category: 'training',
    make: (b) => {
      const t = clamp(Math.round(b.strength) + 1, 2, 6);
      return { title: `Eiserne Legion: ${t} Krafteinheiten`, description: 'Nur Krafttraining zählt – Gewichte bewegen.', target: t, unit: 'Krafteinheiten' };
    },
    progress: (f) => sum(f, (x) => x.workouts),
  },
  {
    id: 'w-cardio',
    category: 'training',
    make: (b) => {
      const t = clamp(roundTo(Math.max(60, b.cardioMin * 1.25), 15), 60, 300);
      return { title: `Marsch der Legion: ${t} Min. Ausdauer`, description: 'Laufen, Rad, Rudern, Crosstrainer – alles zählt.', target: t, unit: 'Minuten' };
    },
    progress: (f) => Math.round(sum(f, (x) => x.cardioMin)),
  },
  {
    id: 'w-volume',
    category: 'training',
    eligible: (b) => b.volume >= 1000,
    make: (b) => {
      const t = roundTo(b.volume * 1.1, 500);
      return { title: `Last des Imperiums: ${de(t)} kg`, description: `Wochenvolumen 10 % über deinem Schnitt (${de(Math.round(b.volume))} kg).`, target: t, unit: 'kg' };
    },
    progress: (f) => Math.round(sum(f, (x) => x.volume)),
  },
  {
    id: 'w-pr',
    category: 'training',
    make: (b) => {
      const t = b.prs >= 1 ? 2 : 1;
      return { title: t === 1 ? 'Neuer Rekord' : 'Doppelter Lorbeer: 2 Rekorde', description: 'Mehr Gewicht oder ein höheres e1RM als je zuvor.', target: t, unit: t === 1 ? 'Bestleistung' : 'Bestleistungen' };
    },
    progress: (_f, ctx, w) => ctx.prs.filter((p) => p.date >= w.start && p.date <= w.end).length,
  },
  {
    id: 'w-early',
    category: 'training',
    make: () => ({ title: 'Morgenappell', description: 'Einmal vor 9 Uhr mit dem Training beginnen.', target: 1, unit: 'Training' }),
    progress: (f) => count(f, (x) => x.earlyWorkout),
  },
  {
    id: 'w-weekend',
    category: 'training',
    make: () => ({ title: 'Wochenendkrieger', description: 'Am Samstag oder Sonntag trainieren.', target: 1, unit: 'Tag' }),
    progress: (f) => count(f, (x) => x.workouts + x.cardioSessions > 0 && [0, 6].includes(new Date(x.date + 'T12:00:00').getDay())),
  },
  {
    id: 'w-new',
    category: 'training',
    make: () => ({ title: 'Neue Waffe', description: 'Eine Übung ausprobieren, die du noch nie gemacht hast.', target: 1, unit: 'Übung' }),
    progress: (f) => sum(f, (x) => x.newExercises),
  },
  {
    id: 'w-mobility',
    category: 'training',
    make: () => ({ title: 'Geschmeidig wie Merkur', description: '6 Sätze Dehnen, Mobility oder Rückengeräte.', target: 6, unit: 'Sätze' }),
    progress: (f) => sum(f, (x) => x.mobilitySets),
  },
  {
    id: 'w-protein-days',
    category: 'ernaehrung',
    make: (b) => {
      const t = clamp(Math.round(b.proteinDays) + 1, 3, 7);
      return { title: `Versorgung der Truppe: Protein an ${t} Tagen`, description: 'Mindestens 90 % deines Proteinziels.', target: t, unit: 'Tage' };
    },
    progress: (f) => count(f, (x) => x.proteinHit),
  },
  {
    id: 'w-protein-boost',
    category: 'ernaehrung',
    eligible: (b) => b.proteinTarget != null,
    make: (b) => ({ title: 'Festmahl des Herkules', description: `An 2 Tagen 120 % Protein – also mind. ${de(Math.round(b.proteinTarget! * 1.2))} g statt ${de(Math.round(b.proteinTarget!))} g.`, target: 2, unit: 'Tage' }),
    progress: (f) => count(f, (x) => x.proteinTarget != null && x.protein >= x.proteinTarget * 1.2),
  },
  {
    id: 'w-lean-day',
    category: 'ernaehrung',
    eligible: (b) => b.kcalTarget != null,
    make: (b) => {
      const t = b.kcalTarget!;
      return {
        title: 'Fastentag des Asketen',
        description: `Ein Tag 15 % unter Ziel: ca. ${de(roundTo(t * 0.85, 10))} statt ${de(Math.round(t))} kcal – gleicht üppigere Tage aus. Zählt bei 75–90 % des Ziels, am Folgetag.`,
        target: 1,
        unit: 'Tag',
      };
    },
    progress: (f, ctx) => count(closed(f, ctx), (x) => x.kcalTarget != null && x.meals >= 2 && x.kcal >= x.kcalTarget * 0.75 && x.kcal <= x.kcalTarget * 0.9),
  },
  {
    id: 'w-calories',
    category: 'ernaehrung',
    make: (b) => {
      const t = clamp(Math.round(b.calDays) + 1, 3, 7);
      return { title: `Maß halten an ${t} Tagen`, description: 'Kalorienziel ± 10 % treffen. Zählt am Folgetag.', target: t, unit: 'Tage' };
    },
    progress: (f, ctx) => count(closed(f, ctx), (x) => x.caloriesHit),
  },
  {
    id: 'w-log',
    category: 'ernaehrung',
    eligible: (b) => b.logDays < 7,
    make: (b) => {
      const t = clamp(Math.round(b.logDays) + 1, 4, 7);
      return { title: `Chronist: ${t} Tage protokollieren`, description: 'An jedem dieser Tage Ernährung erfassen.', target: t, unit: 'Tage' };
    },
    progress: (f) => count(f, (x) => x.logged),
  },
  {
    id: 'w-mealhits',
    category: 'ernaehrung',
    make: (b) => {
      const t = clamp(Math.round(b.mealHits * 1.2) + 1, 4, 20);
      return { title: `Treffsicher: ${t} Punktlandungen`, description: 'Mahlzeiten innerhalb ± 10 % ihres Ziels.', target: t, unit: 'Punktlandungen' };
    },
    progress: (f) => sum(f, (x) => x.mealHits),
  },
  {
    id: 'w-perfect',
    category: 'ernaehrung',
    make: () => ({ title: 'Ein perfekter Tag', description: 'Alle Mahlzeiten eines Tages als Punktlandung.', target: 1, unit: 'Tag' }),
    progress: (f) => count(f, (x) => x.perfectDay),
  },
  {
    id: 'w-water',
    category: 'alltag',
    make: (b) => {
      const t = clamp(Math.round(b.waterDays) + 1, 3, 7);
      return { title: `Wasser des Lebens: ${t} Tage`, description: 'Trinkziel erreichen.', target: t, unit: 'Tage' };
    },
    progress: (f) => count(f, (x) => x.waterHit),
  },
  {
    id: 'w-steps',
    category: 'alltag',
    make: (b, ctx) => {
      const t = clamp(Math.round(b.stepDays) + 1, 3, 7);
      return { title: `Via Appia: ${t} Tage Schrittziel`, description: `Jeweils ${de(ctx.stepGoal)} Schritte.`, target: t, unit: 'Tage' };
    },
    progress: (f) => count(f, (x) => x.stepsHit),
  },
  {
    id: 'w-steps-total',
    category: 'alltag',
    eligible: (b) => b.steps > 0,
    make: (b) => {
      const t = roundTo(Math.max(b.steps * 1.1, 35000), 5000);
      return { title: `Tausend Meilen: ${de(t)} Schritte`, description: `Wochensumme 10 % über deinem Schnitt (${de(Math.round(b.steps))}).`, target: t, unit: 'Schritte' };
    },
    progress: (f) => sum(f, (x) => x.steps),
  },
  {
    id: 'w-sleep',
    category: 'alltag',
    make: () => ({ title: 'Ruhe des Kriegers', description: 'An 4 Tagen mindestens 7 Stunden Schlaf (in Regeneration eintragen).', target: 4, unit: 'Nächte' }),
    progress: (f) => count(f, (x) => (x.sleepHours ?? 0) >= 7),
  },
  {
    id: 'w-weigh',
    category: 'alltag',
    make: () => ({ title: 'Waage des Senats', description: '3× Gewicht messen.', target: 3, unit: 'Messungen' }),
    progress: (f) => count(f, (x) => x.weighIn),
  },
];

function classTpl(c: HeroClassId): WeekTpl {
  const q = CLASS_TRAINING[c].quest;
  return {
    id: q.id,
    category: q.metric === 'proteinWater' ? 'ernaehrung' : 'training',
    make: () => ({ title: `Klasse: ${q.title}`, description: q.description, target: q.target, unit: q.unit }),
    progress: (f) =>
      q.metric === 'strength' ? sum(f, (x) => x.workouts) : q.metric === 'sessions' ? sum(f, (x) => x.workouts + x.cardioSessions) : q.metric === 'cardio' ? Math.round(sum(f, (x) => x.cardioMin)) : count(f, (x) => x.proteinHit && x.waterHit),
  };
}

function pool(ctx: QuestCtx) {
  return ctx.heroClass ? [...WEEK_POOL, classTpl(ctx.heroClass)] : WEEK_POOL;
}

function build(t: WeekTpl, weekStart: string, b: Baseline, ctx: QuestCtx): QuestOffer {
  const end = addDays(weekStart, 6);
  const f = rangeDates(weekStart, end)
    .filter((d) => d <= ctx.today)
    .map((d) => ctx.facts.get(d))
    .filter((x): x is DayFacts => !!x);
  const m = t.make(b, ctx);
  const progress = t.progress(f, ctx, { start: weekStart, end });
  return { id: t.id, category: t.category, ...m, progress: Math.min(progress, m.target), done: progress >= m.target };
}

export const OFFERS_PER_WEEK = 5;
export const PICKS_PER_WEEK = 3;

/** 5 Angebote der Woche: mind. 2 Training, 2 Ernährung, 1 Alltag – je Woche anders, aber stabil. */
export function weeklyOffers(weekStart: string, ctx: QuestCtx): QuestOffer[] {
  const b = baseline(weekStart, ctx);
  const r = rng('feldzug:' + weekStart);
  const eligible = shuffle(
    pool(ctx).filter((t) => !t.eligible || t.eligible(b, ctx)),
    r,
  );
  const pick: WeekTpl[] = [];
  const take = (cat: QuestCategory, n: number) => {
    for (const t of eligible) {
      if (pick.length >= OFFERS_PER_WEEK || n <= 0) break;
      if (t.category === cat && !pick.includes(t)) {
        pick.push(t);
        n--;
      }
    }
  };
  take('training', 2);
  take('ernaehrung', 2);
  take('alltag', 1);
  for (const t of eligible) if (pick.length < OFFERS_PER_WEEK && !pick.includes(t)) pick.push(t);
  const order: QuestCategory[] = ['training', 'ernaehrung', 'alltag'];
  return pick.map((t) => build(t, weekStart, b, ctx)).sort((x, y) => order.indexOf(x.category) - order.indexOf(y.category));
}

/** Die gewählten Feldzüge einer Woche (unbekannte IDs werden ignoriert). */
export function pickedQuests(weekStart: string, picks: string[], ctx: QuestCtx): QuestOffer[] {
  const b = baseline(weekStart, ctx);
  const byId = new Map(pool(ctx).map((t) => [t.id, t]));
  return picks.flatMap((id) => (byId.get(id) ? [build(byId.get(id)!, weekStart, b, ctx)] : []));
}

// ---------- Tagesaufträge ----------

interface DailyTpl {
  id: string;
  title: (ctx: QuestCtx, f: DayFacts | undefined) => string;
  description: string;
  target: number;
  unit: string;
  progress: (f: DayFacts | undefined, ctx: QuestCtx) => number;
  weight?: (date: string, ctx: QuestCtx) => number;
}

const isPlanDay = (date: string, ctx: QuestCtx) => !!ctx.planWeekdays?.includes(((new Date(date + 'T12:00:00').getDay() + 6) % 7) + 1);

const DAILY_POOL: DailyTpl[] = [
  { id: 'd-train', title: () => 'Zu den Waffen: Trainiere heute', description: 'Krafttraining oder Ausdauer ab 20 Minuten.', target: 1, unit: 'Einheit', progress: (f) => (f ? f.workouts + f.cardioSessions : 0), weight: (d, c) => (isPlanDay(d, c) ? 4 : 1.5) },
  { id: 'd-steps', title: (c) => `Eilmarsch: ${de(c.stepGoal + 2000)} Schritte`, description: '2.000 Schritte mehr als dein Tagesziel.', target: 1, unit: 'Ziel', progress: (f, c) => ((f?.steps ?? 0) >= c.stepGoal + 2000 ? 1 : 0) },
  { id: 'd-protein', title: () => 'Proteinration +10 %', description: '110 % deines Proteinziels heute.', target: 1, unit: 'Ziel', progress: (f) => (f?.proteinTarget != null && f.protein >= f.proteinTarget * 1.1 ? 1 : 0) },
  { id: 'd-water', title: () => 'Aquädukt: Trinkziel heute', description: 'Dein Trinkziel erreichen.', target: 1, unit: 'Ziel', progress: (f) => (f?.waterHit ? 1 : 0) },
  { id: 'd-mealhits', title: () => 'Drei Punktlandungen', description: 'Drei Mahlzeiten heute im Ziel (± 10 %).', target: 3, unit: 'Punktlandungen', progress: (f) => f?.mealHits ?? 0 },
  { id: 'd-meals', title: () => 'Lagerbuch: 3 Mahlzeiten erfassen', description: 'Mindestens drei Mahlzeiten protokollieren.', target: 3, unit: 'Mahlzeiten', progress: (f) => f?.meals ?? 0 },
  { id: 'd-weigh', title: () => 'Waage des Tages', description: 'Heute dein Gewicht messen.', target: 1, unit: 'Messung', progress: (f) => (f?.weighIn ? 1 : 0) },
  { id: 'd-sleep', title: () => 'Wachbericht: Schlaf eintragen', description: 'Schlafdauer in „Regeneration“ erfassen.', target: 1, unit: 'Eintrag', progress: (f) => (f?.sleepHours != null ? 1 : 0) },
  { id: 'd-mobility', title: () => 'Geschmeidige Glieder', description: '3 Sätze Dehnen oder Mobility.', target: 3, unit: 'Sätze', progress: (f) => f?.mobilitySets ?? 0 },
  { id: 'd-cardio', title: () => 'Botenlauf: 20 Min. Ausdauer', description: 'Eine Ausdauereinheit ab 20 Minuten.', target: 1, unit: 'Einheit', progress: (f) => f?.cardioSessions ?? 0 },
  { id: 'd-early', title: () => 'Morgenappell', description: 'Training vor 9 Uhr beginnen.', target: 1, unit: 'Training', progress: (f) => (f?.earlyWorkout ? 1 : 0), weight: (d, c) => (isPlanDay(d, c) ? 1 : 0.3) },
];

/** An etwa 3 von 5 Tagen erscheint ein Tagesauftrag – stabil je Datum. */
export function dailyQuest(date: string, ctx: QuestCtx): Quest | null {
  if (ctx.sickDays?.has(date)) {
    const f = ctx.facts.get(date);
    const progress = f?.waterHit ? 1 : 0;
    return { id: 'd-heal', title: 'Heiltrank: Trinkziel erreichen', description: 'Krankentag – ruh dich aus und trink genug.', target: 1, unit: 'Ziel', progress, done: progress >= 1 };
  }
  const r = rng('tagesauftrag:' + date);
  if (r() >= 0.6) return null;
  const weights = DAILY_POOL.map((t) => t.weight?.(date, ctx) ?? 1);
  let x = r() * weights.reduce((a, w) => a + w, 0);
  const t = DAILY_POOL.find((_, i) => (x -= weights[i]!) < 0) ?? DAILY_POOL[0]!;
  const f = ctx.facts.get(date);
  const progress = t.progress(f, ctx);
  return { id: t.id, title: t.title(ctx, f), description: t.description, target: t.target, unit: t.unit, progress: Math.min(progress, t.target), done: progress >= t.target };
}
