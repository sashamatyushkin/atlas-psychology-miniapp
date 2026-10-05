import type { GameState, Level, TaskId, UpgradeKind, World } from './types';

/** Параметры экономики. Меняйте здесь — изменится и клиент, и сервер. */
export const ECONOMY = {
  baseEnergyCap: 1000,
  energyCapStep: 500,
  baseRegenPerSec: 2,
  /** максимальная честная частота тапов (с учётом мультитача) */
  maxTapsPerSec: 18,
  /** запас на неравномерную доставку батчей, сек */
  tapBurstSec: 3,
  refillsPerDay: 3,
  dailyRewards: [100, 250, 500, 1000, 2000, 3500, 5000],
} as const;

export const UPGRADES: Record<
  UpgradeKind,
  { title: string; description: string; costs: number[]; effect: (lvl: number) => string }
> = {
  tap: {
    title: 'Глубина вдоха',
    description: 'Больше искр за каждое касание',
    costs: [1000, 3000, 8000, 20000, 50000],
    effect: (lvl) => `+${1 + lvl} ✦ за тап`,
  },
  cap: {
    title: 'Запас спокойствия',
    description: 'Увеличивает максимум энергии',
    costs: [800, 2500, 7000, 18000, 45000],
    effect: (lvl) => `${ECONOMY.baseEnergyCap + ECONOMY.energyCapStep * lvl} энергии`,
  },
  regen: {
    title: 'Восстановление',
    description: 'Энергия возвращается быстрее',
    costs: [1500, 5000, 15000, 40000],
    effect: (lvl) => `${ECONOMY.baseRegenPerSec + lvl} энергии/сек`,
  },
};

export const LEVELS: Level[] = [
  { index: 0, title: 'Странник', min: 0 },
  { index: 1, title: 'Наблюдатель', min: 5_000 },
  { index: 2, title: 'Исследователь', min: 25_000 },
  { index: 3, title: 'Практик', min: 100_000 },
  { index: 4, title: 'Проводник', min: 300_000 },
  { index: 5, title: 'Мудрец', min: 1_000_000 },
];

/** «Миры» сферы: каждый уровень открывает новый пейзаж. */
export const WORLDS: World[] = [
  { level: 0, name: 'Звёздная ночь', image: 'orb-night', glow: '140, 150, 255' },
  { level: 1, name: 'Сумеречное озеро', image: 'purple-lake', glow: '190, 140, 255' },
  { level: 2, name: 'Над облаками', image: 'hero-clouds', glow: '255, 170, 120' },
  { level: 3, name: 'Альпийский день', image: 'alps', glow: '130, 210, 255' },
  { level: 4, name: 'Бирюзовая гавань', image: 'harbor-lake', glow: '90, 220, 200' },
  { level: 5, name: 'Рассвет у океана', image: 'beach', glow: '255, 210, 140' },
];

export const worldFor = (levelIndex: number) => WORLDS[Math.min(levelIndex, WORLDS.length - 1)]!;

/** Комбо и вспышка: каждые 100 касаний подряд — ×2 искры на 5 секунд. */
export const FLASH = {
  every: 100,
  durationSec: 5,
  /** комбо прерывается, если пауза между касаниями больше */
  comboGapMs: 700,
  /** сервер разрешает не больше стольких усиленных тапов на каждые 100 касаний */
  maxBoostedPerFlash: 90,
} as const;

export const TASK_REWARDS: Record<TaskId, number> = {
  quiz: 1000,
  channel: 2500,
  story: 1500,
  homescreen: 1000,
  invite: 5000,
};

export const tapValue = (s: GameState) => 1 + s.upgrades.tap;
export const energyCap = (s: GameState) => ECONOMY.baseEnergyCap + ECONOMY.energyCapStep * s.upgrades.cap;
export const regenPerSec = (s: GameState) => ECONOMY.baseRegenPerSec + s.upgrades.regen;

export function levelFor(totalEarned: number): { level: Level; next: Level | null; progress: number } {
  let level = LEVELS[0]!;
  for (const l of LEVELS) if (totalEarned >= l.min) level = l;
  const next = LEVELS[level.index + 1] ?? null;
  const progress = next ? (totalEarned - level.min) / (next.min - level.min) : 1;
  return { level, next, progress: Math.min(1, Math.max(0, progress)) };
}

export function upgradeCost(kind: UpgradeKind, currentLvl: number): number | null {
  return UPGRADES[kind].costs[currentLvl] ?? null;
}

/** День в UTC: YYYY-MM-DD. Один и тот же на клиенте и сервере. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function dailyRewardFor(streak: number): number {
  const r = ECONOMY.dailyRewards;
  return r[Math.min(streak, r.length) - 1] ?? r[0];
}
