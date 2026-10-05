import { CalendarCheck, ListChecks, Rocket, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Img } from '../components/Img';
import { Spark, formatNum } from '../components/Spark';
import { useEnergy } from '../hooks/useEnergy';
import { dailyStatus } from '../domain/engine';
import { LEVELS, levelFor } from '../domain/economy';
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
}

let floatSeq = 0;

/** Тапалка: «Сфера дыхания». Касание = искры, энергия восстанавливается со временем. */
export function Practice({ active }: { active: boolean }) {
  const state = useApp((s) => s.state)!;
  const tap = useApp((s) => s.tap);
  const openSheet = useNav((s) => s.openSheet);
  const balance = useDisplayBalance();
  const { energy, cap, tapValue, regen } = useEnergy(active ? 250 : 2000);
  const { level, next, progress } = levelFor(state.totalEarned + (balance - state.balance));
  const daily = dailyStatus(state, Date.now());

  const [floats, setFloats] = useState<Float[]>([]);
  const [tilt, setTilt] = useState({ x: 0, y: 0, pressed: false });
  const orbRef = useRef<HTMLDivElement>(null);
  const lastHaptic = useRef(0);
  const lastEmptyToast = useRef(0);
  const prevLevel = useRef(level.index);

  useEffect(() => {
    if (level.index > prevLevel.current) {
      haptic.success();
      toast(`Новый уровень: ${level.title}`, 'success');
    }
    prevLevel.current = level.index;
  }, [level.index, level.title]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = orbRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!tap()) {
        haptic.error();
        orbRef.current?.classList.remove('shake');
        void orbRef.current?.offsetWidth;
        orbRef.current?.classList.add('shake');
        if (Date.now() - lastEmptyToast.current > 3000) {
          lastEmptyToast.current = Date.now();
          toast('Энергия восстанавливается — сделайте паузу и подышите');
        }
        return;
      }
      const now = performance.now();
      if (now - lastHaptic.current > 45) {
        haptic.tap();
        lastHaptic.current = now;
      }
      // наклон сферы в сторону касания (как в хамстере, но мягче)
      const nx = (x / rect.width - 0.5) * 2;
      const ny = (y / rect.height - 0.5) * 2;
      setTilt({ x: -ny * 10, y: nx * 10, pressed: true });
      const id = ++floatSeq;
      setFloats((f) => [...f.slice(-14), { id, x, y, value: tapValue }]);
      setTimeout(() => setFloats((f) => f.filter((p) => p.id !== id)), 900);
    },
    [tap, tapValue],
  );

  const release = useCallback(() => setTilt((t) => ({ ...t, x: 0, y: 0, pressed: false })), []);

  const energyPct = (energy / cap) * 100;
  const fullIn = Math.ceil((cap - energy) / regen);

  return (
    <div className="screen practice">
      <div className="practice-bg" aria-hidden="true">
        <Img name="orb-night" eager />
      </div>

      <header className="practice-top">
        <button className="level-pill glass-dark" onClick={() => openSheet({ name: 'boosts' })}>
          <div className="level-row">
            <span className="level-title">{level.title}</span>
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
          искры осознанности · <b>+{tapValue}</b> за касание
          {next ? '' : ' · максимальный уровень'}
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
          <div className="orb-core">
            <Img name="orb-night" eager />
            <div className="orb-glare" />
            <div className="orb-label">
              <span className="breath-in">вдох</span>
              <span className="breath-out">выдох</span>
            </div>
          </div>
          {floats.map((f) => (
            <span key={f.id} className="float num" style={{ left: f.x, top: f.y }}>
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
          <button className="action glass-dark" onClick={() => openSheet({ name: 'tasks' })}>
            <ListChecks size={20} />
            <span>Задания</span>
          </button>
          <button className="action glass-dark" onClick={() => openSheet({ name: 'boosts' })}>
            <Rocket size={20} />
            <span>Бусты</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} мин ${s} с` : `${m} мин`;
}
