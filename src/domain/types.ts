/**
 * Доменные типы. Этот модуль не зависит ни от браузера, ни от Node —
 * его используют и клиентский мок-слой, и сервер.
 */

export interface TgUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
  isPremium?: boolean;
}

export type UpgradeKind = 'tap' | 'cap' | 'regen';

export type TaskId = 'quiz' | 'channel' | 'story' | 'homescreen' | 'invite';

/** Профили теста «Карта внутреннего состояния» */
export type ProfileId = 'storm' | 'desert' | 'fog' | 'harbor';

export type GoalId = 'anxiety' | 'burnout' | 'relations' | 'self' | 'profession';

export interface Purchase {
  /** id покупки */
  id: string;
  productId: string;
  at: number;
  /** промокод / код доступа / номер заявки */
  code: string;
}

export interface QuizResult {
  profile: ProfileId;
  scores: Record<ProfileId, number>;
  completedAt: number;
}

export interface LeadInfo {
  name: string;
  goal: GoalId;
  at: number;
}

export interface GameState {
  v: 1;
  /** баланс искр, доступный для трат */
  balance: number;
  /** заработано за всё время — определяет уровень */
  totalEarned: number;
  totalTaps: number;
  /** энергия на момент energyAt (может быть дробной из-за регенерации) */
  energy: number;
  energyAt: number;
  /** момент последней синхронизации тапов — для антифрода */
  lastTapSyncAt: number;
  upgrades: Record<UpgradeKind, number>;
  refills: { day: string; used: number };
  daily: { lastDay: string | null; streak: number };
  tasks: Partial<Record<TaskId, number>>;
  quiz: QuizResult | null;
  lead: LeadInfo | null;
  purchases: Purchase[];
  applications: { courseId: string; at: number }[];
  practicesDone: number;
  /** журнал практик для таймлайна (последние 12) */
  practiceLog: { id: string; at: number }[];
  /** когда достигнут каждый уровень: индекс → время */
  levelsAt: Record<string, number>;
  /** использованные «усиленные» тапы вспышки — для антифрода */
  flashTapsUsed: number;
  enrollments: Enrollment[];
  createdAt: number;
}

export type PaymentMethod = 'card' | 'sbp' | 'installments';

/** Запись на программу (оплата в тестовом режиме) */
export interface Enrollment {
  courseId: string;
  at: number;
  amountRub: number;
  discountPct: number;
  method: PaymentMethod;
  receipt: string;
}

export interface Review {
  id: string;
  name: string;
  meta: string;
  courseId: string;
  rating: number;
  text: string;
  result: string;
}

export interface World {
  level: number;
  name: string;
  image: string;
  /** цвет свечения сферы */
  glow: string;
}

export type ProductKind = 'practice' | 'access' | 'promo' | 'booking' | 'merch';

export interface Product {
  id: string;
  title: string;
  subtitle: string;
  kind: ProductKind;
  category: 'practices' | 'learning' | 'discounts' | 'live';
  price: number;
  /** минимальный уровень (индекс с 0) */
  minLevel: number;
  image: string;
  description: string;
  includes: string[];
  /** id практики для kind === 'practice' */
  practiceId?: string;
  /** для промокодов: на какую программу и какая скидка */
  courseId?: string;
  discountPct?: number;
  /** ценность в рублях — для якоря «экономия» */
  valueRub?: number;
  badge?: string;
}

export interface Course {
  id: string;
  word: string;
  title: string;
  tagline: string;
  duration: string;
  format: string;
  priceRub: number;
  image: string;
  description: string;
  modules: string[];
  outcomes: string[];
  forProfiles: ProfileId[];
}

export interface Level {
  index: number;
  title: string;
  min: number;
}

export type DomainErrorCode =
  | 'NO_ENERGY'
  | 'INSUFFICIENT_FUNDS'
  | 'LEVEL_REQUIRED'
  | 'ALREADY_OWNED'
  | 'ALREADY_CLAIMED'
  | 'NO_REFILLS'
  | 'MAX_LEVEL'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'QUIZ_REQUIRED'
  | 'TASK_NOT_VERIFIED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'DomainError';
  }
}
