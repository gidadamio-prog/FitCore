import { describe, expect, it } from 'vitest';
import { lagerState, stationState, STATIONS } from '@/domain/lager';
import { emptyDayFacts } from '@/domain/gamification';

describe('Lager-Stationen', () => {
  it('Stufe nach Schwellen, Rest bis zur nächsten Stufe, Höchststufe ohne „nächste“', () => {
    const def = STATIONS.find((s) => s.id === 'proviant')!;
    expect(stationState(def, 0)).toMatchObject({ tier: 0, name: 'Reiserucksack', next: { name: 'Packesel', remaining: 7 } });
    expect(stationState(def, 7)).toMatchObject({ tier: 1, name: 'Packesel', next: { at: 30, remaining: 23 } });
    const max = stationState(def, 120);
    expect(max.tier).toBe(3);
    expect(max.next).toBeNull();
    expect(max.progress).toBe(1);
  });
  it('zählt echtes Verhalten: Protokolltage, Einheiten, Schritt-/Trinkziel, Messtage, Regionen, Rang', () => {
    const f = (date: string, p: Partial<ReturnType<typeof emptyDayFacts>>) => ({ ...emptyDayFacts(date), ...p });
    const facts = [f('2026-01-01', { logged: true, workouts: 2, stepsHit: true }), f('2026-01-02', { logged: true, waterHit: true, weighIn: true }), f('2026-01-03', { recovery: true }), f('2026-02-01', { logged: true })];
    const s = lagerState({ facts, today: '2026-01-10', conquered: 2, rankLevel: 3 });
    expect(s.proviant.value).toBe(2);
    expect(s.training.value).toBe(2);
    expect(s.pfad.value).toBe(1);
    expect(s.brunnen.value).toBe(1);
    expect(s.heiler.value).toBe(2);
    expect(s.kartentisch).toMatchObject({ tier: 1, name: 'Kriegszelt' });
    expect(s.lager).toMatchObject({ tier: 1, name: 'Feldlager' });
  });
});
