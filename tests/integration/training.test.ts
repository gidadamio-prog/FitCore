import { describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { freshDb, onboard } from './helpers';
import { activePlan, addCardio, deleteCardio, discardActiveWorkout, duplicatePlan, finishWorkout, getActiveWorkout, saveActiveWorkout, saveCustomExercise, savePlan, searchExercises, setPlanStatus, startWorkout, updateCardio, updateWorkout, DuplicateError } from '@/data/trainingRepo';
import { loadDaySummary } from '@/data/daySummary';
import { updateProfile } from '@/data/profileRepo';
import { addEntry, createCustomFood, updateEntryAmount } from '@/data/nutritionRepo';
import { today } from '@/domain/dates';
import type { Plan } from '@/domain/types';

const planInput = (): Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Ganzkörper A/B', goal: 'Kraft', split: 'fullbody', status: 'draft', notes: '',
  days: [{ id: 'd1', name: 'Tag A', weekdays: [1, 4], exercises: [
    { id: 'e1', exerciseId: 'squat', sets: 3, repMin: 5, repMax: 8, targetWeightKg: 80, restSec: 150 },
    { id: 'e2', exerciseId: 'bench-press', sets: 3, repMin: 8, repMax: 10, targetWeightKg: 60, restSec: 120 },
    { id: 'e3', exerciseId: 'barbell-row', sets: 3, repMin: 8, repMax: 12, restSec: 90 },
  ] }],
});

async function doWorkout(plan: Plan) {
  const a = await startWorkout(plan, plan.days[0]);
  for (const e of a.exercises) for (const s of e.sets) { s.reps = 10; s.done = true; if (s.weightKg == null) s.weightKg = 50; }
  await saveActiveWorkout(a);
  return finishWorkout(new Date(new Date(a.startedAt).getTime() + 3600_000));
}

describe('Pläne & Übungen (AK-049–057)', () => {
  it('erstellen, umsortieren, duplizieren, archivieren, aktivieren', async () => {
    await freshDb();
    const p = await savePlan(planInput());
    const reordered = await savePlan({ ...p, days: [{ ...p.days[0]!, exercises: [p.days[0]!.exercises[1]!, p.days[0]!.exercises[0]!, p.days[0]!.exercises[2]!] }] });
    expect(reordered.days[0]!.exercises.map((e) => e.exerciseId)).toEqual(['bench-press', 'squat', 'barbell-row']);
    const copy = await duplicatePlan(p.id);
    expect(copy.name).toMatch(/Kopie/);
    expect(copy.days[0]!.id).not.toBe(p.days[0]!.id);
    await setPlanStatus(p.id, 'active');
    expect((await activePlan())!.id).toBe(p.id);
    await setPlanStatus(copy.id, 'active');
    expect((await db.plans.get(p.id))!.status).toBe('draft'); // nur ein aktiver Plan
    await setPlanStatus(p.id, 'archived');
    expect((await db.plans.get(p.id))!.status).toBe('archived');
  });
  it('Validierung', async () => {
    await freshDb();
    await expect(savePlan({ ...planInput(), name: '' })).rejects.toThrow(/Plannamen/);
    await expect(savePlan({ ...planInput(), days: [] })).rejects.toThrow(/Trainingstag/);
    const bad = planInput();
    bad.days[0]!.exercises[0]!.repMin = 12;
    await expect(savePlan(bad)).rejects.toThrow(/Wiederholungsbereich/);
  });
  it('Übungssuche & eigene Übungen', async () => {
    await freshDb();
    const all = await db.exercises.toArray();
    expect(searchExercises(all, 'bank')[0]!.name).toMatch(/Bankdrücken/);
    expect(searchExercises(all, '', 'Waden').length).toBeGreaterThan(0);
    await saveCustomExercise({ name: 'Landmine Press', primaryMuscle: 'Vordere Schulter', secondaryMuscles: [], equipment: 'Langhantel', kind: 'strength', description: '', alternatives: [] });
    expect(searchExercises(await db.exercises.toArray(), 'landmine')).toHaveLength(1);
  });
  it('AK-057: Planänderung verändert abgeschlossene Workouts nicht', async () => {
    await freshDb();
    await onboard();
    const p = await savePlan(planInput());
    const w = await doWorkout(p);
    await savePlan({ ...p, name: 'Umbenannt', days: [{ ...p.days[0]!, exercises: [p.days[0]!.exercises[0]!] }] });
    const stored = (await db.workouts.get(w.id))!;
    expect(stored.exercises).toHaveLength(3);
    expect(stored.name).toBe('Ganzkörper A/B – Tag A');
  });
});

