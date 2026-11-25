import { describe, expect, it } from 'vitest';
import { badgeStatus, computeGame, dayStreak, SICK_WEEK_MIN, earnedBadgeKeys, prEvents, questsForWeek, rankFor, RANKS, weekStreak, XP_RULES, dayFacts, type GameInput } from '@/domain/gamification';
import { addDays } from '@/domain/dates';
import type { DiaryEntry, GoalVersion } from '@/domain/types';
import { EXERCISE_LIBRARY, VITOVA_NORDENSTADT } from '@/data/exerciseLibrary';
import { ex, set, workout } from './fixtures';

const goal = { id: 1, effectiveFrom: '2026-01-01', calorieTarget: 2000, proteinG: 150 } as GoalVersion;
const entry = (date: string, meal: string, kcal: number, protein: number): DiaryEntry => ({
  id: date + meal + kcal, date, meal, name: 'x', source: 'custom', amount: 1, unit: 'g', grams: 1,
  per100: { kcal, protein, carbs: 0, fat: 0 }, nutrients: { kcal, protein, carbs: 0, fat: 0 }, createdAt: '', updatedAt: '',
});
const base = (over: Partial<GameInput> = {}): GameInput => ({
  today: '2026-01-14', entries: [], goals: [goal], workouts: [], cardio: [], measurements: [], water: [], recovery: [], recipesCount: 0,
  exercises: EXERCISE_LIBRARY, trainingDaysPerWeek: 3, waterGoalMl: 2500, ...over,
});

describe('Ränge', () => {
  it('Schwellen und Fortschritt', () => {
    expect(rankFor(0).rank.name).toBe('Tiro');
    expect(rankFor(499).rank.name).toBe('Tiro');
    expect(rankFor(500).rank.name).toBe('Miles');
    expect(rankFor(1000).progress).toBeCloseTo(0.5, 5);
    const top = rankFor(99999);
    expect(top.rank.name).toBe('Imperator');
    expect(top.next).toBeUndefined();
    expect(RANKS.every((r, i) => i === 0 || r.minXp > RANKS[i - 1]!.minXp)).toBe(true);
  });
});

describe('Punkte nur aus echten Daten', () => {
  it('Tag mit Protokoll, 3 Mahlzeiten, Protein- und Kalorienziel = 35 XP', () => {
    const entries = [entry('2026-01-14', 'breakfast', 600, 50), entry('2026-01-14', 'lunch', 700, 50), entry('2026-01-14', 'dinner', 700, 40)];
    const g = computeGame(base({ entries }));
    expect(g.breakdown.logged.xp).toBe(10);
    expect(g.breakdown.threeMeals.xp).toBe(5);
    expect(g.breakdown.protein.xp).toBe(10);
    expect(g.breakdown.calories.xp).toBe(10);
  });
  it('kein Bonus für extremes Defizit: 800 kcal bei 2000 Ziel → kein Kalorienpunkt', () => {
    const g = computeGame(base({ entries: [entry('2026-01-14', 'lunch', 800, 160)] }));
    expect(g.breakdown.calories.count).toBe(0);
    expect(g.breakdown.logged.count).toBe(1);
  });
  it('Workouts (max. 2/Tag) und Löschen entzieht Punkte wieder', () => {
    const ws = [1, 2, 3].map((n) => workout('w' + n, '2026-01-14', [ex('bench-press', [set(60, 10)])]));
    expect(computeGame(base({ workouts: ws })).breakdown.workout.xp).toBe(100);
    expect(computeGame(base({ workouts: [] })).breakdown.workout.xp).toBe(0);
  });
  it('zukünftige Daten zählen nicht', () => {
    expect(computeGame(base({ entries: [entry('2026-02-01', 'lunch', 2000, 150)] })).xp).toBe(0);
  });
});

describe('Bestleistungen', () => {
  it('erste Einheit ist kein PR, Steigerung schon; max. 1 PR pro Übung & Workout', () => {
    const w1 = workout('1', '2026-01-01', [ex('bench-press', [set(60, 8), set(60, 8)])]);
    const w2 = workout('2', '2026-01-03', [ex('bench-press', [set(62.5, 8), set(65, 5)])], { startedAt: '2026-01-03T10:00:00Z' });
    const w3 = workout('3', '2026-01-05', [ex('bench-press', [set(60, 8)])], { startedAt: '2026-01-05T10:00:00Z' });
    const p = prEvents([w3, w2, w1]);
    expect(p).toHaveLength(1);
    expect(p[0]!.workoutId).toBe('2');
    expect(p[0]!.detail).toBe('65 kg × 5 (vorher 60 kg)');
  });
});

describe('Serien', () => {
  const days = (from: string, n: number, skip: number[] = []) => new Set(Array.from({ length: n }, (_, i) => addDays(from, i)).filter((_, i) => !skip.includes(i)));
  it('lückenlose Serie, heute noch offen bricht nichts', () => {
    expect(dayStreak(days('2026-01-05', 10), '2026-01-14').current).toBe(10);
    expect(dayStreak(days('2026-01-05', 9), '2026-01-14').current).toBe(9); // heute leer
  });
  it('ein Schild pro Woche überbrückt einen Fehltag, zwei Fehltage in Folge brechen', () => {
    const s = dayStreak(days('2026-01-05', 10, [4]), '2026-01-14'); // 09.01 fehlt
    expect(s.current).toBe(9);
    expect(dayStreak(days('2026-01-05', 10, [4, 5]), '2026-01-14').current).toBe(4);
    expect(dayStreak(days('2026-01-05', 10, [1, 3]), '2026-01-14').current).toBe(7); // 14.–09. (6) + Schild 08. + 07. → 2. Fehltag 06. in derselben Woche bricht
  });
  it('beste Serie bleibt erhalten', () => {
    const d = new Set([...days('2026-01-01', 8), '2026-01-13']);
    expect(dayStreak(d, '2026-01-14').best).toBe(8);
  });
  it('Wochenserie', () => {
    const w = weekStreak(['2026-01-02', '2026-01-06', '2026-01-13', '2025-12-10'], '2026-01-14');
    expect(w.current).toBe(3);
    expect(w.best).toBe(3);
    expect(weekStreak(['2026-01-06'], '2026-01-14').current).toBe(1); // laufende Woche noch offen
  });
});

