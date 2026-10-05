import { BatteryCharging, Check, Gift, Hand, Megaphone, Smartphone, Sparkles, TimerReset, UserPlus, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { useMainButton } from '../components/MainButton';
import { Amount, formatNum } from '../components/Spark';
import { appLink, config, publicUrl } from '../config';
import { dailyStatus, refillsLeft } from '../domain/engine';
import { ECONOMY, LEVELS, TASK_REWARDS, UPGRADES, levelFor, upgradeCost } from '../domain/economy';
import type { TaskId, UpgradeKind } from '../domain/types';
import { useTicker } from '../hooks/useEnergy';
import { useApp, useDisplayBalance } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import {
  addToHomeScreen,
  canAddToHomeScreen,
  canShareStory,
  checkHomeScreenStatus,
  haptic,
  openTelegramLink,
  shareLink,
  shareStory,
  tg,
} from '../telegram/webapp';

async function run(fn: () => Promise<unknown>, success?: string) {
  try {
    await fn();
    haptic.success();
    if (success) toast(success, 'success');
  } catch (e) {
    haptic.error();
    toast(errorMessage(e), 'error');
  }
}

// ── Бусты ─────────────────────────────────────────────────────────────

const UPGRADE_ICON: Record<UpgradeKind, typeof Zap> = { tap: Hand, cap: BatteryCharging, regen: TimerReset };

export function BoostsSheet() {
  const state = useApp((s) => s.state)!;
  const now = useApp((s) => s.now);
  const refill = useApp((s) => s.refillEnergy);
  const upgrade = useApp((s) => s.buyUpgrade);
  const balance = useDisplayBalance();
  const left = refillsLeft(state, now());
  const [busy, setBusy] = useState<string | null>(null);
  const { level } = levelFor(state.totalEarned);

  const act = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    await run(fn, msg);
    setBusy(null);
  };

  return (
    <>
      <div className="eyebrow">Баланс · {formatNum(balance)} ✦</div>
      <h2 className="sheet-title">Бусты</h2>

      <div className="boost-free card">
        <div className="row-icon teal">
          <Zap size={20} fill="currentColor" />
        </div>
        <div className="row-main">
          <div className="row-title">Полный запас энергии</div>
          <div className="row-sub">
            Бесплатно · осталось {left} из {ECONOMY.refillsPerDay} сегодня
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          disabled={left === 0 || busy !== null}
          onClick={() => act('refill', refill, 'Энергия восстановлена')}
        >
          {busy === 'refill' ? <span className="spinner" /> : 'Взять'}
        </button>
      </div>

      <h3 className="sheet-h">Улучшения</h3>
      <div className="upgrades">
        {(Object.keys(UPGRADES) as UpgradeKind[]).map((kind) => {
          const u = UPGRADES[kind];
          const lvl = state.upgrades[kind];
          const cost = upgradeCost(kind, lvl);
          const Icon = UPGRADE_ICON[kind];
          return (
            <div key={kind} className="upgrade card">
              <div className="upgrade-top">
                <div className="row-icon">
                  <Icon size={20} />
                </div>
                <div className="row-main">
                  <div className="row-title">{u.title}</div>
                  <div className="row-sub">{u.description}</div>
                </div>
                <span className="chip chip-soft num">ур. {lvl}</span>
              </div>
              <div className="upgrade-effect">
                <span>{u.effect(lvl)}</span>
                {cost !== null && (
                  <>
                    <span className="subtle">→</span>
                    <b>{u.effect(lvl + 1)}</b>
                  </>
                )}
              </div>
              <button
                className="btn btn-ghost btn-sm btn-block"
                disabled={cost === null || balance < cost || busy !== null}
                onClick={() => act(kind, () => upgrade(kind), `${u.title}: уровень ${lvl + 1}`)}
              >
                {busy === kind ? (
                  <span className="spinner" />
                ) : cost === null ? (
                  'Максимум'
                ) : (
                  <>
                    Улучшить за <Amount value={cost} size={12} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <h3 className="sheet-h">Уровни Атласа</h3>
      <div className="levels card">
        {LEVELS.map((l) => (
          <div key={l.index} className={`level-line ${l.index === level.index ? 'current' : ''} ${l.index < level.index ? 'passed' : ''}`}>
            <span className="level-dot">{l.index < level.index ? <Check size={12} strokeWidth={3} /> : l.index + 1}</span>
            <span className="level-name">{l.title}</span>
            <span className="num subtle">{l.min === 0 ? 'старт' : `${formatNum(l.min)} ✦`}</span>
          </div>
        ))}
      </div>
      <p className="sheet-note subtle">Уровень растёт от всех заработанных искр — траты его не снижают. Новые уровни открывают товары в Лавке.</p>
    </>
  );
}

// ── Задания ───────────────────────────────────────────────────────────

interface TaskView {
  id: TaskId;
  title: string;
  sub: string;
  Icon: typeof Zap;
  action: string;
  onAction: () => void;
  available: boolean;
  repeatable?: boolean;
}

export function TasksSheet() {
  const state = useApp((s) => s.state)!;
  const user = useApp((s) => s.user)!;
  const backend = useApp((s) => s.backend);
  const complete = useApp((s) => s.completeTask);
  const { push } = useNav();
  const [opened, setOpened] = useState<Partial<Record<TaskId, number>>>({});
  const [checking, setChecking] = useState<TaskId | null>(null);
  const invite = appLink(`ref_${user.id}`);

  const claim = async (id: TaskId) => {
    setChecking(id);
    try {
      const reward = await complete(id);
      haptic.success();
      toast(`+${formatNum(reward)} ✦ за задание`, 'success');
    } catch (e) {
      haptic.error();
      toast(errorMessage(e), 'error');
    } finally {
      setChecking(null);
    }
  };

  // «Добавить на экран» подтверждается событием Telegram, а не доверием клиенту
  useEffect(() => {
    if (!tg || state.tasks.homescreen) return;
    const onAdded = () => void claim('homescreen');
    tg.onEvent('homeScreenAdded', onAdded);
    return () => tg!.offEvent('homeScreenAdded', onAdded);
  }, [state.tasks.homescreen]);

  const tasks: TaskView[] = [
    {
      id: 'quiz',
      title: 'Пройти тест «Карта состояния»',
      sub: 'и получить гайд по тревоге',
      Icon: Sparkles,
      action: 'Пройти',
      onAction: () => push({ name: 'quiz' }),
      available: true,
    },
    {
      id: 'channel',
      title: 'Подписаться на канал школы',
      sub: 'Психология без воды каждый день',
      Icon: Megaphone,
      action: opened.channel ? 'Проверить' : 'Открыть',
      onAction: () => {
        if (!opened.channel) {
          openTelegramLink(config.channelUrl);
          setOpened((o) => ({ ...o, channel: Date.now() }));
          return;
        }
        // в мок-режиме проверить подписку невозможно — засчитываем после перехода;
        // сервер проверяет через getChatMember
        if (!backend && Date.now() - opened.channel < 4000) {
          toast('Подпишитесь на канал и вернитесь');
          return;
        }
        void claim('channel');
      },
      available: true,
    },
    {
      id: 'story',
      title: 'Поделиться в Stories',
      sub: 'Расскажите друзьям об Атласе',
      Icon: Gift,
      action: 'Поделиться',
      onAction: () => {
        shareStory(publicUrl('img/hero-clouds.webp'), 'Изучаю свой внутренний ландшафт в Атласе ✦', invite ? { url: invite, name: 'Открыть Атлас' } : undefined);
        void claim('story');
      },
      available: canShareStory(),
    },
    {
      id: 'homescreen',
      title: 'Добавить на главный экран',
      sub: 'Практика в одно касание',
      Icon: Smartphone,
      action: 'Добавить',
      onAction: async () => {
        if ((await checkHomeScreenStatus()) === 'added') void claim('homescreen');
        else addToHomeScreen();
      },
      available: canAddToHomeScreen(),
    },
    {
      id: 'invite',
      title: 'Пригласить друга',
      sub: backend ? 'Награда — когда друг откроет приложение' : 'Награда начисляется на сервере',
      Icon: UserPlus,
      action: 'Пригласить',
      onAction: () => invite && shareLink(invite, 'Пройди тест «Карта внутреннего состояния» и забери гайд по тревоге 🌿'),
      available: Boolean(invite),
      repeatable: true,
    },
  ];

  const visible = tasks.filter((t) => t.available);

  return (
    <>
      <div className="eyebrow">Дополнительные искры</div>
      <h2 className="sheet-title">Задания</h2>
      <div className="tasks card">
        {visible.map((t) => {
          const done = Boolean(state.tasks[t.id]) && !t.repeatable;
          return (
            <div key={t.id} className={`task ${done ? 'done' : ''}`}>
              <div className="row-icon">
                <t.Icon size={19} />
              </div>
              <div className="row-main">
                <div className="row-title">{t.title}</div>
                <div className="task-reward">
                  +<Amount value={TASK_REWARDS[t.id]} size={11} />
                  <span className="subtle"> · {t.sub}</span>
                </div>
              </div>
              {done ? (
                <span className="task-check">
                  <Check size={16} strokeWidth={3} />
                </span>
              ) : (
                <button className="btn btn-sm btn-ghost task-btn" disabled={checking !== null} onClick={t.onAction}>
                  {checking === t.id ? <span className="spinner" /> : t.action}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="sheet-note subtle">Основной источник искр — сфера на экране «Практика». Энергия восстанавливается сама.</p>
    </>
  );
}

// ── Ежедневная награда ────────────────────────────────────────────────

export function DailySheet() {
  useTicker(1000);
  const state = useApp((s) => s.state)!;
  const now = useApp((s) => s.now);
  const claimDaily = useApp((s) => s.claimDaily);
  const [loading, setLoading] = useState(false);
  const st = dailyStatus(state, now());
  const days = ECONOMY.dailyRewards;
  const activeDay = st.available ? st.nextStreak : st.streak;
  // после 7-го дня серия продолжается с максимальной наградой
  const position = Math.min(Math.max(activeDay, 1), days.length);

  const onClaim = async () => {
    setLoading(true);
    try {
      const reward = await claimDaily();
      haptic.success();
      toast(`+${formatNum(reward)} ✦ — до завтра!`, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  useMainButton(
    st.available
      ? { text: `Забрать ${formatNum(st.nextReward)} ✦`, onClick: onClaim, loading, shine: true, priority: 10 }
      : null,
  );

  const msToReset = 86_400_000 - (now() % 86_400_000);
  const h = Math.floor(msToReset / 3_600_000);
  const m = Math.floor((msToReset % 3_600_000) / 60_000);

  return (
    <>
      <div className="eyebrow">Серия · {st.streak} дн.</div>
      <h2 className="sheet-title">Награда дня</h2>
      <p className="muted daily-text">Заходите каждый день — награда растёт. Пропуск дня сбрасывает серию.</p>
      <div className="days">
        {days.map((r, i) => {
          const d = i + 1;
          const claimed = st.available ? d < position : d <= position;
          const current = st.available && d === position;
          return (
            <div key={d} className={`day ${claimed ? 'claimed' : ''} ${current ? 'current' : ''} ${d === 7 ? 'wide' : ''}`}>
              <span className="day-n">День {d}</span>
              <Amount value={r} size={12} />
              {claimed && <Check size={14} className="day-check" strokeWidth={3} />}
            </div>
          );
        })}
      </div>
      {!st.available && (
        <div className="daily-next card">
          <Gift size={18} />
          <span>
            Следующая награда через{' '}
            <b className="num">
              {h} ч {m} мин
            </b>
          </span>
        </div>
      )}
    </>
  );
}
