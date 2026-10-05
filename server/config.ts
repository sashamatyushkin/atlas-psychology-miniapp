/** Конфигурация сервера из переменных окружения (.env подхватывается автоматически). */
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

export function assertEnv() {
  if (!env.botToken) throw new Error('BOT_TOKEN не задан. Скопируйте .env.example в .env и заполните.');
}
