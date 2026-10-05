import { describe, expect, it } from 'vitest';
import { PRODUCTS } from './catalog';
import { ECONOMY, LEVELS, levelFor, tapValue } from './economy';
import {
  applyTaps,
  buyUpgrade,
  claimDaily,
  claimLeadMagnet,
  completeTask,
  createInitialState,
  currentEnergy,
  dailyStatus,
  normalizeState,
  purchase,
  refillEnergy,
  submitQuiz,
} from './engine';
import { QUIZ, scoreQuiz } from './quiz';
import { DomainError, type GameState } from './types';
import { validateLeadForm } from './validation';

const T0 = Date.UTC(2026, 9, 5, 12, 0, 0);
const DAY = 86_400_000;
const rand = () => 0.42;

const rich = (balance: number, totalEarned = balance): GameState => ({ ...createInitialState(T0), balance, totalEarned });

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected DomainError ${code}`);
};

describe('energy & taps', () => {
  it('регенерирует энергию, но не выше лимита', () => {
    const s = { ...createInitialState(T0), energy: 0 };
    expect(currentEnergy(s, T0 + 10_000)).toBe(20);
    expect(currentEnergy(s, T0 + 10 * 60_000)).toBe(ECONOMY.baseEnergyCap);
  });

  it('начисляет искры за принятые тапы', () => {
    const s = createInitialState(T0);
    const { state, accepted } = applyTaps(s, 30, T0 + 2000);
    expect(accepted).toBe(30);
    expect(state.balance).toBe(30);
    expect(state.totalEarned).toBe(30);
    expect(state.totalTaps).toBe(30);
  });

  it('ограничивает тапы физически возможной частотой (антифрод)', () => {
    const s = createInitialState(T0);
    const { accepted } = applyTaps(s, 5000, T0 + 1000);
    expect(accepted).toBe((1 + ECONOMY.tapBurstSec) * ECONOMY.maxTapsPerSec);
  });

  it('не принимает тапы без энергии', () => {
    const s = { ...createInitialState(T0), energy: 3 };
    const { accepted, state } = applyTaps({ ...s, upgrades: { tap: 1, cap: 0, regen: 0 } }, 10, T0);
    expect(accepted).toBe(1); // 3 энергии / 2 за тап
    expect(state.energy).toBe(1);
  });

  it('отклоняет некорректный ввод', () => {
    expectCode(() => applyTaps(createInitialState(T0), -1, T0), 'VALIDATION');
    expectCode(() => applyTaps(createInitialState(T0), 1.5, T0), 'VALIDATION');
  });

  it('восстанавливает энергию не чаще лимита в день', () => {
    let s = { ...createInitialState(T0), energy: 0 };
    for (let i = 0; i < ECONOMY.refillsPerDay; i++) s = refillEnergy({ ...s, energy: 0 }, T0);
    expect(s.energy).toBe(ECONOMY.baseEnergyCap);
    expectCode(() => refillEnergy(s, T0), 'NO_REFILLS');
    expect(() => refillEnergy(s, T0 + DAY)).not.toThrow();
  });
});

describe('daily reward', () => {
  it('растёт серией и сбрасывается при пропуске', () => {
    let s = createInitialState(T0);
    s = claimDaily(s, T0).state;
    expectCode(() => claimDaily(s, T0 + 1000), 'ALREADY_CLAIMED');
    const second = claimDaily(s, T0 + DAY);
    expect(second.reward).toBe(ECONOMY.dailyRewards[1]);
    expect(dailyStatus(second.state, T0 + 3 * DAY).nextStreak).toBe(1);
  });
});

describe('upgrades', () => {
  it('списывает стоимость и повышает силу тапа', () => {
    const s = buyUpgrade(rich(1000), 'tap', T0);
    expect(s.balance).toBe(0);
    expect(tapValue(s)).toBe(2);
    expectCode(() => buyUpgrade(s, 'tap', T0), 'INSUFFICIENT_FUNDS');
  });
});

describe('levels', () => {
  it('определяет уровень по сумме заработанного', () => {
    expect(levelFor(0).level.index).toBe(0);
    expect(levelFor(LEVELS[2]!.min).level.index).toBe(2);
    expect(levelFor(10_000_000).next).toBeNull();
  });
});

describe('lead magnet', () => {
  const answers = QUIZ.map(() => 0);
  const form = { name: 'Алина', goal: 'anxiety' as const, consent: true };

  it('считает профиль по большинству ответов', () => {
    expect(scoreQuiz(answers).profile).toBe('storm');
    expect(scoreQuiz(QUIZ.map(() => 3)).profile).toBe('harbor');
  });

  it('требует тест перед выдачей гайда и начисляет награду один раз', () => {
    const s0 = createInitialState(T0);
    expectCode(() => claimLeadMagnet(s0, form, T0), 'QUIZ_REQUIRED');
    const s1 = submitQuiz(s0, answers, T0);
    const first = claimLeadMagnet(s1, form, T0);
    expect(first.reward).toBe(1000);
    const again = claimLeadMagnet(first.state, form, T0);
    expect(again.reward).toBe(0);
    expect(again.state.balance).toBe(1000);
  });

  it('валидирует форму', () => {
    expect(validateLeadForm({ name: ' ', goal: null, consent: false })).toHaveProperty('name');
    expect(validateLeadForm({ name: 'A1', goal: 'self', consent: true })).toHaveProperty('name');
    expect(validateLeadForm({ name: 'Анна-Мария', goal: 'self', consent: true })).toEqual({});
    expectCode(() => submitQuiz(createInitialState(T0), [1, 2], T0), 'VALIDATION');
  });
});

describe('shop', () => {
  const cheap = PRODUCTS.find((p) => p.minLevel === 0 && p.kind === 'practice')!;
  const gated = PRODUCTS.find((p) => p.minLevel >= 2)!;

  it('покупает товар и выдаёт код', () => {
    const { state, purchase: p } = purchase(rich(cheap.price), cheap.id, T0, rand);
    expect(state.balance).toBe(0);
    expect(p.code).toMatch(/^PR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expectCode(() => purchase({ ...state, balance: 99_999 }, cheap.id, T0, rand), 'ALREADY_OWNED');
  });

  it('проверяет уровень и баланс', () => {
    expectCode(() => purchase(rich(gated.price, 0), gated.id, T0, rand), 'LEVEL_REQUIRED');
    expectCode(() => purchase(rich(0, 10_000_000), gated.id, T0, rand), 'INSUFFICIENT_FUNDS');
    expectCode(() => purchase(rich(10), 'nope', T0, rand), 'NOT_FOUND');
  });
});

describe('tasks & storage', () => {
  it('закрывает задание один раз', () => {
    const { state, reward } = completeTask(createInitialState(T0), 'channel', T0);
    expect(reward).toBeGreaterThan(0);
    expectCode(() => completeTask(state, 'channel', T0), 'ALREADY_CLAIMED');
    expectCode(() => completeTask(state, 'invite', T0), 'VALIDATION');
  });

  it('восстанавливает повреждённое состояние', () => {
    expect(normalizeState(null, T0).balance).toBe(0);
    const s = normalizeState({ v: 1, balance: 'x', energyAt: T0 + 99_999 }, T0);
    expect(s.balance).toBe(0);
    expect(s.energyAt).toBe(T0);
  });
});