describe('Krankentage', () => {
  const days = (from: string, n: number, skip: number[] = []) => new Set(Array.from({ length: n }, (_, i) => addDays(from, i)).filter((_, i) => !skip.includes(i)));
  it('Krankentage zählen nicht, brechen die Tages-Serie aber nicht', () => {
    // 05.–14.01., krank 09.–11.01. (3 Tage in Folge, ohne Krankmeldung wäre die Serie weg)
    const active = days('2026-01-05', 10, [4, 5, 6]);
    expect(dayStreak(active, '2026-01-14').current).toBe(3);
    const s = dayStreak(active, '2026-01-14', new Set(['2026-01-09', '2026-01-10', '2026-01-11']));
    expect(s.current).toBe(7);
    expect(s.shieldUsedThisWeek).toBe(false);
    // heute krank und noch nichts eingetragen: Serie bleibt stehen
    expect(dayStreak(days('2026-01-05', 9), '2026-01-14', new Set(['2026-01-14'])).current).toBe(9);
  });
  it('Trainings-Serie: Woche mit mind. 2 Krankentagen ohne Training pausiert, 1 Tag reicht nicht', () => {
    const train = ['2025-12-30', '2026-01-13']; // Wochen 29.12. und 12.01., Woche 05.01. ohne Training
    expect(weekStreak(train, '2026-01-14').current).toBe(1);
    expect(weekStreak(train, '2026-01-14', ['2026-01-07']).current).toBe(1);
    const w = weekStreak(train, '2026-01-14', ['2026-01-07', '2026-01-08']);
    expect(w.current).toBe(2);
    expect(w.best).toBe(2);
    expect(SICK_WEEK_MIN).toBe(2);
  });
  it('Tagesauftrag am Krankentag: Heiltrank (Trinkziel)', () => {
    const input = base({ sickDays: ['2026-01-14'], questBoardStart: '2026-01-01' });
    const g = computeGame(input);
    expect(g.sickToday).toBe(true);
    expect(g.dailyQuest?.id).toBe('d-heal');
  });
});

describe('Feldzüge, Saison, Abzeichen', () => {
  it('Wochen-Feldzüge: Ziel aus aktivem Plan, Fortschritt aus Daten, Studio-Auftrag nur mit Studio', () => {
    const i = base({ workouts: [workout('a', '2026-01-12', [ex('bench-press', [set(60, 10)])]), workout('b', '2026-01-13', [ex('bench-press', [set(60, 10)])])] });
    const qs = questsForWeek('2026-01-12', dayFacts(i), [], { ...i, activePlan: { days: [{ weekdays: [1, 3, 5] }] } as never });
    expect(qs[0]!.title).toBe('3× trainieren');
    expect(qs[0]!.progress).toBe(2);
    expect(qs[0]!.done).toBe(false);
    expect(qs).toHaveLength(3);
    for (let w = 0; w < 20; w++) expect(questsForWeek(addDays('2026-01-05', 7 * w), new Map(), [], i)[2]!.id).not.toBe('mobility');
  });
  it('erfüllte Feldzüge und Saisons bringen Punkte; Abzeichenstufen', () => {
    const ws = Array.from({ length: 6 }, (_, k) => workout('w' + k, addDays('2026-01-05', k), [ex('squat', [set(100, 5)])], { startedAt: addDays('2026-01-05', k) + 'T10:00:00Z' }));
    const g = computeGame(base({ workouts: ws, today: '2026-01-11' }));
    expect(g.breakdown.quest.count).toBeGreaterThanOrEqual(1); // 3× trainieren
    expect(g.badges.find((b) => b.id === 'workouts')!.tier).toBe('bronze');
    expect(earnedBadgeKeys(g.badges)).toContain('workouts:bronze');
    expect(badgeStatus({ id: 'x', name: 'x', description: () => '', tiers: [1, 5, 10], value: 7 })).toMatchObject({ tier: 'silver', nextTarget: 10 });
  });
  it('Studio-Abzeichen nur mit Heimstudio', () => {
    const w = workout('m', '2026-01-14', [ex('milon-chest-press', [set(40, 12)])]);
    expect(computeGame(base({ workouts: [w] })).badges.some((b) => b.id === 'milon')).toBe(false);
    const g = computeGame(base({ workouts: [w], homeGym: VITOVA_NORDENSTADT }));
    expect(g.badges.find((b) => b.id === 'milon')!.value).toBe(1);
  });
  it('XP-Regeln sind positiv und belohnen kein Abnehmtempo', () => {
    expect(Object.values(XP_RULES).every((r) => r.xp > 0)).toBe(true);
    expect(Object.values(XP_RULES).some((r) => /abnehm|defizit|weniger/i.test(r.label))).toBe(false);
  });
});
