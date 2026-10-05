/**
 * Клиент реального бэкенда (server/). Авторизация — подписанные Telegram initData
 * в заголовке Authorization: tma <initData>; сервер проверяет HMAC-подпись.
 */
import { getInitData } from '../telegram/webapp';
import { ApiError, type ApiErrorCode } from './errors';
import type { Api, LeadResult, Session, StateResult, StateWithReward } from './types';
import type { Purchase, TaskId, UpgradeKind } from '../domain/types';
import type { LeadForm } from '../domain/validation';

const TIMEOUT_MS = 8_000;

export class HttpApi implements Api {
  readonly kind = 'http' as const;
  private readonly baseUrl: string;
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, body?: unknown, attempt = 0): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `tma ${getInitData()}` },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      // сетевые сбои — одна повторная попытка с паузой
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 800));
        return this.request<T>(path, body, attempt + 1);
      }
      throw new ApiError('NETWORK', 'Нет соединения');
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => ({}))) as { error?: { code: ApiErrorCode; message: string } } & T;
    if (!res.ok) {
      // 502/503/504/530 — прокси/туннель жив, а сервер за ним недоступен
      if (!data.error && res.status >= 502) throw new ApiError('NETWORK', 'Сервер недоступен');
      const code: ApiErrorCode = data.error?.code ?? (res.status === 401 ? 'UNAUTHORIZED' : res.status === 429 ? 'RATE_LIMIT' : 'SERVER');
      throw new ApiError(code, data.error?.message ?? 'Ошибка сервера');
    }
    return data;
  }

  session(startParam?: string) {
    return this.request<Session>('/api/session', { startParam });
  }
  syncTaps(count: number) {
    return this.request<StateResult>('/api/taps', { count });
  }
  claimDaily() {
    return this.request<StateWithReward>('/api/daily', {});
  }
  refillEnergy() {
    return this.request<StateResult>('/api/refill', {});
  }
  buyUpgrade(kind: UpgradeKind) {
    return this.request<StateResult>('/api/upgrade', { kind });
  }
  completeTask(id: TaskId) {
    return this.request<StateWithReward>('/api/task', { id });
  }
  submitQuiz(answers: number[]) {
    return this.request<StateResult>('/api/quiz', { answers });
  }
  claimLeadMagnet(form: LeadForm, writeAccess: boolean) {
    return this.request<LeadResult>('/api/lead', { ...form, writeAccess });
  }
  purchase(productId: string) {
    return this.request<StateResult & { purchase: Purchase }>('/api/purchase', { productId });
  }
  applyCourse(courseId: string) {
    return this.request<StateResult>('/api/apply', { courseId });
  }
  completePractice(practiceId: string) {
    return this.request<StateResult>('/api/practice', { practiceId });
  }
}
