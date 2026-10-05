import { CalendarDays, Check, MonitorPlay, Tag } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api';
import { Img } from '../components/Img';
import { wordSize } from '../screens/Home';
import { useMainButton } from '../components/MainButton';
import { StateView } from '../components/StateView';
import { PRODUCTS, findCourse } from '../domain/catalog';
import { PROFILES } from '../domain/quiz';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { haptic } from '../telegram/webapp';

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
  const openSheet = useNav((s) => s.openSheet);
  const [loading, setLoading] = useState(false);
  const applied = state.applications.some((a) => a.courseId === id);
  const promo = PRODUCTS.find((p) => p.kind === 'promo' && p.id.includes(id));
  const forYou = state.quiz && c?.forProfiles.includes(state.quiz.profile);

  const onApply = async () => {
    setLoading(true);
    try {
      await apply(id);
      haptic.success();
      toast(backend ? 'Заявка отправлена — куратор напишет вам в Telegram' : 'Заявка сохранена', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  useMainButton(
    !c ? null : applied ? { text: 'Заявка отправлена ✓', onClick: () => {}, disabled: true, priority: 10 } : { text: 'Оставить заявку', onClick: onApply, loading, priority: 10, shine: true },
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
          <b className="num">{rub.format(c.priceRub)}</b>
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
    </>
  );
}
