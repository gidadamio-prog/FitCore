import type { Workout, WorkoutExercise, WorkoutSet } from '@/domain/types';

export const set = (weightKg: number | null, reps: number | null, done = true): WorkoutSet => ({ id: Math.random().toString(36), weightKg, reps, done });
export const ex = (exerciseId: string, sets: WorkoutSet[], primary = 'Brust', secondary: string[] = []): WorkoutExercise => ({
  id: Math.random().toString(36), exerciseId, name: exerciseId, primaryMuscle: primary, secondaryMuscles: secondary, restSec: 90, sets,
});
export const workout = (id: string, date: string, exercises: WorkoutExercise[], extra: Partial<Workout> = {}): Workout => ({
  id, date, name: 'W ' + id, startedAt: date + 'T10:00:00.000Z', endedAt: date + 'T11:00:00.000Z', durationSec: 3600,
  exercises, notes: '', bodyWeightKg: 80, estimatedKcal: 320, ...extra,
});
