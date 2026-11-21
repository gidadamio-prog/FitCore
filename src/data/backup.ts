// Vollständiges Backup (JSON) und CSV-Export.
import { ALL_TABLES, SCHEMA_VERSION, db, type TableName } from './db';
import { backupSchema } from '@/domain/schemas';
import type { DiaryEntry, Measurement, Workout } from '@/domain/types';
import { ensureSeed } from './profileRepo';

export interface BackupFile {
  app: 'fitcore';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export async function exportBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction('r', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) tables[t] = await db.table(t).toArray();
  });
  return { app: 'fitcore', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
}

export interface RestoreResult {
  counts: Record<string, number>;
}

/** Stellt ein Backup wieder her (ersetzt alle lokalen Daten). Validiert die Struktur vorab. */
export async function restoreBackup(raw: unknown): Promise<RestoreResult> {
  const parsed = backupSchema.parse(raw);
  if (parsed.schemaVersion > SCHEMA_VERSION) throw new Error(`Backup stammt aus einer neueren App-Version (Schema ${parsed.schemaVersion}).`);
  const counts: Record<string, number> = {};
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) {
      await db.table(t).clear();
      const rows = parsed.tables[t] ?? [];
      if (rows.length) await db.table(t).bulkAdd(migrateRows(t, rows, parsed.schemaVersion));
      counts[t] = rows.length;
    }
  });
  await ensureSeed(); // mitgelieferte Übungsbibliothek sicherstellen
  return { counts };
}

/** Migration von Backup-Daten älterer Schemaversionen (analog zur DB-Migration). */
function migrateRows(table: TableName, rows: unknown[], from: number): unknown[] {
  if (from >= 2) return rows;
  if (table === 'measurements') {
    return rows.map((r) => {
      const m = { ...(r as Record<string, unknown>) };
      if ('bodyFatSource' in m) {
        m.bodyFatMethod = m.bodyFatSource === 'navy' ? 'navy' : 'manual';
        delete m.bodyFatSource;
      }
      return m;
    });
  }
  return rows;
}

export async function wipeAllData() {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
}

// ---------- CSV ----------

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCSV(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
}

export function diaryCSV(entries: DiaryEntry[]) {
  return toCSV(
    ['Datum', 'Mahlzeit', 'Lebensmittel', 'Marke', 'Quelle', 'Menge', 'Einheit', 'Gramm', 'kcal', 'Protein', 'Kohlenhydrate', 'Fett', 'Ballaststoffe', 'Zucker', 'Salz'],
    entries.map((e) => [e.date, e.meal, e.name, e.brand, e.source, e.amount, e.unit, e.grams, e.nutrients.kcal, e.nutrients.protein, e.nutrients.carbs, e.nutrients.fat, e.nutrients.fiber, e.nutrients.sugar, e.nutrients.salt]),
  );
}

export function measurementsCSV(ms: Measurement[]) {
  return toCSV(
    ['Datum', 'Gewicht', 'Körperfett', 'Methode', 'Muskelmasse', 'Bauch', 'Taille', 'Hüfte', 'Hals', 'Brust', 'Oberarm', 'Oberschenkel', 'Notiz'],
    ms.map((m) => [m.date, m.weightKg, m.bodyFatPct, m.bodyFatMethod, m.muscleMassKg, m.abdomenCm, m.waistCm, m.hipCm, m.neckCm, m.chestCm, m.armCm, m.thighCm, m.note]),
  );
}

export function workoutsCSV(ws: Workout[]) {
  const rows: unknown[][] = [];
  for (const w of ws) for (const e of w.exercises) e.sets.forEach((s, i) => rows.push([w.date, w.name, e.name, i + 1, s.weightKg, s.reps, s.done ? 'ja' : 'nein', w.durationSec, w.kcalOverride ?? w.estimatedKcal]));
  return toCSV(['Datum', 'Workout', 'Übung', 'Satz', 'Gewicht', 'Wdh', 'Abgeschlossen', 'Dauer (s)', 'kcal (geschätzt)'], rows);
}

export function download(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
