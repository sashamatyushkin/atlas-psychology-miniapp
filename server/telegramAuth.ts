/**
 * Проверка подписи Telegram initData.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TgUser } from '../src/domain/types';

export interface InitData {
  user: TgUser;
  authDate: number;
  startParam?: string;
  queryId?: string;
}

export class AuthError extends Error {}

export function signInitData(params: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...params, hash }).toString();
}

export function validateInitData(raw: string, botToken: string, maxAgeSec: number, now = Date.now()): InitData {
  if (!raw) throw new AuthError('initData отсутствует');
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) throw new AuthError('Некорректная подпись');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw new AuthError('Подпись не совпадает');

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec) throw new AuthError('initData устарели');

  let u: { id?: unknown; first_name?: unknown; last_name?: string; username?: string; photo_url?: string; language_code?: string; is_premium?: boolean };
  try {
    u = JSON.parse(params.get('user') ?? '');
  } catch {
    throw new AuthError('Нет данных пользователя');
  }
  if (typeof u.id !== 'number' || typeof u.first_name !== 'string') throw new AuthError('Нет данных пользователя');

  return {
    user: {
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      username: u.username,
      photoUrl: u.photo_url,
      languageCode: u.language_code,
      isPremium: u.is_premium,
    },
    authDate,
    startParam: params.get('start_param') ?? undefined,
    queryId: params.get('query_id') ?? undefined,
  };
}
