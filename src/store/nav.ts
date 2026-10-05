import { create } from 'zustand';

export type Tab = 'home' | 'practice' | 'shop' | 'profile';

export type Route =
  | { name: 'quiz' }
  | { name: 'guide' }
  | { name: 'practice'; id: string }
  | { name: 'purchases' }
  | { name: 'map' }
  | { name: 'checkout'; courseId: string };

export type Sheet =
  | { name: 'product'; id: string }
  | { name: 'course'; id: string }
  | { name: 'boosts' }
  | { name: 'tasks' }
  | { name: 'daily' }
  | { name: 'settings' }
  | { name: 'policy' };

interface NavStore {
  tab: Tab;
  stack: Route[];
  sheet: Sheet | null;
  setTab(t: Tab): void;
  push(r: Route): void;
  pop(): void;
  replace(r: Route): void;
  openSheet(s: Sheet): void;
  closeSheet(): void;
  /** Обработчик Telegram BackButton: сначала закрываем шит, затем экран */
  back(): void;
  /** Вернуться на главную, закрыв всё поверх */
  reset(): void;
}

export const useNav = create<NavStore>((set, get) => ({
  tab: 'home',
  stack: [],
  sheet: null,
  setTab: (tab) => set({ tab, sheet: null }),
  push: (r) => set((s) => ({ stack: [...s.stack, r], sheet: null })),
  pop: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
  replace: (r) => set((s) => ({ stack: [...s.stack.slice(0, -1), r] })),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  reset: () => set({ tab: 'home', stack: [], sheet: null }),
  back() {
    if (get().sheet) set({ sheet: null });
    else get().pop();
  },
}));
