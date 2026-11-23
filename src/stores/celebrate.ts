import { create } from 'zustand';

export interface Celebration {
  id: number;
  kind: 'pr' | 'rank' | 'badge' | 'quest' | 'season' | 'boss' | 'colosseum' | 'mastery' | 'comeback' | 'duel' | 'level' | 'triumph' | 'item' | 'transform';
  title: string;
  subtitle?: string;
  lines?: string[];
  /** Neues Ausrüstungsteil */
  item?: { id: string; rarity: 'common' | 'rare' | 'epic' | 'legendary' };
  /** Verwandlung des Porträts */
  portrait?: { classId: 'legionar' | 'gladiator' | 'cursor' | 'strategos'; rankLevel: number; crest: string };
}

interface State {
  queue: Celebration[];
  push: (c: Omit<Celebration, 'id'>) => void;
  shift: () => void;
}

let n = 0;
export const useCelebrate = create<State>((set, get) => ({
  queue: [],
  push: (c) => set({ queue: [...get().queue, { ...c, id: ++n }] }),
  shift: () => set({ queue: get().queue.slice(1) }),
}));

export const celebrate = (c: Omit<Celebration, 'id'>) => useCelebrate.getState().push(c);
