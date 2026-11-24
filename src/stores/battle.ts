import { create } from 'zustand';
import type { BattlePlan } from '@/domain/battle';

export interface BattleRequest {
  reason: 'workout' | 'meal';
  /** Überschrift der Zusammenfassung, z. B. Workout-Name oder „Frühstück abgeschlossen“ */
  title: string;
  /** Ergebniszeilen (Dauer, Sätze, Volumen …) */
  lines?: string[];
  /** Gesamtschaden, den der Auslöser vor dem Speichern gesehen hat – der Kampf wartet, bis neue Daten da sind */
  seenTotal?: number;
  at: number;
}

export interface BattleScene {
  id: number;
  request: BattleRequest;
  plan: BattlePlan;
  /** Rüstungs-Beute dieses Kampfes (Item-IDs) */
  loot?: string[];
}

interface State {
  pending: BattleRequest | null;
  scene: BattleScene | null;
  request: (r: Omit<BattleRequest, 'at'>) => void;
  open: (s: Omit<BattleScene, 'id'>) => void;
  clearPending: () => void;
  close: () => void;
}

let n = 0;
export const useBattle = create<State>((set) => ({
  pending: null,
  scene: null,
  request: (r) => set({ pending: { ...r, at: Date.now() } }),
  open: (s) => set({ scene: { ...s, id: ++n }, pending: null }),
  clearPending: () => set({ pending: null }),
  close: () => set({ scene: null }),
}));

export const requestBattle = (r: Omit<BattleRequest, 'at'>) => useBattle.getState().request(r);
