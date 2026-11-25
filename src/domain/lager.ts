/**
 * Das Lager auf der Startseite: Stationen als Bildszenen, die mit echtem Verhalten aufgewertet werden.
 * Jede Station hat 4 Stufen; die Schwellen zählen Tage bzw. Einheiten seit Beginn.
 */
import type { DayFacts } from './gamification';

export type StationId = 'lager' | 'proviant' | 'training' | 'pfad' | 'brunnen' | 'heiler' | 'kartentisch';

export interface StationDef {
  id: StationId;
  title: string;
  /** Wofür gezählt wird (Mehrzahl, für „noch 3 …“) */
  unit: string;
  /** Schwellen der Stufen I–IV (erste immer 0) */
  tiers: [number, number, number, number];
  /** Namen der Stufen */
  names: [string, string, string, string];
}

export const STATIONS: StationDef[] = [
  { id: 'lager', title: 'Lager', unit: 'Ränge', tiers: [1, 3, 6, 9], names: ['Zelt', 'Feldlager', 'Holzhütte', 'Burghof'] },
  { id: 'proviant', title: 'Proviant', unit: 'Tage protokolliert', tiers: [0, 7, 30, 90], names: ['Reiserucksack', 'Packesel', 'Vorratswagen', 'Proviantlager'] },
  { id: 'training', title: 'Übungsplatz', unit: 'Trainingseinheiten', tiers: [0, 10, 40, 100], names: ['Übungswiese', 'Kampfschule', 'Trainingsplatz', 'Arena'] },
  { id: 'pfad', title: 'Wanderpfad', unit: 'Tage Schrittziel', tiers: [0, 7, 30, 90], names: ['Feldweg', 'Gepflasterter Weg', 'Handelsstraße', 'Kaiserstraße'] },
  { id: 'brunnen', title: 'Brunnen', unit: 'Tage Trinkziel', tiers: [0, 7, 30, 90], names: ['Dorfbrunnen', 'Quellhaus', 'Zierbrunnen', 'Thermen'] },
  { id: 'heiler', title: 'Heilerzelt', unit: 'Messtage', tiers: [0, 7, 30, 90], names: ['Heilerzelt', 'Kräutergarten', 'Hospiz', 'Tempel der Heilung'] },
  { id: 'kartentisch', title: 'Kartentisch', unit: 'eroberte Regionen', tiers: [0, 2, 5, 9], names: ['Kartentisch', 'Kriegszelt', 'Kommandoturm', 'Kriegsrat'] },
];

export interface StationState {
  id: StationId;
  title: string;
  /** 0–3 */
  tier: number;
  name: string;
  value: number;
  next: { name: string; at: number; remaining: number; unit: string } | null;
  /** Fortschritt zur nächsten Stufe 0–1 (1 bei Höchststufe) */
  progress: number;
}

export function stationState(def: StationDef, value: number): StationState {
  let tier = 0;
  for (let k = 0; k < 4; k++) if (value >= def.tiers[k]!) tier = k;
  const nextAt = tier < 3 ? def.tiers[tier + 1]! : null;
  const from = def.tiers[tier]!;
  return {
    id: def.id,
    title: def.title,
    tier,
    name: def.names[tier]!,
    value,
    next: nextAt == null ? null : { name: def.names[tier + 1]!, at: nextAt, remaining: nextAt - value, unit: def.unit },
    progress: nextAt == null ? 1 : Math.max(0, Math.min(1, (value - from) / (nextAt - from))),
  };
}

export function lagerState(i: { facts: DayFacts[]; today: string; conquered: number; rankLevel: number }): Record<StationId, StationState> {
  const past = i.facts.filter((f) => f.date <= i.today);
  const count = (p: (f: DayFacts) => boolean) => past.filter(p).length;
  const values: Record<StationId, number> = {
    lager: i.rankLevel,
    proviant: count((f) => f.logged),
    training: past.reduce((a, f) => a + f.workouts, 0),
    pfad: count((f) => f.stepsHit),
    brunnen: count((f) => f.waterHit),
    heiler: count((f) => f.weighIn || f.recovery),
    kartentisch: i.conquered,
  };
  return Object.fromEntries(STATIONS.map((d) => [d.id, stationState(d, values[d.id])])) as Record<StationId, StationState>;
}

export const ROMAN = ['I', 'II', 'III', 'IV'];
