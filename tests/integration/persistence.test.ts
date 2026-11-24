import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { FitCoreDB, SCHEMA_V1, setDatabase, db } from '@/data/db';
import { freshDb, onboard } from './helpers';
import { addGoalVersion, currentGoal, getProfile, updateProfile } from '@/data/profileRepo';
import { exportBackup, restoreBackup } from '@/data/backup';
import { addEntry, createCustomFood } from '@/data/nutritionRepo';
import { saveMeasurement } from '@/data/bodyRepo';
import { goalForDate } from '@/domain/balance';

describe('Datenpersistenz (AK-006/009/010)', () => {
  it('Profil wird angelegt, geändert und bleibt nach Neuöffnen erhalten', async () => {
    const d = await freshDb();
    await onboard();
    await updateProfile({ name: 'Neu', activityLevel: 'light' });
    d.close();
    const reopened = new FitCoreDB(d.name);
    setDatabase(reopened);
    await reopened.open();
    const p = await getProfile();
    expect(p!.name).toBe('Neu');
    expect(p!.activityLevel).toBe('light');
    expect(await reopened.measurements.count()).toBe(1);
    expect((await currentGoal())!.calorieTarget).toBe(2163) // 36 J.: (800+1125−180+5)·1,55 − 550;
  });
  it('ungültige Profiländerungen werden abgelehnt (AK-016)', async () => {
    await freshDb();
    await onboard();
    await expect(updateProfile({ heightCm: 400 })).rejects.toThrow(/Körpergröße/);
  });
});

describe('Zielhistorie (AK-015)', () => {
  it('neue Zielversion verändert frühere Tage nicht', async () => {
    await freshDb();
    await onboard();
    const g = (await currentGoal())!;
    await db.goals.update(g.id!, { effectiveFrom: '2026-01-01' });
    await addGoalVersion({ ...g, id: undefined, calorieTarget: 1900, manualCalories: true, reason: 'manuell', effectiveFrom: '2026-02-01' } as never);
    const goals = await db.goals.toArray();
    expect(goals).toHaveLength(2);
    expect(goalForDate(goals, '2026-01-15')!.calorieTarget).toBe(2163) // 36 J.: (800+1125−180+5)·1,55 − 550;
    expect(goalForDate(goals, '2026-02-02')!.calorieTarget).toBe(1900);
  });
});

describe('Versionierte Migration (AK-007)', () => {
  it('v1-Daten werden ohne Verlust nach v2 migriert', async () => {
    const name = 'fitcore-migrate-' + Math.random();
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.open();
    await v1.table('measurements').bulkAdd([
      { id: 'm1', date: '2025-12-01', weightKg: 82, bodyFatPct: 20, bodyFatSource: 'navy', createdAt: '2025-12-01T08:00:00Z' },
      { id: 'm2', date: '2025-12-02', weightKg: 81.8, bodyFatPct: 19, bodyFatSource: 'measured', createdAt: '2025-12-02T08:00:00Z' },
    ]);
    await v1.table('diary').add({ id: 'd1', date: '2025-12-01', meal: 'lunch', name: 'Reis', createdAt: '2025-12-01T12:00:00Z', nutrients: { kcal: 300 } });
    v1.close();

    const v2 = new FitCoreDB(name);
    await v2.open();
    expect(v2.verno).toBe(2);
    const m1 = await v2.measurements.get('m1');
    expect(m1!.bodyFatMethod).toBe('navy');
    expect((m1 as unknown as Record<string, unknown>).bodyFatSource).toBeUndefined();
    expect((await v2.measurements.get('m2'))!.bodyFatMethod).toBe('manual');
    expect((await v2.diary.get('d1'))!.updatedAt).toBe('2025-12-01T12:00:00Z');
    expect(await v2.measurements.where('bodyFatMethod').equals('navy').count()).toBe(1);
    expect(await v2.recovery.count()).toBe(0); // neue Tabelle vorhanden
  });
});

