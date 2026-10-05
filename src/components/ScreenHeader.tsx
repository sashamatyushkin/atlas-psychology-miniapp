import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { isTelegram } from '../telegram/webapp';
import { useNav } from '../store/nav';

/**
 * Верхняя панель вложенного экрана. В Telegram «назад» — системная BackButton,
 * в браузере показываем свою кнопку.
 */
export function ScreenHeader({ title, right, onDark }: { title?: ReactNode; right?: ReactNode; onDark?: boolean }) {
  const pop = useNav((s) => s.pop);
  return (
    <header className={`screen-header ${onDark ? 'on-dark' : ''}`}>
      {!isTelegram ? (
        <button className={`icon-btn ${onDark ? 'glass-dark' : 'glass'}`} onClick={pop} aria-label="Назад">
          <ChevronLeft size={20} />
        </button>
      ) : (
        <span className="header-spacer" />
      )}
      {title && <div className="screen-header-title">{title}</div>}
      <div className="screen-header-right">{right}</div>
    </header>
  );
}
