// Tageszusammenfassung: verbindet Ernährung, Ziele und Training zu einer gemeinsamen Energiebilanz.
import { db } from './db';
import { goalForDate, trainingEnergyItems, creditTrainingEnergy, dayBudget, trainingDayMacros, type CreditResult, type DayBudget, type MacroTargets, type TrainingEnergyItem } from '@/domain/balance';
import { sumEntries, type NutrientSum } from '@/domain/nutrition';
import type { CardioSession, DiaryEntry, GoalVersion, Profile, Workout } from '@/domain/types';

export interface DaySummary {
  date: string;
  goal?: GoalVersion;
  entries: DiaryEntry[];
  sum: NutrientSum;
  workouts: Workout[];
  cardio: CardioSession[];
  training: TrainingEnergyItem[];
  credit: CreditResult;
  budget: DayBudget | null;
  /** Makroziele inkl. Trainingszuschlag (null = kein Ziel) */
  macros: MacroTargets | null;
  waterMl: number;
}

export function buildDaySummary(
  date: string,
  profile: Pick<Profile, 'trainingCreditPct' | 'activityIncludesTraining' | 'includedTrainingKcal'> | undefined,
  goals: GoalVersion[],
  entries: DiaryEntry[],
  workouts: Workout[],
  cardio: CardioSession[],
  waterMl = 0,
): DaySummary {
  const goal = goalForDate(goals, date);
  const sum = sumEntries(entries);
  const training = trainingEnergyItems(workouts, cardio);
  const credit = creditTrainingEnergy(training, {
    creditPct: profile?.trainingCreditPct ?? 0,
    activityIncludesTraining: profile?.activityIncludesTraining ?? false,
    includedTrainingKcal: profile?.includedTrainingKcal ?? 0,
  });
  return {
    date,
    goal,
    entries,
    sum,
    workouts,
    cardio,
    training,
    credit,
    budget: goal ? dayBudget(goal.calorieTarget, sum.totals.kcal, credit.creditedKcal) : null,
    macros: goal ? trainingDayMacros(goal, credit.creditedKcal) : null,
    waterMl,
  };
}

export async function loadDaySummary(date: string): Promise<DaySummary> {
  const [profile, goals, entries, workouts, cardio, water] = await Promise.all([
    db.profile.get('me'),
    db.goals.toArray(),
    db.diary.where('date').equals(date).toArray(),
    db.workouts.where('date').equals(date).toArray(),
    db.cardio.where('date').equals(date).toArray(),
    db.water.where('date').equals(date).toArray(),
  ]);
  return buildDaySummary(date, profile, goals, entries, workouts, cardio, water.reduce((a, w) => a + w.ml, 0));
}
