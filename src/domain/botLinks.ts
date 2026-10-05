/**
 * Диплинки в бота: t.me/<bot>?start=<payload>.
 * Позволяют передать событие боту без публичного API (бот получает его через
 * long polling), — так работают лиды, когда сервер запущен локально.
 * Формат payload ограничен Telegram: 1–64 символа [A-Za-z0-9_-].
 */
import { findCourse, findProduct } from './catalog';
import { GOALS, PROFILES } from './quiz';
import type { GoalId, ProfileId } from './types';

export type BotEvent =
  | { type: 'guide'; profile: ProfileId; goal: GoalId; name: string }
  | { type: 'apply'; courseId: string }
  | { type: 'purchase'; productId: string; code: string };

const b64url = {
  encode(s: string): string {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): string {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  },
};

export function encodeBotEvent(e: BotEvent): string {
  switch (e.type) {
    case 'guide': {
      const head = `g_${e.profile}_${e.goal}_`;
      // имя обрезаем так, чтобы уложиться в 64 символа
      let name = e.name;
      while (name && head.length + b64url.encode(name).length > 64) name = name.slice(0, -1);
      return head + b64url.encode(name);
    }
    case 'apply':
      return `a_${e.courseId}`;
    case 'purchase':
      return `p_${e.productId}_${e.code}`.slice(0, 64);
  }
}

/** Разбор и строгая валидация payload — данные пришли от пользователя. */
export function decodeBotEvent(payload: string): BotEvent | null {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(payload)) return null;
  const [kind, ...rest] = payload.split('_');
  try {
    if (kind === 'g' && rest.length >= 3) {
      const [profile, goal, ...nameParts] = rest;
      if (!(profile! in PROFILES) || !GOALS.some((g) => g.id === goal)) return null;
      const name = b64url.decode(nameParts.join('_')).replace(/\s+/g, ' ').trim();
      if (!/^[\p{L}][\p{L}\s'’-]{0,39}$/u.test(name)) return null;
      return { type: 'guide', profile: profile as ProfileId, goal: goal as GoalId, name };
    }
    if (kind === 'a' && rest.length === 1 && findCourse(rest[0]!)) return { type: 'apply', courseId: rest[0]! };
    if (kind === 'p' && rest.length === 2 && findProduct(rest[0]!) && /^[A-Z]{2,5}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(rest[1]!)) {
      return { type: 'purchase', productId: rest[0]!, code: rest[1]! };
    }
  } catch {
    return null;
  }
  return null;
}
