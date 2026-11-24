import { describe, expect, it } from 'vitest';
import {
  attributes,
  battleScore,
  bossAt,
  campaign,
  CAMPAIGN,
  colosseum,
  COLOSSEUM_HP,
  comebackDates,
  dayDamage,
  decodeShare,
  denare,
  encodeShare,
  exerciseMastery,
  heroLevel,
  shadowDuel,
  toRoman,
  triumphWeek,
  weightComparison,
  type ShareCard,
} from '@/domain/rpg';
import { computeGame, type DayFacts, type GameInput } from '@/domain/gamification';
import { emptyDayFacts } from '@/domain/gamification';
import { mealHitsByDay } from '@/domain/mealGame';
import { addDays } from '@/domain/dates';
import type { DiaryEntry, GoalVersion, Measurement } from '@/domain/types';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { ex, set, workout } from './fixtures';

const fact = (date: string, over: Partial<DayFacts> = {}): DayFacts => ({
  ...emptyDayFacts(date), ...over,
});
const goal = { id: 1, effectiveFrom: '2026-01-01', calorieTarget: 2000, proteinG: 150 } as GoalVersion;
const entry = (date: string, meal: string, kcal: number, createdAt: string): DiaryEntry => ({
  id: date + meal + createdAt, date, meal, name: 'x', source: 'custom', amount: 1, unit: 'g', grams: 1,
  per100: { kcal, protein: 0, carbs: 0, fat: 0 }, nutrients: { kcal, protein: 0, carbs: 0, fat: 0 }, createdAt, updatedAt: createdAt,
});
const base = (over: Partial<GameInput> = {}): GameInput => ({
  today: '2026-03-31', entries: [], goals: [goal], workouts: [], cardio: [], measurements: [], water: [], recovery: [], recipesCount: 0,
  exercises: EXERCISE_LIBRARY, trainingDaysPerWeek: 3, waterGoalMl: 2500, ...over,
});

describe('Stufe & Attribute', () => {
  it('Stufe aus EP: 40·(L−1)², gedeckelt bei 99', () => {
    expect(heroLevel(0).level).toBe(1);
    expect(heroLevel(39).level).toBe(1);
    expect(heroLevel(40).level).toBe(2);
    expect(heroLevel(3240).level).toBe(10);
    expect(heroLevel(3239).level).toBe(9);
    expect(heroLevel(10_000_000).level).toBe(99);
    expect(heroLevel(100).progress).toBeCloseTo((100 - 40) / (160 - 40), 5);
  });
  it('Klasse gibt +10 % auf das Hauptattribut', () => {
    const facts = [fact('2026-01-01', { volume: 50000 })];
    const neutral = attributes({ facts, prCount: 0, questsDone: 0, cardioKm: 0 });
    const legion = attributes({ facts, prCount: 0, questsDone: 0, cardioKm: 0, classId: 'legionar' });
    expect(neutral.str.points).toBe(100);
    expect(legion.str.points).toBe(110);
    expect(neutral.str.level).toBe(16); // 1 + ⌊1,5·√100⌋
  });
});

describe('Schaden', () => {
  it('Tagesschaden je Bereich, Klassenbonus nur im eigenen Bereich', () => {
    const f = fact('2026-01-01', { volume: 8000, cardioMin: 30, logged: true, proteinHit: true, caloriesHit: true, mealHits: 2, waterHit: true, prs: 1, mobilitySets: 2 });
    const d = dayDamage(f);
    expect(d).toMatchObject({ kraft: 200, ausdauer: 120, disziplin: 70, vitalitaet: 10, beweglichkeit: 16, rekorde: 40 });
    expect(d.total).toBe(456);
    expect(dayDamage(f, 'legionar').kraft).toBe(250);
    expect(dayDamage(f, 'legionar').ausdauer).toBe(120);
    expect(dayDamage(f, 'gladiator').rekorde).toBe(60);
  });
  it('wenig essen bringt keinen Schaden: 0 kcal-Tag ohne Treffer = nur Protokollpunkte', () => {
    expect(dayDamage(fact('2026-01-01', { logged: true })).total).toBe(20);
  });
});

