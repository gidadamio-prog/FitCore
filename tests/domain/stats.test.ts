import { describe, expect, it } from 'vitest';
import { calorieGoalRate, dailyNutrition, dailyTraining, macroDistribution, proteinGoalRate, trainingSummary, weeklyReport } from '@/domain/stats';
import { coachInsights, classifyDay, dayRecommendations, weightDataSufficiency } from '@/domain/coach';
import type { DiaryEntry, GoalVersion, Measurement } from '@/domain/types';
import { addDays } from '@/domain/dates';
import { ex, set, workout } from './fixtures';
import { dailySeries } from '@/domain/body';

const entry = (date: string, kcal: number, protein = 100): DiaryEntry => ({
  id: date + kcal, date, meal: 'lunch', name: 'x', source: 'custom', amount: 100, unit: 'g', grams: 100,
  per100: { kcal, protein, carbs: 0, fat: 0 }, nutrients: { kcal, protein, carbs: 10, fat: 5 }, createdAt: '', updatedAt: '',
});
const goal = { id: 1, effectiveFrom: '2026-01-01', calorieTarget: 2000, proteinG: 150, weeklyRateKg: -0.5 } as GoalVersion;

describe('Statistikaggregation', () => {
  const entries = [entry('2026-01-01', 2000, 160), entry('2026-01-02', 1500, 100), entry('2026-01-02', 300, 40), entry('2026-01-04', 2500, 80)];
  const days = dailyNutrition(entries, [goal], '2026-01-01', '2026-01-05');
  it('fehlende Tage sind null, nicht 0', () => {
    expect(days[2]!.logged).toBe(false);
    expect(days[2]!.kcal).toBeNull();
    expect(days[1]!.kcal).toBe(1800);
  });
  it('AK-083: Zielerreichung auf Basis auswertbarer Tage mit Lückenausweis', () => {
    const r = calorieGoalRate(days);
    expect(r.evaluableDays).toBe(3);
    expect(r.hitDays).toBe(2);
    expect(r.rate).toBeCloseTo(2 / 3, 5);
    expect(r.missingDates).toEqual(['2026-01-03', '2026-01-05']);
    expect(proteinGoalRate(days).hitDays).toBe(2);
  });
  it('Makroverteilung', () => {
    expect(macroDistribution(days)).not.toBeNull();
    expect(macroDistribution([])).toBeNull();
  });
  it('AK-080: Training aus abgeschlossenen Workouts aggregiert', () => {
    const ws = [workout('a', '2026-01-01', [ex('b', [set(60, 10), set(60, 10, false)])]), workout('b', '2026-01-03', [ex('b', [set(50, 10)])])];
    const s = trainingSummary(dailyTraining(ws, [], '2026-01-01', '2026-01-07'));
    expect(s.strengthSessions).toBe(2);
    expect(s.volume).toBe(1100);
    expect(s.sets).toBe(2);
    expect(s.trainingDays).toBe(2);
  });
  it('AK-084: Wochenbericht mit echten Durchschnitten und Veränderung', () => {
    const r = weeklyReport(entries, [goal], [], [], [], '2026-01-04', '2026-01-10', '2025-12-28', '2026-01-03');
    expect(r.avgKcal).toBe(2500);
    expect(r.prev.avgKcal).toBe(1900);
    expect(r.delta.avgKcal).toBe(600);
  });
});

describe('Coach (AK-085/086)', () => {
  const base = { entries: [] as DiaryEntry[], goals: [goal], workouts: [], cardio: [], sex: 'male' as const, deficitAllowed: true };
  it('meldet Einschränkung bei < 14 Tagen Gewichtsdaten', () => {
    const ms: Measurement[] = Array.from({ length: 5 }, (_, i) => ({ id: String(i), date: addDays('2026-01-01', i), weightKg: 80, createdAt: '', updatedAt: '' }));
    const ins = coachInsights({ ...base, asOf: '2026-01-05', measurements: ms });
    expect(ins.find((i) => i.id === 'weight-insufficient')).toBeDefined();
    expect(ins.some((i) => i.proposal)).toBe(false);
  });
  it('wertet bei ≥ 14 Tagen aus und schlägt nur vor (mit Datengrundlage)', () => {
    const ms: Measurement[] = Array.from({ length: 15 }, (_, i) => ({ id: String(i), date: addDays('2026-01-01', i), weightKg: 80 - i * 0.005, createdAt: '', updatedAt: '' }));
    expect(weightDataSufficiency(dailySeries(ms), '2026-01-15').sufficient).toBe(true);
    const ins = coachInsights({ ...base, asOf: '2026-01-15', measurements: ms });
    const slow = ins.find((i) => i.id === 'weight-slower')!;
    expect(slow).toBeDefined();
    expect(slow.basis.length).toBeGreaterThan(0);
    expect(slow.reasoning).toMatch(/nicht bewiesen/);
    expect(slow.proposal!.deltaKcal).toBe(-150);
  });
  it('Proteinhinweis: „an X von Y Tagen“', () => {
    const entries = [entry('2026-01-14', 2000, 160), entry('2026-01-15', 2000, 50)];
    const ins = coachInsights({ ...base, entries, asOf: '2026-01-15', measurements: [] });
    expect(ins.find((i) => i.id === 'protein-7d')!.message).toMatch(/an 1 von 2/);
  });
  it('Tagestyp und Empfehlungen sind rein informativ', () => {
    const w = workout('a', '2026-01-01', []);
    expect(classifyDay('2026-01-01', [w], [])).toBe('strength');
    expect(classifyDay('2026-01-02', [w], [])).toBe('rest');
    const g = { ...goal };
    const recs = dayRecommendations('strength', 80, g, 60);
    expect(recs.find((r) => r.topic === 'Flüssigkeit')!.text).toMatch(/3,3 l/);
    expect(g).toEqual(goal); // AK-078: Ziel unverändert
  });
});
