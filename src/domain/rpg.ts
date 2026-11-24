// RPG-Schicht: Held, Klassen, Attribute, Stufe, Schaden, Bosse, Kolosseum, Schatten-Duell,
// Comeback, Übungs-Meisterschaft, Lebenswerk, Denare, Kampfwert und Teilen-Code.
// Alles wird aus echten Einträgen abgeleitet – nichts wird separat gespeichert außer Held, Käufen und Rivalen.
import type { CardioSession, Measurement, Sex, Workout } from './types';
import type { DayFacts } from './gamification';
import { addDays, rangeDates, startOfWeek } from './dates';
import { epley1RM, isCompletedSet } from './training';

// ---------------------------------------------------------------------------
// Held & Klassen
// ---------------------------------------------------------------------------

export type Domain = 'kraft' | 'ausdauer' | 'disziplin' | 'vitalitaet' | 'beweglichkeit' | 'rekorde';
export const DOMAIN_LABEL: Record<Domain, string> = {
  kraft: 'Kraft',
  ausdauer: 'Ausdauer',
  disziplin: 'Disziplin',
  vitalitaet: 'Vitalität',
  beweglichkeit: 'Beweglichkeit',
  rekorde: 'Bestleistungen',
};

export type HeroClassId = 'legionar' | 'gladiator' | 'cursor' | 'strategos';
export interface HeroClass {
  id: HeroClassId;
  name: string;
  motto: string;
  description: string;
  /** Schadensbonus je Bereich (1.25 = +25 %) */
  bonus: Partial<Record<Domain, number>>;
  primary: AttributeId;
}

export const HERO_CLASSES: HeroClass[] = [
  { id: 'legionar', name: 'Legionär', motto: 'Schild an Schild, Gewicht um Gewicht.', description: '+25 % Schaden aus Krafttraining. Hauptattribut Stärke.', bonus: { kraft: 1.25 }, primary: 'str' },
  { id: 'gladiator', name: 'Gladiator', motto: 'Die Arena vergisst keinen Rekord.', description: '+50 % Schaden aus Bestleistungen, +25 % aus Beweglichkeit. Hauptattribut Gewandtheit.', bonus: { rekorde: 1.5, beweglichkeit: 1.25 }, primary: 'agi' },
  { id: 'cursor', name: 'Cursor', motto: 'Der Bote des Kaisers rastet nie.', description: '+25 % Schaden aus Ausdauer. Hauptattribut Ausdauer.', bonus: { ausdauer: 1.25 }, primary: 'end' },
  { id: 'strategos', name: 'Stratege', motto: 'Schlachten gewinnt man in der Küche.', description: '+25 % Schaden aus Disziplin und Vitalität (Ernährung, Wasser, Erholung). Hauptattribut Disziplin.', bonus: { disziplin: 1.25, vitalitaet: 1.25 }, primary: 'dis' },
];
export const classById = (id: string | undefined) => HERO_CLASSES.find((c) => c.id === id);

export const EMBLEMS = ['aquila', 'gladius', 'scutum', 'corona', 'flamma', 'fulmen'] as const;
export type EmblemId = (typeof EMBLEMS)[number];
export const EMBLEM_LABEL: Record<EmblemId, string> = { aquila: 'Adler', gladius: 'Schwert', scutum: 'Schild', corona: 'Krone', flamma: 'Flamme', fulmen: 'Blitz' };
export const CREST_COLORS = ['#9e1b32', '#d4a64a', '#2f7d5b', '#2f5fa8', '#5b3a8a', '#4a4a4a'] as const;

export type FrameId = 'bronze' | 'silver' | 'gold' | 'purpur';
export type PaletteId = 'imperium' | 'byzanz' | 'smaragd' | 'obsidian';

// ---------------------------------------------------------------------------
// Klasse = Trainingsfokus, Lebensweg = Ernährung
// ---------------------------------------------------------------------------

export interface ClassTraining {
  focus: string;
  guidance: string[];
  /** IDs aus PLAN_TEMPLATES, in Reihenfolge der Empfehlung */
  templates: string[];
  repRange: string;
  quest: { id: string; title: string; description: string; target: number; unit: string; metric: 'strength' | 'sessions' | 'cardio' | 'proteinWater' };
}

