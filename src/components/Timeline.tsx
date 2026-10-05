import { useEffect, useMemo, useRef } from 'react';
import { findCourse, findProduct } from '../domain/catalog';
import { LEVELS, worldFor } from '../domain/economy';
import { PRACTICES } from '../domain/practices';
import { PROFILES } from '../domain/quiz';
import type { GameState } from '../domain/types';
import { Img } from './Img';

interface Event {
  at: number;
  title: string;
  sub: string;
  image: string;
  accent?: boolean;
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

/** События пути пользователя из состояния — без отдельного хранения. */
export function buildTimeline(s: GameState): Event[] {
  const ev: Event[] = [{ at: s.createdAt, title: 'Начало пути', sub: 'Первый вход в Атлас', image: 'hero-clouds' }];
  for (const [idx, at] of Object.entries(s.levelsAt)) {
    const i = Number(idx);
    if (i > 0 && LEVELS[i]) ev.push({ at, title: LEVELS[i]!.title, sub: `Открыт мир «${worldFor(i).name}»`, image: worldFor(i).image, accent: true });
  }
  if (s.quiz) {
    const p = PROFILES[s.quiz.profile];
    ev.push({ at: s.quiz.completedAt, title: `Ландшафт: ${p.word}`, sub: 'Карта состояния', image: p.image });
  }
  if (s.tasks.quiz) ev.push({ at: s.tasks.quiz, title: 'Гайд получен', sub: '7 техник при тревоге', image: 'purple-lake' });
  for (const p of s.practiceLog) {
    const pr = PRACTICES[p.id];
    if (pr) ev.push({ at: p.at, title: pr.title, sub: 'Практика завершена', image: pr.image });
  }
  for (const p of s.purchases) {
    const pr = findProduct(p.productId);
    if (pr) ev.push({ at: p.at, title: pr.title, sub: 'Обмен в Лавке', image: pr.image });
  }
  for (const e of s.enrollments) {
    const c = findCourse(e.courseId);
    if (c) ev.push({ at: e.at, title: c.title, sub: 'Запись на программу', image: c.image, accent: true });
  }
  return ev.sort((a, b) => a.at - b.at);
}

export function Timeline({ state }: { state: GameState }) {
  const events = useMemo(() => buildTimeline(state), [state]);
  const ref = useRef<HTMLDivElement>(null);

  // показываем последние события
  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth });
  }, [events.length]);

  const day = (at: number) => Math.floor((at - state.createdAt) / 86_400_000) + 1;

  return (
    <div className="timeline" ref={ref}>
      <div className="timeline-track">
        {events.map((e, i) => (
          <div key={`${e.at}-${i}`} className={`tl-item ${e.accent ? 'accent' : ''}`}>
            <div className="tl-head">
              <span className="tl-day num">День {day(e.at)}</span>
              <span className="tl-title">{e.title}</span>
            </div>
            <div className="tl-line">
              <i className="tl-dot" />
            </div>
            <Img name={e.image} className="tl-img" />
            <span className="tl-sub">
              {e.sub} · {dateFmt.format(e.at)}
            </span>
          </div>
        ))}
        <div className="tl-item tl-next">
          <div className="tl-head">
            <span className="tl-day">Дальше</span>
            <span className="tl-title">Следующий шаг</span>
          </div>
          <div className="tl-line">
            <i className="tl-dot" />
          </div>
          <div className="tl-img tl-placeholder">✦</div>
          <span className="tl-sub">Практика, уровень или программа</span>
        </div>
      </div>
    </div>
  );
}