describe('Live-Workout (AK-058–064)', () => {
  it('Start aus Plan, Satzwerte, Wiederherstellung, Abschluss, Historie', async () => {
    await freshDb();
    await onboard();
    const p = await savePlan(planInput());
    const a = await startWorkout(p, p.days[0]);
    expect(a.exercises).toHaveLength(3);
    expect(a.exercises[0]!.sets[0]!.weightKg).toBe(80);
    await expect(startWorkout(p, p.days[0])).rejects.toThrow(/läuft bereits/);
    a.exercises[0]!.sets[0] = { ...a.exercises[0]!.sets[0]!, weightKg: 82.5, reps: 6, done: true };
    a.exercises[0]!.sets[1] = { ...a.exercises[0]!.sets[1]!, weightKg: 80, reps: 8, done: true };
    await saveActiveWorkout(a);
    const restored = (await getActiveWorkout())!; // = Neuladen
    expect(restored.exercises[0]!.sets[0]!.weightKg).toBe(82.5);
    expect(restored.exercises[0]!.sets[1]!.reps).toBe(8);
    const w = await finishWorkout(new Date(new Date(a.startedAt).getTime() + 45 * 60000));
    expect(w.exercises).toHaveLength(1); // nur Übungen mit abgeschlossenen Sätzen
    expect(w.durationSec).toBe(2700);
    expect(w.estimatedKcal).toBe(240); // (5−1)·80·0,75
    expect(await getActiveWorkout()).toBeUndefined();
    expect(await db.workouts.count()).toBe(1);
    await expect(finishWorkout()).rejects.toThrow(/Kein laufendes/);
  });
  it('Workout ohne abgeschlossene Sätze kann nur verworfen werden', async () => {
    await freshDb();
    await startWorkout(undefined, undefined, 'Frei');
    await expect(finishWorkout()).rejects.toThrow(/mindestens einen Satz/);
    await discardActiveWorkout();
    expect(await getActiveWorkout()).toBeUndefined();
  });
  it('AK-075: doppeltes Abschließen speichert nicht doppelt', async () => {
    await freshDb();
    await onboard();
    const p = await savePlan(planInput());
    const a = await startWorkout(p, p.days[0]);
    a.exercises[0]!.sets[0]!.done = true;
    a.exercises[0]!.sets[0]!.reps = 5;
    await saveActiveWorkout(a);
    await finishWorkout();
    await saveActiveWorkout(a); // z. B. veralteter Tab schreibt erneut
    await finishWorkout();
    expect(await db.workouts.count()).toBe(1);
  });
});

describe('Ausdauer (AK-068) und Energiebilanz (AK-069–077)', () => {
  it('Ausdauer mit Sportart, Dauer, optionaler Distanz; Duplikatschutz', async () => {
    await freshDb();
    await onboard();
    const c = await addCardio({ date: today(), startedAt: new Date().toISOString(), activity: 'running', durationMin: 30, distanceKm: 5 });
    expect(c.estimatedKcal).toBe(360); // 10 km/h → MET 10 → (10−1)·80 kg·0,5 h
    await expect(addCardio({ date: today(), startedAt: c.startedAt, activity: 'running', durationMin: 30 })).rejects.toBeInstanceOf(DuplicateError);
    await addCardio({ date: today(), startedAt: new Date().toISOString(), activity: 'walking', durationMin: 20 });
    await expect(addCardio({ date: today(), startedAt: new Date().toISOString(), activity: 'cycling', durationMin: 0 })).rejects.toThrow();
  });
  it('gemeinsame Bilanz reagiert auf Quote, Overrides, Löschungen und Ernährungsänderungen', async () => {
    await freshDb();
    await onboard();
    const p = await savePlan(planInput());
    const w = await doWorkout(p);
    const d = w.date;
    const food = await createCustomFood({ name: 'Reis', unitBase: 'g', kcal: 150, protein: 3, carbs: 32, fat: 0.5 });
    const e = await addEntry({ date: d, meal: 'lunch', food, amount: 1000, unit: 'g' });
    await updateProfile({ trainingCreditPct: 100 });
    await updateWorkout(w.id, { kcalOverride: 300 });
    let s = await loadDaySummary(d);
    const target = s.goal!.calorieTarget;
    expect(s.credit.creditedKcal).toBe(300);
    expect(s.budget!.remaining).toBe(target + 300 - 1500);
    expect(s.training[0]!.estimated).toBe(false);
    await updateProfile({ trainingCreditPct: 0 });
    s = await loadDaySummary(d);
    expect(s.budget!.remaining).toBe(target - 1500);
    await updateProfile({ trainingCreditPct: 50, activityIncludesTraining: true, includedTrainingKcal: 200 });
    s = await loadDaySummary(d);
    expect(s.credit.creditedKcal).toBe(50);
    await updateEntryAmount(e.id, 500, 'g'); // AK-077
    s = await loadDaySummary(d);
    expect(s.budget!.remaining).toBe(target + 50 - 750);
    const c = await addCardio({ date: d, startedAt: new Date().toISOString(), activity: 'cycling', durationMin: 60, rpe: 5 });
    await updateCardio(c.id, { kcalOverride: 400 });
    s = await loadDaySummary(d);
    expect(s.credit.rawKcal).toBe(700);
    await deleteCardio(c.id);
    s = await loadDaySummary(d);
    expect(s.credit.rawKcal).toBe(300);
  });
});
