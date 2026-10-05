import { useEffect } from 'react';
import { isTelegram, supports, tg } from '../telegram/webapp';
import { useNav } from '../store/nav';

/**
 * Синхронизирует системные кнопки Telegram с навигацией приложения:
 * BackButton — когда открыт экран поверх табов или шит; SettingsButton — настройки.
 */
export function TelegramChrome() {
  const canGoBack = useNav((s) => s.stack.length > 0 || s.sheet !== null);

  useEffect(() => {
    const bb = tg?.BackButton;
    if (!isTelegram || !bb) return;
    const onBack = () => useNav.getState().back();
    bb.onClick(onBack);
    return () => {
      bb.offClick(onBack);
    };
  }, []);

  useEffect(() => {
    if (!isTelegram || !tg || !supports('6.1')) return;
    if (canGoBack) tg.BackButton.show();
    else tg.BackButton.hide();
  }, [canGoBack]);

  useEffect(() => {
    const sb = tg?.SettingsButton;
    if (!isTelegram || !sb || !supports('7.0')) return;
    const open = () => useNav.getState().openSheet({ name: 'settings' });
    sb.onClick(open);
    sb.show();
    return () => {
      sb.offClick(open);
      sb.hide();
    };
  }, []);

  return null;
}