export const CLASS_TRAINING: Record<HeroClassId, ClassTraining> = {
  legionar: {
    focus: 'Kraft und Muskelaufbau',
    guidance: ['3–5 Krafteinheiten pro Woche, Grundübungen zuerst', '6–10 Wiederholungen, 2–3 Minuten Pause bei schweren Sätzen', 'Ausdauer als Ergänzung (1–2× locker)'],
    templates: ['ppl-free', 'vitova-upper-lower', 'vitova-tg-ab'],
    repRange: '6–10',
    quest: { id: 'class-legionar', title: 'Disziplin der Legion', description: '3 Krafteinheiten in der Woche.', target: 3, unit: 'Krafteinheiten', metric: 'strength' },
  },
  gladiator: {
    focus: 'Athletik, Zirkel und Beweglichkeit',
    guidance: ['Ganzkörper- und Zirkeltraining, gern Supersätze', '10–15 Wiederholungen, kurze Pausen', 'Mobility und Rumpf in jede Woche einbauen'],
    templates: ['vitova-kinesis', 'vitova-milon', 'bodyweight-home', 'vitova-back'],
    repRange: '10–15',
    quest: { id: 'class-gladiator', title: 'Spiele der Arena', description: '4 Einheiten in der Woche (Kraft oder Ausdauer).', target: 4, unit: 'Einheiten', metric: 'sessions' },
  },
  cursor: {
    focus: 'Ausdauer mit Kraftbasis',
    guidance: ['3 Ausdauereinheiten, überwiegend locker (man kann noch sprechen)', '2 Ganzkörper-Krafteinheiten zur Verletzungsvorbeugung', '12–20 Wiederholungen an den Geräten'],
    templates: ['vitova-milon', 'vitova-tg-ab', 'bodyweight-home'],
    repRange: '12–20',
    quest: { id: 'class-cursor', title: 'Die Botenroute', description: '120 Minuten Ausdauer in der Woche.', target: 120, unit: 'Minuten', metric: 'cardio' },
  },
  strategos: {
    focus: 'Ausgewogen und gesund',
    guidance: ['2–3 Ganzkörpereinheiten plus Rücken und Haltung', '8–12 Wiederholungen, saubere Technik vor Gewicht', 'Ernährung, Wasser und Erholung sind deine Waffen'],
    templates: ['vitova-tg-ab', 'vitova-back', 'vitova-milon'],
    repRange: '8–12',
    quest: { id: 'class-strategos', title: 'Versorgung der Truppe', description: 'An 5 Tagen Protein- und Trinkziel erreichen.', target: 5, unit: 'Tage', metric: 'proteinWater' },
  },
};

export type PathId = 'asket' | 'stoiker' | 'epikureer';
export interface LifePath {
  id: PathId;
  name: string;
  motto: string;
  description: string;
  goal: 'reduce_fat' | 'recomp' | 'build_muscle';
  macroStrategy: 'high_protein' | 'balanced';
  aura: string;
}
export const PATHS: LifePath[] = [
  { id: 'asket', name: 'Asket', motto: 'Weniger ist mehr – aber nie zu wenig.', description: 'Moderates Defizit zum Fettabbau (ca. 0,5 % Körpergewicht pro Woche), eiweißbetont.', goal: 'reduce_fat', macroStrategy: 'high_protein', aura: '#8fc3e8' },
  { id: 'stoiker', name: 'Stoiker', motto: 'Maß halten ist die höchste Kunst.', description: 'Gewicht halten bzw. Rekomposition: kaum Defizit, viel Eiweiß, Muskeln auf- und Fett abbauen.', goal: 'recomp', macroStrategy: 'high_protein', aura: '#e9dcc0' },
  { id: 'epikureer', name: 'Epikureer', motto: 'Wer Großes baut, braucht Material.', description: 'Leichter Überschuss für Muskelaufbau (ca. 0,25 % Körpergewicht pro Woche), ausgewogene Makros.', goal: 'build_muscle', macroStrategy: 'balanced', aura: '#b8434e' },
];
export const pathById = (id: string | undefined) => PATHS.find((p) => p.id === id);
/** Welcher Lebensweg zum aktuellen Ernährungsziel passt */
export function pathForGoal(goal: string | undefined): PathId | null {
  if (goal === 'reduce_fat' || goal === 'lose_weight') return 'asket';
  if (goal === 'recomp' || goal === 'maintain') return 'stoiker';
  if (goal === 'build_muscle' || goal === 'strength') return 'epikureer';
  return null;
}

