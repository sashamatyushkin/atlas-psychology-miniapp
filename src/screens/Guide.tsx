import { AlertTriangle, Download, Lightbulb, Lock, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { Img } from '../components/Img';
import { ScreenHeader } from '../components/ScreenHeader';
import { StateView } from '../components/StateView';
import { useMainButton } from '../components/MainButton';
import { publicUrl } from '../config';
import { GUIDE } from '../domain/guide';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import { downloadFile, haptic } from '../telegram/webapp';
import './guide.css';

const PDF_NAME = 'Атлас — 7 техник самопомощи при тревоге.pdf';

export function Guide() {
  const unlocked = useApp((s) => Boolean(s.state?.tasks.quiz));
  const { push, replace, openSheet } = useNav();
  const scroller = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useMainButton(unlocked ? null : { text: 'Пройти тест', onClick: () => replace({ name: 'quiz' }) });

  const download = () => {
    haptic.impact('light');
    void downloadFile(publicUrl(GUIDE.pdfPath), PDF_NAME);
  };

  if (!unlocked) {
    return (
      <div className="screen overlay-screen">
        <ScreenHeader />
        <StateView
          icon={<Lock size={22} />}
          title="Гайд ждёт вас"
          text="Пройдите тест «Карта внутреннего состояния» — гайд откроется сразу после него."
        />
      </div>
    );
  }

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setProgress(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight));
  };

  const goTo = (n: number) => {
    const el = scroller.current?.querySelector(`#tech-${n}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="screen overlay-screen guide" ref={scroller} onScroll={onScroll}>
      <div className="read-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="guide-cover">
        <Img name="hero-clouds" eager />
        <div className="guide-cover-shade" />
        <ScreenHeader
          onDark
          right={
            <button className="icon-btn glass-dark" onClick={download} aria-label="Скачать PDF">
              <Download size={18} />
            </button>
          }
        />
        <div className="guide-cover-text">
          <div className="eyebrow">{GUIDE.subtitle}</div>
          <h1 className="display">{GUIDE.title}</h1>
          <div className="guide-meta">7 техник · ≈ 15 минут чтения</div>
        </div>
      </div>

      <article className="guide-body">
        {GUIDE.intro.map((p, i) => (
          <p key={i} className={i === 0 ? 'lead' : ''}>
            {p}
          </p>
        ))}

        <nav className="toc" aria-label="Содержание">
          {GUIDE.techniques.map((t) => (
            <button key={t.n} className="toc-item" onClick={() => goTo(t.n)}>
              <span className="toc-n display">{String(t.n).padStart(2, '0')}</span>
              <span className="toc-title">{t.title}</span>
              <span className="toc-min subtle">{t.minutes}</span>
            </button>
          ))}
        </nav>

        {GUIDE.techniques.map((t) => (
          <section key={t.n} id={`tech-${t.n}`} className="tech">
            <div className="tech-media">
              <Img name={t.image} />
              <div className="glass-word tech-num">{String(t.n).padStart(2, '0')}</div>
            </div>
            <div className="tech-head">
              <span className="chip chip-accent">{t.approach}</span>
              <span className="chip chip-soft">{t.minutes}</span>
            </div>
            <h2 className="display tech-title">{t.title}</h2>
            <div className="tech-block">
              <div className="tech-label">Когда использовать</div>
              <p>{t.when}</p>
            </div>
            <div className="tech-block">
              <div className="tech-label">Почему это работает</div>
              <p>{t.why}</p>
            </div>
            <ol className="tech-steps">
              {t.steps.map((s, i) => (
                <li key={i}>
                  <span className="num">{i + 1}</span>
                  <p>{s}</p>
                </li>
              ))}
            </ol>
            {t.tip && (
              <div className="tech-tip">
                <Lightbulb size={18} />
                <p>{t.tip}</p>
              </div>
            )}
            {t.practiceId && (
              <button className="btn btn-primary btn-block" onClick={() => push({ name: 'practice', id: t.practiceId! })}>
                <Play size={16} fill="currentColor" /> Попробовать сейчас
              </button>
            )}
          </section>
        ))}

        <section className="help-box">
          <div className="help-box-head">
            <AlertTriangle size={20} />
            <h3 className="display">Когда стоит обратиться к специалисту</h3>
          </div>
          <ul>
            {GUIDE.whenToSeekHelp.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="crisis">{GUIDE.crisisNote}</p>
        </section>

        <p className="guide-outro">{GUIDE.outro}</p>
        <div className="guide-actions">
          <button className="btn btn-primary btn-block" onClick={() => openSheet({ name: 'course', id: 'anxiety' })}>
            О программе «Тревога под контролем»
          </button>
          <button className="btn btn-ghost btn-block" onClick={download}>
            <Download size={18} /> Сохранить PDF
          </button>
        </div>
        <p className="guide-sign subtle">{GUIDE.author}</p>
      </article>
    </div>
  );
}
