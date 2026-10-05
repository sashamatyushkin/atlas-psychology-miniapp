import { useDisplayBalance } from '../store/app';
import { useNav } from '../store/nav';
import { Spark, formatNum } from './Spark';

export function BalanceChip({ onDark = false }: { onDark?: boolean }) {
  const balance = useDisplayBalance();
  const setTab = useNav((s) => s.setTab);
  return (
    <button
      className={`balance-chip ${onDark ? 'glass-dark' : 'glass'}`}
      onClick={() => setTab('practice')}
      aria-label={`Баланс: ${formatNum(balance)} искр`}
    >
      <Spark size={15} />
      <span className="num">{formatNum(balance)}</span>
    </button>
  );
}