export interface Hero {
  /** Zufällige ID – erkennt beim Teilen denselben Helden wieder */
  id: string;
  name: string;
  classId: HeroClassId;
  emblem: EmblemId;
  color: string;
  createdAt: string;
  title?: string;
  frame?: FrameId;
  palette?: PaletteId;
  /** Getragene Ausrüstung je Slot (null = leer) */
  loadout?: Partial<Record<'main' | 'off' | 'head' | 'hands' | 'legs' | 'feet', string | null>>;
  /** Rüstungs-Slots, die auf der eigenen Figur ausgeblendet sind (bleiben angelegt) */
  armorHidden?: string[];
  /** Färbung des Rüstungsstoffs (Farb-ID, leer = Original) */
  armorColor?: string;
  /** Frisur, Bart und Farben (siehe domain/appearance) */
  look?: { hair?: string | null; beard?: string | null; scar?: string | null; tattoo?: string | null; eyes?: string | null; hairColor?: string; beardColor?: string };
}

// ---------------------------------------------------------------------------
// Stufe & Attribute
// ---------------------------------------------------------------------------

export const MAX_LEVEL = 99;
export const xpForLevel = (level: number) => 40 * (level - 1) ** 2;

export function heroLevel(xp: number) {
  const level = Math.min(MAX_LEVEL, Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1);
  const cur = xpForLevel(level);
  const next = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  return { level, cur, next, progress: next ? (xp - cur) / (next - cur) : 1, toNext: next ? next - xp : 0 };
}

export type AttributeId = 'str' | 'end' | 'dis' | 'vit' | 'agi';
export const ATTRIBUTE_LABEL: Record<AttributeId, { name: string; source: string }> = {
  str: { name: 'Stärke', source: 'Trainingsvolumen und Bestleistungen' },
  end: { name: 'Ausdauer', source: 'Ausdauerminuten und Kilometer' },
  dis: { name: 'Disziplin', source: 'Protokolltage, Punktlandungen, Proteintage, Feldzüge' },
  vit: { name: 'Vitalität', source: 'Trinkziel, Erholung, Messungen' },
  agi: { name: 'Gewandtheit', source: 'Mobility- und Rückengeräte-Sätze' },
};

export interface AttributeInput {
  facts: DayFacts[];
  prCount: number;
  questsDone: number;
  cardioKm: number;
  classId?: HeroClassId;
}

export const attributeLevel = (points: number) => Math.min(MAX_LEVEL, 1 + Math.floor(1.5 * Math.sqrt(Math.max(0, points))));

