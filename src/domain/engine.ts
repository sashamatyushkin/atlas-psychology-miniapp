/**
 * Чистые функции изменения состояния. Ни одна не мутирует вход —
 * возвращают новое состояние. Один и тот же код исполняется в мок-слое
 * (браузер) и на сервере, поэтому поведение всегда совпадает.
 */
import { findCourse, findProduct } from './catalog';
import {
  ECONOMY,
  TASK_REWARDS,
  dailyRewardFor,
  dayKey,
  energyCap,
  levelFor,
  regenPerSec,
  tapValue,
  upgradeCost,
} from './economy';
import { isValidAnswers, scoreQuiz } from './quiz';
import type { GameState, ProductKind, Purchase, TaskId, UpgradeKind } from './types';
import { DomainError } from './types';
import { isFormValid, normalizeName, validateLeadForm, type LeadForm } from './validation';

export type Rand = () => number;

export function createInitialState(now: number): GameState {
  return {
    v: 1,
    balance: 0,
    totalEarned: 0,
    totalTaps: 0,
    energy: ECONOMY.baseEnergyCap,
    energyAt: now,
    lastTapSyncAt: now,
    upgrades: { tap: 0, cap: 0, regen: 0 },
    refills: { day: dayKey(now), used: 0 },
    daily: { lastDay: null, streak: 0 },
    tasks: {},
    quiz: null,
    lead: null,
    purchases: [],
    applications: [],
    practicesDone: 0,
    createdAt: now,
  };
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Восстанавливает состояние из хранилища, отбрасывая повреждённые поля. */
export function normalizeState(raw: unknown, now: number): GameState {
  const base = createInitialState(now);
  if (!raw || typeof raw !== 'object' || (raw as GameState).v !== 1) return base;
  const r = raw as Partial<GameState>;
  return {
    ...base,
    ...r,
    balance: Math.max(0, num(r.balance, 0)),
    totalEarned: Math.max(0, num(r.totalEarned, 0)),
    totalTaps: Math.max(0, num(r.totalTaps, 0)),
    energy: Math.max(0, num(r.energy, base.energy)),
    energyAt: Math.min(now, num(r.energyAt, now)),
    lastTapSyncAt: Math.min(now, num(r.lastTapSyncAt, now)),
    upgrades: { ...base.upgrades, ...(r.upgrades ?? {}) },
    refills: r.refills ?? base.refills,
    daily: r.daily ?? base.daily,
    tasks: r.tasks ?? {},
    purchases: Array.isArray(r.purchases) ? r.purchases : [],
    applications: Array.isArray(r.applications) ? r.applications : [],
  };
}

export function currentEnergy(s: GameState, now: number): number {
  const elapsed = Math.max(0, now - s.energyAt) / 1000;
  return Math.min(energyCap(s), s.energy + elapsed * regenPerSec(s));
}

function settleEnergy(s: GameState, now: number): GameState {
  return { ...s, energy: currentEnergy(s, now), energyAt: now };
}

function earn(s: GameState, amount: number): GameState {
  return { ...s, balance: s.balance + amount, totalEarned: s.totalEarned + amount };
}

// ── Тапы ────────────────────────────────────────────────────────────────

/**
 * Принимает пачку тапов. Сервер не доверяет клиенту: число тапов ограничено
 * доступной энергией и физически возможной частотой с момента прошлой синхронизации.
 */
export function applyTaps(s: GameState, count: number, now: number): { state: GameState; accepted: number } {
  if (!Number.isInteger(count) || count < 0 || count > 10_000) throw new DomainError('VALIDATION', 'Некорректное число тапов');
  const settled = settleEnergy(s, now);
  const value = tapValue(settled);
  const elapsedSec = Math.max(0, now - s.lastTapSyncAt) / 1000;
  const rateLimit = Math.floor((elapsedSec + ECONOMY.tapBurstSec) * ECONOMY.maxTapsPerSec);
  const energyLimit = Math.floor(settled.energy / value);
  const accepted = Math.max(0, Math.min(count, rateLimit, energyLimit));
  const next = earn(
    {
      ...settled,
      energy: settled.energy - accepted * value,
      totalTaps: settled.totalTaps + accepted,
      lastTapSyncAt: now,
    },
    accepted * value,
  );
  return { state: next, accepted };
}

// ── Ежедневная награда ──────────────────────────────────────────────────

export function dailyStatus(s: GameState, now: number) {
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const available = s.daily.lastDay !== today;
  const continues = s.daily.lastDay === yesterday || s.daily.lastDay === today;
  const currentStreak = continues ? s.daily.streak : 0;
  const nextStreak = available ? currentStreak + 1 : currentStreak;
  return { available, streak: currentStreak, nextStreak, nextReward: dailyRewardFor(Math.max(1, nextStreak)) };
}

export function claimDaily(s: GameState, now: number): { state: GameState; reward: number } {
  const st = dailyStatus(s, now);
  if (!st.available) throw new DomainError('ALREADY_CLAIMED', 'Награда за сегодня уже получена');
  const reward = dailyRewardFor(st.nextStreak);
  return { state: earn({ ...s, daily: { lastDay: dayKey(now), streak: st.nextStreak } }, reward), reward };
}

// ── Бусты и улучшения ───────────────────────────────────────────────────

export function refillsLeft(s: GameState, now: number): number {
  return s.refills.day === dayKey(now) ? Math.max(0, ECONOMY.refillsPerDay - s.refills.used) : ECONOMY.refillsPerDay;
}

export function refillEnergy(s: GameState, now: number): GameState {
  const left = refillsLeft(s, now);
  if (left <= 0) throw new DomainError('NO_REFILLS', 'Восстановления на сегодня закончились');
  const used = ECONOMY.refillsPerDay - left + 1;
  return { ...s, energy: energyCap(s), energyAt: now, refills: { day: dayKey(now), used } };
}

export function buyUpgrade(s: GameState, kind: UpgradeKind, now: number): GameState {
  const lvl = s.upgrades[kind];
  if (lvl === undefined) throw new DomainError('NOT_FOUND', 'Улучшение не найдено');
  const cost = upgradeCost(kind, lvl);
  if (cost === null) throw new DomainError('MAX_LEVEL', 'Достигнут максимальный уровень');
  if (s.balance < cost) throw new DomainError('INSUFFICIENT_FUNDS', 'Недостаточно искр');
  // энергию фиксируем до изменения формул регенерации/лимита
  const settled = settleEnergy(s, now);
  return { ...settled, balance: settled.balance - cost, upgrades: { ...settled.upgrades, [kind]: lvl + 1 } };
}

// ── Задания ─────────────────────────────────────────────────────────────

export function completeTask(s: GameState, id: TaskId, now: number): { state: GameState; reward: number } {
  if (!(id in TASK_REWARDS) || id === 'quiz' || id === 'invite') {
    // quiz закрывается через лид-магнит, invite — только сервером по факту прихода друга
    throw new DomainError('VALIDATION', 'Это задание нельзя закрыть вручную');
  }
  if (s.tasks[id]) throw new DomainError('ALREADY_CLAIMED', 'Задание уже выполнено');
  const reward = TASK_REWARDS[id];
  return { state: earn({ ...s, tasks: { ...s.tasks, [id]: now } }, reward), reward };
}

/** Начисление рефереру (вызывается только сервером). */
export function rewardReferral(s: GameState, now: number): { state: GameState; reward: number } {
  const reward = TASK_REWARDS.invite;
  return { state: earn({ ...s, tasks: { ...s.tasks, invite: now } }, reward), reward };
}

// ── Лид-магнит ──────────────────────────────────────────────────────────

export function submitQuiz(s: GameState, answers: unknown, now: number): GameState {
  if (!isValidAnswers(answers)) throw new DomainError('VALIDATION', 'Ответьте на все вопросы');
  const { profile, scores } = scoreQuiz(answers);
  return { ...s, quiz: { profile, scores, completedAt: now } };
}

export function claimLeadMagnet(s: GameState, form: LeadForm, now: number): { state: GameState; reward: number } {
  if (!s.quiz) throw new DomainError('QUIZ_REQUIRED', 'Сначала пройдите тест');
  if (!isFormValid(validateLeadForm(form)) || !form.goal) throw new DomainError('VALIDATION', 'Проверьте поля формы');
  const lead = { name: normalizeName(form.name), goal: form.goal, at: now };
  // повторная отправка обновляет данные лида, но не начисляет награду второй раз
  if (s.tasks.quiz) return { state: { ...s, lead }, reward: 0 };
  const reward = TASK_REWARDS.quiz;
  return { state: earn({ ...s, lead, tasks: { ...s.tasks, quiz: now } }, reward), reward };
}

// ── Лавка ───────────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(len: number, rand: Rand): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return out;
}

