/**
 * Мок-бэкенд: исполняет ту же доменную логику, что и сервер, но локально.
 * Состояние хранится в Telegram CloudStorage (или localStorage в браузере),
 * поэтому прогресс сохраняется между запусками и устройствами пользователя.
 *
 * Замена на реальный сервер — установить VITE_API_URL (см. api/index.ts).
 */
import * as engine from '../domain/engine';
import type { GameState } from '../domain/types';
import { getUser, storage } from '../telegram/webapp';
import { toApiError } from './errors';
import type { Api, Session, StateResult } from './types';

const KEY = 'atlas_state_v1';
const LATENCY = { min: 120, max: 320 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => sleep(LATENCY.min + Math.random() * (LATENCY.max - LATENCY.min));
const rand = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
};

export class MockApi implements Api {
  readonly kind = 'mock' as const;
  private state: GameState | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** Операции выполняются строго последовательно — как транзакции на сервере. */
  private run<T>(fn: (s: GameState, now: number) => { state: GameState } & T, opts: { latency?: boolean; lazy?: boolean } = {}) {
    const job = this.queue.then(async () => {
      if (opts.latency !== false) await latency();
      const now = Date.now();
      try {
        const result = fn(await this.load(), now);
        this.state = result.state;
        this.persist(opts.lazy);
        return { ...result, serverNow: now };
      } catch (e) {
        throw toApiError(e);
      }
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async load(): Promise<GameState> {
    if (this.state) return this.state;
    const raw = await storage.get(KEY);
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    this.state = engine.normalizeState(parsed, Date.now());
    return this.state;
  }

  private persist(lazy = false) {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    const write = () => {
      if (this.state) void storage.set(KEY, JSON.stringify(this.state));
    };
    if (lazy) this.persistTimer = setTimeout(write, 2500);
    else write();
  }

  async session(): Promise<Session> {
    const { state, serverNow } = await this.run((s) => ({ state: s }));
    return { user: getUser(), state, serverNow, backend: false };
  }

  syncTaps(count: number, boosted: number) {
    return this.run((s, now) => engine.applyTaps(s, count, now, boosted), { latency: false, lazy: true });
  }

  claimDaily() {
    return this.run((s, now) => engine.claimDaily(s, now));
  }

  refillEnergy() {
    return this.run((s, now) => ({ state: engine.refillEnergy(s, now) }));
  }

  buyUpgrade(kind: Parameters<Api['buyUpgrade']>[0]) {
    return this.run((s, now) => ({ state: engine.buyUpgrade(s, kind, now) }));
  }

  completeTask(id: Parameters<Api['completeTask']>[0]) {
    return this.run((s, now) => engine.completeTask(s, id, now));
  }

  submitQuiz(answers: number[]) {
    return this.run((s, now) => ({ state: engine.submitQuiz(s, answers, now) }));
  }

  async claimLeadMagnet(form: Parameters<Api['claimLeadMagnet']>[0]) {
    const res = await this.run((s, now) => engine.claimLeadMagnet(s, form, now));
    // без сервера бот не может написать пользователю — гайд скачивается из приложения
    return { ...res, sentToChat: false };
  }

  purchase(productId: string) {
    return this.run((s, now) => engine.purchase(s, productId, now, rand));
  }

  applyCourse(courseId: string) {
    return this.run((s, now) => ({ state: engine.applyCourse(s, courseId, now) }));
  }

  completePractice(practiceId: string) {
    return this.run((s, now) => ({ state: engine.completePractice(s, practiceId, now) }), { latency: false });
  }

  enrollCourse(courseId: string, method: Parameters<Api['enrollCourse']>[1]) {
    return this.run((s, now) => engine.enrollCourse(s, courseId, method, now, rand));
  }

  async resetDemo(): Promise<StateResult> {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    await storage.remove(KEY);
    this.state = null;
    const { state, serverNow } = await this.run((_s, now) => ({ state: engine.createInitialState(now) }));
    return { state, serverNow };
  }
}
