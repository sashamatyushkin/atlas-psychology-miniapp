import { CalendarCheck, ListChecks, Map as MapIcon, Rocket, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Img } from '../components/Img';
import { Spark, formatNum } from '../components/Spark';
import { useEnergy } from '../hooks/useEnergy';
import { dailyStatus } from '../domain/engine';
import { FLASH, LEVELS, levelFor, worldFor } from '../domain/economy';
import type { World } from '../domain/types';
import { useApp, useDisplayBalance } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { haptic } from '../telegram/webapp';
import './practice.css';

interface Float {
  id: number;
  x: number;
  y: number;
  value: number;
  boosted: boolean;
}

let floatSeq = 0;

/** Тапалка: «Сфера дыхания». Касание = искры, серия из 100 касаний зажигает вспышку ×2. */
export function Practice({ active }: { active: boolean }) {
  const state = useApp((s) => s.state)!;
  const tap = useApp((s) => s.tap);
  const { openSheet, push } = useNav();
  const balance = useDisplayBalance();
  const { energy, cap, tapValue, regen } = useEnergy(active ? 250 : 2000);
  const { level, next, progress } = levelFor(state.totalEarned + (balance - state.balance));
  const world = worldFor(level.index);
  const daily = dailyStatus(state, Date.now());

  const [floats, setFloats] = useState<Float[]>([]);
  const [tilt, setTilt] = useState({ x: 0, y: 0, pressed: false });
  const [combo, setCombo] = useState(0);
  const [flashUntil, setFlashUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [reveal, setReveal] = useState<World | null>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const lastTapAt = useRef(0);
  const comboRef = useRef(0);
  const lastHaptic = useRef(0);
  const lastEmptyToast = useRef(0);
  const prevLevel = useRef(level.index);

  const flashing = now < flashUntil;
  const flashLeft = Math.ceil((flashUntil - now) / 1000);

  // часы для вспышки и затухания комбо
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (comboRef.current > 0 && t - lastTapAt.current > FLASH.comboGapMs && t >= flashUntil) {
        comboRef.current = 0;
        setCombo(0);
      }
    }, 200);
    return () => clearInterval(id);
  }, [active, flashUntil]);

  // новый уровень — открывается новый мир
  useEffect(() => {
    if (level.index > prevLevel.current) {
      haptic.success();
      setReveal(worldFor(level.index));
      const t = setTimeout(() => setReveal(null), 3200);
      prevLevel.current = level.index;
      return () => clearTimeout(t);
    }
    prevLevel.current = level.index;
  }, [level.index]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = orbRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const t = Date.now();
      const boosted = t < flashUntil;
      if (!tap(boosted)) {
        haptic.error();
        orbRef.current?.classList.remove('shake');
        void orbRef.current?.offsetWidth;
        orbRef.current?.classList.add('shake');
        comboRef.current = 0;
        setCombo(0);
        if (t - lastEmptyToast.current > 3000) {
          lastEmptyToast.current = t;
          toast('Энергия восстанавливается — сделайте паузу и подышите');
        }
        return;
      }

      // комбо: касания без пауз дольше 0.7 с
      comboRef.current = t - lastTapAt.current <= FLASH.comboGapMs || boosted ? comboRef.current + 1 : 1;
      lastTapAt.current = t;
      setCombo(comboRef.current);
      if (!boosted && comboRef.current % FLASH.every === 0) {
        setFlashUntil(t + FLASH.durationSec * 1000);
        setNow(t);
        haptic.impact('heavy');
        haptic.success();
      } else if (t - lastHaptic.current > 45) {
        haptic.tap();
        lastHaptic.current = t;
      }

      const nx = (x / rect.width - 0.5) * 2;
      const ny = (y / rect.height - 0.5) * 2;
      setTilt({ x: -ny * 10, y: nx * 10, pressed: true });
      const id = ++floatSeq;
      setFloats((f) => [...f.slice(-14), { id, x, y, value: tapValue * (boosted ? 2 : 1), boosted }]);
      setTimeout(() => setFloats((f) => f.filter((p) => p.id !== id)), 900);
    },
    [tap, tapValue, flashUntil],
  );

  const release = useCallback(() => setTilt((t) => ({ ...t, x: 0, y: 0, pressed: false })), []);

  const energyPct = (energy / cap) * 100;
  const fullIn = Math.ceil((cap - energy) / regen);
  const comboProgress = flashing ? (flashUntil - now) / (FLASH.durationSec * 1000) : (combo % FLASH.every) / FLASH.every;
  const R = 47;
  const C = 2 * Math.PI * R;

  return (
    <div
      className={`screen practice ${flashing ? 'flashing' : ''}`}
      style={{ '--glow': world.glow, '--combo': Math.min(1, combo / FLASH.every) } as React.CSSProperties}
    >
      <div className="practice-bg" aria-hidden="true">
        <Img key={world.image} name={world.image} eager />
      </div>
      {flashing && <div className="flash-burst" aria-hidden="true" />}

      <header className="practice-top">
        <button className="level-pill glass-dark" onClick={() => push({ name: 'map' })} aria-label="Карта пути">
          <div className="level-row">
            <span className="level-title">
              <MapIcon size={14} /> {level.title}
            </span>
            <span className="level-count">
              {level.index + 1}/{LEVELS.length}
            </span>
          </div>
          <div className="bar level-bar">
            <i style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </div>
        </button>
        <button className="pill-btn glass-dark" onClick={() => openSheet({ name: 'daily' })} aria-label="Награда дня">
          <CalendarCheck size={18} />
          {daily.available && <span className="dot" />}
        </button>
      </header>

      <div className="practice-balance">
        <div className="balance-big num">
          <Spark size={34} />
          {formatNum(balance)}
        </div>
        <div className="balance-caption">
          {flashing ? (
            <span className="flash-caption">
              Вспышка · <b>×2</b> ещё {flashLeft} с
            </span>
          ) : (
            <>
              {world.name} · <b>+{tapValue}</b> за касание
              {next ? '' : ' · вершина'}
            </>
          )}
        </div>
      </div>

      <div className="orb-zone">
        <div
          ref={orbRef}
          className={`orb ${tilt.pressed ? 'pressed' : ''} ${energy < tapValue ? 'empty' : ''}`}
          style={{ '--rx': `${tilt.x}deg`, '--ry': `${tilt.y}deg` } as React.CSSProperties}
          onPointerDown={onPointerDown}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          onContextMenu={(e) => e.preventDefault()}
          role="button"
          aria-label="Коснитесь сферы, чтобы получить искры"
        >
          <div className="orb-ring r1" />
          <div className="orb-ring r2" />
          <div className="orb-ring r3" />
          <svg className="combo-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={R} className="combo-track" />
            <circle
              cx="50"
              cy="50"
              r={R}
              className="combo-fill"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - comboProgress)}
            />
          </svg>
          <div className="orb-core">
            <Img key={world.image} name={world.image} eager />
            <div className="orb-glare" />
            <div className="orb-label">
              <span className="breath-in">вдох</span>
              <span className="breath-out">выдох</span>
            </div>
          </div>
          {combo >= 10 && !flashing && (
            <div className="combo-chip num" key={Math.floor(combo / 10)}>
              Комбо ×{combo}
              <span>до вспышки {FLASH.every - (combo % FLASH.every)}</span>
            </div>
          )}
          {floats.map((f) => (
            <span key={f.id} className={`float num ${f.boosted ? 'gold' : ''}`} style={{ left: f.x, top: f.y }}>
              +{f.value}
            </span>
          ))}
        </div>
      </div>

      <div className="practice-bottom">
        <div className="energy">
          <div className="energy-row">
            <span className="energy-label">
              <Zap size={16} fill="currentColor" />
              <b className="num">{formatNum(energy)}</b>
              <span className="num">/ {formatNum(cap)}</span>
            </span>
            <span className="energy-hint">{energy >= cap ? 'Полный запас' : `+${regen}/сек · полная через ${formatTime(fullIn)}`}</span>
          </div>
          <div className="bar energy-bar">
            <i style={{ width: `${energyPct}%` }} />
          </div>
        </div>
        <div className="practice-actions">
          <button className="action glass-dark" onClick={() => openSheet({ name: 'tasks' })} data-tour="tasks">
            <ListChecks size={20} />
            <span>Задания</span>
          </button>
          <button className="action glass-dark" onClick={() => openSheet({ name: 'boosts' })}>
            <Rocket size={20} />
            <span>Бусты</span>
          </button>
        </div>
      </div>

      {reveal && (
        <div className="world-reveal" onClick={() => setReveal(null)}>
          <Img name={reveal.image} eager />
          <div className="world-reveal-text">
            <span className="eyebrow">Новый уровень · новый мир</span>
            <div className="display">{reveal.name}</div>
            <span className="world-reveal-level">{LEVELS[reveal.level]!.title}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(sec: number) {
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} мин ${s} с` : `${m} мин`;
}