const CODE_PREFIX: Record<ProductKind, string> = {
  practice: 'PR',
  access: 'ACC',
  promo: 'ATLAS',
  booking: 'BK',
  merch: 'ORD',
};

export function isOwned(s: GameState, productId: string): boolean {
  return s.purchases.some((p) => p.productId === productId);
}

/** Товары, которые можно купить только один раз (цифровой доступ). */
const SINGLE_PURCHASE: ProductKind[] = ['practice', 'access', 'promo'];

export function purchase(
  s: GameState,
  productId: string,
  now: number,
  rand: Rand,
): { state: GameState; purchase: Purchase } {
  const product = findProduct(productId);
  if (!product) throw new DomainError('NOT_FOUND', 'Товар не найден');
  if (SINGLE_PURCHASE.includes(product.kind) && isOwned(s, productId)) {
    throw new DomainError('ALREADY_OWNED', 'Этот товар уже у вас');
  }
  if (levelFor(s.totalEarned).level.index < product.minLevel) {
    throw new DomainError('LEVEL_REQUIRED', 'Нужен более высокий уровень');
  }
  if (s.balance < product.price) throw new DomainError('INSUFFICIENT_FUNDS', 'Недостаточно искр');
  const p: Purchase = {
    id: `${now.toString(36)}${randomCode(4, rand)}`.toLowerCase(),
    productId,
    at: now,
    code: `${CODE_PREFIX[product.kind]}-${randomCode(4, rand)}-${randomCode(4, rand)}`,
  };
  return { state: { ...s, balance: s.balance - product.price, purchases: [p, ...s.purchases] }, purchase: p };
}

export function applyCourse(s: GameState, courseId: string, now: number): GameState {
  if (!findCourse(courseId)) throw new DomainError('NOT_FOUND', 'Программа не найдена');
  if (s.applications.some((a) => a.courseId === courseId)) return s;
  return { ...s, applications: [{ courseId, at: now }, ...s.applications] };
}

export function completePractice(s: GameState): GameState {
  return { ...s, practicesDone: s.practicesDone + 1 };
}