describe('Feldzug & Kolosseum', () => {
  it('Überschuss geht auf den nächsten Boss über, Datum der Niederlage stimmt', () => {
    const c = campaign([{ date: '2026-01-02', dmg: 600 }, { date: '2026-01-01', dmg: 600 }, { date: '2026-01-03', dmg: 2400 }]);
    expect(c.defeated.map((d) => [d.boss.id, d.date])).toEqual([['gallia', '2026-01-02'], ['germania', '2026-01-03']]);
    expect(c.current.boss.id).toBe('britannia');
    expect(c.current.dealt).toBe(100);
    expect(c.totalDamage).toBe(3600);
  });
  it('nach dem letzten Boss folgt der endlose Limes', () => {
    expect(bossAt(CAMPAIGN.length).name).toBe('Barbarenheer I');
    expect(bossAt(CAMPAIGN.length + 3).name).toBe('Barbarenheer IV');
    expect(toRoman(1994)).toBe('MCMXCIV');
  });
  it('Kolosseum: Monatsschaden, Siegdatum, nur bis heute', () => {
    const dmg = [{ date: '2026-02-27', dmg: 4000 }, { date: '2026-03-01', dmg: 3000 }, { date: '2026-03-10', dmg: 1600 }, { date: '2026-03-20', dmg: 5000 }];
    const c = colosseum('2026-03', dmg, '2026-03-15');
    expect(c).toMatchObject({ dealt: COLOSSEUM_HP, defeatedOn: '2026-03-10' });
    expect(colosseum('2026-03', dmg, '2026-03-05')).toMatchObject({ dealt: 3000, defeatedOn: null });
  });
});

describe('Schatten-Duell & Comeback', () => {
  it('gewinnt, wenn mehr Kennzahlen besser sind als vor 4 Wochen; ohne Schatten kein Ergebnis', () => {
    const facts = new Map<string, DayFacts>();
    const put = (f: DayFacts) => facts.set(f.date, f);
    put(fact('2026-02-02', { workouts: 1, volume: 5000, logged: true }));
    put(fact('2026-03-02', { workouts: 2, volume: 6000, logged: true }));
    const d = shadowDuel('2026-03-02', facts, '2026-03-20');
    expect(d.shadowWeekStart).toBe('2026-02-02');
    expect(d).toMatchObject({ wins: 2, losses: 0, won: true, complete: true });
    expect(shadowDuel('2026-02-02', facts, '2026-03-20').won).toBeNull();
  });
  it('Comeback erst nach ≥ 7 freien Tagen und höchstens alle 14 Tage', () => {
    expect(comebackDates(['2026-01-01', '2026-01-08'])).toEqual([]);
    expect(comebackDates(['2026-01-01', '2026-01-09'])).toEqual(['2026-01-09']);
    expect(comebackDates(['2026-01-01', '2026-01-09', '2026-01-18'])).toEqual(['2026-01-09']);
    expect(comebackDates(['2026-01-01', '2026-01-09', '2026-01-24'])).toEqual(['2026-01-09', '2026-01-24']);
  });
});

