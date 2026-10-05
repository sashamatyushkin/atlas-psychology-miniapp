import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useToasts } from '../store/toast';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass toast-${t.tone}`}>
          {t.tone === 'success' && <CheckCircle2 size={18} />}
          {t.tone === 'error' && <AlertCircle size={18} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
