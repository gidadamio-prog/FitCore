import { create } from 'zustand';
import { today } from '@/domain/dates';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'success';
}

interface ConfirmReq {
  title: string;
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface UiState {
  date: string;
  setDate: (d: string) => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
  confirmReq: ConfirmReq | null;
  confirm: (r: Omit<ConfirmReq, 'resolve'>) => Promise<boolean>;
  closeConfirm: (ok: boolean) => void;
}

let n = 0;
export const useUi = create<UiState>((set, get) => ({
  date: today(),
  setDate: (date) => set({ date }),
  toasts: [],
  toast: (text, tone = 'info') => {
    const id = ++n;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    setTimeout(() => get().dismiss(id), tone === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  confirmReq: null,
  confirm: (r) => new Promise<boolean>((resolve) => set({ confirmReq: { ...r, resolve } })),
  closeConfirm: (ok) => {
    get().confirmReq?.resolve(ok);
    set({ confirmReq: null });
  },
}));

export const toast = (text: string, tone?: Toast['tone']) => useUi.getState().toast(text, tone);
export const confirmDialog = (r: Omit<ConfirmReq, 'resolve'>) => useUi.getState().confirm(r);
