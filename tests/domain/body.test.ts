import { describe, expect, it } from 'vitest';
import { compareMeasurements, dailySeries, emaTrend, fatMass, forecastGoal, goalProgress, movingAverage, navyBodyFat, windowTrend } from '@/domain/body';
import { ValidationError } from '@/domain/energy';
import { addDays } from '@/domain/dates';

// Unabhängige Referenzwerte: separat mit Python (math.log10) aus der Zoll-Formel berechnet und mit der
// metrischen SI-Variante (495/(…) − 450) auf ±0,5 Prozentpunkte gegengeprüft.
const SI_M = (h: number, n: number, a: number) => 495 / (1.0324 - 0.19077 * Math.log10(a - n) + 0.15456 * Math.log10(h)) - 450;
const SI_F = (h: number, n: number, w: number, hip: number) => 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450;

describe('US-Navy-Methode (AK-041/042)', () => {
  const cases = [
    { sex: 'male' as const, heightCm: 180, neckCm: 38, waistCm: 85, ref: 16.15 },
    { sex: 'male' as const, heightCm: 175, neckCm: 40, waistCm: 95, ref: 22.88 },
    { sex: 'male' as const, heightCm: 170, neckCm: 36, waistCm: 78, ref: 13.69 },
    { sex: 'female' as const, heightCm: 165, neckCm: 32, waistCm: 75, hipCm: 95, ref: 27.71 },
    { sex: 'female' as const, heightCm: 170, neckCm: 34, waistCm: 80, hipCm: 100, ref: 30.44 },
    { sex: 'female' as const, heightCm: 160, neckCm: 31, waistCm: 70, hipCm: 92, ref: 25.33 },
  ];
  it.each(cases)('Referenz %#', (c) => {
    const r = navyBodyFat(c);
    expect(Math.abs(r.bodyFatPct - c.ref)).toBeLessThanOrEqual(0.051); // Ergebnis auf 0,1 gerundet
    const si = c.sex === 'male' ? SI_M(c.heightCm, c.neckCm, c.waistCm) : SI_F(c.heightCm, c.neckCm, c.waistCm, c.hipCm!);
    expect(Math.abs(r.bodyFatPct - si)).toBeLessThan(0.5);
  });
  it('Referenz in Zoll: 70″, Hals 15″, Bauch 34″ → 17,5 %', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 70 * 2.54, neckCm: 15 * 2.54, waistCm: 34 * 2.54 }).bodyFatPct).toBeCloseTo(17.5, 1);
  });
  it('ungültige Werte', () => {
    expect(() => navyBodyFat({ sex: 'male', heightCm: 180, neckCm: 40, waistCm: 40 })).toThrow(ValidationError);
    expect(() => navyBodyFat({ sex: 'female', heightCm: 165, neckCm: 32, waistCm: 75 })).toThrow(/Hüftumfang/);
    expect(() => navyBodyFat({ sex: 'male', heightCm: 100, neckCm: 38, waistCm: 85 })).toThrow(/Körpergröße/);
    expect(() => navyBodyFat({ sex: 'male', heightCm: 180, neckCm: NaN, waistCm: 85 })).toThrow(/Halsumfang/);
    expect(() => navyBodyFat({ sex: 'male', heightCm: 230, neckCm: 69, waistCm: 70 })).toThrow(ValidationError);
  });
});

describe('Fett-/fettfreie Masse (AK-043)', () => {
  it('80 kg, 20 % → 16 / 64 kg', () => {
    expect(fatMass(80, 20)).toEqual({ fatMassKg: 16, leanMassKg: 64 });
    expect(fatMass(72.5, 18.3)).toEqual({ fatMassKg: 13.3, leanMassKg: 59.2 });
    expect(() => fatMass(0, 20)).toThrow();
    expect(() => fatMass(80, 120)).toThrow();
  });
});

describe('Gewichtstrend (AK-045)', () => {
  const ms = [
    { date: '2026-01-03', weightKg: 80 },
    { date: '2026-01-01', weightKg: 81 },
    { date: '2026-01-02', weightKg: 80.6 },
    { date: '2026-01-02', weightKg: 80.4 },
  ];
  it('Tagesmittel, chronologisch, keine erfundenen Tage', () => {
    const s = dailySeries(ms);
    expect(s.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(s[1]!.value).toBeCloseTo(80.5, 5);
  });
  it('EMA α=0,1 und zeitgewichtete Lücken', () => {
    const t = emaTrend([{ date: '2026-01-01', value: 80 }, { date: '2026-01-02', value: 81 }]);
    expect(t[1]!.value).toBeCloseTo(80.1, 5);
    const g = emaTrend([{ date: '2026-01-01', value: 80 }, { date: '2026-01-11', value: 81 }]);
    expect(g[1]!.value).toBeCloseTo(80 + (1 - 0.9 ** 10), 2); // ≈ 80,65
    expect(g).toHaveLength(2);
  });
  it('7-Tage-Mittel und Fenstertrend', () => {
    const pts = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-01-01', i), value: 80 - i * 0.1 }));
    expect(movingAverage(pts, 7)[6]!.value).toBeCloseTo(79.7, 5);
    const w = windowTrend(pts, 7, '2026-01-14');
    expect(w.n).toBe(7);
    expect(w.kgPerWeek).toBeCloseTo(-0.7, 5);
    expect(windowTrend(pts, 7, '2025-01-01').kgPerWeek).toBeNull();
  });
  it('Zielfortschritt und Prognose', () => {
    expect(goalProgress(90, 85, 80).pct).toBe(50);
    const pts = Array.from({ length: 21 }, (_, i) => ({ date: addDays('2026-01-01', i), value: 90 - i * 0.1 }));
    const f = forecastGoal(pts, 85);
    expect(f.etaDays).toBeGreaterThan(0);
    expect(forecastGoal(pts.slice(0, 3), 85).etaDays).toBeNull();
  });
  it('Vergleich zweier Messungen (AK-048)', () => {
    const rows = compareMeasurements(
      { id: 'a', date: '2026-01-01', weightKg: 80, waistCm: 90, createdAt: '', updatedAt: '' },
      { id: 'b', date: '2026-02-01', weightKg: 78.5, waistCm: 87, createdAt: '', updatedAt: '' },
    );
    expect(rows.find((r) => r.field === 'weightKg')!.diff).toBe(-1.5);
    expect(rows.find((r) => r.field === 'waistCm')!.diff).toBe(-3);
  });
});
