import { ShoppingBag } from 'lucide-react';
import { PurchaseRow } from '../components/PurchaseRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { StateView } from '../components/StateView';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';

export function Purchases() {
  const purchases = useApp((s) => s.state!.purchases);
  const { pop, setTab } = useNav();
  return (
    <div className="screen overlay-screen">
      <ScreenHeader title="Мои покупки" />
      <div className="section" style={{ marginTop: 8 }}>
        {purchases.length === 0 ? (
          <StateView
            icon={<ShoppingBag size={22} />}
            title="Пока пусто"
            text="Обменяйте искры на практики, курсы и скидки."
            action={{
              label: 'Открыть Лавку',
              onClick: () => {
                pop();
                setTab('shop');
              },
            }}
          />
        ) : (
          <div className="card purchases-card">
            {purchases.map((p) => (
              <PurchaseRow key={p.id} purchase={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
