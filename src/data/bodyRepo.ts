import { db } from './db';
import type { Measurement } from '@/domain/types';
import { measurementSchema } from '@/domain/schemas';
import { nowISO, uid } from '@/domain/dates';

export type MeasurementInput = Omit<Measurement, 'id' | 'createdAt' | 'updatedAt'>;

function clean(input: MeasurementInput): MeasurementInput {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) continue;
    if (k === 'custom' && v && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return out as MeasurementInput;
}

export async function saveMeasurement(input: MeasurementInput, id?: string): Promise<Measurement> {
  const c = clean(input);
  const { bodyFatMethod, ...rest } = c;
  measurementSchema.parse(rest);
  const ts = nowISO();
  const existing = id ? await db.measurements.get(id) : undefined;
  const m: Measurement = {
    ...c,
    bodyFatMethod: c.bodyFatPct != null ? bodyFatMethod ?? 'manual' : undefined,
    id: id ?? uid(),
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  await db.measurements.put(m);
  return m;
}

export async function deleteMeasurement(id: string) {
  await db.measurements.delete(id);
}
