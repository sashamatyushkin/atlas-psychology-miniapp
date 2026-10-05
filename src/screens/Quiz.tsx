import { ArrowLeft, Check, Clock, Download, FileText, ListOrdered, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api';
import { Img } from '../components/Img';
import { useMainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Amount } from '../components/Spark';
import { botStartLink, config, publicUrl } from '../config';
import { encodeBotEvent } from '../domain/botLinks';
import { findCourse, reviewsFor } from '../domain/catalog';
import { ReviewCard } from '../components/ReviewCard';
import { TASK_REWARDS } from '../domain/economy';
import { GUIDE } from '../domain/guide';
import { GOALS, PROFILES, QUIZ } from '../domain/quiz';
import type { GoalId, ProfileId } from '../domain/types';
import { isFormValid, validateLeadForm, type LeadFormErrors } from '../domain/validation';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { downloadFile, haptic, openTelegramLink, requestWriteAccess } from '../telegram/webapp';
import './quiz.css';

type Step = 'intro' | 'questions' | 'calculating' | 'result' | 'form' | 'done';

export function Quiz() {
  const state = useApp((s) => s.state)!;
  const [step, setStep] = useState<Step>(() => (state.quiz && !state.tasks.quiz ? 'result' : 'intro'));
  const [delivery, setDelivery] = useState<{ reward: number; sentToChat: boolean } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step]);

  return (
    <div className="screen quiz overlay-screen" ref={scroller}>
      {step === 'intro' && <Intro onStart={() => setStep('questions')} />}
      {step === 'questions' && <Questions onCalculating={() => setStep('calculating')} onDone={() => setStep('result')} onFail={() => setStep('intro')} />}
      {step === 'calculating' && <Calculating />}
      {step === 'result' && <Result onClaim={() => setStep('form')} onRetake={() => setStep('intro')} />}
      {step === 'form' && (
        <LeadFormStep
          onDone={(d) => {
            setDelivery(d);
            setStep('done');
          }}
        />
      )}
      {step === 'done' && delivery && <Done delivery={delivery} />}
    </div>
  );
}

// ── Интро ──────────────────────────────────────────────────────────────

function Intro({ onStart }: { onStart: () => void }) {
  useMainButton({ text: 'Начать тест', onClick: onStart, shine: true });
  return (
    <>
      <div className="quiz-hero">
        <Img name="quiz-hills" eager />
        <div className="quiz-hero-shade" />
      </div>
      <ScreenHeader onDark />
      <div className="quiz-intro rise">
        <div className="eyebrow">Глава I · Знакомство</div>
        <h1 className="display">
          Карта внутреннего <em>состояния</em>
        </h1>
        <p className="muted">
          Психологи школы собрали 10 вопросов, которые помогут понять, в каком «ландшафте» вы сейчас находитесь, — и что поможет
          именно вам.
        </p>
        <div className="quiz-features">
          <div>
            <ListOrdered size={18} />
            <span>10 вопросов</span>
          </div>
          <div>
            <Clock size={18} />
            <span>3 минуты</span>
          </div>
          <div>
            <FileText size={18} />
            <span>Гайд в подарок</span>
          </div>
        </div>
        <div className="quiz-gift card">
          <Img name="purple-lake" className="quiz-gift-img" />
          <div>
            <div className="quiz-gift-title">«{GUIDE.title}»</div>
            <div className="quiz-gift-sub">
              PDF-гайд + <Amount value={TASK_REWARDS.quiz} size={12} /> на баланс
            </div>
          </div>
        </div>
        <p className="quiz-disclaimer subtle">
          Тест предназначен для самопознания и не является медицинской диагностикой.
        </p>
      </div>
    </>
  );
}

// ── Вопросы ────────────────────────────────────────────────────────────

function Questions({ onCalculating, onDone, onFail }: { onCalculating: () => void; onDone: () => void; onFail: () => void }) {
  const submitQuiz = useApp((s) => s.submitQuiz);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const q = QUIZ[index]!;

  useMainButton(null);

  const choose = (i: number) => {
    if (picked !== null) return;
    haptic.select();
    setPicked(i);
    const next = [...answers.slice(0, index), i];
    setTimeout(async () => {
      setAnswers(next);
      setPicked(null);
      if (index < QUIZ.length - 1) {
        setIndex(index + 1);
        return;
      }
      onCalculating();
      try {
        // небольшая пауза — момент ожидания повышает ценность результата
        await Promise.all([submitQuiz(next), new Promise((r) => setTimeout(r, 1600))]);
        haptic.success();
        onDone();
      } catch (e) {
        toast(errorMessage(e), 'error');
        onFail();
      }
    }, 320);
  };

  return (
    <div className="questions">
      <ScreenHeader
        title={
          <span className="num">
            {index + 1} <span className="subtle">/ {QUIZ.length}</span>
          </span>
        }
      />
      <div className="q-progress" aria-hidden="true">
        {QUIZ.map((_, i) => (
          <i key={i} className={i < index ? 'done' : i === index ? 'current' : ''} />
        ))}
      </div>
      <div className="q-body" key={index}>
        <h2 className="display q-text">{q.text}</h2>
        <div className="q-options">
          {q.options.map((o, i) => (
            <button
              key={i}
              className={`q-option ${picked === i ? 'picked' : ''} ${answers[index] === i && picked === null ? 'prev' : ''}`}
              onClick={() => choose(i)}
              style={{ animationDelay: `${0.05 + i * 0.05}s` }}
            >
              <span className="q-letter">{'АБВГ'[i]}</span>
              <span>{o.text}</span>
              {picked === i && <Check size={18} className="q-check" />}
            </button>
          ))}
        </div>
        {index > 0 && (
          <button className="q-back" onClick={() => setIndex(index - 1)}>
            <ArrowLeft size={16} /> Предыдущий вопрос
          </button>
        )}
      </div>
    </div>
  );
}

