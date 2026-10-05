/**
 * Нативная кнопка Telegram (MainButton) с единым API для компонентов.
 * Компоненты регистрируют желаемое состояние через useMainButton — показывается
 * последняя зарегистрированная (верхний экран/шит). Вне Telegram рендерится
 * визуально похожая кнопка внутри страницы.
 */
import { createContext, useContext, useEffect, useId, useRef } from 'react';
import { create } from 'zustand';
import { isTelegram, tg } from '../telegram/webapp';
import { useApp } from '../store/app';

export interface MainButtonOptions {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  shine?: boolean;
  /** шиты и модальные экраны перекрывают кнопку экрана под ними */
  priority?: number;
}

interface Entry extends MainButtonOptions {
  id: string;
}

const useRegistry = create<{ entries: Entry[] }>(() => ({ entries: [] }));

function upsert(entry: Entry) {
  useRegistry.setState((s) => {
    const i = s.entries.findIndex((e) => e.id === entry.id);
    if (i === -1) return { entries: [...s.entries, entry] };
    const next = s.entries.slice();
    next[i] = entry;
    return { entries: next };
  });
}

function remove(id: string) {
  useRegistry.setState((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
}

/** Внутри провайдера со значением true кнопка не регистрируется (закрывающийся шит). */
export const MainButtonSuppressed = createContext(false);

/** Передайте null, чтобы спрятать кнопку. */
export function useMainButton(input: MainButtonOptions | null) {
  const suppressed = useContext(MainButtonSuppressed);
  const opts = suppressed ? null : input;
  const id = useId();
  const clickRef = useRef<() => void>(() => {});
  clickRef.current = opts?.onClick ?? (() => {});
  const visible = opts !== null;
  const text = opts?.text ?? '';
  const disabled = opts?.disabled ?? false;
  const loading = opts?.loading ?? false;
  const shine = opts?.shine ?? false;
  const priority = opts?.priority ?? 0;

  useEffect(() => {
    if (!visible) {
      remove(id);
      return;
    }
    upsert({ id, text, disabled, loading, shine, priority, onClick: () => clickRef.current() });
  }, [id, visible, text, disabled, loading, shine, priority]);

  useEffect(() => () => remove(id), [id]);
}

const NATIVE = isTelegram && Boolean(tg?.MainButton);

export function MainButtonHost() {
  const top = useRegistry((s) =>
    s.entries.reduce<Entry | undefined>((best, e) => (!best || (e.priority ?? 0) >= (best.priority ?? 0) ? e : best), undefined),
  );
  const scheme = useApp((s) => s.scheme);
  const topRef = useRef(top);
  topRef.current = top;

  // нативная кнопка: один обработчик, который вызывает актуальный onClick
  useEffect(() => {
    const mb = tg?.MainButton;
    if (!NATIVE || !mb) return;
    const handler = () => {
      const t = topRef.current;
      if (t && !t.disabled && !t.loading) t.onClick();
    };
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--mb-space', top && !NATIVE ? '84px' : '0px');
    if (!NATIVE || !tg) return;
    const mb = tg.MainButton;
    if (!top) {
      mb.hideProgress();
      mb.hide();
      return;
    }
    mb.setParams({
      text: top.text,
      color: scheme === 'dark' ? '#e2b67d' : '#b07a3c',
      text_color: scheme === 'dark' ? '#1d140a' : '#ffffff',
      is_active: !top.disabled,
      is_visible: true,
      has_shine_effect: Boolean(top.shine) && tg.isVersionAtLeast('7.10'),
    });
    if (top.loading) mb.showProgress(false);
    else mb.hideProgress();
  }, [top, scheme]);

  if (NATIVE || !top) return null;
  return (
    <div className="fallback-mb">
      <button
        className={`btn btn-primary btn-block ${top.shine ? 'shine' : ''}`}
        disabled={top.disabled || top.loading}
        onClick={top.onClick}
      >
        {top.loading ? <span className="spinner" aria-label="Загрузка" /> : top.text}
      </button>
    </div>
  );
}
