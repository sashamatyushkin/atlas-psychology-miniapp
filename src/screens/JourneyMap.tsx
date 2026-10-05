import { Check, Lock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Img } from '../components/Img';
import { useMainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Amount, formatNum } from '../components/Spark';
import { LEVELS, WORLDS, levelFor } from '../domain/economy';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import './map.css';

/** Макет карты в условных единицах: ширина 360, шаг между уровнями 210. */
const W = 360;
const STEP = 210;
const PAD = 130;
const H = PAD * 2 + STEP * (LEVELS.length - 1);
const X = [104, 256, 112, 248, 108, 252];

const point = (level: number) => ({ x: X[level]!, y: H - PAD - level * STEP });

function pathThrough(levels: number[]) {
  const pts = levels.map(point);
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    d += ` C ${a.x} ${a.y - STEP * 0.55}, ${b.x} ${b.y + STEP * 0.55}, ${b.x} ${b.y}`;
  }
  return d;
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

/** Карта пути: уровни как точки маршрута, у каждой — свой «мир» сферы. */
export function JourneyMap() {
  const state = useApp((s) => s.state)!;
  const user = useApp((s) => s.user)!;
  const { pop, setTab } = useNav();
  const { level, next, progress } = levelFor(state.totalEarned);
  const scroller = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useMainButton({
    text: 'Продолжить путь',
    onClick: () => {
      pop();
      setTab('practice');
    },
  });

  // открываем карту на текущей точке
  useEffect(() => {
    // после анимации появления экрана плавно доводим до текущей точки
    const t = setTimeout(() => {
      const sc = scroller.current;
      const node = currentRef.current;
      if (!sc || !node) return;
      const top = node.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - sc.clientHeight * 0.45;
      sc.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const all = LEVELS.map((l) => l.index);
  const traveled = all.slice(0, level.index + 1);
  const initials = (user.firstName[0] ?? '') + (user.lastName?.[0] ?? '');

  return (
    <div className="screen overlay-screen journey" ref={scroller}>
      <ScreenHeader title="Карта пути" />
      <div className="journey-intro">
        <div className="eyebrow">Уровень {level.index + 1} из {LEVELS.length}</div>
        <h1 className="display">
          Вы — <em>{level.title.toLowerCase()}</em>
        </h1>
        <p className="muted">Каждый уровень открывает новый мир сферы и товары в Лавке. Уровень растёт от всех заработанных искр.</p>
      </div>

      <div className="map-canvas" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <linearGradient id="trail" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="var(--teal)" />
              <stop offset="1" stopColor="var(--accent)" />
            </linearGradient>
            <pattern id="topo" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M0 30 Q30 10 60 30 T120 30 M0 70 Q30 50 60 70 T120 70 M0 105 Q30 90 60 105 T120 105" className="topo" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#topo)" />
          <path d={pathThrough(all)} className="trail-dash" />
          {traveled.length > 1 && <path d={pathThrough(traveled)} className="trail-done" />}
        </svg>

        {WORLDS.map((w) => {
          const p = point(w.level);
          const l = LEVELS[w.level]!;
          const passed = w.level < level.index;
          const current = w.level === level.index;
          const locked = w.level > level.index;
          const at = state.levelsAt[String(w.level)];
          const side = p.x < W / 2 ? 'right' : 'left';
          return (
            <div
              key={w.level}
              ref={current ? currentRef : undefined}
              className={`node ${passed ? 'passed' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''} side-${side}`}
              style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
            >
              <div className="node-orb">
                <Img name={w.image} />
                {locked && (
                  <span className="node-lock">
                    <Lock size={18} />
                  </span>
                )}
                {passed && (
                  <span className="node-badge">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
                {current && <span className="node-me">{initials}</span>}
              </div>
              <div className="node-card">
                <span className="node-n num">{String(w.level + 1).padStart(2, '0')}</span>
                <span className="node-title display">{l.title}</span>
                <span className="node-world">{w.name}</span>
                <span className="node-meta num">
                  {current ? 'Вы здесь' : passed && at ? dateFmt.format(at) : l.min === 0 ? 'Старт' : `${formatNum(l.min)} ✦`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="journey-goal card">
        {next ? (
          <>
            <div className="journey-goal-row">
              <span>
                До «{next.title}» — <Amount value={next.min - state.totalEarned} size={12} />
              </span>
              <b className="num">{Math.floor(progress * 100)}%</b>
            </div>
            <div className="bar">
              <i style={{ width: `${Math.max(3, progress * 100)}%` }} />
            </div>
          </>
        ) : (
          <span>Вы прошли весь путь Атласа ✦</span>
        )}
      </div>
    </div>
  );
}
