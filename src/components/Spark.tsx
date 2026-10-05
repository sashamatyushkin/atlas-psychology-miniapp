import { useId } from 'react';

/** Знак внутренней валюты — «искра». */
export function Spark({ size = 14, className = '' }: { size?: number; className?: string }) {
  // уникальный id: градиент из скрытой вкладки (display:none) браузер не рисует
  const gid = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className={`spark ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6dcb3" />
          <stop offset="1" stopColor="#c98f4e" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.5c.7 6.6 3.9 9.8 10.5 10.5-6.6.7-9.8 3.9-10.5 10.5-.7-6.6-3.9-9.8-10.5-10.5C8.1 11.3 11.3 8.1 12 1.5Z"
        fill={`url(#${gid})`}
      />
    </svg>
  );
}

const fmt = new Intl.NumberFormat('ru-RU');
export const formatNum = (n: number) => fmt.format(Math.floor(n));

const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
/** 120 100 → «120,1 тыс.» — для узких ячеек статистики */
export const formatCompact = (n: number) => (n < 10_000 ? formatNum(n) : compact.format(n));

/** Сумма в искрах: «12 480 ✦» */
export function Amount({ value, size = 14, className = '' }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`amount num ${className}`}>
      {formatNum(value)}
      <Spark size={size} />
    </span>
  );
}
