import { create } from 'zustand';
import type { FightOutcome } from '@/data/worldRepo';

/** Nach Training oder abgeschlossener Mahlzeit: kurze Bilanz mit neu verdienten Aktionspunkten. */
export interface BattleRequest {
  reason: 'workout' | 'meal';
  /** Überschrift der Zusammenfassung, z. B. Workout-Name oder „Frühstück abgeschlossen“ */
  title: string;
  /** Ergebniszeilen (Dauer, Sätze, Volumen …) */
  lines?: string[];
  /** AP heute, die der Auslöser vor dem Speichern gesehen hat – die Bilanz wartet, bis neue Daten da sind */
  seenAp?: number;
  at: number;
}

export type BattleScene =
  | { id: number; kind: 'summary'; request: BattleRequest; ap: number; balance: number }
  | { id: number; kind: 'fight'; outcome: FightOutcome };

interface State {
  pending: BattleRequest | null;
  scene: BattleScene | null;
  request: (r: Omit<BattleRequest, 'at'>) => void;
  open: (s: Omit<Extract<BattleScene, { kind: 'summary' }>, 'id'> | Omit<Extract<BattleScene, { kind: 'fight' }>, 'id'>) => void;
  clearPending: () => void;
  close: () => void;
}

let n = 0;
export const useBattle = create<State>((set) => ({
  pending: null,
  scene: null,
  request: (r) => set({ pending: { ...r, at: Date.now() } }),
  open: (s) => set({ scene: { ...s, id: ++n } as BattleScene, pending: null }),
  clearPending: () => set({ pending: null }),
  close: () => set({ scene: null }),
}));

export const requestBattle = (r: Omit<BattleRequest, 'at'>) => useBattle.getState().request(r);
export const showFight = (outcome: FightOutcome) => useBattle.getState().open({ kind: 'fight', outcome });
