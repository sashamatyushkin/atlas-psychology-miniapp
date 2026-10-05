const env = import.meta.env;

const clean = (v: string | undefined) => (v ?? '').trim().replace(/^@/, '');

export const config = {
  apiUrl: clean(env.VITE_API_URL).replace(/\/$/, ''),
  botUsername: clean(env.VITE_BOT_USERNAME),
  appShortName: clean(env.VITE_APP_SHORTNAME),
  channelUrl: clean(env.VITE_CHANNEL_URL) || 'https://t.me/telegram',
  curatorUsername: clean(env.VITE_CURATOR_USERNAME),
  version: '1.0.0',
};

/** Абсолютный URL файла из public/ — нужен для шеринга в Stories и загрузки PDF. */
export function publicUrl(path: string): string {
  return new URL(path.replace(/^\//, ''), new URL(import.meta.env.BASE_URL, window.location.href)).toString();
}

export const imageUrl = (name: string) => `${import.meta.env.BASE_URL}img/${name}.webp`;

/** Ссылка на Mini App для приглашений: t.me/<bot>/<app>?startapp=ref_<id> */
export function appLink(startParam?: string): string | null {
  if (!config.botUsername) return null;
  const base = config.appShortName
    ? `https://t.me/${config.botUsername}/${config.appShortName}`
    : `https://t.me/${config.botUsername}`;
  if (!startParam) return base;
  return config.appShortName ? `${base}?startapp=${startParam}` : `${base}?start=${startParam}`;
}
