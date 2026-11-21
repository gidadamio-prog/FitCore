import { describe, expect, it } from 'vitest';
import { completedSets, epley1RM, estimateCardioKcal, estimateStrengthKcal, exerciseHistory, isDuplicateCardio, netKcal, newRecordsIn, pace, personalRecords, setsPerMuscle, suggestProgression, workoutVolume } from '@/domain/training';
import { ex, set, workout } from './fixtures';

describe('Trainingsvolumen (AK-065)', () => {
  it('3 × 10 × 60 kg = 1800 kg', () => {
    const w = workout('1', '2026-01-01', [ex('bench', [set(60, 10), set(60, 10), set(60, 10)])]);
    expect(workoutVolume(w)).toBe(1800);
    expect(completedSets(w)).toBe(3);
  });
  it('nicht abgeschlossene / leere Sätze zählen nicht, Körpergewicht = 0 kg Volumen', () => {
    const w = workout('1', '2026-01-01', [ex('bench', [set(60, 10), set(60, 10, false), set(null, 12), set(50, null)])]);
    expect(workoutVolume(w)).toBe(600);
    expect(completedSets(w)).toBe(2);
  });
  it('Dezimalgewichte', () => {
    expect(workoutVolume(workout('1', '2026-01-01', [ex('c', [set(22.5, 8), set(22.5, 7)])]))).toBe(337.5);
  });
});

describe('Muskelgruppen', () => {
  it('primär 1, sekundär 0,5', () => {
    const r = setsPerMuscle([workout('1', '2026-01-01', [ex('bench', [set(60, 10), set(60, 10)], 'Brust', ['Trizeps'])])]);
    expect(r).toEqual({ Brust: 2, Trizeps: 1 });
  });
});

describe('Bestleistungen (AK-066)', () => {
  const w1 = workout('1', '2026-01-01', [ex('bench', [set(60, 10), set(70, 5)])]);
  const w2 = workout('2', '2026-01-08', [ex('bench', [set(72.5, 5), set(60, 12)])]);
  it('Epley', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 10)).toBe(133.3);
    expect(() => epley1RM(100, 0)).toThrow();
  });
  it('PRs aus echten Sätzen', () => {
    const prs = personalRecords([w1, w2]);
    expect(prs.find((p) => p.kind === 'weight')!.value).toBe(72.5);
    expect(prs.find((p) => p.kind === 'reps')!.value).toBe(12);
    expect(prs.find((p) => p.kind === 'volume')!.value).toBe(1082.5);
  });
  it('neue Rekorde im Vergleich zu früheren Workouts', () => {
    const recs = newRecordsIn(w2, [w1]);
    expect(recs.map((r) => r.kind).sort()).toEqual(['e1rm', 'reps', 'volume', 'weight']);
    expect(newRecordsIn(w1, [])).toEqual([]);
  });
  it('Übungshistorie chronologisch', () => {
    const h = exerciseHistory([w2, w1], 'bench');
    expect(h.map((x) => x.date)).toEqual(['2026-01-01', '2026-01-08']);
    expect(h[1]!.topWeight).toBe(72.5);
  });
});

describe('Progressionsvorschlag', () => {
  it('erhöht, wenn alle Sätze ≥ repMax', () => {
    const s = suggestProgression([ex('b', [set(60, 10), set(60, 10), set(60, 10)])], 8, 10);
    expect(s.action).toBe('increase');
    expect(s.nextWeightKg).toBe(62.5);
  });
  it('hält, wenn nicht alle im Bereich', () => {
    expect(suggestProgression([ex('b', [set(60, 10), set(60, 7)])], 8, 10).action).toBe('hold');
  });
  it('reduziert nach zwei Einheiten unter repMin', () => {
    const s = suggestProgression([ex('b', [set(60, 6)]), ex('b', [set(60, 5)])], 8, 10);
    expect(s.action).toBe('decrease');
    expect(s.nextWeightKg).toBe(54);
  });
});

describe('Energieschätzung', () => {
  it('Netto-MET: (MET − 1) · kg · h', () => {
    expect(netKcal(5, 80, 60)).toBe(320);
    expect(estimateStrengthKcal(3600, 80)).toBe(320);
    expect(estimateStrengthKcal(3600, null)).toBe(0);
  });
  it('Laufen 10 km in 60 min, 70 kg → MET 10 → 630 kcal', () => {
    expect(estimateCardioKcal({ activity: 'running', durationMin: 60, distanceKm: 10 }, 70)).toBe(630);
    expect(() => estimateCardioKcal({ activity: 'running', durationMin: 0 }, 70)).toThrow();
  });
  it('Pace', () => {
    expect(pace(10, 55)).toBe('5:30 min/km');
    expect(pace(undefined, 55)).toBeNull();
  });
  it('Duplikaterkennung Ausdauer (AK-075)', () => {
    const e = [{ id: 'x', date: '2026-01-01', startedAt: '2026-01-01T10:00:00Z', activity: 'running' as const, durationMin: 30, estimatedKcal: 300, createdAt: '' }];
    expect(isDuplicateCardio({ activity: 'running', startedAt: '2026-01-01T10:03:00Z', durationMin: 30 }, e)).toBe(true);
    expect(isDuplicateCardio({ activity: 'running', startedAt: '2026-01-01T12:00:00Z', durationMin: 30 }, e)).toBe(false);
  });
});
