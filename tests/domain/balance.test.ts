import { describe, expect, it } from 'vitest';
import { creditTrainingEnergy, dayBudget, goalForDate, trainingEnergyItems } from '@/domain/balance';
import { workout } from './fixtures';
import type { GoalVersion } from '@/domain/types';

const settings = { creditPct: 100, activityIncludesTraining: false, includedTrainingKcal: 0 };

describe('Energiebilanz', () => {
  it('AK-071: 2000 + 300 − 1500 = 800', () => {
    expect(dayBudget(2000, 1500, 300).remaining).toBe(800);
  });
  it('AK-072: Quote 0 % → kein Einfluss', () => {
    const items = trainingEnergyItems([workout('1', '2026-01-01', [], { estimatedKcal: 300 })], []);
    const c = creditTrainingEnergy(items, { ...settings, creditPct: 0 });
    expect(c.creditedKcal).toBe(0);
    expect(dayBudget(2000, 1500, c.creditedKcal).remaining).toBe(500);
  });
  it('AK-070: Quoten 25/50/75/100 und benutzerdefiniert', () => {
    const items = trainingEnergyItems([workout('1', '2026-01-01', [], { estimatedKcal: 400 })], []);
    expect([25, 50, 75, 100, 33].map((p) => creditTrainingEnergy(items, { ...settings, creditPct: p }).creditedKcal)).toEqual([100, 200, 300, 400, 132]);
    expect(() => creditTrainingEnergy(items, { ...settings, creditPct: 120 })).toThrow();
  });
  it('AK-073: Override ersetzt Schätzung', () => {
    const items = trainingEnergyItems([workout('1', '2026-01-01', [], { estimatedKcal: 400, kcalOverride: 250 })], []);
    expect(creditTrainingEnergy(items, settings).creditedKcal).toBe(250);
    expect(items[0]!.estimated).toBe(false);
  });
  it('AK-074: bereits im Aktivitätsfaktor enthaltene Energie wird abgezogen', () => {
    const items = trainingEnergyItems([workout('1', '2026-01-01', [], { estimatedKcal: 400 })], []);
    const c = creditTrainingEnergy(items, { creditPct: 100, activityIncludesTraining: true, includedTrainingKcal: 300 });
    expect(c.creditedKcal).toBe(100);
    expect(c.alreadyIncludedKcal).toBe(300);
    const none = creditTrainingEnergy(items, { creditPct: 100, activityIncludesTraining: true, includedTrainingKcal: 500 });
    expect(none.creditedKcal).toBe(0);
  });
  it('AK-075: gleiche Trainings-ID wird nur einmal gezählt', () => {
    const w = workout('1', '2026-01-01', [], { estimatedKcal: 300 });
    expect(trainingEnergyItems([w, w], []).length).toBe(1);
  });
});

describe('Zielhistorie (AK-015)', () => {
  const g = (id: number, effectiveFrom: string, calorieTarget: number) => ({ id, effectiveFrom, calorieTarget } as GoalVersion);
  it('liefert das zum Datum gültige Ziel', () => {
    const goals = [g(1, '2026-01-01', 2000), g(2, '2026-02-01', 1800), g(3, '2026-02-01', 1850)];
    expect(goalForDate(goals, '2026-01-15')!.calorieTarget).toBe(2000);
    expect(goalForDate(goals, '2026-02-01')!.calorieTarget).toBe(1850);
    expect(goalForDate(goals, '2025-12-31')).toBeUndefined();
  });
});
