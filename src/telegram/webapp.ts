/**
 * Тонкая обёртка над Telegram.WebApp. Все обращения к SDK проходят здесь:
 * проверка версий, безопасные фолбэки для обычного браузера (локальная разработка,
 * демонстрация по ссылке), промисы вместо колбэков.
 */
import type { TgUser } from '../domain/types';
import type { TgEvent, TgWebApp } from './types';

export const tg: TgWebApp | undefined = window.Telegram?.WebApp;

/** Запущены ли мы действительно внутри Telegram (есть подписанные initData). */
export const isTelegram = Boolean(tg?.initData);

export const platform = tg?.platform ?? 'unknown';
export const isMobileTelegram = isTelegram && (platform === 'ios' || platform === 'android' || platform === 'android_x');

export function supports(version: string): boolean {
  return Boolean(isTelegram && tg?.isVersionAtLeast(version));
}

const BRAND_BG = { dark: '#0e0d0c', light: '#f4f0ea' } as const;

const query = new URLSearchParams(window.location.search);

export function getColorScheme(): 'light' | 'dark' {
  const forced = query.get('theme');
  if (forced === 'light' || forced === 'dark') return forced;
  if (isTelegram && tg) return tg.colorScheme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applySafeArea() {
  const root = document.documentElement;
  const safe = tg?.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const content = tg?.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
  if (isTelegram) {
    root.style.setProperty('--tg-top', `${safe.top + content.top}px`);
    root.style.setProperty('--tg-bottom', `${safe.bottom + content.bottom}px`);
  }
}

function applyChromeColors(scheme: 'light' | 'dark') {
  if (!isTelegram || !tg) return;
  const bg = BRAND_BG[scheme];
  try {
    if (tg.isVersionAtLeast('6.1')) {
      tg.setHeaderColor(bg);
      tg.setBackgroundColor(bg);
    }
    if (tg.isVersionAtLeast('7.10')) tg.setBottomBarColor?.(bg);
  } catch {
    /* старые клиенты могут не поддерживать произвольные цвета */
  }
}

/**
 * Инициализация: сообщаем Telegram о готовности, разворачиваем на весь экран,
 * отключаем свайп-закрытие (мешает тапалке), синхронизируем тему и safe area.
 */
export function initTelegram(onThemeChange: (scheme: 'light' | 'dark') => void): void {
  const scheme = getColorScheme();
  onThemeChange(scheme);
  if (!isTelegram || !tg) return;

  tg.ready();
  tg.expand();
  if (isMobileTelegram && tg.isVersionAtLeast('8.0') && !tg.isFullscreen) {
    try {
      tg.requestFullscreen?.();
    } catch {
      /* fullscreen недоступен — остаёмся в expanded */
    }
  }
  if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.();
  if (isMobileTelegram && tg.isVersionAtLeast('8.0')) tg.lockOrientation?.();

  applyChromeColors(scheme);
  applySafeArea();

  const sync = () => applySafeArea();
  (['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged'] as TgEvent[]).forEach((e) =>
    tg.onEvent(e, sync),
  );
  tg.onEvent('themeChanged', () => {
    const next = getColorScheme();
    applyChromeColors(next);
    onThemeChange(next);
  });
}

// ── Пользователь и параметры запуска ───────────────────────────────────

const DEMO_USER: TgUser = { id: 700_000_001, firstName: 'Алина', username: 'alina_demo', languageCode: 'ru' };

export function getUser(): TgUser {
  const u = tg?.initDataUnsafe.user;
  if (!isTelegram || !u) return DEMO_USER;
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    username: u.username,
    photoUrl: u.photo_url,
    languageCode: u.language_code,
    isPremium: u.is_premium,
  };
}

/** start_param из ссылки t.me/bot/app?startapp=… (или ?startapp=… в браузере для тестов). */
export function getStartParam(): string | undefined {
  return tg?.initDataUnsafe.start_param || query.get('tgWebAppStartParam') || query.get('startapp') || undefined;
}

export const getInitData = () => tg?.initData ?? '';

// ── Тактильный отклик ──────────────────────────────────────────────────

let hapticsEnabled = true;
export const setHapticsEnabled = (v: boolean) => {
  hapticsEnabled = v;
};

const canHaptic = () => hapticsEnabled && supports('6.1');

export const haptic = {
  tap: () => canHaptic() && tg!.HapticFeedback.impactOccurred('light'),
  impact: (style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'medium') =>
    canHaptic() && tg!.HapticFeedback.impactOccurred(style),
  select: () => canHaptic() && tg!.HapticFeedback.selectionChanged(),
  success: () => canHaptic() && tg!.HapticFeedback.notificationOccurred('success'),
  warning: () => canHaptic() && tg!.HapticFeedback.notificationOccurred('warning'),
  error: () => canHaptic() && tg!.HapticFeedback.notificationOccurred('error'),
};

// ── Ссылки, шеринг, файлы ──────────────────────────────────────────────

export function openLink(url: string) {
  if (isTelegram && tg) tg.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function openTelegramLink(url: string) {
  if (isTelegram && tg && /^https:\/\/t\.me\//.test(url)) tg.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function shareLink(url: string, text: string) {
  openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
}

export const canShareStory = () => isMobileTelegram && supports('7.8') && Boolean(tg?.shareToStory);

export function shareStory(mediaUrl: string, text: string, link?: { url: string; name: string }) {
  tg?.shareToStory?.(mediaUrl, { text, widget_link: link });
}

export const canAddToHomeScreen = () => isMobileTelegram && supports('8.0') && Boolean(tg?.addToHomeScreen);

export function addToHomeScreen() {
  tg?.addToHomeScreen?.();
}

export function checkHomeScreenStatus(): Promise<'unsupported' | 'unknown' | 'added' | 'missed'> {
  return new Promise((resolve) => {
    if (!tg?.checkHomeScreenStatus || !supports('8.0')) return resolve('unsupported');
    tg.checkHomeScreenStatus(resolve);
  });
}

export function downloadFile(url: string, fileName: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (supports('8.0') && tg?.downloadFile) {
      tg.downloadFile({ url, file_name: fileName }, (ok) => resolve(ok));
      return;
    }
    openLink(url);
    resolve(true);
  });
}

/** Разрешение боту писать пользователю — нужно, чтобы отправить гайд в чат. */
export function requestWriteAccess(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!supports('6.9') || !tg?.requestWriteAccess) return resolve(false);
    tg.requestWriteAccess((granted) => resolve(granted));
  });
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (supports('6.2')) tg!.showConfirm(message, (ok) => resolve(ok));
    else resolve(window.confirm(message));
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // фолбэк для WebView без Clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// ── CloudStorage ───────────────────────────────────────────────────────

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/**
 * Хранилище «ключ-значение»: Telegram CloudStorage (синхронизируется между
 * устройствами пользователя), в браузере — localStorage.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (supports('6.9')) {
      try {
        const v = await withTimeout(
          new Promise<string>((res, rej) => tg!.CloudStorage.getItem(key, (err, val) => (err ? rej(err) : res(val ?? '')))),
          4000,
        );
        if (v) return v;
      } catch {
        /* падаем в localStorage */
      }
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* приватный режим */
    }
    if (supports('6.9')) {
      await withTimeout(
        new Promise<void>((res, rej) => tg!.CloudStorage.setItem(key, value, (err) => (err ? rej(err) : res()))),
        4000,
      ).catch(() => undefined);
    }
  },
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
    if (supports('6.9')) {
      await new Promise<void>((res) => tg!.CloudStorage.removeItem(key, () => res()));
    }
  },
};
