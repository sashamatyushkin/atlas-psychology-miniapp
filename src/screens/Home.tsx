import { ArrowRight, ArrowUpRight, Flame, Gift, Star, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { BalanceChip } from '../components/BalanceChip';
import { Img } from '../components/Img';
import { Amount, Spark, formatNum } from '../components/Spark';
import { useEnergy } from '../hooks/useEnergy';
import { COURSES, SCHOOL } from '../domain/catalog';
import { dailyStatus } from '../domain/engine';
import { LEVELS, TASK_REWARDS, levelFor } from '../domain/economy';
import { PROFILES } from '../domain/quiz';
import { useApp, useDisplayBalance } from '../store/app';
import { useNav } from '../store/nav';
import { haptic } from '../telegram/webapp';
import './home.css';

function greeting(h: number) {
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 17) return 'Добрый день';
  if (h >= 17 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

export function Home() {
  const user = useApp((s) => s.user)!;
  const state = useApp((s) => s.state)!;
  const now = useApp((s) => s.now);
  const { push, openSheet, setTab } = useNav();
  const daily = dailyStatus(state, now());
  const recommended = state.quiz ? PROFILES[state.quiz.profile].courseId : null;

  return (
    <div className="screen home">
      <header className="home-top rise">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">{SCHOOL.name}</div>
            <div className="brand-sub">школа психологии</div>
          </div>
        </div>
        <BalanceChip />
      </header>

      <section className="home-hello rise rise-1">
        <div className="eyebrow">{dayCaption(state.createdAt, now())}</div>
        <h1 className="display">
          {greeting(new Date().getHours())},
          <br />
          <em>{user.firstName}</em>
        </h1>
      </section>

      <div className="rise rise-2">
        <PassCard onOpen={() => setTab('profile')} />
      </div>

      <section className="section rise rise-3">
        <LeadMagnetCard onStart={() => push({ name: 'quiz' })} onGuide={() => push({ name: 'guide' })} />
      </section>

      <section className="section rise rise-4">
        <div className="section-head">
          <h2>Сегодня</h2>
        </div>
        <div className="today">
          <button className="today-card card" onClick={() => openSheet({ name: 'daily' })}>
            <div className="today-icon gift">
              <Gift size={18} />
            </div>
            <div className="today-label">Награда дня</div>
            {daily.available ? (
              <>
                <div className="today-value">
                  <Amount value={daily.nextReward} size={15} />
                </div>
                <div className="today-sub">День {daily.nextStreak} серии · забрать</div>
                <span className="today-dot" />
              </>
            ) : (
              <>
                <div className="today-value">Получено</div>
                <div className="today-sub">
                  <Flame size={12} /> {daily.streak} дн. подряд
                </div>
              </>
            )}
          </button>
          <EnergyCard onOpen={() => setTab('practice')} />
        </div>
      </section>

      <section className="section rise rise-5">
        <div className="section-head">
          <h2>Программы</h2>
          <span className="subtle num" style={{ fontSize: 13 }}>
            {COURSES.length} направлений
          </span>
        </div>
        <div className="courses">
          {COURSES.map((c) => (
            <button key={c.id} className="course-card" onClick={() => openSheet({ name: 'course', id: c.id })}>
              <Img name={c.image} alt={c.title} />
              <div className="course-shade" />
              <div className="course-top">
                <span className="chip chip-outline">{c.duration}</span>
                {recommended === c.id ? (
                  <span className="chip chip-outline rec">
                    <Star size={12} fill="currentColor" /> Для вас
                  </span>
                ) : (
                  <span className="icon-btn glass-dark course-arrow">
                    <ArrowUpRight size={17} />
                  </span>
                )}
              </div>
              <div className="course-title">{c.title}</div>
              <div className="glass-word course-word" style={{ fontSize: wordSize(c.word) }}>
                {c.word}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="proof card">
          <div>
            <b className="num">{formatNum(SCHOOL.graduates)}</b>
            <span>выпускников</span>
          </div>
          <div>
            <b className="num">{SCHOOL.psychologists}</b>
            <span>психологов</span>
          </div>
          <div>
            <b className="num">
              {SCHOOL.rating} <Star size={13} fill="currentColor" />
            </b>
            <span>средняя оценка</span>
          </div>
        </div>
      </section>

      <figure className="quote">
        <span className="quote-mark">“</span>
        <blockquote className="display">
          Когда я принимаю себя таким, какой я есть, тогда я могу измениться.
        </blockquote>
        <figcaption className="eyebrow">Карл Роджерс</figcaption>
      </figure>
    </div>
  );
}

/** Крупное слово занимает почти всю ширину карточки, но не обрезается. */
export function wordSize(word: string, max = 96) {
  return `clamp(48px, ${Math.min(21, 152 / word.length).toFixed(1)}vw, ${max}px)`;
}

function dayCaption(createdAt: number, now: number) {
  const day = Math.floor((now - createdAt) / 86_400_000) + 1;
  return `Ваш путь · день ${day}`;
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="currentColor" opacity="0.1" />
      <path d="M12 45 26 23l7.5 10.5L39 26l13 19Z" fill="var(--accent)" />
      <circle cx="43" cy="18.5" r="4.5" fill="var(--accent-2)" />
    </svg>
  );
}

/** «Пропуск» участника в стилистике билета (референс Safari Pass). */
function PassCard({ onOpen }: { onOpen: () => void }) {
  const user = useApp((s) => s.user)!;
  const state = useApp((s) => s.state)!;
  const balance = useDisplayBalance();
  const { level, next, progress } = levelFor(state.totalEarned);
  const streak = dailyStatus(state, Date.now()).streak;
  const bars = useMemo(() => barcode(user.id), [user.id]);
  const number = String(user.id).padStart(10, '0').replace(/(\d{4})(?=\d)/g, '$1 ');

  return (
    <button className="pass" onClick={onOpen} aria-label="Ваш пропуск">
      <div className="pass-main">
        <div className="eyebrow pass-eyebrow">Atlas pass</div>
        <div className="pass-level display">{level.title}</div>
        <div className="pass-sub">
          Уровень {level.index + 1} из {LEVELS.length}
          {next && (
            <>
              {' · '}до «{next.title}» <Amount value={next.min - state.totalEarned} size={11} />
            </>
          )}
        </div>
        <div className="bar pass-bar">
          <i style={{ width: `${Math.max(4, progress * 100)}%` }} />
        </div>
        <div className="pass-meta">
          <div>
            <Spark size={15} />
            <b className="num">{formatNum(balance)}</b>
            <span>баланс</span>
          </div>
          <div>
            <Flame size={15} />
            <b className="num">{streak}</b>
            <span>дней подряд</span>
          </div>
          <div>
            <Zap size={15} />
            <b className="num">{formatNum(state.totalTaps)}</b>
            <span>касаний</span>
          </div>
        </div>
      </div>
      <div className="pass-stub">
        <Img name="hero-clouds" className="pass-img" eager />
        <svg className="pass-barcode" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
          {bars.map(([x, w], i) => (
            <rect key={i} x={x} y="0" width={w} height="24" fill="currentColor" />
          ))}
        </svg>
        <div className="pass-number num">{number}</div>
      </div>
    </button>
  );
}

function barcode(seed: number): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  let s = seed % 2147483647 || 7;
  while (x < 100) {
    s = (s * 16807) % 2147483647;
    const w = 0.8 + (s % 4) * 0.7;
    out.push([x, w]);
    x += w + 0.9 + ((s >> 3) % 3) * 0.8;
  }
  return out;
}

function LeadMagnetCard({ onStart, onGuide }: { onStart: () => void; onGuide: () => void }) {
  const state = useApp((s) => s.state)!;
  const claimed = Boolean(state.tasks.quiz);

  if (claimed && state.quiz) {
    const p = PROFILES[state.quiz.profile];
    return (
      <div className="lm-result">
        <Img name={p.image} alt={p.word} />
        <div className="course-shade" />
        <div className="lm-result-top">
          <span className="chip chip-outline">Ваш ландшафт</span>
        </div>
        <div className="glass-word lm-result-word">{p.word}</div>
        <div className="lm-result-actions">
          <button className="btn btn-light btn-sm" onClick={onGuide}>
            Открыть гайд
          </button>
          <button className="btn btn-sm glass-dark" onClick={onStart}>
            Пройти заново
          </button>
        </div>
      </div>
    );
  }

  const resultReady = Boolean(state.quiz);
  return (
    <button
      className="lm-card"
      onClick={() => {
        haptic.impact('light');
        onStart();
      }}
    >
      <Img name="quiz-hills" alt="" eager />
      <div className="lm-shade" />
      <div className="lm-chips">
        <span className="chip chip-outline">Бесплатно</span>
        <span className="chip chip-outline">3 минуты</span>
      </div>
      <div className="lm-content">
        <div className="eyebrow lm-eyebrow">Глава I · Знакомство</div>
        <h2 className="display lm-title">
          Карта внутреннего <em>состояния</em>
        </h2>
        <p className="lm-text">
          {resultReady
            ? 'Ваш результат уже готов. Заберите гайд «7 техник самопомощи при тревоге».'
            : '10 вопросов о том, где вы сейчас. В подарок — гайд «7 техник самопомощи при тревоге».'}
        </p>
        <div className="lm-cta">
          <span className="btn btn-light">
            {resultReady ? 'Забрать гайд' : 'Пройти тест'} <ArrowRight size={18} />
          </span>
          <span className="lm-bonus glass-dark">
            +<Amount value={TASK_REWARDS.quiz} size={13} />
          </span>
        </div>
      </div>
    </button>
  );
}

function EnergyCard({ onOpen }: { onOpen: () => void }) {
  const { energy, cap } = useEnergy();
  return (
    <button className="today-card card" onClick={onOpen}>
      <div className="today-icon energy">
        <Zap size={18} />
      </div>
      <div className="today-label">Энергия</div>
      <div className="today-value num">
        {formatNum(energy)}
        <span className="subtle"> / {formatNum(cap)}</span>
      </div>
      <div className="bar today-bar">
        <i style={{ width: `${(energy / cap) * 100}%` }} />
      </div>
    </button>
  );
}
