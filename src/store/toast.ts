import { create } from 'zustand';

export interface Toast {
  id: number;
  text: string;
  tone: 'default' | 'success' | 'error';
}

interface ToastStore {
  toasts: Toast[];
  show(text: string, tone?: Toast['tone']): void;
  dismiss(id: number): void;
}

let seq = 0;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  show(text, tone = 'default') {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    setTimeout(() => get().dismiss(id), 2800);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (text: string, tone?: Toast['tone']) => useToasts.getState().show(text, tone);
