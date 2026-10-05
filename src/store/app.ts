import { create } from 'zustand';
import { api, errorMessage, type StateResult } from '../api';
import { currentEnergy } from '../domain/engine';
import { tapValue } from '../domain/economy';
import type { Enrollment, GameState, PaymentMethod, Purchase, TaskId, TgUser, UpgradeKind } from '../domain/types';
import type { LeadForm } from '../domain/validation';
import { getStartParam, setHapticsEnabled } from '../telegram/webapp';

const PREFS_KEY = 'atlas_prefs_v1';

interface Prefs {
  haptics: boolean;
  /** онбординг (слайды + тур с подсветкой) пройден */
  onboarded: boolean;
}

function loadPrefs(): Prefs {
  const defaults: Prefs = { haptics: true, onboarded: false };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

function savePrefs(patch: Partial<Prefs>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    /* приватный режим */
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
  /** из них — во время вспышки (×2) */
  pendingBoosted: number;
  inflightBoosted: number;
  onboarded: boolean;
  setOnboarded(v: boolean): void;
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
  tap(boosted?: boolean): boolean;
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
  enrollCourse(courseId: string, method: PaymentMethod): Promise<Enrollment>;
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
    pendingBoosted: 0,
    inflightBoosted: 0,
    onboarded: loadPrefs().onboarded,
    setOnboarded(v) {
      savePrefs({ onboarded: v });
      set({ onboarded: v });
    },
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
      savePrefs({ haptics: v });
      set({ haptics: v });
    },

    now: () => Date.now() + get().clockOffset,

    tap(boosted = false) {
      const { state, pendingTaps, inflightTaps, pendingBoosted } = get();
      if (!state) return false;
      const value = tapValue(state);
      const energy = currentEnergy(state, get().now()) - (pendingTaps + inflightTaps) * value;
      if (energy < value) return false;
      set({ pendingTaps: pendingTaps + 1, pendingBoosted: pendingBoosted + (boosted ? 1 : 0) });
      return true;
    },

    async flushTaps() {
      const { pendingTaps, inflightTaps, pendingBoosted } = get();
      if (pendingTaps === 0 || inflightTaps > 0) return;
      set({ pendingTaps: 0, inflightTaps: pendingTaps, pendingBoosted: 0, inflightBoosted: pendingBoosted });
      try {
        const r = await api.syncTaps(pendingTaps, pendingBoosted);
        set({ inflightTaps: 0, inflightBoosted: 0 });
        accept(r);
      } catch (e) {
        // сетевой сбой — вернём тапы в очередь; прочие ошибки — отбрасываем
        const retry = (e as { code?: string }).code === 'NETWORK';
        set((s) => ({
          inflightTaps: 0,
          inflightBoosted: 0,
          pendingTaps: retry ? s.pendingTaps + pendingTaps : s.pendingTaps,
          pendingBoosted: retry ? s.pendingBoosted + pendingBoosted : s.pendingBoosted,
        }));
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
    async enrollCourse(courseId, method) {
      return (await mutate(() => api.enrollCourse(courseId, method))).enrollment;
    },
    async resetDemo() {
      if (!api.canResetDemo) return;
      set({ pendingTaps: 0, inflightTaps: 0, pendingBoosted: 0, inflightBoosted: 0 });
      accept(await api.resetDemo());
    },
  };
});

setHapticsEnabled(loadPrefs().haptics);

/** Баланс с учётом ещё не подтверждённых тапов. */
export function useDisplayBalance(): number {
  return useApp((s) =>
    s.state
      ? s.state.balance + (s.pendingTaps + s.inflightTaps + s.pendingBoosted + s.inflightBoosted) * tapValue(s.state)
      : 0,
  );
}
