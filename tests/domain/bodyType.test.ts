import { describe, expect, it } from 'vitest';
import { BODY_GRID, BODY_TYPES, bodyTypeFromHistory, classifyBody, estimateBodyFat, ffmi, stageWithHysteresis, KFA_STUFEN } from '@/domain/bodyType';
import type { Measurement } from '@/domain/types';
import { addDays } from '@/domain/dates';

const male = (weightKg: number, heightCm: number, bodyFatPct?: number) => classifyBody({ weightKg, heightCm, bodyFatPct, sex: 'male', age: 35 });

describe('Grundkörper – Zuordnung', () => {
  it('Raster nutzt alle 12 Körper', () => {
    expect(new Set(BODY_GRID.flat())).toEqual(new Set(BODY_TYPES.map((b) => b.id)));
  });
  it('FFMI normalisiert auf 1,80 m', () => {
    expect(ffmi(80, 180, 20)).toBeCloseTo(19.75, 2);
    expect(ffmi(80, 170, 20)).toBeCloseTo(64 / 2.89 + 0.61, 2);
  });
  it.each([
    [65, 185, 10, 'duenn'],
    [85, 180, 23, 'durchschnitt'],
    [100, 178, 30, 'uebergewichtig'],
    [125, 178, 36, 'adipoes'],
    [150, 180, 40, 'adipoes'],
    [75, 180, 11, 'fit'],
    [85, 180, 14, 'athletisch'],
    [92, 180, 24, 'kraeftig'],
    [95, 180, 9, 'bodybuilder'],
    [135, 185, 28, 'strongman'],
  ] as const)('%i kg, %i cm, %i %% → %s', (w, h, kfa, id) => {
    expect(male(w, h, kfa).id).toBe(id);
  });
  it('schwere Untrainierte werden nicht zum Strongman (Fettkorrektur)', () => {
    const r = male(125, 178, 36);
    expect(r.ffmi).toBeGreaterThan(25);
    expect(r.muscleScore).toBeLessThan(21.5);
  });
  it('ohne KFA wird geschätzt und markiert', () => {
    expect(estimateBodyFat(88, 180, 35, 'male')).toBeCloseTo(24.44, 1);
    const r = male(88, 180);
    expect(r.estimated).toBe(true);
    expect(r.id).toBe('durchschnitt');
  });
  it('Frauen: Fettgrenzen um 9 Punkte verschoben', () => {
    expect(classifyBody({ weightKg: 62, heightCm: 168, bodyFatPct: 24, sex: 'female', age: 30 }).stages.f).toBe(1);
  });
});

describe('Grundkörper – Hysterese', () => {
  it('wechselt erst mit Puffer', () => {
    expect(stageWithHysteresis(18.3, KFA_STUFEN, 1, 0.7)).toBe(1);
    expect(stageWithHysteresis(18.8, KFA_STUFEN, 1, 0.7)).toBe(2);
    expect(stageWithHysteresis(17.5, KFA_STUFEN, 2, 0.7)).toBe(2);
    expect(stageWithHysteresis(17.2, KFA_STUFEN, 2, 0.7)).toBe(1);
    expect(stageWithHysteresis(30, KFA_STUFEN, 0, 0.7)).toBe(3);
  });
});

describe('Grundkörper aus Messhistorie', () => {
  const profile = { sex: 'male' as const, heightCm: 180, birthDate: '1990-05-01', bodyFatPct: undefined };
  const m = (date: string, weightKg?: number, bodyFatPct?: number): Measurement => ({ id: date + weightKg, date, weightKg, bodyFatPct, createdAt: date + 'T08:00:00Z', updatedAt: date + 'T08:00:00Z' });
  it('null ohne Gewicht oder Profil', () => {
    expect(bodyTypeFromHistory([], profile)).toBeNull();
    expect(bodyTypeFromHistory([m('2026-01-01', 80)], null)).toBeNull();
  });
  it('letzter KFA gilt weiter, Gewicht als 7-Tage-Schnitt', () => {
    const ms = [m('2026-01-01', 85, 14), ...Array.from({ length: 6 }, (_, i) => m(addDays('2026-01-02', i), 85))];
    const r = bodyTypeFromHistory(ms, profile)!;
    expect(r.estimated).toBe(false);
    expect(r.bodyFatPct).toBe(14);
    expect(r.id).toBe('athletisch');
  });
  it('Tagesschwankung an der Grenze lässt den Körper stehen', () => {
    const ms = [m('2026-01-01', 85, 17.9), m('2026-01-08', 85, 18.4), m('2026-01-09', 85, 17.8), m('2026-01-10', 85, 18.3)];
    expect(bodyTypeFromHistory(ms, profile)!.stages.f).toBe(1);
  });
});
