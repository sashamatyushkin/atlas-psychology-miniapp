import { Check, Lock, PackageOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BalanceChip } from '../components/BalanceChip';
import { Img } from '../components/Img';
import { Amount } from '../components/Spark';
import { StateView } from '../components/StateView';
import { PRODUCTS, PRODUCT_CATEGORIES } from '../domain/catalog';
import { isOwned } from '../domain/engine';
import { LEVELS, levelFor } from '../domain/economy';
import type { Product } from '../domain/types';
import { useApp, useDisplayBalance } from '../store/app';
import { useNav } from '../store/nav';
import { haptic } from '../telegram/webapp';
import './shop.css';

type Cat = (typeof PRODUCT_CATEGORIES)[number]['id'];

export function Shop() {
  const [cat, setCat] = useState<Cat>('all');
  const openSheet = useNav((s) => s.openSheet);
  const items = useMemo(() => (cat === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat)), [cat]);
  const featured = PRODUCTS.find((p) => p.id === 'promo-profession-30')!;

  return (
    <div className="screen shop">
      <header className="shop-head">
        <div>
          <div className="eyebrow">Обмен искр</div>
          <h1 className="display">Лавка</h1>
        </div>
        <BalanceChip />
      </header>

      <button className="featured rise" onClick={() => openSheet({ name: 'product', id: featured.id })}>
        <Img name={featured.image} alt="" eager />
        <div className="featured-shade" />
        <div className="featured-top">
          <span className="chip chip-outline">Главная награда</span>
          <span className="chip glass-dark featured-price">
            <Amount value={featured.price} size={13} />
          </span>
        </div>
        <div className="featured-text">
          <div className="featured-title">Скидка на профессию психолога</div>
          <div className="featured-sub">Экономия ≈ 44 700 ₽ · с уровня «{LEVELS[featured.minLevel]!.title}»</div>
        </div>
        <div className="glass-word featured-word">−30%</div>
      </button>

      <div className="cats" role="tablist">
        {PRODUCT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={cat === c.id}
            className={`cat ${cat === c.id ? 'active' : ''}`}
            onClick={() => {
              haptic.select();
              setCat(c.id);
            }}
          >
            {c.title}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <StateView icon={<PackageOpen size={24} />} title="Скоро здесь" text="В этой категории пока нет товаров." />
      ) : (
        <div className="grid" key={cat}>
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} onOpen={() => openSheet({ name: 'product', id: p.id })} />
          ))}
        </div>
      )}

      <p className="shop-note subtle">
        Искры начисляются за касания сферы, ежедневные награды и задания. Курс обмена фиксирован, искры не сгорают.
      </p>
    </div>
  );
}

function ProductCard({ product: p, onOpen, index }: { product: Product; onOpen: () => void; index: number }) {
  const state = useApp((s) => s.state)!;
  const balance = useDisplayBalance();
  const lvl = levelFor(state.totalEarned).level.index;
  const owned = isOwned(state, p.id) && p.kind !== 'booking' && p.kind !== 'merch';
  const locked = lvl < p.minLevel;
  const affordable = balance >= p.price;

  return (
    <button className="pcard rise" style={{ animationDelay: `${index * 0.04}s` }} onClick={onOpen}>
      <div className="pcard-media">
        <Img name={p.image} alt="" />
        {p.badge && <span className="chip pcard-badge">{p.badge}</span>}
        {locked && (
          <div className="pcard-lock">
            <Lock size={16} />
            <span>{LEVELS[p.minLevel]!.title}</span>
          </div>
        )}
        <span className={`pcard-price glass-dark ${owned ? 'owned' : ''}`}>
          {owned ? (
            <>
              <Check size={13} /> Ваше
            </>
          ) : (
            <Amount value={p.price} size={12} />
          )}
        </span>
      </div>
      <div className="pcard-title">{p.title}</div>
      <div className="pcard-sub">{p.subtitle}</div>
      {!owned && !locked && (
        <div className="pcard-progress">
          <div className="bar">
            <i style={{ width: `${Math.min(100, (balance / p.price) * 100)}%` }} />
          </div>
          <span>{affordable ? 'Доступно' : `${Math.floor((balance / p.price) * 100)}%`}</span>
        </div>
      )}
    </button>
  );
}
