import { Check, Copy, Lock, Play, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api';
import { Img } from '../components/Img';
import { useMainButton } from '../components/MainButton';
import { fulfillmentHint } from '../components/PurchaseRow';
import { Amount, formatNum } from '../components/Spark';
import { StateView } from '../components/StateView';
import { findProduct } from '../domain/catalog';
import { isOwned } from '../domain/engine';
import { LEVELS, levelFor } from '../domain/economy';
import type { Product, Purchase } from '../domain/types';
import { useApp, useDisplayBalance } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { confirmDialog, copyText, haptic } from '../telegram/webapp';

const KIND_LABEL: Record<Product['kind'], string> = {
  practice: 'Практика в приложении',
  access: 'Код доступа',
  promo: 'Промокод',
  booking: 'Живая встреча',
  merch: 'Физический товар',
};

const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

export function ProductSheetContent({ id }: { id: string }) {
  const product = findProduct(id);
  if (!product) return <StateView title="Товар не найден" text="Возможно, он закончился. Загляните в Лавку позже." />;
  return <ProductView product={product} />;
}

function ProductView({ product: p }: { product: Product }) {
  const state = useApp((s) => s.state)!;
  const buy = useApp((s) => s.purchase);
  const balance = useDisplayBalance();
  const { push, setTab } = useNav();
  const [loading, setLoading] = useState(false);
  const [bought, setBought] = useState<Purchase | null>(null);

  const levelIdx = levelFor(state.totalEarned).level.index;
  const locked = levelIdx < p.minLevel;
  const singleOwned = isOwned(state, p.id) && (p.kind === 'practice' || p.kind === 'access' || p.kind === 'promo');
  const existing = singleOwned ? state.purchases.find((x) => x.productId === p.id) ?? null : null;
  const shown = bought ?? existing;
  const missing = p.price - balance;

  const onBuy = async () => {
    const ok = await confirmDialog(`Обменять ${formatNum(p.price)} ✦ на «${p.title}»?`);
    if (!ok) return;
    setLoading(true);
    try {
      const purchase = await buy(p.id);
      haptic.success();
      setBought(purchase);
    } catch (e) {
      haptic.error();
      toast(errorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  useMainButton(
    shown
      ? p.kind === 'practice'
        ? { text: 'Начать практику', onClick: () => push({ name: 'practice', id: p.practiceId! }), priority: 10 }
        : null
      : locked
        ? { text: `Откроется на уровне «${LEVELS[p.minLevel]!.title}»`, onClick: () => {}, disabled: true, priority: 10 }
        : missing > 0
          ? { text: `Не хватает ${formatNum(missing)} ✦ · к практике`, onClick: () => setTab('practice'), priority: 10 }
          : { text: `Обменять за ${formatNum(p.price)} ✦`, onClick: onBuy, loading, shine: true, priority: 10 },
  );

  return (
    <>
      <div className="ps-chips">
        <span className="chip chip-accent">{KIND_LABEL[p.kind]}</span>
        {p.minLevel > 0 && (
          <span className={`chip ${locked ? 'chip-soft' : 'chip-teal'}`}>
            {locked ? <Lock size={12} /> : <Check size={12} />} {LEVELS[p.minLevel]!.title}
          </span>
        )}
      </div>
      <h2 className="sheet-title">{p.title}</h2>
      <p className="ps-sub muted">{p.subtitle}</p>

      {shown ? (
        <Delivered product={p} purchase={shown} fresh={Boolean(bought)} />
      ) : (
        <div className="ps-price card">
          <div>
            <div className="ps-price-label">Стоимость</div>
            <Amount value={p.price} size={18} className="ps-price-value" />
          </div>
          {p.valueRub && (
            <div className="ps-value">
              <div className="ps-price-label">Ценность</div>
              <b>≈ {rub.format(p.valueRub)}</b>
            </div>
          )}
          <div className="ps-balance">
            <div className="ps-price-label">Ваш баланс</div>
            <Amount value={balance} size={13} />
          </div>
        </div>
      )}

      <p className="ps-desc">{p.description}</p>
      <ul className="ps-includes">
        {p.includes.map((i) => (
          <li key={i}>
            <Check size={16} />
            {i}
          </li>
        ))}
      </ul>
    </>
  );
}

function Delivered({ product: p, purchase, fresh }: { product: Product; purchase: Purchase; fresh: boolean }) {
  const push = useNav((s) => s.push);
  const copy = async () => {
    if (await copyText(purchase.code)) {
      haptic.success();
      toast('Скопировано', 'success');
    }
  };
  return (
    <div className={`delivered ${fresh ? 'fresh' : ''}`}>
      <div className="delivered-head">
        <Sparkles size={18} />
        {fresh ? 'Готово! Обмен прошёл успешно' : 'Уже у вас'}
      </div>
      {p.kind === 'practice' ? (
        <button className="btn btn-light btn-block" onClick={() => push({ name: 'practice', id: p.practiceId! })}>
          <Play size={16} fill="currentColor" /> Начать практику
        </button>
      ) : (
        <button className="code-box" onClick={copy}>
          <span className="num">{purchase.code}</span>
          <Copy size={16} />
        </button>
      )}
      <p className="delivered-hint">{fulfillmentHint(p.kind)}</p>
    </div>
  );
}

export function ProductCover({ id }: { id: string }) {
  const p = findProduct(id);
  if (!p) return null;
  return (
    <div className="sheet-cover">
      <Img name={p.image} eager />
    </div>
  );
}
