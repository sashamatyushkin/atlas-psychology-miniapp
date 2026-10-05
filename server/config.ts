/** Конфигурация сервера из переменных окружения (.env подхватывается автоматически). */
import { readFileSync, writeFileSync } from 'node:fs';

try {
  process.loadEnvFile?.();
} catch {
  /* .env не обязателен — переменные могут прийти из окружения */
}

const list = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  botToken: process.env.BOT_TOKEN ?? '',
  webAppUrl: (process.env.WEBAPP_URL ?? '').replace(/\/?$/, '/'),
  adminChatId: process.env.ADMIN_CHAT_ID ?? '',
  channelId: process.env.CHANNEL_ID ?? '',
  port: Number(process.env.PORT ?? 8080),
  corsOrigins: list(process.env.CORS_ORIGINS),
  polling: (process.env.BOT_POLLING ?? 'true') !== 'false',
  dataFile: process.env.DATA_FILE ?? new URL('./data/db.json', import.meta.url).pathname,
  /** срок жизни initData; Telegram рекомендует проверять auth_date */
  initDataMaxAgeSec: Number(process.env.INIT_DATA_MAX_AGE ?? 86_400),
};

const runtimeFile = new URL('./data/runtime.json', import.meta.url).pathname;

/** Настройки, которые сервер узнаёт сам (например, id канала) и сохраняет между запусками. */
export function loadRuntime() {
  try {
    const r = JSON.parse(readFileSync(runtimeFile, 'utf8')) as { channelId?: string };
    if (!env.channelId && r.channelId) env.channelId = r.channelId;
  } catch {
    /* нет файла */
  }
}

export function saveRuntime(patch: { channelId?: string }) {
  let cur = {};
  try {
    cur = JSON.parse(readFileSync(runtimeFile, 'utf8'));
  } catch {
    /* нет файла */
  }
  writeFileSync(runtimeFile, JSON.stringify({ ...cur, ...patch }, null, 2));
}

export function assertEnv() {
  if (!env.botToken) throw new Error('BOT_TOKEN не задан. Скопируйте .env.example в .env и заполните.');
}
