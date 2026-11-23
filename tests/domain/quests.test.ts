import { describe, expect, it } from 'vitest';
import { baseline, dailyQuest, pickedQuests, weeklyOffers, type QuestCtx } from '@/domain/quests';
import { computeGame, emptyDayFacts, type DayFacts, type GameInput } from '@/domain/gamification';
import { addDays, rangeDates } from '@/domain/dates';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { ex, set, workout } from './fixtures';

const W = '2026-03-02'; // Montag
function ctxWith(days: Record<string, Partial<DayFacts>>, today = addDays(W, 6)): QuestCtx {
  const facts = new Map<string, DayFacts>();
  for (const [d, o] of Object.entries(days)) facts.set(d, { ...emptyDayFacts(d), ...o });
  return { facts, prs: [], today, stepGoal: 8000 };
}
// 4 Wochen vorher: 2 Einheiten pro Woche, Protein an 3 Tagen, Ziel 1.700 kcal / 140 g
const history = (): Record<string, Partial<DayFacts>> => {
  const out: Record<string, Partial<DayFacts>> = {};
  for (const d of rangeDates(addDays(W, -28), addDays(W, -1))) {
    const wd = new Date(d + 'T12:00:00').getDay();
    out[d] = { logged: true, meals: 3, kcal: 1700, kcalTarget: 1700, proteinTarget: 140, protein: wd % 2 ? 140 : 100, proteinHit: wd === 1 || wd === 3 || wd === 5, workouts: wd === 1 || wd === 4 ? 1 : 0, volume: wd === 1 || wd === 4 ? 3000 : 0 };
  }
  return out;
};

describe('Quest-Brett', () => {
  it('Schnitt der 4 Wochen davor', () => {
    const b = baseline(W, ctxWith(history()));
    expect(b.sessions).toBe(2);
    expect(b.proteinDays).toBe(3);
    expect(b.kcalTarget).toBe(1700);
  });
  it('5 Angebote: je Woche anders, gleiche Woche stabil, mind. 2 Training und 2 Ernährung', () => {
    const c = ctxWith(history());
    const a = weeklyOffers(W, c);
    expect(a).toHaveLength(5);
    expect(weeklyOffers(W, c).map((q) => q.id)).toEqual(a.map((q) => q.id));
    expect(a.filter((q) => q.category === 'training').length).toBeGreaterThanOrEqual(2);
    expect(a.filter((q) => q.category === 'ernaehrung').length).toBeGreaterThanOrEqual(2);
    const weeks = Array.from({ length: 6 }, (_, k) => weeklyOffers(addDays(W, 7 * k), ctxWith(history(), addDays(W, 7 * k))).map((q) => q.id).join());
    expect(new Set(weeks).size).toBeGreaterThan(1);
  });
  it('Ziele fordern etwas mehr als der Schnitt', () => {
    const c = ctxWith(history());
    const [train, protein, lean, boost] = pickedQuests(W, ['w-train', 'w-protein-days', 'w-lean-day', 'w-protein-boost'], c);
    expect(train!.target).toBe(3); // Schnitt 2 → 3
    expect(protein!.target).toBe(4); // Schnitt 3 → 4
    expect(lean!.description).toContain('1.450 statt 1.700 kcal');
    expect(boost!.description).toContain('168 g statt 140 g');
  });
  it('Fastentag zählt nur im Bereich 75–90 % und erst am Folgetag', () => {
    const days = { ...history(), [W]: { logged: true, meals: 3, kcal: 1450, kcalTarget: 1700 }, [addDays(W, 1)]: { logged: true, meals: 3, kcal: 1000, kcalTarget: 1700 } };
    expect(pickedQuests(W, ['w-lean-day'], ctxWith(days, W))[0]!.done).toBe(false); // heute noch offen
    expect(pickedQuests(W, ['w-lean-day'], ctxWith(days, addDays(W, 2)))[0]!.done).toBe(true);
    const tooLow = { ...history(), [W]: { logged: true, meals: 3, kcal: 1000, kcalTarget: 1700 } };
    expect(pickedQuests(W, ['w-lean-day'], ctxWith(tooLow, addDays(W, 2)))[0]!.done).toBe(false);
  });
  it('Tagesaufträge: an manchen Tagen, stabil je Datum', () => {
    const c = ctxWith({});
    const days = rangeDates(W, addDays(W, 59)).map((d) => dailyQuest(d, c));
    const shown = days.filter(Boolean).length;
    expect(shown).toBeGreaterThan(20);
    expect(shown).toBeLessThan(55);
    expect(dailyQuest(W, c)?.id).toBe(dailyQuest(W, c)?.id);
    expect(new Set(days.filter(Boolean).map((q) => q!.id)).size).toBeGreaterThan(4);
  });
});

describe('Quest-Brett im Spielstand', () => {
  const base = (over: Partial<GameInput>): GameInput => ({
    today: addDays(W, 6), entries: [], goals: [], workouts: [], cardio: [], measurements: [], water: [], recovery: [], recipesCount: 0,
    exercises: EXERCISE_LIBRARY, trainingDaysPerWeek: 3, waterGoalMl: 2500, ...over,
  });
  const ws = [0, 2, 4].map((k) => workout('w' + k, addDays(W, k), [ex('squat', [set(100, 5)])]));
  it('ohne Wahl: Angebote statt Feldzüge; mit Wahl: EP je Feldzug und Bonus für alle drei', () => {
    const open = computeGame(base({ workouts: ws, questBoardStart: W }));
    expect(open.quests).toHaveLength(0);
    expect(open.questOffers).toHaveLength(5);
    const g = computeGame(base({ workouts: ws, questBoardStart: W, questPicks: { [W]: ['w-train', 'w-strength', 'w-weekend'] } }));
    expect(g.questsPicked).toBe(true);
    expect(g.quests.map((q) => q.id)).toEqual(['w-train', 'w-strength', 'w-weekend']);
    const done = g.quests.filter((q) => q.done).length;
    expect(g.breakdown.quest.count).toBe(done);
    expect(g.breakdown.questAll.count).toBe(done === 3 ? 1 : 0);
  });
  it('Schritte: Ziel erreicht bringt EP', () => {
    const g = computeGame(base({ recovery: [{ id: W, date: W, steps: 9000 }, { id: addDays(W, 1), date: addDays(W, 1), steps: 4000 }], stepGoal: 8000 }));
    expect(g.breakdown.steps.count).toBe(1);
    expect(g.facts.get(W)!.steps).toBe(9000);
  });
});

describe('Makroziele am Trainingstag', async () => {
  const { trainingDayMacros } = await import('@/domain/balance');
  it('verteilt angerechnete kcal: 70 % KH, 15 % Protein, 15 % Fett', () => {
    const m = trainingDayMacros({ proteinG: 140, carbsG: 180, fatG: 60 }, 400);
    expect(m.extra).toEqual({ proteinG: 15, carbsG: 70, fatG: 7 });
    expect(m.carbsG).toBe(250);
    expect(trainingDayMacros({ proteinG: 140, carbsG: 180, fatG: 60 }, 0).extra.carbsG).toBe(0);
  });
});
