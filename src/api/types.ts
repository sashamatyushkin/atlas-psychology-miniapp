import type { Enrollment, GameState, PaymentMethod, Purchase, TaskId, TgUser, UpgradeKind } from '../domain/types';
import type { LeadForm } from '../domain/validation';

export interface Session {
  user: TgUser;
  state: GameState;
  /** время сервера — для компенсации расхождения часов при расчёте энергии */
  serverNow: number;
  /** есть ли реальный бэкенд (бот может присылать сообщения) */
  backend: boolean;
}

export interface StateWithReward {
  state: GameState;
  reward: number;
  serverNow: number;
}

export interface StateResult {
  state: GameState;
  serverNow: number;
}

export interface LeadResult extends StateWithReward {
  /** гайд отправлен ботом в чат */
  sentToChat: boolean;
}

/**
 * Контракт с бэкендом. Реализации: MockApi (локально, без сервера) и HttpApi.
 * Чтобы подключить свой бэкенд, достаточно реализовать этот интерфейс.
 */
export interface Api {
  readonly kind: 'mock' | 'http';
  session(startParam?: string): Promise<Session>;
  /** boosted — сколько из count пришлось на «вспышку» (×2) */
  syncTaps(count: number, boosted: number): Promise<StateResult>;
  claimDaily(): Promise<StateWithReward>;
  refillEnergy(): Promise<StateResult>;
  buyUpgrade(kind: UpgradeKind): Promise<StateResult>;
  completeTask(id: TaskId): Promise<StateWithReward>;
  submitQuiz(answers: number[]): Promise<StateResult>;
  claimLeadMagnet(form: LeadForm, writeAccess: boolean): Promise<LeadResult>;
  purchase(productId: string): Promise<StateResult & { purchase: Purchase }>;
  applyCourse(courseId: string): Promise<StateResult>;
  completePractice(practiceId: string): Promise<StateResult>;
  /** Запись на программу. Оплата в тестовом режиме: деньги не списываются. */
  enrollCourse(courseId: string, method: PaymentMethod): Promise<StateResult & { enrollment: Enrollment }>;
  resetDemo?(): Promise<StateResult>;
}
