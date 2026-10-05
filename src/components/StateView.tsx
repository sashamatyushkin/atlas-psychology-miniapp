import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}

/** Единый вид для пустых состояний и ошибок. */
export function StateView({ icon, title, text, action, compact }: Props) {
  return (
    <div className={`state-view ${compact ? 'compact' : ''}`}>
      {icon && <div className="state-icon">{icon}</div>}
      <h3 className="display">{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action && (
        <button className="btn btn-ghost btn-sm" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
