import {
  BookOpen,
  ChevronRight,
  FileText,
  GraduationCap,
  LifeBuoy,
  ListChecks,
  RotateCcw,
  ShoppingBag,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { Img } from '../components/Img';
import { PurchaseRow } from '../components/PurchaseRow';
import { Timeline } from '../components/Timeline';
import { Amount, formatCompact } from '../components/Spark';
import { StateView } from '../components/StateView';
import { config } from '../config';
import { findCourse } from '../domain/catalog';
import { LEVELS, levelFor } from '../domain/economy';
import { PROFILES } from '../domain/quiz';
import { api } from '../api';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { confirmDialog, haptic, isTelegram, openTelegramLink } from '../telegram/webapp';
import './profile.css';

export function Profile() {
  const user = useApp((s) => s.user)!;
  const state = useApp((s) => s.state)!;
  const backend = useApp((s) => s.backend);
  const haptics = useApp((s) => s.haptics);
  const setHaptics = useApp((s) => s.setHaptics);
  const resetDemo = useApp((s) => s.resetDemo);
  const setOnboarded = useApp((s) => s.setOnboarded);
  const { push, openSheet } = useNav();
  const { level, next, progress } = levelFor(state.totalEarned);
  const profile = state.quiz ? PROFILES[state.quiz.profile] : null;
  const initials = (user.firstName[0] ?? '') + (user.lastName?.[0] ?? '');

  const onReset = async () => {
    if (!(await confirmDialog('Сбросить демо-прогресс? Баланс, покупки и результаты теста будут удалены.'))) return;
    await resetDemo();
    haptic.warning();
    toast('Прогресс сброшен');
  };

  return (
    <div className="screen profile">
      <div className="profile-hero">
        <Img name="wanderer" eager />
        <div className="profile-hero-shade" />
      </div>

      <section className="profile-id rise">
        <div className="avatar">
          {user.photoUrl ? <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </div>
        <h1 className="display">
          {user.firstName} {user.lastName ?? ''}
        </h1>
        <div className="profile-handle">
          {user.username ? `@${user.username}` : `ID ${user.id}`}
          {user.isPremium && <span className="chip chip-accent premium">Premium</span>}
        </div>
      </section>

      <section className="section rise rise-1">
        <div className="card level-card">
          <div className="level-card-top">
            <div>
              <div className="eyebrow">Уровень {level.index + 1}</div>
              <div className="display level-card-title">{level.title}</div>
            </div>
            <div className="level-steps">
              {LEVELS.map((l) => (
                <i key={l.index} className={l.index <= level.index ? 'on' : ''} />
              ))}
            </div>
          </div>
          <div className="bar">
            <i style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </div>
          <div className="level-card-foot">
            {next ? (
              <>
                <span>
                  До «{next.title}»: <Amount value={next.min - state.totalEarned} size={12} />
                </span>
                <button className="link-btn" onClick={() => push({ name: 'map' })}>
                  Карта пути
                </button>
              </>
            ) : (
              <span>Вы достигли вершины Атласа</span>
            )}
          </div>
        </div>

        <div className="stats">
          <Stat value={formatCompact(state.totalEarned)} label="искр всего" />
          <Stat value={formatCompact(state.totalTaps)} label="касаний" />
          <Stat value={state.practicesDone} label="практик" />
          <Stat value={state.purchases.length} label="покупок" />
        </div>
      </section>

      <section className="section rise rise-2">
        <div className="section-head">
          <h2>Ваш путь</h2>
          <button className="link" onClick={() => push({ name: 'map' })}>
            Карта пути
          </button>
        </div>
        <Timeline state={state} />
      </section>

      <section className="section rise rise-2">
        {profile ? (
          <button className="landscape" onClick={() => push({ name: 'guide' })}>
            <Img name={profile.image} />
            <div className="landscape-body">
              <span className="eyebrow">Ваш ландшафт</span>
              <span className="display landscape-word">{profile.word}</span>
              <span className="landscape-sub">{profile.summary}</span>
            </div>
            <ChevronRight className="landscape-chevron" size={20} />
          </button>
        ) : (
          <button className="landscape empty" onClick={() => push({ name: 'quiz' })}>
            <div className="row-icon">
              <Sparkles size={20} />
            </div>
            <div className="landscape-body">
              <span className="row-title">Узнайте свой ландшафт</span>
              <span className="row-sub">Тест «Карта внутреннего состояния» · 3 минуты</span>
            </div>
            <ChevronRight size={20} className="subtle" />
          </button>
        )}
      </section>

      <section className="section rise rise-3">
        <div className="section-head">
          <h2>Мои покупки</h2>
          {state.purchases.length > 3 && (
            <button className="link" onClick={() => push({ name: 'purchases' })}>
              Все {state.purchases.length}
            </button>
          )}
        </div>
        <div className="card purchases-card">
          {state.purchases.length === 0 ? (
            <StateView
              compact
              icon={<ShoppingBag size={22} />}
              title="Пока пусто"
              text="Обменяйте искры на практики, курсы и скидки в Лавке."
              action={{ label: 'Открыть Лавку', onClick: () => useNav.getState().setTab('shop') }}
            />
          ) : (
            state.purchases.slice(0, 3).map((p) => <PurchaseRow key={p.id} purchase={p} />)
          )}
        </div>
      </section>

      {state.applications.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Заявки</h2>
          </div>
          <div className="card list">
            {state.applications.map((a) => (
              <button key={a.courseId} className="row" onClick={() => openSheet({ name: 'course', id: a.courseId })}>
                <div className="row-icon">
                  <BookOpen size={18} />
                </div>
                <div className="row-main">
                  <div className="row-title">{findCourse(a.courseId)?.title}</div>
                  <div className="row-sub">Куратор свяжется с вами в Telegram</div>
                </div>
                <span className="chip chip-teal">Отправлена</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Настройки</h2>
        </div>
        <div className="card list">
          <button className="row" onClick={() => setHaptics(!haptics)} role="switch" aria-checked={haptics}>
            <div className="row-icon">
              <Smartphone size={18} />
            </div>
            <div className="row-main">
              <div className="row-title">Вибро-отклик</div>
              <div className="row-sub">Тактильная отдача при касаниях</div>
            </div>
            <span className={`switch ${haptics ? 'on' : ''}`} />
          </button>
          <button className="row" onClick={() => openSheet({ name: 'tasks' })}>
            <div className="row-icon">
              <ListChecks size={18} />
            </div>
            <div className="row-main">
              <div className="row-title">Задания</div>
              <div className="row-sub">Дополнительные искры</div>
            </div>
            <ChevronRight size={18} className="subtle" />
          </button>
          {config.curatorUsername && (
            <button className="row" onClick={() => openTelegramLink(`https://t.me/${config.curatorUsername}`)}>
              <div className="row-icon">
                <LifeBuoy size={18} />
              </div>
              <div className="row-main">
                <div className="row-title">Поддержка</div>
                <div className="row-sub">Написать куратору школы</div>
              </div>
              <ChevronRight size={18} className="subtle" />
            </button>
          )}
          <button className="row" onClick={() => setOnboarded(false)}>
            <div className="row-icon">
              <GraduationCap size={18} />
            </div>
            <div className="row-main">
              <div className="row-title">Пройти обучение заново</div>
              <div className="row-sub">Короткий тур по приложению</div>
            </div>
            <ChevronRight size={18} className="subtle" />
          </button>
          <button className="row" onClick={() => openSheet({ name: 'policy' })}>
            <div className="row-icon">
              <FileText size={18} />
            </div>
            <div className="row-main">
              <div className="row-title">Конфиденциальность</div>
              <div className="row-sub">Как мы обрабатываем данные</div>
            </div>
            <ChevronRight size={18} className="subtle" />
          </button>
          {api.canResetDemo && (
            <button className="row" onClick={onReset}>
              <div className="row-icon danger">
                <RotateCcw size={18} />
              </div>
              <div className="row-main">
                <div className="row-title">Сбросить демо-прогресс</div>
                <div className="row-sub">Начать путь с нуля</div>
              </div>
            </button>
          )}
        </div>
        <p className="version subtle">
          Атлас {config.version} · {backend ? 'сервер подключён' : api.offline ? 'сервер недоступен, автономный режим' : 'автономный режим'}
          {!isTelegram && ' · браузер'}
        </p>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="stat card">
      <b className="num">{value}</b>
      <span>{label}</span>
    </div>
  );
}
