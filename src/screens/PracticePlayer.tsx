import { Pause, Play, RotateCcw, SkipForward, Vibrate, VibrateOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Img } from '../components/Img';
import { useMainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StateView } from '../components/StateView';
import { PRODUCTS } from '../domain/catalog';
import { isOwned } from '../domain/engine';
import { PRACTICES, practiceDurationSec, type BreathPhase, type Practice } from '../domain/practices';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { haptic, isTelegram, tg } from '../telegram/webapp';
import './player.css';

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'Вдох',
  hold: 'Задержка',
  exhale: 'Выдох',
  rest: 'Пауза',
};

/** Бесплатные практики (из гайда) не требуют покупки. */
const FREE = new Set(['breath478']);

export function PracticePlayer({ id }: { id: string }) {
  const practice = PRACTICES[id];
  const state = useApp((s) => s.state)!;
  const { setTab, pop } = useNav();
  const product = PRODUCTS.find((p) => p.practiceId === id);
  const unlocked = practice && (FREE.has(id) || (product && isOwned(state, product.id)));

  useMainButton(
    practice && !unlocked
      ? {
          text: 'Открыть в Лавке',
          onClick: () => {
            pop();
            setTab('shop');
          },
        }
      : null,
  );

  if (!practice) {
    return (
      <div className="screen overlay-screen">
        <ScreenHeader />
        <StateView title="Практика не найдена" text="Возможно, она была обновлена. Вернитесь назад и попробуйте снова." />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="screen overlay-screen">
        <ScreenHeader />
        <StateView title={practice.title} text="Эта практика открывается за искры в Лавке." />
      </div>
    );
  }

  return <Player practice={practice} />;
}

type Status = 'ready' | 'running' | 'paused' | 'finished';

