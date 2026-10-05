import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FLASH } from '../domain/economy';
import { haptic } from '../telegram/webapp';
import { Img } from './Img';
import { useMainButton } from './MainButton';

// ── Слайды ───────────────────────────────────────────────────────────────

const SLIDES = [
  {
    image: 'hero-clouds',
    eyebrow: 'Добро пожаловать',
    title: (
      <>
        Атлас — карта вашего <em>внутреннего</em> мира
      </>
    ),
    text: 'Здесь психология становится практикой: короткий тест, дыхательные техники и программы школы.',
  },
  {
    image: 'orb-night',
    eyebrow: 'Сфера дыхания',
    title: (
      <>
        Касайтесь сферы — <em>копите искры</em>
      </>
    ),
    text: `Каждое касание — маленькая пауза для себя. ${FLASH.every} касаний подряд зажигают вспышку ×2, а новые уровни открывают новые миры.`,
  },
  {
    image: 'mountain-lake',
    eyebrow: 'Лавка и программы',
    title: (
      <>
        Обменивайте искры на <em>практики и скидки</em>
      </>
    ),
    text: 'А начать лучше с теста «Карта внутреннего состояния»: 3 минуты и гайд по тревоге в подарок.',
  },
];

export function OnboardingSlides({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const last = i === SLIDES.length - 1;

  const go = (n: number) => {
    if (n < 0 || n >= SLIDES.length) return;
    haptic.select();
    setI(n);
  };

  useMainButton({ text: last ? 'Как всё устроено' : 'Далее', onClick: () => (last ? onDone() : go(i + 1)), priority: 20, shine: last });

  return (
    <div
      className="onb"
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (dx < -50) go(i + 1);
        if (dx > 50) go(i - 1);
      }}
    >
      {SLIDES.map((s, n) => (
        <div key={s.image} className={`onb-bg ${n === i ? 'on' : ''}`} aria-hidden={n !== i}>
          <Img name={s.image} eager={n === 0} />
        </div>
      ))}
      <div className="onb-shade" />
      <button className="onb-skip glass-dark" onClick={onSkip}>
        Пропустить
      </button>
      <div className="onb-content" key={i}>
        <div className="eyebrow">{SLIDES[i]!.eyebrow}</div>
        <h1 className="display">{SLIDES[i]!.title}</h1>
        <p>{SLIDES[i]!.text}</p>
      </div>
      <div className="onb-dots" role="tablist">
        {SLIDES.map((_, n) => (
          <button key={n} className={n === i ? 'on' : ''} onClick={() => go(n)} aria-label={`Слайд ${n + 1}`} />
        ))}
      </div>
    </div>
  );
}

// ── Тур с подсветкой ─────────────────────────────────────────────────────

export interface TourStep {
  target: string;
  title: string;
  text: string;
}

export const HOME_TOUR: TourStep[] = [
  {
    target: 'leadmagnet',
    title: 'Начните отсюда',
    text: 'Тест из 10 вопросов покажет ваш «ландшафт», а гайд «7 техник самопомощи при тревоге» придёт в подарок.',
  },
  {
    target: 'pass',
    title: 'Ваш пропуск',
    text: 'Уровень, баланс искр и серия дней. Нажмите на него — откроется карта пути с мирами.',
  },
  {
    target: 'tab-practice',
    title: 'Практика',
    text: 'Сфера дыхания: касайтесь, копите искры и ловите вспышки ×2.',
  },
  {
    target: 'tab-shop',
    title: 'Лавка',
    text: 'Обменивайте искры на практики, промокоды на программы и консультации.',
  },
];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

const PAD = 8;

export function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vh, setVh] = useState(window.innerHeight);
  const step = steps[i]!;
  const last = i === steps.length - 1;

  useMainButton(null);

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      // элемента нет на экране — пропускаем шаг
      if (last) onDone();
      else setI((n) => n + 1);
      return;
    }
    // элемент в прокручиваемом экране ставим ближе к верху — под ним останется место для подсказки
    const scroller = el.closest('.screen');
    if (scroller) {
      el.scrollIntoView({ block: 'start' });
      scroller.scrollBy(0, -110);
    }
    const measure = () => {
      const b = el.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el).borderRadius) || 20;
      setRect({ x: b.left - PAD, y: b.top - PAD, w: b.width + PAD * 2, h: b.height + PAD * 2, r: Math.min(radius + PAD, 40) });
      setVh(window.innerHeight);
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [step.target, last, onDone]);

  useEffect(() => {
    haptic.select();
  }, [i]);

  const next = () => (last ? onDone() : setI(i + 1));
  // подсказка — под элементом, над ним или, если элемент высокий, поверх его нижней части
  const TIP = 210;
  const tipStyle: React.CSSProperties = !rect
    ? {}
    : vh - (rect.y + rect.h) >= TIP + 14
      ? { top: rect.y + rect.h + 14 }
      : rect.y >= TIP + 14
        ? { bottom: vh - rect.y + 14 }
        : { bottom: 'calc(var(--bottom) + 16px)' };

  return (
    <div className="tour" role="dialog" aria-label="Знакомство с приложением">
      <svg className="tour-mask" width="100%" height="100%" aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {rect && <rect className="tour-cut" style={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }} rx={rect.r} fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" className="tour-dim" mask="url(#tour-hole)" />
      </svg>
      {rect && (
        <div className="tour-ring" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: rect.r }} />
      )}
      {rect && (
        <div
          className="tour-tip glass"
          key={i}
          style={tipStyle}
        >
          <div className="tour-step num">
            {i + 1} / {steps.length}
          </div>
          <div className="tour-title display">{step.title}</div>
          <p>{step.text}</p>
          <div className="tour-actions">
            <button className="tour-skip" onClick={onDone}>
              Пропустить
            </button>
            <button className="btn btn-primary btn-sm" onClick={next}>
              {last ? 'Начать путь' : 'Далее'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
