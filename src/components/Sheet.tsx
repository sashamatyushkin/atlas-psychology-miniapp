import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClose: () => void;
  closing: boolean;
  /** контент на всю ширину сверху (обложка) — без отступов */
  cover?: ReactNode;
  label: string;
}

/** Нижний шит со свайпом вниз для закрытия. */
export function Sheet({ children, onClose, closing, cover, label }: Props) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    // тянуть можно за «ручку» в верхней части шита
    if (!(e.target as Element).closest('.sheet-grab')) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    start.current = e.clientY;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, e.clientY - start.current));
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    start.current = null;
    if (drag > 110) onClose();
    setDrag(0);
  };

  return (
    <div className={`sheet-root ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
      <div className="sheet-backdrop" onClick={onClose} style={{ opacity: drag ? Math.max(0.2, 1 - drag / 400) : undefined }} />
      <div
        ref={panel}
        className="sheet-panel"
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <button className="sheet-close icon-btn glass" onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>
        <div className="sheet-scroll">
          {cover}
          <div className="sheet-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
