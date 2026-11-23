// Punktlandungen je Mahlzeit über die gesamte Historie – gleiche Regeln wie im Tagebuch.
import type { CardioSession, DiaryEntry, GoalVersion, Profile, Workout } from './types';
import { creditTrainingEnergy, goalForDate, trainingEnergyItems } from './balance';
import { effectiveSplit, mealTargets } from './nutrition';

export interface MealDayHits {
  /** Mahlzeiten mit Ziel > 0, die gegessen wurden */
  targeted: number;
  /** davon Punktlandungen */
  hits: number;
  /** Perfekter Tag: mind. 3 Mahlzeiten getroffen und keine gegessene Mahlzeit verfehlt */
  perfect: boolean;
}

export interface MealHitInput {
  entries: DiaryEntry[];
  goals: GoalVersion[];
  workouts: Workout[];
  cardio: CardioSession[];
  profile?: Pick<Profile, 'trainingCreditPct' | 'activityIncludesTraining' | 'includedTrainingKcal'>;
  mealIds: string[];
  split: Record<string, number> | undefined;
}

export function mealHitsByDay(i: MealHitInput): Map<string, MealDayHits> {
  const out = new Map<string, MealDayHits>();
  const byDate = <T extends { date: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(x.date, [...(m.get(x.date) ?? []), x]);
    return m;
  };
  const entries = byDate(i.entries);
  const workouts = byDate(i.workouts);
  const cardio = byDate(i.cardio);
  const shares = effectiveSplit(i.mealIds, i.split);
  for (const [date, list] of entries) {
    const goal = goalForDate(i.goals, date);
    if (!goal) continue;
    let credited = 0;
    try {
      credited = creditTrainingEnergy(trainingEnergyItems(workouts.get(date) ?? [], cardio.get(date) ?? []), {
        creditPct: i.profile?.trainingCreditPct ?? 0,
        activityIncludesTraining: i.profile?.activityIncludesTraining ?? false,
        includedTrainingKcal: i.profile?.includedTrainingKcal ?? 0,
      }).creditedKcal;
    } catch {
      credited = 0;
    }
    const eaten = new Map<string, number>();
    for (const e of [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) eaten.set(e.meal, (eaten.get(e.meal) ?? 0) + (e.nutrients.kcal ?? 0));
    const t = mealTargets(goal.calorieTarget + credited, shares, eaten).filter((x) => x.eaten != null && x.target > 0);
    const hits = t.filter((x) => x.hit).length;
    out.set(date, { targeted: t.length, hits, perfect: hits >= 3 && hits === t.length });
  }
  return out;
}
