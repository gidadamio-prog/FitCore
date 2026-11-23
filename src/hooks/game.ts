import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { computeGame, type GameState } from '@/domain/gamification';
import { today } from '@/domain/dates';
import { useMeals, useMeasurements, useProfile, useSettings } from './data';
import { mealHitsByDay } from '@/domain/mealGame';
import { bodyTypeFromHistory, type BodyTypeResult } from '@/domain/bodyType';

/** Gamification-Zustand, reaktiv aus allen relevanten Tabellen berechnet. */
export function useGame(): GameState | undefined {
  const settings = useSettings();
  const mealIds = useMeals().map((m) => m.id).join('|');
  const data = useLiveQuery(async () => {
    const [entries, goals, workouts, cardio, measurements, water, recovery, recipesCount, exercises, plan, profile] = await Promise.all([
      db.diary.toArray(),
      db.goals.toArray(),
      db.workouts.toArray(),
      db.cardio.toArray(),
      db.measurements.toArray(),
      db.water.toArray(),
      db.recovery.toArray(),
      db.recipes.count(),
      db.exercises.toArray(),
      db.plans.where('status').equals('active').first(),
      db.profile.get('me'),
    ]);
    return { entries, goals, workouts, cardio, measurements, water, recovery, recipesCount, exercises, plan, profile };
  }, []);
  const day = today();
  return useMemo(() => {
    if (!data) return undefined;
    const mealHits = mealHitsByDay({ entries: data.entries, goals: data.goals, workouts: data.workouts, cardio: data.cardio, profile: data.profile, mealIds: mealIds.split('|'), split: settings.mealSplit });
    return computeGame({
      today: day,
      entries: data.entries,
      goals: data.goals,
      workouts: data.workouts,
      cardio: data.cardio,
      measurements: data.measurements,
      water: data.water,
      recovery: data.recovery,
      recipesCount: data.recipesCount,
      exercises: data.exercises,
      activePlan: data.plan,
      trainingDaysPerWeek: data.profile?.trainingDaysPerWeek ?? 3,
      waterGoalMl: settings.waterGoalMl,
      homeGym: settings.homeGym || undefined,
      mealHits,
      heroClass: settings.hero?.classId,
      sex: data.profile?.sex,
    });
  }, [data, day, settings.waterGoalMl, settings.homeGym, settings.mealSplit, settings.hero?.classId, mealIds]);
}

/** Grundkörper des Helden aus Messungen und Profil (null, solange kein Gewicht erfasst ist). */
export function useBodyType(): BodyTypeResult | null {
  const measurements = useMeasurements();
  const profile = useProfile();
  return useMemo(() => bodyTypeFromHistory(measurements, profile), [measurements, profile]);
}
