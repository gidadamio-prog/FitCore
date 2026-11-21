import { db } from './db';
import type { ActiveWorkout, CardioSession, Exercise, Plan, PlanDay, Workout, WorkoutExercise } from '@/domain/types';
import { nowISO, toISODate, uid } from '@/domain/dates';
import { estimateCardioKcal, estimateStrengthKcal, isDuplicateCardio } from '@/domain/training';
import { latestWeight } from './profileRepo';

// ---------- Übungen ----------

export async function saveCustomExercise(e: Omit<Exercise, 'id' | 'isCustom'> & { id?: string }) {
  if (!e.name.trim()) throw new Error('Bitte einen Übungsnamen angeben.');
  if (!e.primaryMuscle) throw new Error('Bitte eine Muskelgruppe wählen.');
  const ex: Exercise = { ...e, name: e.name.trim(), id: e.id ?? 'custom-' + uid(), isCustom: 1 };
  await db.exercises.put(ex);
  return ex;
}

export function searchExercises(all: Exercise[], q: string, muscle?: string, opts: { gym?: string; equipment?: string } = {}) {
  const n = q.trim().toLowerCase();
  return all
    .filter(
      (e) =>
        (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) &&
        (!opts.gym || e.gyms?.includes(opts.gym) || e.isCustom === 1) &&
        (!opts.equipment || e.equipment === opts.equipment) &&
        (!n || (e.name + ' ' + e.primaryMuscle + ' ' + e.equipment).toLowerCase().includes(n)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// ---------- Pläne ----------

export function validatePlan(p: Pick<Plan, 'name' | 'days'>) {
  if (!p.name.trim()) throw new Error('Bitte einen Plannamen angeben.');
  if (p.days.length < 1) throw new Error('Ein Plan braucht mindestens einen Trainingstag.');
  for (const d of p.days) {
    if (!d.name.trim()) throw new Error('Jeder Trainingstag braucht einen Namen.');
    for (const e of d.exercises) {
      if (!(e.sets >= 1 && e.sets <= 20)) throw new Error('Sätze müssen zwischen 1 und 20 liegen.');
      if (!(e.repMin >= 1 && e.repMax >= e.repMin && e.repMax <= 100)) throw new Error('Wiederholungsbereich ungültig (min ≤ max, 1–100).');
      if (e.targetWeightKg != null && !(e.targetWeightKg >= 0 && e.targetWeightKg <= 500)) throw new Error('Zielgewicht muss zwischen 0 und 500 kg liegen.');
      if (!(e.restSec >= 0 && e.restSec <= 1200)) throw new Error('Pause muss zwischen 0 und 1200 s liegen.');
    }
  }
}

export async function savePlan(p: Omit<Plan, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }): Promise<Plan> {
  validatePlan(p);
  const ts = nowISO();
  const existing = p.id ? await db.plans.get(p.id) : undefined;
  const plan: Plan = { ...structuredClone(p), id: p.id ?? uid(), createdAt: existing?.createdAt ?? ts, updatedAt: ts };
  await db.plans.put(plan);
  return plan;
}

export async function duplicatePlan(id: string) {
  const p = await db.plans.get(id);
  if (!p) throw new Error('Plan nicht gefunden.');
  const copy: Plan = {
    ...structuredClone(p),
    id: uid(),
    name: p.name + ' (Kopie)',
    status: 'draft',
    days: p.days.map((d) => ({ ...d, id: uid(), exercises: d.exercises.map((e) => ({ ...e, id: uid() })) })),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await db.plans.add(copy);
  return copy;
}

export async function setPlanStatus(id: string, status: Plan['status']) {
  await db.transaction('rw', db.plans, async () => {
    if (status === 'active') await db.plans.where('status').equals('active').modify({ status: 'draft' });
    await db.plans.update(id, { status, updatedAt: nowISO() });
  });
}

export async function deletePlan(id: string) {
  await db.plans.delete(id);
}

export async function activePlan(): Promise<Plan | undefined> {
  return db.plans.where('status').equals('active').first();
}

// ---------- Live-Workout ----------

async function previousExerciseSets(exerciseId: string): Promise<WorkoutExercise | undefined> {
  const ws = await db.workouts.orderBy('startedAt').reverse().toArray();
  for (const w of ws) {
    const e = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (e) return e;
  }
  return undefined;
}

export async function buildWorkoutExercise(exercise: Exercise, sets = 3, restSec = 90, repMin?: number, repMax?: number, targetWeight?: number): Promise<WorkoutExercise> {
  const prev = await previousExerciseSets(exercise.id);
  return {
    id: uid(),
    exerciseId: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: exercise.secondaryMuscles,
    restSec,
    repMin,
    repMax,
    sets: Array.from({ length: sets }, (_, i) => ({
      id: uid(),
      weightKg: targetWeight ?? prev?.sets[i]?.weightKg ?? prev?.sets[0]?.weightKg ?? null,
      reps: null,
      done: false,
    })),
  };
}

export async function startWorkout(plan?: Plan, day?: PlanDay, name?: string): Promise<ActiveWorkout> {
  const existing = await db.activeWorkout.get('current');
  if (existing) throw new Error('Es läuft bereits ein Workout.');
  const exercises: WorkoutExercise[] = [];
  if (day) {
    for (const pe of day.exercises) {
      const ex = await db.exercises.get(pe.exerciseId);
      if (!ex) continue;
      exercises.push(await buildWorkoutExercise(ex, pe.sets, pe.restSec, pe.repMin, pe.repMax, pe.targetWeightKg));
    }
  }
  const a: ActiveWorkout = {
    id: 'current',
    workoutId: uid(),
    planId: plan?.id,
    planDayId: day?.id,
    name: name ?? (plan && day ? `${plan.name} – ${day.name}` : 'Freies Training'),
    startedAt: nowISO(),
    exercises,
    notes: '',
  };
  await db.activeWorkout.put(a);
  return a;
}

export async function getActiveWorkout() {
  return db.activeWorkout.get('current');
}

export async function saveActiveWorkout(a: ActiveWorkout) {
  await db.activeWorkout.put(a);
}

export async function discardActiveWorkout() {
  await db.activeWorkout.delete('current');
}

/** Workout abschließen – idempotent: dieselbe Workout-ID wird nie doppelt gespeichert. */
export async function finishWorkout(endedAt = new Date()): Promise<Workout> {
  return db.transaction('rw', [db.activeWorkout, db.workouts, db.measurements], async () => {
    const a = await db.activeWorkout.get('current');
    if (!a) throw new Error('Kein laufendes Workout.');
    const dup = await db.workouts.get(a.workoutId);
    if (dup) {
      await db.activeWorkout.delete('current');
      return dup;
    }
    const exercises = a.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length > 0);
    if (!exercises.length) throw new Error('Bitte mindestens einen Satz abschließen oder das Workout verwerfen.');
    const started = new Date(a.startedAt);
    const durationSec = Math.max(60, Math.round((endedAt.getTime() - started.getTime()) / 1000));
    const bw = (await latestWeight()) ?? null;
    const w: Workout = {
      id: a.workoutId,
      date: toISODate(started),
      planId: a.planId,
      planDayId: a.planDayId,
      name: a.name,
      startedAt: a.startedAt,
      endedAt: endedAt.toISOString(),
      durationSec,
      exercises,
      notes: a.notes,
      bodyWeightKg: bw,
      estimatedKcal: estimateStrengthKcal(durationSec, bw),
    };
    await db.workouts.add(w);
    await db.activeWorkout.delete('current');
    return w;
  });
}

export async function updateWorkout(id: string, patch: Partial<Pick<Workout, 'kcalOverride' | 'notes' | 'name' | 'exercises'>>) {
  if (patch.kcalOverride != null && !(patch.kcalOverride >= 0 && patch.kcalOverride <= 5000)) throw new Error('Energie muss zwischen 0 und 5000 kcal liegen.');
  await db.workouts.update(id, patch);
}

export async function clearWorkoutKcalOverride(id: string) {
  await db.workouts.where('id').equals(id).modify((w) => {
    delete w.kcalOverride;
  });
}

export async function deleteWorkout(id: string) {
  await db.workouts.delete(id);
}

// ---------- Ausdauer ----------

export type CardioInput = Omit<CardioSession, 'id' | 'estimatedKcal' | 'createdAt'>;

export async function addCardio(input: CardioInput, opts: { allowDuplicate?: boolean } = {}): Promise<CardioSession> {
  if (!(input.durationMin >= 1 && input.durationMin <= 1440)) throw new Error('Dauer muss zwischen 1 und 1440 Minuten liegen.');
  if (input.distanceKm != null && !(input.distanceKm > 0 && input.distanceKm <= 500)) throw new Error('Distanz muss zwischen 0 und 500 km liegen.');
  if (input.avgHr != null && !(input.avgHr >= 30 && input.avgHr <= 230)) throw new Error('Herzfrequenz muss zwischen 30 und 230 liegen.');
  const sameDay = await db.cardio.where('date').equals(input.date).toArray();
  if (!opts.allowDuplicate && isDuplicateCardio(input, sameDay)) throw new DuplicateError('Diese Einheit scheint bereits erfasst zu sein (gleiche Sportart, Startzeit und Dauer).');
  const weight = await latestWeight();
  // Ohne bekanntes Körpergewicht keine erfundene Schätzung – 0 kcal, UI weist darauf hin.
  const s: CardioSession = { ...input, id: uid(), estimatedKcal: weight ? estimateCardioKcal(input, weight) : 0, createdAt: nowISO() };
  await db.cardio.add(s);
  return s;
}

export class DuplicateError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'DuplicateError';
  }
}

export async function updateCardio(id: string, patch: Partial<CardioSession>) {
  if (patch.kcalOverride != null && !(patch.kcalOverride >= 0 && patch.kcalOverride <= 5000)) throw new Error('Energie muss zwischen 0 und 5000 kcal liegen.');
  await db.cardio.update(id, patch);
}

export async function deleteCardio(id: string) {
  await db.cardio.delete(id);
}