function Player({ practice }: { practice: Practice }) {
  const completePractice = useApp((s) => s.completePractice);
  const pop = useNav((s) => s.pop);
  const total = practiceDurationSec(practice);
  const [status, setStatus] = useState<Status>('ready');
  const [elapsed, setElapsed] = useState(0); // секунды, дробные
  const last = useRef<number | null>(null);
  const hapticsOn = useApp((s) => s.haptics);
  const [rhythm, setRhythm] = useState(hapticsOn);
  const lastPulse = useRef(0);

  // таймер на requestAnimationFrame — точный и останавливается в фоне
  useEffect(() => {
    if (status !== 'running') {
      last.current = null;
      return;
    }
    let raf = 0;
    const loop = (t: number) => {
      if (last.current !== null) {
        const dt = (t - last.current) / 1000;
        setElapsed((e) => Math.min(total, e + dt));
      }
      last.current = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, total]);

  useEffect(() => {
    if (status === 'running' && elapsed >= total) {
      setStatus('finished');
      haptic.success();
      completePractice(practice.id).catch(() => toast('Не удалось сохранить прогресс', 'error'));
    }
  }, [elapsed, total, status, completePractice, practice.id]);

  const phase = useMemo(() => (practice.mode === 'breathing' ? breathingPhase(practice, elapsed) : null), [practice, elapsed]);
  const stepIndex = practice.mode === 'steps' ? Math.min(practice.steps.length - 1, Math.floor(elapsed / practice.stepSec)) : 0;

  // вибрация в ритме дыхания: частые лёгкие импульсы на вдохе, редкие мягкие на выдохе,
  // тишина на задержке — можно дышать с закрытыми глазами
  useEffect(() => {
    if (!rhythm || status !== 'running' || !phase) return;
    const interval = phase.name === 'inhale' ? 420 : phase.name === 'exhale' ? 720 : 0;
    if (!interval) return;
    const t = performance.now();
    if (t - lastPulse.current < interval) return;
    lastPulse.current = t;
    pulse(phase.name === 'inhale' ? 'light' : 'soft');
  }, [elapsed, rhythm, status, phase]);

  // лёгкий отклик на смене фазы дыхания
  const prevPhase = useRef<string | null>(null);
  useEffect(() => {
    const key = phase ? `${phase.cycle}-${phase.name}` : `s-${stepIndex}`;
    if (status === 'running' && prevPhase.current && prevPhase.current !== key) haptic.impact('soft');
    prevPhase.current = key;
  }, [phase, stepIndex, status]);

  useMainButton(
    status === 'ready'
      ? { text: `Начать · ${Math.round(total / 60)} мин`, onClick: () => setStatus('running'), shine: true }
      : status === 'finished'
        ? { text: 'Готово', onClick: pop }
        : null,
  );

  const remaining = Math.max(0, Math.ceil(total - elapsed));
  const scale = phase ? phase.scale : 0.8;

  return (
    <div className="screen overlay-screen player">
      <div className="player-bg">
        <Img name={practice.image} eager />
      </div>
      <ScreenHeader onDark title={<span className="player-title">{practice.title}</span>} />

      <div className="player-stage">
        {status === 'ready' && (
          <div className="player-intro rise">
            <div className="eyebrow">{practice.subtitle}</div>
            <p className="display">{practice.intro}</p>
          </div>
        )}

        {status !== 'ready' && status !== 'finished' && practice.mode === 'breathing' && phase && (
          <div className="breath">
            <div
              className="breath-orb"
              style={{
                transform: `scale(${scale})`,
                transitionDuration: `${phase.transition}s`,
              }}
            />
            <div className="breath-text">
              <div className="display breath-phase" key={`${phase.cycle}-${phase.name}`}>
                {PHASE_LABEL[phase.name]}
              </div>
              <div className="breath-count num">{phase.left}</div>
            </div>
          </div>
        )}

        {status !== 'ready' && status !== 'finished' && practice.mode === 'steps' && (
          <div className="steps-view">
            <div className="steps-n num">
              {stepIndex + 1} / {practice.steps.length}
            </div>
            <p className="display steps-text" key={stepIndex}>
              {practice.steps[stepIndex]}
            </p>
          </div>
        )}

        {status === 'finished' && (
          <div className="player-finish rise">
            <div className="display">Практика завершена</div>
            <p>Побудьте ещё немного в этом состоянии. Заметьте, что изменилось в теле и мыслях.</p>
          </div>
        )}
      </div>

      {(status === 'running' || status === 'paused') && (
        <div className="player-controls">
          <div className="player-meta num">
            {phase ? `Цикл ${Math.min(phase.cycle + 1, (practice as { cycles: number }).cycles)} из ${(practice as { cycles: number }).cycles}` : ''}
            <span>{formatClock(remaining)}</span>
          </div>
          <div className="bar player-bar">
            <i style={{ width: `${(elapsed / total) * 100}%`, transition: 'none' }} />
          </div>
          {practice.mode === 'breathing' && rhythm && (
            <div className="player-hint">Вибро-ритм: частые импульсы — вдох, редкие — выдох</div>
          )}
          <div className="player-buttons">
            <button
              className="icon-btn glass-dark"
              onClick={() => {
                setElapsed(0);
                setStatus('running');
              }}
              aria-label="Сначала"
            >
              <RotateCcw size={18} />
            </button>
            <button
              className="player-main"
              onClick={() => setStatus(status === 'running' ? 'paused' : 'running')}
              aria-label={status === 'running' ? 'Пауза' : 'Продолжить'}
            >
              {status === 'running' ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
            {practice.mode === 'steps' ? (
              <button
                className="icon-btn glass-dark"
                onClick={() => setElapsed(Math.min(total, (stepIndex + 1) * practice.stepSec))}
                aria-label="Следующий шаг"
              >
                <SkipForward size={18} />
              </button>
            ) : (
              <button
                className={`icon-btn glass-dark ${rhythm ? 'on' : ''}`}
                onClick={() => setRhythm(!rhythm)}
                aria-label={rhythm ? 'Выключить вибро-ритм' : 'Включить вибро-ритм'}
                aria-pressed={rhythm}
              >
                {rhythm ? <Vibrate size={18} /> : <VibrateOff size={18} />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Импульс вибрации: Telegram Haptic Feedback, в браузере — Vibration API (Android). */
function pulse(style: 'light' | 'soft') {
  if (tg && isTelegram) haptic.impact(style);
  else navigator.vibrate?.(style === 'light' ? 12 : 20);
}

function breathingPhase(p: Extract<Practice, { mode: 'breathing' }>, elapsed: number) {
  const order: BreathPhase[] = ['inhale', 'hold', 'exhale', 'rest'];
  const phases = order.filter((n) => p.pattern[n] > 0).map((n) => ({ name: n, dur: p.pattern[n] }));
  const cycleLen = phases.reduce((a, b) => a + b.dur, 0);
  const cycle = Math.floor(elapsed / cycleLen);
  let t = elapsed - cycle * cycleLen;
  let prev: BreathPhase = 'rest';
  for (const ph of phases) {
    if (t < ph.dur) {
      // целевой масштаб фазы: на вдохе растём, на выдохе сжимаемся, задержки держат форму
      const target = ph.name === 'inhale' ? 1 : ph.name === 'exhale' ? 0.55 : prev === 'inhale' ? 1 : 0.55;
      return { name: ph.name, cycle, left: Math.ceil(ph.dur - t), scale: target, transition: ph.dur };
    }
    t -= ph.dur;
    prev = ph.name;
  }
  return { name: 'rest' as BreathPhase, cycle, left: 0, scale: 0.55, transition: 1 };
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
