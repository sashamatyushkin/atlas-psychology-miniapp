import { CalendarDays, Check, MessageCircle, MonitorPlay, Tag } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api';
import { Img } from '../components/Img';
import { wordSize } from '../screens/Home';
import { useMainButton } from '../components/MainButton';
import { StateView } from '../components/StateView';
import { PRODUCTS, findCourse, reviewsFor } from '../domain/catalog';
import { coursePrice } from '../domain/engine';
import { ReviewCard } from '../components/ReviewCard';
import { PROFILES } from '../domain/quiz';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { haptic, openTelegramLink } from '../telegram/webapp';
import { botStartLink } from '../config';
import { encodeBotEvent } from '../domain/botLinks';

const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

export function CourseCover({ id }: { id: string }) {
  const c = findCourse(id);
  if (!c) return null;
  return (
    <div className="sheet-cover course-cover">
      <Img name={c.image} eager />
      <div className="glass-word course-cover-word" style={{ fontSize: wordSize(c.word, 104) }}>
        {c.word}
      </div>
    </div>
  );
}

export function CourseSheetContent({ id }: { id: string }) {
  const c = findCourse(id);
  const state = useApp((s) => s.state)!;
  const backend = useApp((s) => s.backend);
  const apply = useApp((s) => s.applyCourse);
  const { openSheet, push } = useNav();
  const [loading, setLoading] = useState(false);
  const applied = state.applications.some((a) => a.courseId === id);
  const promo = PRODUCTS.find((p) => p.kind === 'promo' && p.courseId === id);
  const enrolled = state.enrollments.some((e) => e.courseId === id);
  const price = c ? coursePrice(state, id) : null;
  const reviews = reviewsFor(id);
  const forYou = state.quiz && c?.forProfiles.includes(state.quiz.profile);

  const onApply = async () => {
    setLoading(true);
    try {
      await apply(id);
      haptic.success();
      const link = backend ? null : botStartLink(encodeBotEvent({ type: 'apply', courseId: id }));
      if (link) openTelegramLink(link);
      else toast(backend ? 'Заявка отправлена — куратор напишет вам в Telegram' : 'Заявка сохранена', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  useMainButton(
    !c || !price
      ? null
      : enrolled
        ? { text: 'Вы записаны ✓ · чек', onClick: () => push({ name: 'checkout', courseId: id }), priority: 10 }
        : {
            text: `Записаться · ${rub.format(price.total)}`,
            onClick: () => push({ name: 'checkout', courseId: id }),
            priority: 10,
            shine: true,
          },
  );

  if (!c) return <StateView title="Программа не найдена" />;

  return (
    <>
      {forYou && state.quiz && <span className="chip chip-accent">Подходит для ландшафта «{PROFILES[state.quiz.profile].word}»</span>}
      <h2 className="sheet-title cs-title">{c.title}</h2>
      <p className="muted cs-tagline">{c.tagline}</p>

      <div className="cs-meta">
        <div>
          <CalendarDays size={18} />
          <span>{c.duration}</span>
        </div>
        <div>
          <MonitorPlay size={18} />
          <span>{c.format}</span>
        </div>
      </div>

      <div className="cs-price card">
        <div>
          <div className="ps-price-label">Стоимость</div>
          {price && price.discountPct > 0 ? (
            <b className="num">
              {rub.format(price.total)} <s className="subtle">{rub.format(price.base)}</s>
            </b>
          ) : (
            <b className="num">{rub.format(c.priceRub)}</b>
          )}
        </div>
        <div>
          <div className="ps-price-label">В рассрочку</div>
          <b className="num">от {rub.format(Math.ceil(c.priceRub / 12))}/мес</b>
        </div>
      </div>

      {promo && (
        <button className="cs-promo" onClick={() => openSheet({ name: 'product', id: promo.id })}>
          <Tag size={18} />
          <span>
            Скидка за искры: <b>{promo.title}</b>
          </span>
        </button>
      )}

      <p className="ps-desc">{c.description}</p>

      <h3 className="cs-h display">Программа</h3>
      <ol className="cs-modules">
        {c.modules.map((m, i) => (
          <li key={m}>
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            {m}
          </li>
        ))}
      </ol>

      <h3 className="cs-h display">Результат</h3>
      <ul className="ps-includes">
        {c.outcomes.map((o) => (
          <li key={o}>
            <Check size={16} />
            {o}
          </li>
        ))}
      </ul>

      {reviews.length > 0 && (
        <>
          <h3 className="cs-h display">Отзывы выпускников</h3>
          <div className="reviews">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} showCourse={false} />
            ))}
          </div>
        </>
      )}

      {!enrolled && (
        <button className="btn btn-ghost btn-block cs-ask" disabled={applied || loading} onClick={onApply}>
          <MessageCircle size={17} /> {applied ? 'Вопрос отправлен куратору' : 'Задать вопрос куратору'}
        </button>
      )}
    </>
  );
}
