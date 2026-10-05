import { Copy, MessageCircle, Play } from 'lucide-react';
import { config } from '../config';
import { findProduct } from '../domain/catalog';
import type { Purchase } from '../domain/types';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { copyText, haptic, openTelegramLink } from '../telegram/webapp';
import { Img } from './Img';

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

/** Строка покупки с действием по типу выдачи: практика, код, запись к куратору. */
export function PurchaseRow({ purchase }: { purchase: Purchase }) {
  const product = findProduct(purchase.productId);
  const push = useNav((s) => s.push);
  if (!product) return null;

  const copy = async () => {
    if (await copyText(purchase.code)) {
      haptic.success();
      toast('Код скопирован', 'success');
    }
  };

  return (
    <div className="purchase">
      <Img name={product.image} className="purchase-img" />
      <div className="purchase-main">
        <div className="purchase-title">{product.title}</div>
        <div className="purchase-sub">{dateFmt.format(purchase.at)}</div>
        {product.kind === 'practice' ? (
          <button className="purchase-action" onClick={() => push({ name: 'practice', id: product.practiceId! })}>
            <Play size={14} fill="currentColor" /> Начать практику
          </button>
        ) : (
          <div className="purchase-actions">
            <button className="purchase-code num" onClick={copy} aria-label={`Скопировать код ${purchase.code}`}>
              {purchase.code}
              <Copy size={13} />
            </button>
            {(product.kind === 'booking' || product.kind === 'merch') && config.curatorUsername && (
              <button className="purchase-action" onClick={() => openTelegramLink(`https://t.me/${config.curatorUsername}`)}>
                <MessageCircle size={14} /> Куратор
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function fulfillmentHint(kind: string): string {
  switch (kind) {
    case 'practice':
      return 'Практика открыта навсегда — найдёте её в профиле.';
    case 'promo':
      return 'Введите промокод при оплате программы на сайте школы или назовите его менеджеру.';
    case 'access':
      return 'Активируйте код в личном кабинете на платформе школы — доступ откроется сразу.';
    case 'booking':
      return 'Куратор напишет вам в Telegram в течение 24 часов, чтобы подобрать время. Сохраните номер заявки.';
    case 'merch':
      return 'Куратор свяжется с вами, чтобы уточнить адрес доставки. Сохраните номер заказа.';
    default:
      return '';
  }
}