describe('Übungs-Meisterschaft', () => {
  it('Richtwert-Übung: e1RM/Körpergewicht, Frauen × 0,65; Stufen mit Datum', () => {
    const w1 = workout('1', '2026-01-05', [ex('bench-press', [set(60, 10)])]); // e1RM 80 bei 80 kg → 1,0 → Silber
    const w2 = workout('2', '2026-02-05', [ex('bench-press', [set(90, 5)])], { startedAt: '2026-02-05T10:00:00Z' }); // 105 → 1,31 → Gold
    const [m] = exerciseMastery([w2, w1], [], 'male');
    expect(m).toMatchObject({ kind: 'standard', tier: 3, value: 1.31 });
    expect(m!.reached).toEqual([{ tier: 1, date: '2026-01-05' }, { tier: 2, date: '2026-01-05' }, { tier: 3, date: '2026-02-05' }]);
    const [f] = exerciseMastery([w1], [], 'female');
    expect(f!.thresholds[0]).toBeCloseTo(0.49, 2);
    expect(f!.tier).toBe(4); // 1,0 ≥ 0,98
  });
  it('andere Übungen: Steigerung gegenüber der ersten Einheit; Körpergewicht aus Messung', () => {
    const w1 = workout('1', '2026-01-05', [ex('leg-press', [set(100, 10)])], { bodyWeightKg: null });
    const w2 = workout('2', '2026-01-20', [ex('leg-press', [set(130, 10)])], { bodyWeightKg: null, startedAt: '2026-01-20T10:00:00Z' });
    const [m] = exerciseMastery([w1, w2], [], 'male');
    expect(m).toMatchObject({ kind: 'progress', tier: 2, value: 0.3 });
    const sq = workout('3', '2026-01-05', [ex('squat', [set(100, 1)])], { bodyWeightKg: null });
    const ms: Measurement[] = [{ id: 1, date: '2026-01-01', weightKg: 100, createdAt: '' } as unknown as Measurement];
    expect(exerciseMastery([sq], ms, 'male')[0]).toMatchObject({ value: 1, tier: 1 });
  });
});

describe('Kampfwert, Denare, Teilen', () => {
  it('Kampfwert = EP der letzten 28 Tage; Ø pro Woche seit Start', () => {
    const xp = new Map<string, number>([['2026-01-01', 1000], ['2026-03-10', 300], ['2026-03-31', 200], ['2026-04-02', 999]]);
    const b = battleScore(xp, '2026-03-31');
    expect(b.score).toBe(500);
    expect(b.start).toBe('2026-01-01');
    expect(b.days).toBe(90);
    expect(b.avgWeek).toBe(Math.round((1500 / 90) * 7));
  });
  it('zwei Spieler mit gleichem Verhalten haben trotz anderem Start denselben Kampfwert', () => {
    const daily = (from: string, days: number) => new Map(Array.from({ length: days }, (_, k) => [addDays(from, k), 100] as [string, number]));
    const veteran = battleScore(daily('2025-01-01', 455), '2026-03-31');
    const rookie = battleScore(daily('2026-03-01', 31), '2026-03-31');
    expect(veteran.score).toBe(2800);
    expect(rookie.score).toBe(2800);
    expect(veteran.avgWeek).toBe(700);
    expect(rookie.avgWeek).toBe(700);
  });
  it('Denare: 1 je 10 EP minus Käufe', () => {
    expect(denare(2345, ['palette-byzanz', 'title-unbeugsam'])).toEqual({ earned: 234, spent: 450, balance: -216 });
  });
  it('Teilen-Code: Hin- und Rückweg, Umlaute, Prüfsumme, ungültige Werte', () => {
    const card: ShareCard = { v: 1, id: 'abc123', n: 'Jürgen Größe', k: 'legionar', e: 'aquila', col: '#9e1b32', t: 'der Unbeugsame', l: 12, x: 5400, f: 2100, w: 650, s: 60, b: 3, c: 1, d: '2026-03-31' };
    const code = encodeShare(card);
    expect(code).toMatch(/^FC1\.[A-Za-z0-9_-]+\.[0-9a-z]{5}$/);
    expect(decodeShare(`Schau mal: https://x.y/#/erfolge?rivale=${code} !`)).toEqual(card);
    const broken = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11);
    expect(() => decodeShare(broken)).toThrow(/beschädigt/);
    expect(() => decodeShare('hallo')).toThrow(/Kein gültiger/);
    expect(() => decodeShare(encodeShare({ ...card, l: 500 }))).toThrow(/ungültige Werte/);
  });
});