function Calculating() {
  useMainButton(null);
  const lines = ['Сопоставляем ответы', 'Определяем ваш ландшафт', 'Подбираем техники'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, lines.length - 1)), 550);
    return () => clearInterval(id);
  }, [lines.length]);
  return (
    <div className="calculating">
      <div className="calc-orb" />
      <div className="display calc-title">Составляем вашу карту</div>
      <div className="calc-line muted" key={i}>
        {lines[i]}…
      </div>
    </div>
  );
}

// ── Результат ─────────────────────────────────────────────────────────

const ORDER: ProfileId[] = ['storm', 'desert', 'fog', 'harbor'];

function Result({ onClaim, onRetake }: { onClaim: () => void; onRetake: () => void }) {
  const state = useApp((s) => s.state)!;
  const { replace, openSheet } = useNav();
  const quiz = state.quiz!;
  const p = PROFILES[quiz.profile];
  const course = findCourse(p.courseId)!;
  const claimed = Boolean(state.tasks.quiz);

  useMainButton(
    claimed
      ? { text: 'Открыть гайд', onClick: () => replace({ name: 'guide' }) }
      : { text: `Забрать гайд и ${TASK_REWARDS.quiz.toLocaleString('ru-RU')} ✦`, onClick: onClaim, shine: true },
  );

  return (
    <div className="result">
      <div className="result-hero">
        <Img name={p.image} eager />
        <div className="result-hero-shade" />
        <ScreenHeader onDark />
        <div className="result-hero-text">
          <span className="chip chip-outline">Ваш ландшафт</span>
          <div className="glass-word result-word">{p.word}</div>
        </div>
      </div>
      <div className="result-body">
        <p className="result-summary display">{p.summary}</p>
        <p className="muted result-desc">{p.description}</p>

        <div className="scores card">
          {ORDER.map((id) => (
            <div key={id} className={`score ${id === quiz.profile ? 'top' : ''}`}>
              <span>{PROFILES[id].word}</span>
              <div className="bar">
                <i style={{ width: `${(quiz.scores[id] / QUIZ.length) * 100}%` }} />
              </div>
              <b className="num">{Math.round((quiz.scores[id] / QUIZ.length) * 100)}%</b>
            </div>
          ))}
        </div>

        <h3 className="result-h display">Что поможет сейчас</h3>
        <div className="helps">
          {p.helps.map((h, i) => (
            <div key={h.title} className="help">
              <span className="help-n display">{i + 1}</span>
              <div>
                <div className="help-title">{h.title}</div>
                <div className="help-text muted">{h.text}</div>
              </div>
            </div>
          ))}
        </div>

        {reviewsFor(course.id)[0] && (
          <>
            <h3 className="result-h display">Уже прошли этот путь</h3>
            <ReviewCard review={reviewsFor(course.id)[0]!} />
          </>
        )}

        <h3 className="result-h display">Программа для вас</h3>
        <button className="rec-course" onClick={() => openSheet({ name: 'course', id: course.id })}>
          <Img name={course.image} />
          <div className="rec-course-body">
            <span className="chip chip-outline">{course.duration}</span>
            <div className="rec-course-title display">{course.title}</div>
            <div className="rec-course-sub">{course.tagline}</div>
          </div>
        </button>

        {claimed && (
          <button className="btn btn-ghost btn-block retake" onClick={onRetake}>
            Пройти тест заново
          </button>
        )}
      </div>
    </div>
  );
}

// ── Форма лида ────────────────────────────────────────────────────────

