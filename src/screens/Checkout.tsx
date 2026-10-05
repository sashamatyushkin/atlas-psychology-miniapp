import { Check, CreditCard, FlaskConical, QrCode, ShieldCheck, Tag, Wallet } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api';
import { Img } from '../components/Img';
import { useMainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StateView } from '../components/StateView';
import { findCourse } from '../domain/catalog';
import { coursePrice } from '../domain/engine';
import type { Enrollment, PaymentMethod } from '../domain/types';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { haptic } from '../telegram/webapp';
import './checkout.css';

const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

const METHODS: { id: PaymentMethod; title: string; sub: (total: number) => string; Icon: typeof CreditCard }[] = [
  { id: 'card', title: 'Банковская карта', sub: () => 'Тестовая карта •••• 4242', Icon: CreditCard },
  { id: 'sbp', title: 'СБП', sub: () => 'Оплата по QR в приложении банка', Icon: QrCode },
  { id: 'installments', title: 'Рассрочка 0%', sub: (t) => `12 платежей по ${rub.format(Math.ceil(t / 12))}`, Icon: Wallet },
];

const STAGES = ['Связываемся с банком', 'Подтверждаем платёж', 'Оформляем доступ'];

/**
 * Оформление записи на программу. ТЕСТОВЫЙ РЕЖИМ: данные карты не вводятся и
 * деньги не списываются. Для боевой оплаты см. комментарий в server/app.ts (/api/enroll).
 */
export function Checkout({ courseId }: { courseId: string }) {
  const course = findCourse(courseId);
  const state = useApp((s) => s.state)!;
  const enroll = useApp((s) => s.enrollCourse);
  const pop = useNav((s) => s.pop);
  const existing = state.enrollments.find((e) => e.courseId === courseId) ?? null;
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [phase, setPhase] = useState<'form' | 'processing' | 'success'>(existing ? 'success' : 'form');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<Enrollment | null>(existing);
  const price = course ? coursePrice(state, courseId) : null;

  const pay = async () => {
    setPhase('processing');
    setStage(0);
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 700);
    try {
      const [e] = await Promise.all([enroll(courseId, method), new Promise((r) => setTimeout(r, 2200))]);
      haptic.success();
      setResult(e);
      setPhase('success');
    } catch (err) {
      haptic.error();
      toast(errorMessage(err), 'error');
      setPhase('form');
    } finally {
      clearInterval(timer);
    }
  };

  useMainButton(
    !course || !price
      ? null
      : phase === 'form'
        ? { text: `Оплатить ${rub.format(price.total)}`, onClick: pay, shine: true }
        : phase === 'success'
          ? { text: 'Готово', onClick: pop }
          : null,
  );

  if (!course || !price) {
    return (
      <div className="screen overlay-screen">
        <ScreenHeader />
        <StateView title="Программа не найдена" />
      </div>
    );
  }

  if (phase === 'processing') {
    return (
      <div className="screen overlay-screen checkout">
        <div className="pay-processing">
          <div className="pay-spinner" />
          <div className="display">{rub.format(price.total)}</div>
          <p className="muted" key={stage}>
            {STAGES[stage]}…
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'success' && result) {
    return (
      <div className="screen overlay-screen checkout">
        <ScreenHeader />
        <div className="pay-success">
          <div className="done-badge">
            <Check size={40} strokeWidth={2.5} />
          </div>
          <h1 className="display">Оплата прошла</h1>
          <p className="muted">Вы записаны на программу «{course.title}». Куратор добавит вас в чат потока и пришлёт расписание.</p>
          <div className="receipt card">
            <Row label="Программа" value={course.title} />
            <Row label="Сумма" value={rub.format(result.amountRub)} />
            {result.discountPct > 0 && <Row label="Скидка" value={`−${result.discountPct}% по промокоду`} />}
            <Row label="Способ" value={METHODS.find((m) => m.id === result.method)!.title} />
            <Row label="Чек" value={result.receipt} mono />
          </div>
          <div className="test-badge">
            <FlaskConical size={14} /> Тестовый платёж — деньги не списаны
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen overlay-screen checkout">
      <ScreenHeader
        title="Оформление"
        right={
          <span className="chip chip-teal test-chip">
            <FlaskConical size={12} /> Тест
          </span>
        }
      />
      <div className="checkout-body">
        <div className="order card">
          <Img name={course.image} className="order-img" />
          <div>
            <div className="order-title display">{course.title}</div>
            <div className="order-sub">
              {course.duration} · {course.format}
            </div>
          </div>
        </div>

        <h3 className="checkout-h">Способ оплаты</h3>
        <div className="methods" role="radiogroup">
          {METHODS.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={method === m.id}
              className={`method card ${method === m.id ? 'selected' : ''}`}
              onClick={() => {
                haptic.select();
                setMethod(m.id);
              }}
            >
              <span className="row-icon">
                <m.Icon size={19} />
              </span>
              <span className="method-main">
                <b>{m.title}</b>
                <span>{m.sub(price.total)}</span>
              </span>
              <span className="radio" />
            </button>
          ))}
        </div>

        <div className="summary card">
          <Row label="Стоимость" value={rub.format(price.base)} />
          {price.discountPct > 0 ? (
            <div className="summary-promo">
              <Tag size={15} />
              <span>
                Промокод <b className="num">{price.promoCode}</b>
              </span>
              <b>−{price.discountPct}%</b>
            </div>
          ) : (
            <p className="summary-hint">Промокоды на скидку можно получить за искры в Лавке.</p>
          )}
          <div className="summary-total">
            <span>Итого</span>
            <b className="num">{rub.format(price.total)}</b>
          </div>
        </div>

        <p className="checkout-legal subtle">
          <ShieldCheck size={14} /> Тестовый режим: данные карты не запрашиваются и деньги не списываются. В боевой версии оплата
          проходит через защищённую форму банка.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <b className={mono ? 'num' : ''}>{value}</b>
    </div>
  );
}