describe('Integration in computeGame', () => {
  it('Punktlandungen aus der Historie geben EP, Schaden und zählen für Abzeichen', () => {
    const d = '2026-03-31';
    const entries = [entry(d, 'breakfast', 500, d + 'T07:00'), entry(d, 'lunch', 700, d + 'T12:00'), entry(d, 'dinner', 600, d + 'T19:00'), entry(d, 'snack', 200, d + 'T21:00')];
    const mealHits = mealHitsByDay({ entries, goals: [goal], workouts: [], cardio: [], mealIds: ['breakfast', 'lunch', 'dinner', 'snack'], split: {} });
    expect(mealHits.get(d)).toEqual({ targeted: 4, hits: 4, perfect: true });
    const g = computeGame(base({ entries, mealHits }));
    expect(g.breakdown.mealHit.xp).toBe(20);
    expect(g.breakdown.perfectDay.xp).toBe(15);
    expect(g.mealHitsTotal).toBe(4);
    expect(g.badges.find((b) => b.id === 'perfect')?.tier).toBe('bronze');
    expect(g.damageByDay.get(d)).toBe(20 + 15 + 40); // protokolliert, Kalorien getroffen, 4 Punktlandungen
  });
  it('Meisterschaft, Comeback und Boss-Siege geben EP am richtigen Tag', () => {
    const w1 = workout('1', '2026-03-01', [ex('bench-press', [set(60, 10)])]);
    const w2 = workout('2', '2026-03-20', [ex('bench-press', [set(60, 10)])], { startedAt: '2026-03-20T10:00:00Z' });
    const g = computeGame(base({ workouts: [w1, w2], heroClass: 'legionar' }));
    expect(g.breakdown.mastery.count).toBe(2); // Bronze + Silber
    expect(g.xpByDay.get('2026-03-01')).toBe(50 + 50);
    expect(g.comebacks).toEqual(['2026-03-20']);
    expect(g.breakdown.comeback.xp).toBe(50);
    // Bosse gibt es nur noch auf der Weltkarte – Trainingsschaden zählt nur für die Übernahme alter Spielstände
    expect(g.campaign.defeated).toEqual([]);
    expect(g.damageByDay.get('2026-03-01')).toBe(Math.round((600 / 40) * 1.25));
  });
  it('EP-Summe entspricht der Summe der Tages-EP (Kampfwert ist konsistent)', () => {
    const ws = Array.from({ length: 10 }, (_, k) => workout('w' + k, addDays('2026-03-01', k * 3), [ex('bench-press', [set(60 + k * 5, 10)])], { startedAt: addDays('2026-03-01', k * 3) + 'T10:00:00Z' }));
    const g = computeGame(base({ workouts: ws }));
    expect([...g.xpByDay.values()].reduce((a, b) => a + b, 0)).toBe(g.xp);
    const inWindow = [...g.xpByDay].filter(([d]) => d >= '2026-03-04').reduce((a, [, x]) => a + x, 0);
    expect(g.battle.score).toBe(inWindow); // Fenster 4.3.–31.3.
    expect(g.battle.score).toBeLessThan(g.xp);
  });
});

describe('Lebenswerk & Triumphzug', () => {
  it('Vergleichsobjekt passend zur Größenordnung', () => {
    expect(weightComparison(12000).label).toContain('Kriegselefanten');
    expect(weightComparison(12000).count).toBeCloseTo(2.4, 5);
    expect(weightComparison(500).label).toBe('Schlachtross (ca. 500 kg)');
  });
  it('Triumphzug: sonntags ab 18 Uhr laufende Woche, sonst Vorwoche', () => {
    expect(triumphWeek('2026-03-29', 19)).toBe('2026-03-23'); // Sonntag
    expect(triumphWeek('2026-03-29', 10)).toBe('2026-03-16');
    expect(triumphWeek('2026-03-30', 8)).toBe('2026-03-23'); // Montag
  });
});