function LeadFormStep({ onDone }: { onDone: (d: { reward: number; sentToChat: boolean }) => void }) {
  const user = useApp((s) => s.user)!;
  const state = useApp((s) => s.state)!;
  const backend = useApp((s) => s.backend);
  const claim = useApp((s) => s.claimLeadMagnet);
  const openSheet = useNav((s) => s.openSheet);
  const [name, setName] = useState(state.lead?.name ?? user.firstName);
  const [goal, setGoal] = useState<GoalId | null>(state.lead?.goal ?? suggestGoal(state.quiz?.profile));
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<LeadFormErrors>({});
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const form = { name, goal, consent };
    const e = validateLeadForm(form);
    setErrors(e);
    setTouched(true);
    if (!isFormValid(e)) {
      haptic.error();
      return;
    }
    setLoading(true);
    try {
      // разрешение нужно, чтобы бот мог прислать PDF в личные сообщения
      const writeAccess = backend ? await requestWriteAccess() : false;
      const res = await claim(form, writeAccess);
      haptic.success();
      onDone(res);
    } catch (err) {
      haptic.error();
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useMainButton({ text: 'Получить гайд', onClick: submit, loading, shine: true });

  useEffect(() => {
    if (touched) setErrors(validateLeadForm({ name, goal, consent }));
  }, [name, goal, consent, touched]);

  return (
    <div className="lead-form">
      <ScreenHeader />
      <div className="lead-form-body rise">
        <div className="eyebrow">Последний шаг</div>
        <h1 className="display">Куда отправить гайд?</h1>
        <p className="muted">
          {backend || config.botUsername
            ? 'Бот пришлёт PDF прямо в чат, а куратор поможет подобрать программу, если захотите.'
            : 'Гайд откроется в приложении и будет доступен для скачивания.'}
        </p>

        <form
          className="lead-fields"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <label className={`field ${errors.name ? 'invalid' : ''}`}>
            <span className="field-label">Как к вам обращаться</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoComplete="given-name"
              enterKeyHint="done"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>

          <div className={`field ${errors.goal ? 'invalid' : ''}`}>
            <span className="field-label">Что для вас сейчас важнее</span>
            <div className="choice-grid" role="radiogroup">
              {GOALS.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  role="radio"
                  aria-checked={goal === g.id}
                  className={`choice ${goal === g.id ? 'selected' : ''}`}
                  onClick={() => {
                    haptic.select();
                    setGoal(g.id);
                  }}
                >
                  {g.title}
                </button>
              ))}
            </div>
            {errors.goal && <span className="field-error">{errors.goal}</span>}
          </div>

          <div className="field">
            <button
              type="button"
              className={`check ${consent ? 'checked' : ''}`}
              onClick={() => setConsent(!consent)}
              role="checkbox"
              aria-checked={consent}
            >
              <span className="check-box">{consent && <Check size={15} strokeWidth={3} />}</span>
              <span>
                Согласен(на) на обработку персональных данных и получение материалов от школы.{' '}
                <span
                  className="link-inline"
                  role="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSheet({ name: 'policy' });
                  }}
                >
                  Политика
                </span>
              </span>
            </button>
            {errors.consent && <span className="field-error">{errors.consent}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

function suggestGoal(profile?: ProfileId): GoalId | null {
  switch (profile) {
    case 'storm':
      return 'anxiety';
    case 'desert':
      return 'burnout';
    case 'fog':
      return 'self';
    case 'harbor':
      return 'relations';
    default:
      return null;
  }
}

// ── Готово ─────────────────────────────────────────────────────────────

function Done({ delivery }: { delivery: { reward: number; sentToChat: boolean } }) {
  const replace = useNav((s) => s.replace);
  const state = useApp((s) => s.state)!;
  // без публичного сервера гайд в чат доставляет бот по диплинку
  const chatLink =
    !delivery.sentToChat && state.quiz && state.lead
      ? botStartLink(encodeBotEvent({ type: 'guide', profile: state.quiz.profile, goal: state.lead.goal, name: state.lead.name }))
      : null;
  useMainButton({ text: 'Читать гайд', onClick: () => replace({ name: 'guide' }) });

  return (
    <div className="done">
      <ScreenHeader />
      <div className="done-body">
        <div className="done-badge">
          <Check size={40} strokeWidth={2.5} />
        </div>
        <h1 className="display">Гайд ваш</h1>
        <p className="muted">
          {delivery.sentToChat
            ? 'Мы отправили PDF в чат с ботом — он всегда будет под рукой.'
            : chatLink
              ? 'Читайте прямо в приложении или получите PDF в чат с ботом — он всегда будет под рукой.'
              : 'Читайте прямо в приложении или сохраните PDF на устройство.'}
        </p>
        {delivery.reward > 0 && (
          <div className="done-reward rise">
            <div className="done-reward-value">
              +<Amount value={delivery.reward} size={22} />
            </div>
            <span>начислено на баланс</span>
          </div>
        )}
        <div className="done-actions">
          {chatLink && (
            <button className="btn btn-ghost" onClick={() => openTelegramLink(chatLink)}>
              <Send size={18} /> Получить PDF в чат
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => downloadFile(publicUrl(GUIDE.pdfPath), 'Атлас — 7 техник самопомощи при тревоге.pdf')}
          >
            <Download size={18} /> Скачать PDF
          </button>
          {delivery.sentToChat && config.botUsername && (
            <button className="btn btn-ghost" onClick={() => openTelegramLink(`https://t.me/${config.botUsername}`)}>
              <Send size={18} /> Открыть чат
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