describe('Backup & Wiederherstellung (AK-008)', () => {
  it('vollständiges Backup lässt sich in frischer Instanz identisch wiederherstellen', async () => {
    await freshDb();
    await onboard();
    const food = await createCustomFood({ name: 'Quark', unitBase: 'g', kcal: 67, protein: 12, carbs: 4, fat: 0.2 });
    await addEntry({ date: '2026-01-01', meal: 'breakfast', food, amount: 250, unit: 'g' });
    await saveMeasurement({ date: '2026-01-02', weightKg: 79.5, waistCm: 88 });
    const backup = await exportBackup();
    const json = JSON.parse(JSON.stringify(backup));

    const fresh = await freshDb();
    expect(await fresh.diary.count()).toBe(0);
    const r = await restoreBackup(json);
    expect(r.counts.diary).toBe(1);
    const again = await exportBackup();
    for (const t of Object.keys(backup.tables)) expect(again.tables[t]).toEqual(backup.tables[t]);
  });
  it('ungültige Backups werden abgelehnt', async () => {
    await freshDb();
    await expect(restoreBackup({ app: 'other' })).rejects.toThrow();
    await expect(restoreBackup({ app: 'fitcore', schemaVersion: 99, exportedAt: '', tables: {} })).rejects.toThrow(/neueren/);
  });
});

describe('Messungen bearbeiten/löschen (AK-039/040/047)', () => {
  it('speichert mit Datum, ändert, löscht; leere Felder bleiben leer', async () => {
    const d = await freshDb();
    const m = await saveMeasurement({ date: '2026-03-01', weightKg: 80, waistCm: 90, hipCm: undefined });
    expect('hipCm' in (await d.measurements.get(m.id))!).toBe(false);
    await saveMeasurement({ date: '2026-03-02', weightKg: 79.4, waistCm: 89 }, m.id);
    const e = (await d.measurements.get(m.id))!;
    expect(e.date).toBe('2026-03-02');
    expect(e.weightKg).toBe(79.4);
    expect(e.createdAt).toBe(m.createdAt);
    await expect(saveMeasurement({ date: '2026-03-02' })).rejects.toThrow(/mindestens einen Messwert/);
    await expect(saveMeasurement({ date: '2026-03-02', weightKg: 900 })).rejects.toThrow(/Gewicht/);
    const { deleteMeasurement } = await import('@/data/bodyRepo');
    await deleteMeasurement(m.id);
    expect(await d.measurements.count()).toBe(0);
  });
});

describe('Backup-Erinnerung', async () => {
  const { backupDue } = await import('@/data/backup');
  const now = new Date('2026-11-24T10:00:00Z');
  it('erinnert nach 3 Tagen Nutzung ohne Backup und 7 Tage nach dem letzten', () => {
    expect(backupDue(null, null, '2026-11-23T10:00:00Z', now)).toBe(false);
    expect(backupDue(null, null, '2026-11-20T10:00:00Z', now)).toBe(true);
    expect(backupDue('2026-11-20T10:00:00Z', null, '2026-01-01T00:00:00Z', now)).toBe(false);
    expect(backupDue('2026-11-16T10:00:00Z', null, '2026-01-01T00:00:00Z', now)).toBe(true);
    expect(backupDue('2026-11-16T10:00:00Z', '2026-11-25', '2026-01-01T00:00:00Z', now)).toBe(false); // „Später“
  });
});

describe('Buchung mit Zubereitung', async () => {
  const { addEntry, updateEntryAmount, repeatEntry } = await import('@/data/nutritionRepo');
  const { BASIC_FOODS } = await import('@/data/basicFoods');
  const { per100For, prepProfile, baseState } = await import('@/domain/preparation');
  const dbm = await import('@/data/db');
  it('speichert umgerechnete Bezugswerte; Mengenänderung und „wie zuletzt“ behalten die Zubereitung', async () => {
    await freshDb();
    const db = dbm.db;
    const rice = BASIC_FOODS.find((f) => f.id === 'basic:reis')!;
    const p = prepProfile(rice)!;
    const per100 = per100For(rice.per100, baseState(p, rice), p.states[1]!);
    const e = await addEntry({ date: '2026-11-24', meal: 'lunch', food: rice, amount: 280, unit: 'g', prep: { label: 'gekocht', per100 } });
    expect(e.prep).toBe('gekocht');
    expect(e.nutrients.kcal).toBeCloseTo(355, 0); // 280 g gekocht ≙ 100 g trocken
    await updateEntryAmount(e.id, 140, 'g');
    expect((await db.diary.get(e.id))!.nutrients.kcal).toBe(178);
    const again = await repeatEntry((await db.diary.get(e.id))!, '2026-11-25', 'dinner');
    expect(again.prep).toBe('gekocht');
    expect(again.date).toBe('2026-11-25');
    expect((await db.foods.get('basic:reis'))!.useCount).toBe(2);
  });
});
