import { create } from 'zustand';
import { api, errorMessage, type StateResult } from '../api';
import { currentEnergy } from '../domain/engine';
import { tapValue } from '../domain/economy';
import type { GameState, Purchase, TaskId, TgUser, UpgradeKind } from '../domain/types';
import type { LeadForm } from '../domain/validation';
import { getStartParam, setHapticsEnabled } from '../telegram/webapp';

const PREFS_KEY = 'atlas_prefs_v1';

function loadPrefs(): { haptics: boolean } {
  try {
    return { haptics: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { haptics: true };
  }
}

interface AppStore {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  user: TgUser | null;
  state: GameState | null;
  backend: boolean;
  clockOffset: number;
  /** тапы, ещё не отправленные на сервер */
  pendingTaps: number;
  /** тапы в полёте */
  inflightTaps: number;
  scheme: 'light' | 'dark';
  haptics: boolean;
  startParam: string | undefined;
  /** диплинк обрабатывается один раз за запуск */
  startParamConsumed: boolean;
  consumeStartParam(): string | undefined;

  boot(): Promise<void>;
  setScheme(s: 'light' | 'dark'): void;
  setHaptics(v: boolean): void;
  now(): number;
  tap(): boolean;
  flushTaps(): Promise<void>;

  claimDaily(): Promise<number>;
  refillEnergy(): Promise<void>;
  buyUpgrade(kind: UpgradeKind): Promise<void>;
  completeTask(id: TaskId): Promise<number>;
  submitQuiz(answers: number[]): Promise<void>;
  claimLeadMagnet(form: LeadForm, writeAccess: boolean): Promise<{ reward: number; sentToChat: boolean }>;
  purchase(productId: string): Promise<Purchase>;
  applyCourse(courseId: string): Promise<void>;
  completePractice(practiceId: string): Promise<void>;
  resetDemo(): Promise<void>;
}

export const useApp = create<AppStore>((set, get) => {
  const accept = (r: StateResult) => set({ state: r.state, clockOffset: r.serverNow - Date.now() });

  /** Перед любым изменением состояния досылаем накопленные тапы — чтобы не потерять искры. */
  async function mutate<T extends StateResult>(call: () => Promise<T>): Promise<T> {
    await get().flushTaps();
    const r = await call();
    accept(r);
    return r;
  }

  return {
    status: 'loading',
    error: null,
    user: null,
    state: null,
    backend: false,
    clockOffset: 0,
    pendingTaps: 0,
    inflightTaps: 0,
    scheme: 'dark',
    haptics: loadPrefs().haptics,
    startParam: getStartParam(),
    startParamConsumed: false,

    consumeStartParam() {
      if (get().startParamConsumed) return undefined;
      set({ startParamConsumed: true });
      return get().startParam;
    },

    async boot() {
      set({ status: 'loading', error: null });
      try {
        const s = await api.session(get().startParam);
        set({
          status: 'ready',
          user: s.user,
          state: s.state,
          backend: s.backend,
          clockOffset: s.serverNow - Date.now(),
        });
      } catch (e) {
        set({ status: 'error', error: errorMessage(e) });
      }
    },

    setScheme: (scheme) => {
      document.documentElement.dataset.theme = scheme;
      set({ scheme });
    },

    setHaptics(v) {
      setHapticsEnabled(v);
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ haptics: v }));
      } catch {
        /* noop */
      }
      set({ haptics: v });
    },

    now: () => Date.now() + get().clockOffset,

    tap() {
      const { state, pendingTaps, inflightTaps } = get();
      if (!state) return false;
      const value = tapValue(state);
      const energy = currentEnergy(state, get().now()) - (pendingTaps + inflightTaps) * value;
      if (energy < value) return false;
      set({ pendingTaps: pendingTaps + 1 });
      return true;
    },

    async flushTaps() {
      const { pendingTaps, inflightTaps } = get();
      if (pendingTaps === 0 || inflightTaps > 0) return;
      set({ pendingTaps: 0, inflightTaps: pendingTaps });
      try {
        const r = await api.syncTaps(pendingTaps);
        set({ inflightTaps: 0 });
        accept(r);
      } catch (e) {
        // сетевой сбой — вернём тапы в очередь; прочие ошибки — отбрасываем
        const retry = (e as { code?: string }).code === 'NETWORK';
        set((s) => ({ inflightTaps: 0, pendingTaps: retry ? s.pendingTaps + pendingTaps : s.pendingTaps }));
      }
    },

    async claimDaily() {
      return (await mutate(() => api.claimDaily())).reward;
    },
    async refillEnergy() {
      await mutate(() => api.refillEnergy());
    },
    async buyUpgrade(kind) {
      await mutate(() => api.buyUpgrade(kind));
    },
    async completeTask(id) {
      return (await mutate(() => api.completeTask(id))).reward;
    },
    async submitQuiz(answers) {
      await mutate(() => api.submitQuiz(answers));
    },
    async claimLeadMagnet(form, writeAccess) {
      const r = await mutate(() => api.claimLeadMagnet(form, writeAccess));
      return { reward: r.reward, sentToChat: r.sentToChat };
    },
    async purchase(productId) {
      return (await mutate(() => api.purchase(productId))).purchase;
    },
    async applyCourse(courseId) {
      await mutate(() => api.applyCourse(courseId));
    },
    async completePractice(practiceId) {
      await mutate(() => api.completePractice(practiceId));
    },
    async resetDemo() {
      if (!api.resetDemo) return;
      set({ pendingTaps: 0, inflightTaps: 0 });
      accept(await api.resetDemo());
    },
  };
});

setHapticsEnabled(loadPrefs().haptics);

/** Баланс с учётом ещё не подтверждённых тапов. */
export function useDisplayBalance(): number {
  return useApp((s) => (s.state ? s.state.balance + (s.pendingTaps + s.inflightTaps) * tapValue(s.state) : 0));
}