export function attributes(i: AttributeInput): Record<AttributeId, { points: number; level: number }> {
  const sum = (fn: (f: DayFacts) => number) => i.facts.reduce((a, f) => a + fn(f), 0);
  const pts: Record<AttributeId, number> = {
    str: sum((f) => f.volume) / 500 + i.prCount * 5,
    end: sum((f) => f.cardioMin) / 10 + i.cardioKm,
    dis: sum((f) => (f.logged ? 2 : 0) + f.mealHits + (f.proteinHit ? 2 : 0)) + i.questsDone * 5,
    vit: sum((f) => (f.waterHit ? 2 : 0) + (f.recovery ? 2 : 0) + (f.weighIn ? 1 : 0)),
    agi: sum((f) => f.mobilitySets) / 2,
  };
  const primary = classById(i.classId)?.primary;
  const out = {} as Record<AttributeId, { points: number; level: number }>;
  for (const k of Object.keys(pts) as AttributeId[]) {
    const p = pts[k] * (k === primary ? 1.1 : 1);
    out[k] = { points: Math.round(p), level: attributeLevel(p) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Schaden
// ---------------------------------------------------------------------------

export type DamageSplit = Record<Domain, number> & { total: number };

/** Schaden eines Tages – belohnt Training und Zielnähe, nie möglichst wenig Essen. */
export function dayDamage(f: DayFacts, classId?: HeroClassId): DamageSplit {
  const raw: Record<Domain, number> = {
    kraft: f.volume / 40,
    ausdauer: f.cardioMin * 4,
    disziplin: (f.logged ? 20 : 0) + (f.proteinHit ? 15 : 0) + (f.caloriesHit ? 15 : 0) + f.mealHits * 10,
    vitalitaet: (f.waterHit ? 10 : 0) + (f.recovery ? 10 : 0) + (f.weighIn ? 5 : 0),
    beweglichkeit: f.mobilitySets * 8,
    rekorde: Math.min(5, f.prs) * 40,
  };
  const bonus = classById(classId)?.bonus ?? {};
  const out = { total: 0 } as DamageSplit;
  for (const k of Object.keys(raw) as Domain[]) {
    out[k] = Math.round(raw[k] * (bonus[k] ?? 1));
    out.total += out[k];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Feldzug (Bosse auf der Provinzkarte)
// ---------------------------------------------------------------------------

export interface Boss {
  id: string;
  province: string;
  name: string;
  epithet: string;
  hp: number;
}

export const CAMPAIGN: Boss[] = [
  { id: 'gallia', province: 'Gallia', name: 'Vercingetorix', epithet: 'Fürst der Arverner', hp: 1000 },
  { id: 'germania', province: 'Germania', name: 'Arminius', epithet: 'Schatten des Teutoburger Waldes', hp: 2500 },
  { id: 'britannia', province: 'Britannia', name: 'Boudicca', epithet: 'Königin der Icener', hp: 4000 },
  { id: 'hispania', province: 'Hispania', name: 'Viriathus', epithet: 'Hirte und Rebell', hp: 6000 },
  { id: 'dacia', province: 'Dacia', name: 'Decebalus', epithet: 'König der Daker', hp: 8000 },
  { id: 'africa', province: 'Africa', name: 'Iugurtha', epithet: 'König von Numidien', hp: 10000 },
  { id: 'aegyptus', province: 'Aegyptus', name: 'Der Wächter von Sobek', epithet: 'Herr des Nils', hp: 12500 },
  { id: 'armenia', province: 'Armenia', name: 'Tiridates', epithet: 'König der Berge', hp: 15000 },
  { id: 'parthia', province: 'Parthia', name: 'Surena', epithet: 'Feldherr von Carrhae', hp: 18000 },
  { id: 'pannonia', province: 'Pannonia', name: 'Attila', epithet: 'Geißel Gottes', hp: 21000 },
  { id: 'persia', province: 'Persis', name: 'Schapur', epithet: 'König der Könige', hp: 25000 },
  { id: 'pons-milvius', province: 'Pons Milvius', name: 'Maxentius', epithet: 'Letzter Gegner Konstantins', hp: 30000 },
];
export const ENDLESS_HP = 30000;

export function bossAt(index: number): Boss {
  const b = CAMPAIGN[index];
  if (b) return b;
  const n = index - CAMPAIGN.length + 1;
  return { id: `limes-${n}`, province: 'Limes', name: `Barbarenheer ${toRoman(n)}`, epithet: 'Grenzwacht – endloser Feldzug', hp: ENDLESS_HP };
}

/** Bilddatei des Bosses in src/assets/rpg (ohne Endung) */
export function bossFile(b: Pick<Boss, 'id' | 'name'>): string {
  if (b.id === 'aegyptus') return 'boss_sobek';
  if (b.id.startsWith('limes')) return 'boss_barbarenheer';
  return `boss_${b.name.toLowerCase().replace(/\s+/g, '-')}`;
}

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let x = Math.max(1, Math.floor(n));
  for (const [v, s] of map) while (x >= v) {
    out += s;
    x -= v;
  }
  return out;
}

export interface CampaignState {
  defeated: { boss: Boss; date: string }[];
  current: { boss: Boss; index: number; dealt: number; remaining: number };
  totalDamage: number;
}

/** `damage` = Tagesschaden chronologisch; überschüssiger Schaden geht auf den nächsten Boss über. */
export function campaign(damage: { date: string; dmg: number }[]): CampaignState {
  const defeated: CampaignState['defeated'] = [];
  let index = 0;
  let dealt = 0;
  let total = 0;
  for (const d of [...damage].sort((a, b) => a.date.localeCompare(b.date))) {
    total += d.dmg;
    dealt += d.dmg;
    while (dealt >= bossAt(index).hp) {
      dealt -= bossAt(index).hp;
      defeated.push({ boss: bossAt(index), date: d.date });
      index++;
    }
  }
  const boss = bossAt(index);
  return { defeated, current: { boss, index, dealt, remaining: boss.hp - dealt }, totalDamage: total };
}

// ---------------------------------------------------------------------------
// Kolosseum (Monats-Boss)
// ---------------------------------------------------------------------------

export const COLOSSEUM_HP = 4500;
const GLADIATORS = ['Spiculus', 'Flamma', 'Priscus', 'Verus', 'Carpophorus', 'Tetraites', 'Hermes', 'Triumphus', 'Celadus', 'Crescens', 'Marcus Attilius', 'Commodus'];

export function colosseumBossName(month: string) {
  return GLADIATORS[(Number(month.slice(5, 7)) - 1 + Number(month.slice(0, 4))) % GLADIATORS.length]!;
}

export function colosseum(month: string, damage: { date: string; dmg: number }[], today: string) {
  let dealt = 0;
  let defeatedOn: string | null = null;
  for (const d of [...damage].filter((x) => x.date.startsWith(month) && x.date <= today).sort((a, b) => a.date.localeCompare(b.date))) {
    dealt += d.dmg;
    if (!defeatedOn && dealt >= COLOSSEUM_HP) defeatedOn = d.date;
  }
  return { month, name: colosseumBossName(month), hp: COLOSSEUM_HP, dealt: Math.min(dealt, COLOSSEUM_HP), defeatedOn };
}

// ---------------------------------------------------------------------------
// Schatten-Gladiator (du vs. du vor 4 Wochen)
// ---------------------------------------------------------------------------

export interface DuelMetric {
  id: string;
  label: string;
  unit: string;
  me: number;
  shadow: number;
}

export interface Duel {
  weekStart: string;
  shadowWeekStart: string;
  metrics: DuelMetric[];
  wins: number;
  losses: number;
  /** null = kein Schatten (vor 4 Wochen keine Daten) */
  won: boolean | null;
  complete: boolean;
}

function weekTotals(weekStart: string, facts: Map<string, DayFacts>, upto: string) {
  const days = rangeDates(weekStart, addDays(weekStart, 6)).filter((d) => d <= upto);
  const f = days.map((d) => facts.get(d)).filter((x): x is DayFacts => !!x);
  return {
    any: f.some((x) => x.logged || x.workouts || x.cardioMin || x.weighIn || x.waterHit || x.recovery),
    sessions: f.reduce((a, x) => a + x.workouts + x.cardioSessions, 0),
    volume: Math.round(f.reduce((a, x) => a + x.volume, 0)),
    logged: f.filter((x) => x.logged).length,
    cardio: Math.round(f.reduce((a, x) => a + x.cardioMin, 0)),
  };
}

/** Vergleich mit derselben Wochenlänge vor 4 Wochen (laufende Woche: gleich viele Tage). */
export function shadowDuel(weekStart: string, facts: Map<string, DayFacts>, today: string): Duel {
  const shadowWeekStart = addDays(weekStart, -28);
  const complete = addDays(weekStart, 6) < today;
  const me = weekTotals(weekStart, facts, today);
  const shadow = weekTotals(shadowWeekStart, facts, complete ? addDays(shadowWeekStart, 6) : addDays(today, -28));
  const metrics: DuelMetric[] = [
    { id: 'sessions', label: 'Einheiten', unit: '', me: me.sessions, shadow: shadow.sessions },
    { id: 'volume', label: 'Volumen', unit: 'kg', me: me.volume, shadow: shadow.volume },
    { id: 'logged', label: 'Protokolltage', unit: 'Tage', me: me.logged, shadow: shadow.logged },
    { id: 'cardio', label: 'Ausdauer', unit: 'min', me: me.cardio, shadow: shadow.cardio },
  ];
  const wins = metrics.filter((m) => m.me > m.shadow).length;
  const losses = metrics.filter((m) => m.me < m.shadow).length;
  const fullShadow = weekTotals(shadowWeekStart, facts, addDays(shadowWeekStart, 6));
  return { weekStart, shadowWeekStart, metrics, wins, losses, won: fullShadow.any ? wins > losses : null, complete };
}

// ---------------------------------------------------------------------------
// Comeback
// ---------------------------------------------------------------------------

export const COMEBACK_GAP_DAYS = 8; // mind. 7 trainingsfreie Tage dazwischen
export const COMEBACK_COOLDOWN_DAYS = 14;

/** Daten von Trainingstagen, an denen nach einer Pause wieder trainiert wurde. */
export function comebackDates(trainingDates: string[]): string[] {
  const days = [...new Set(trainingDates)].sort();
  const out: string[] = [];
  for (let k = 1; k < days.length; k++) {
    const prev = days[k - 1]!;
    const d = days[k]!;
    if (addDays(prev, COMEBACK_GAP_DAYS) <= d) {
      const last = out[out.length - 1];
      if (!last || addDays(last, COMEBACK_COOLDOWN_DAYS) <= d) out.push(d);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Übungs-Meisterschaft
// ---------------------------------------------------------------------------

export const MASTERY_TIERS = ['Bronze', 'Silber', 'Gold', 'Purpur'] as const;

/** Richtwerte e1RM / Körpergewicht (Männer). Frauen: × 0,65. Orientierung, keine Norm. */
export const LIFT_STANDARDS: Record<string, [number, number, number, number]> = {
  'bench-press': [0.75, 1.0, 1.25, 1.5],
  squat: [1.0, 1.25, 1.5, 2.0],
  deadlift: [1.25, 1.5, 2.0, 2.5],
  'overhead-press': [0.45, 0.6, 0.75, 0.9],
  'barbell-row': [0.6, 0.8, 1.0, 1.2],
};
export const FEMALE_FACTOR = 0.65;
/** Steigerung des besten e1RM gegenüber der ersten Einheit */
export const PROGRESS_TIERS: [number, number, number, number] = [0.1, 0.25, 0.5, 1.0];

export interface MasteryEntry {
  exerciseId: string;
  name: string;
  kind: 'standard' | 'progress';
  /** 0 = noch keine Stufe, 1..4 = Bronze..Purpur */
  tier: number;
  /** Verhältnis zum Körpergewicht bzw. Steigerung (0,25 = +25 %) */
  value: number;
  thresholds: [number, number, number, number];
  reached: { tier: number; date: string }[];
  sessions: number;
}

export function exerciseMastery(workouts: Workout[], measurements: Measurement[], sex: Sex = 'male'): MasteryEntry[] {
  const weights = measurements.filter((m) => m.weightKg != null).sort((a, b) => a.date.localeCompare(b.date));
  const bwAt = (w: Workout) => {
    if (w.bodyWeightKg) return w.bodyWeightKg;
    let bw: number | null = null;
    for (const m of weights) if (m.date <= w.date) bw = m.weightKg!;
    return bw ?? weights[0]?.weightKg ?? null;
  };
  const per = new Map<string, MasteryEntry & { baseline: number | null; best: number }>();
  for (const w of [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    for (const e of w.exercises) {
      const sets = e.sets.filter((s) => isCompletedSet(s) && (s.weightKg ?? 0) > 0 && (s.reps ?? 0) >= 1 && (s.reps ?? 0) <= 12);
      if (!sets.length) continue;
      const e1 = Math.max(...sets.map((s) => epley1RM(s.weightKg!, s.reps!)));
      const std = LIFT_STANDARDS[e.exerciseId];
      let m = per.get(e.exerciseId);
      if (!m) {
        const thresholds = std ? (std.map((r) => Math.round(r * (sex === 'female' ? FEMALE_FACTOR : 1) * 100) / 100) as MasteryEntry['thresholds']) : PROGRESS_TIERS;
        m = { exerciseId: e.exerciseId, name: e.name, kind: std ? 'standard' : 'progress', tier: 0, value: 0, thresholds, reached: [], sessions: 0, baseline: null, best: 0 };
        per.set(e.exerciseId, m);
      }
      m.sessions++;
      m.best = Math.max(m.best, e1);
      let value: number | null = null;
      if (m.kind === 'standard') {
        const bw = bwAt(w);
        if (bw) value = Math.round((e1 / bw) * 100) / 100;
      } else if (m.baseline == null) {
        m.baseline = e1;
      } else {
        value = Math.round((m.best / m.baseline - 1) * 100) / 100;
      }
      if (value == null) continue;
      m.value = Math.max(m.value, value);
      const tier = m.thresholds.filter((t) => m!.value >= t).length;
      for (let t = m.tier + 1; t <= tier; t++) m.reached.push({ tier: t, date: w.date });
      m.tier = Math.max(m.tier, tier);
    }
  }
  return [...per.values()].map(({ baseline: _b, best: _x, ...m }) => m).sort((a, b) => b.tier - a.tier || (a.kind === 'standard' ? -1 : 1) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Lebenswerk
// ---------------------------------------------------------------------------

export const WEIGHT_COMPARISONS = [
  { kg: 45000, singular: 'Kriegsgaleere (Trireme, ca. 45 t)', plural: 'Kriegsgaleeren (Triremen, je ca. 45 t)' },
  { kg: 5000, singular: 'Kriegselefant (ca. 5 t)', plural: 'Kriegselefanten (je ca. 5 t)' },
  { kg: 500, singular: 'Schlachtross (ca. 500 kg)', plural: 'Schlachtrösser (je ca. 500 kg)' },
  { kg: 30, singular: 'Legionärsgepäck (ca. 30 kg)', plural: 'Legionärsgepäcke (je ca. 30 kg)' },
];
export const VIA_APPIA_KM = 540; // Rom – Brundisium, ca.

export function weightComparison(kg: number) {
  const c = WEIGHT_COMPARISONS.find((x) => kg >= x.kg) ?? WEIGHT_COMPARISONS[WEIGHT_COMPARISONS.length - 1]!;
  const n = kg / c.kg;
  return { count: n, label: Math.abs(n - 1) < 0.05 ? c.singular : c.plural };
}

export function lifeWork(facts: DayFacts[], workouts: Workout[], cardio: CardioSession[]) {
  const volume = facts.reduce((a, f) => a + f.volume, 0);
  const km = cardio.reduce((a, c) => a + (c.distanceKm ?? 0), 0);
  const hours = (workouts.reduce((a, w) => a + w.durationSec, 0) / 3600) + cardio.reduce((a, c) => a + c.durationMin, 0) / 60;
  const sets = workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter(isCompletedSet).length, 0), 0);
  return { volume: Math.round(volume), comparison: weightComparison(volume), km: Math.round(km * 10) / 10, viaAppia: km / VIA_APPIA_KM, hours: Math.round(hours * 10) / 10, sets, sessions: workouts.length + cardio.length };
}

// ---------------------------------------------------------------------------
// Denare & Markt
// ---------------------------------------------------------------------------

export const XP_PER_DENAR = 10;

export interface ShopItem {
  id: string;
  kind: 'palette' | 'title' | 'frame';
  name: string;
  description: string;
  price: number;
  value: string;
}

export const SHOP: ShopItem[] = [
  { id: 'palette-byzanz', kind: 'palette', name: 'Byzanz', description: 'Kaiserliches Violett mit Gold.', price: 300, value: 'byzanz' },
  { id: 'palette-smaragd', kind: 'palette', name: 'Smaragd', description: 'Tiefgrün mit Gold – die Gärten des Palatin.', price: 300, value: 'smaragd' },
  { id: 'palette-obsidian', kind: 'palette', name: 'Obsidian', description: 'Stahl und Silber der Prätorianer.', price: 500, value: 'obsidian' },
  { id: 'frame-silver', kind: 'frame', name: 'Silberkranz', description: 'Silberner Lorbeer um dein Wappen.', price: 200, value: 'silver' },
  { id: 'frame-gold', kind: 'frame', name: 'Goldkranz', description: 'Goldener Lorbeer um dein Wappen.', price: 500, value: 'gold' },
  { id: 'frame-purpur', kind: 'frame', name: 'Purpurkranz', description: 'Der Kranz der Imperatoren.', price: 900, value: 'purpur' },
  { id: 'title-unbeugsam', kind: 'title', name: 'der Unbeugsame', description: 'Titel hinter deinem Namen.', price: 150, value: 'der Unbeugsame' },
  { id: 'title-arena', kind: 'title', name: 'Liebling der Arena', description: 'Titel hinter deinem Namen.', price: 250, value: 'Liebling der Arena' },
  { id: 'title-limes', kind: 'title', name: 'Hüter des Limes', description: 'Titel hinter deinem Namen.', price: 400, value: 'Hüter des Limes' },
  { id: 'title-augustus', kind: 'title', name: 'Augustus', description: 'Der Erhabene. Nur für die Ausdauerndsten.', price: 1500, value: 'Augustus' },
];

/** Denare aus EP plus Belohnungen aus Erfolgen, minus Käufe. `extraPrices` für Käufe außerhalb des SHOP-Katalogs (z. B. Start-Ausrüstung). */
export function denare(xp: number, purchases: string[], bonus = 0, extraPrices: Record<string, number> = {}) {
  const earned = Math.floor(Math.max(0, xp) / XP_PER_DENAR) + bonus;
  const spent = purchases.reduce((a, id) => a + (SHOP.find((s) => s.id === id)?.price ?? extraPrices[id] ?? 0), 0);
  return { earned, spent, balance: earned - spent };
}

// ---------------------------------------------------------------------------
// Kampfwert (startunabhängig vergleichbar) & Teilen
// ---------------------------------------------------------------------------

export const SCORE_WINDOW_DAYS = 28;

/**
 * Kampfwert = EP der letzten 28 Tage. Egal wann jemand angefangen hat: Jeder sammelt im
 * gleichen Zeitfenster. Dazu Ø EP pro Woche seit dem ersten aktiven Tag.
 */
export function battleScore(xpByDay: Map<string, number>, today: string) {
  const from = addDays(today, -(SCORE_WINDOW_DAYS - 1));
  let score = 0;
  let total = 0;
  let start: string | null = null;
  for (const [d, xp] of xpByDay) {
    if (d > today || xp <= 0) continue;
    total += xp;
    if (!start || d < start) start = d;
    if (d >= from) score += xp;
  }
  const days = start ? rangeDates(start, today).length : 0;
  const windowDays = start ? Math.min(SCORE_WINDOW_DAYS, days) : 0;
  return { score: Math.round(score), avgWeek: days ? Math.round((total / Math.max(7, days)) * 7) : 0, start, days, windowDays };
}

export interface ShareCard {
  v: 1;
  /** Helden-ID */
  id: string;
  /** Name */
  n: string;
  /** Klasse */
  k: HeroClassId;
  /** Emblem, Farbe, Titel, Rahmen */
  e: EmblemId;
  col: string;
  t?: string;
  fr?: FrameId;
  /** Stufe, EP gesamt, Kampfwert (28 T), Ø EP/Woche, Tage seit Start */
  l: number;
  x: number;
  f: number;
  w: number;
  s: number;
  /** besiegte Feldzugs-Bosse, Kolosseum-Siege */
  b: number;
  c: number;
  /** Stand (YYYY-MM-DD) */
  d: string;
}

function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0').slice(-5);
}

const toB64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function encodeShare(card: ShareCard): string {
  const body = toB64Url(JSON.stringify(card));
  return `FC1.${body}.${fnv1a(body)}`;
}

const isNum = (v: unknown, max = 1e9) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const isStr = (v: unknown, max = 60) => typeof v === 'string' && v.length > 0 && v.length <= max;

export function decodeShare(raw: string): ShareCard {
  const code = raw.trim().match(/FC1\.[A-Za-z0-9_-]+\.[0-9a-z]{5}/)?.[0];
  if (!code) throw new Error('Kein gültiger FitCore-Arena-Code gefunden.');
  const [, body, sum] = code.split('.') as [string, string, string];
  if (fnv1a(body) !== sum) throw new Error('Der Code ist beschädigt oder unvollständig. Bitte erneut teilen lassen.');
  let c: Partial<ShareCard>;
  try {
    c = JSON.parse(fromB64Url(body));
  } catch {
    throw new Error('Der Code konnte nicht gelesen werden.');
  }
  const ok =
    c.v === 1 &&
    isStr(c.id, 40) &&
    isStr(c.n, 40) &&
    !!classById(c.k) &&
    EMBLEMS.includes(c.e as EmblemId) &&
    isStr(c.col, 20) &&
    (c.t == null || isStr(c.t, 40)) &&
    (c.fr == null || ['bronze', 'silver', 'gold', 'purpur'].includes(c.fr)) &&
    isNum(c.l, MAX_LEVEL) &&
    isNum(c.x) &&
    isNum(c.f) &&
    isNum(c.w) &&
    isNum(c.s, 100000) &&
    isNum(c.b, 10000) &&
    isNum(c.c, 10000) &&
    typeof c.d === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.d);
  if (!ok) throw new Error('Der Code enthält ungültige Werte.');
  return c as ShareCard;
}

// ---------------------------------------------------------------------------
// Triumphzug (Wochenrückblick)
// ---------------------------------------------------------------------------

export interface WeekRecap {
  weekStart: string;
  xp: number;
  damage: number;
  sessions: number;
  volume: number;
  cardioMin: number;
  loggedDays: number;
  mealHits: number;
  prs: number;
  duel: Duel;
}

export function weekRecap(weekStart: string, facts: Map<string, DayFacts>, xpByDay: Map<string, number>, damageByDay: Map<string, number>, today: string): WeekRecap {
  const days = rangeDates(weekStart, addDays(weekStart, 6)).filter((d) => d <= today);
  const f = days.map((d) => facts.get(d)).filter((x): x is DayFacts => !!x);
  return {
    weekStart,
    xp: days.reduce((a, d) => a + (xpByDay.get(d) ?? 0), 0),
    damage: days.reduce((a, d) => a + (damageByDay.get(d) ?? 0), 0),
    sessions: f.reduce((a, x) => a + x.workouts + x.cardioSessions, 0),
    volume: Math.round(f.reduce((a, x) => a + x.volume, 0)),
    cardioMin: Math.round(f.reduce((a, x) => a + x.cardioMin, 0)),
    loggedDays: f.filter((x) => x.logged).length,
    mealHits: f.reduce((a, x) => a + x.mealHits, 0),
    prs: f.reduce((a, x) => a + x.prs, 0),
    duel: shadowDuel(weekStart, facts, today),
  };
}

/** Welche Woche der Triumphzug zeigt: sonntags ab 18 Uhr die laufende, sonst die vergangene. */
export function triumphWeek(today: string, hour: number) {
  const ws = startOfWeek(today);
  const isSunday = addDays(ws, 6) === today;
  return isSunday && hour >= 18 ? ws : addDays(ws, -7);
}
