/**
 * Типы для используемой части Telegram Web Apps API (Bot API 8.0+).
 * https://core.telegram.org/bots/webapps
 */

export interface TgThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TgInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TgBottomButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setParams(params: {
    text?: string;
    color?: string;
    text_color?: string;
    has_shine_effect?: boolean;
    is_active?: boolean;
    is_visible?: boolean;
  }): TgBottomButton;
  onClick(cb: () => void): TgBottomButton;
  offClick(cb: () => void): TgBottomButton;
  show(): TgBottomButton;
  hide(): TgBottomButton;
  enable(): TgBottomButton;
  disable(): TgBottomButton;
  showProgress(leaveActive?: boolean): TgBottomButton;
  hideProgress(): TgBottomButton;
}

export interface TgBackButton {
  isVisible: boolean;
  onClick(cb: () => void): TgBackButton;
  offClick(cb: () => void): TgBackButton;
  show(): TgBackButton;
  hide(): TgBackButton;
}

export interface TgCloudStorage {
  setItem(key: string, value: string, cb?: (err: string | null, ok?: boolean) => void): void;
  getItem(key: string, cb: (err: string | null, value?: string) => void): void;
  removeItem(key: string, cb?: (err: string | null, ok?: boolean) => void): void;
}

export interface TgHaptic {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

export interface TgWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export type TgEvent =
  | 'themeChanged'
  | 'viewportChanged'
  | 'safeAreaChanged'
  | 'contentSafeAreaChanged'
  | 'fullscreenChanged'
  | 'fullscreenFailed'
  | 'activated'
  | 'deactivated'
  | 'homeScreenAdded'
  | 'settingsButtonClicked';

export interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgWebAppUser; start_param?: string; auth_date?: number; hash?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TgThemeParams;
  isExpanded: boolean;
  isFullscreen?: boolean;
  isActive?: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset?: TgInsets;
  contentSafeAreaInset?: TgInsets;
  MainButton: TgBottomButton;
  SecondaryButton?: TgBottomButton;
  BackButton: TgBackButton;
  SettingsButton?: TgBackButton;
  HapticFeedback: TgHaptic;
  CloudStorage: TgCloudStorage;
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(version: string): boolean;
  requestFullscreen?(): void;
  exitFullscreen?(): void;
  lockOrientation?(): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  showAlert(message: string, cb?: () => void): void;
  showConfirm(message: string, cb?: (ok: boolean) => void): void;
  requestWriteAccess?(cb?: (granted: boolean) => void): void;
  shareToStory?(mediaUrl: string, params?: { text?: string; widget_link?: { url: string; name?: string } }): void;
  addToHomeScreen?(): void;
  checkHomeScreenStatus?(cb: (status: 'unsupported' | 'unknown' | 'added' | 'missed') => void): void;
  downloadFile?(params: { url: string; file_name: string }, cb?: (accepted: boolean) => void): void;
  onEvent(event: TgEvent, cb: (...args: unknown[]) => void): void;
  offEvent(event: TgEvent, cb: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}
