// Reaktive Datenzugriffe (Dexie liveQuery). Jede Änderung in der DB aktualisiert abhängige Ansichten sofort.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { getSettings, DEFAULT_MEAL_DEFS, DEFAULT_SETTINGS, type AppSettings } from '@/data/profileRepo';
import { buildDaySummary } from '@/data/daySummary';

export const useProfile = () => useLiveQuery(() => db.profile.get('me').then((p) => p ?? null), []);
export const useGoals = () => useLiveQuery(() => db.goals.toArray(), []) ?? [];
export const useSettings = (): AppSettings => useLiveQuery(() => getSettings(), []) ?? DEFAULT_SETTINGS;

export function useMeals() {
  const s = useSettings();
  return [...DEFAULT_MEAL_DEFS, ...s.customMeals];
}

// Chronologisch: Datum, bei gleichem Datum Erfassungszeitpunkt
export const useMeasurements = () =>
  useLiveQuery(async () => (await db.measurements.toArray()).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt)), []) ?? [];
export const useWorkouts = () => useLiveQuery(() => db.workouts.orderBy('startedAt').toArray(), []) ?? [];
export const useCardio = () => useLiveQuery(() => db.cardio.orderBy('startedAt').toArray(), []) ?? [];
export const useExercises = () => useLiveQuery(() => db.exercises.toArray(), []) ?? [];
export const usePlans = () => useLiveQuery(() => db.plans.orderBy('updatedAt').reverse().toArray(), []) ?? [];
export const useActiveWorkout = () => useLiveQuery(() => db.activeWorkout.get('current').then((a) => a ?? null), []);
export const useRecipes = () => useLiveQuery(() => db.recipes.orderBy('name').toArray(), []) ?? [];
export const useAllEntries = () => useLiveQuery(() => db.diary.toArray(), []) ?? [];

export function useDaySummary(date: string) {
  return useLiveQuery(async () => {
    const [profile, goals, entries, workouts, cardio, water] = await Promise.all([
      db.profile.get('me'),
      db.goals.toArray(),
      db.diary.where('date').equals(date).sortBy('createdAt'),
      db.workouts.where('date').equals(date).toArray(),
      db.cardio.where('date').equals(date).toArray(),
      db.water.where('date').equals(date).toArray(),
    ]);
    return buildDaySummary(date, profile, goals, entries, workouts, cardio, water.reduce((a, w) => a + w.ml, 0));
  }, [date]);
}
