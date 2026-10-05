/**
 * HTTP API для Mini App. Без фреймворков: node:http + общая доменная логика из src/domain.
 * Каждый запрос авторизуется подписанными Telegram initData (заголовок Authorization: tma <initData>).
 */
import { randomInt } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { findCourse, findProduct } from '../src/domain/catalog';
import * as engine from '../src/domain/engine';
import { GOALS, PROFILES } from '../src/domain/quiz';
import { DomainError, type GameState, type PaymentMethod, type TaskId, type UpgradeKind } from '../src/domain/types';
import { esc, isChannelMember, notifyAdmin, notifyUser, sendGuide, userLink } from './bot';
import { env } from './config';
import { newRecord, type Store, type UserRecord } from './store';
import { AuthError, validateInitData, type InitData } from './telegramAuth';

const MAX_BODY = 8 * 1024;
const rand = () => randomInt(0, 2 ** 32) / 2 ** 32;

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ── Rate limit: скользящее окно на пользователя ──────────────────────────
const hits = new Map<number, number[]>();
function rateLimit(userId: number, limit = 40, windowMs = 10_000) {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(userId, arr);
  if (arr.length > limit) throw new HttpError(429, 'RATE_LIMIT', 'Слишком много запросов');
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some((t) => now - t < 10_000)) hits.delete(k);
}, 60_000).unref();

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'VALIDATION', 'Слишком большой запрос');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new HttpError(400, 'VALIDATION', 'Некорректный JSON');
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && (env.corsOrigins.length === 0 || env.corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

function auth(req: IncomingMessage): InitData {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('tma ')) throw new HttpError(401, 'UNAUTHORIZED', 'Нет авторизации');
  try {
    return validateInitData(header.slice(4), env.botToken, env.initDataMaxAgeSec);
  } catch (e) {
    if (e instanceof AuthError) throw new HttpError(401, 'UNAUTHORIZED', e.message);
    throw e;
  }
}

type Handler = (ctx: { init: InitData; body: Record<string, unknown>; store: Store }) => Promise<unknown>;

/** Хелпер: атомарно меняет состояние пользователя через доменную функцию. */
function mutate<T extends { state: GameState }>(store: Store, id: number, fn: (s: GameState, now: number) => T) {
  return store.update(id, (rec) => {
    if (!rec) throw new HttpError(401, 'UNAUTHORIZED', 'Сессия не найдена — перезапустите приложение');
    const now = Date.now();
    const result = fn(rec.state, now);
    return { rec: { ...rec, state: result.state }, result: { ...result, serverNow: now } };
  });
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function createRoutes(): Record<string, Handler> {
  return {
    '/api/session': async ({ init, store }) => {
      const now = Date.now();
      const id = init.user.id;
      const refMatch = /^ref_(\d{1,15})$/.exec(init.startParam ?? '');
      const referrer = refMatch ? Number(refMatch[1]) : undefined;

      const { rec, isNew } = await store.update(id, (existing) => {
        const base = existing ?? newRecord(init.user, now);
        const rec: UserRecord = {
          ...base,
          user: init.user,
          referredBy: base.referredBy ?? (!existing && referrer && referrer !== id ? referrer : undefined),
        };
        return { rec, result: { rec, isNew: !existing } };
      });

      // реферальная награда — только за нового пользователя и только существующему пригласившему
      if (isNew && rec.referredBy && store.get(rec.referredBy)) {
        const refId = rec.referredBy;
        const reward = await store.update(refId, (r) => {
          const { state, reward } = engine.rewardReferral(r!.state, now);
          return { rec: { ...r!, state }, result: reward };
        });
        void notifyUser(refId, `✦ ${esc(init.user.firstName)} присоединился(ась) по вашему приглашению. +${reward.toLocaleString('ru-RU')} искр!`);
      }
      return { user: rec.user, state: rec.state, serverNow: now, backend: true };
    },

    '/api/taps': async ({ init, body, store }) => {
      const count = Number(body.count);
      const boosted = Number(body.boosted ?? 0);
      return mutate(store, init.user.id, (s, now) => engine.applyTaps(s, count, now, boosted));
    },

    '/api/daily': async ({ init, store }) => mutate(store, init.user.id, (s, now) => engine.claimDaily(s, now)),

    '/api/refill': async ({ init, store }) => mutate(store, init.user.id, (s, now) => ({ state: engine.refillEnergy(s, now) })),

    '/api/upgrade': async ({ init, body, store }) => {
      const kind = str(body.kind) as UpgradeKind;
      if (!['tap', 'cap', 'regen'].includes(kind)) throw new DomainError('VALIDATION', 'Неизвестное улучшение');
      return mutate(store, init.user.id, (s, now) => ({ state: engine.buyUpgrade(s, kind, now) }));
    },

    '/api/task': async ({ init, body, store }) => {
      const id = str(body.id) as TaskId;
      if (id === 'channel' && !(await isChannelMember(init.user.id).catch(() => false))) {
        throw new DomainError('TASK_NOT_VERIFIED', 'Не видим подписку. Подпишитесь на канал и нажмите «Проверить» ещё раз.');
      }
      return mutate(store, init.user.id, (s, now) => engine.completeTask(s, id, now));
    },

    '/api/quiz': async ({ init, body, store }) =>
      mutate(store, init.user.id, (s, now) => ({ state: engine.submitQuiz(s, body.answers, now) })),

    '/api/lead': async ({ init, body, store }) => {
      const form = { name: str(body.name), goal: str(body.goal) as never, consent: body.consent === true };
      const res = await mutate(store, init.user.id, (s, now) => engine.claimLeadMagnet(s, form, now));
      const rec = store.get(init.user.id)!;
      const lead = res.state.lead!;
      const profile = res.state.quiz ? PROFILES[res.state.quiz.profile] : null;

      // бот может написать, если пользователь разрешил (requestWriteAccess) или уже писал боту
      const sentToChat = body.writeAccess === true || rec.botStarted ? await sendGuide(init.user.id, lead.name) : false;

      if (res.reward > 0) {
        void notifyAdmin(
          [
            '🧭 <b>Новый лид · гайд по тревоге</b>',
            `Имя: ${esc(lead.name)} (${userLink(init.user)})`,
            `Ландшафт: <b>${profile?.word ?? '—'}</b>`,
            `Цель: ${GOALS.find((g) => g.id === lead.goal)?.title ?? lead.goal}`,
            `Баллы: ${res.state.quiz ? Object.entries(res.state.quiz.scores).map(([k, v]) => `${PROFILES[k as keyof typeof PROFILES].word} ${v}`).join(' · ') : '—'}`,
            `Гайд в чат: ${sentToChat ? 'отправлен' : 'нет доступа'}`,
          ].join('\n'),
        );
      }
      return { ...res, sentToChat };
    },

    '/api/purchase': async ({ init, body, store }) => {
      const productId = str(body.productId);
      const res = await mutate(store, init.user.id, (s, now) => engine.purchase(s, productId, now, rand));
      const product = findProduct(productId)!;
      void notifyAdmin(
        `🛍 <b>Обмен в Лавке</b>\n${esc(product.title)} — ${product.price.toLocaleString('ru-RU')} ✦\nКлиент: ${userLink(init.user)}\nКод: <code>${res.purchase.code}</code>${product.kind === 'booking' || product.kind === 'merch' ? '\n⚠️ Нужно связаться с клиентом' : ''}`,
      );
      return res;
    },

    '/api/apply': async ({ init, body, store }) => {
      const courseId = str(body.courseId);
      const course = findCourse(courseId);
      const already = store.get(init.user.id)?.state.applications.some((a) => a.courseId === courseId);
      const res = await mutate(store, init.user.id, (s, now) => ({ state: engine.applyCourse(s, courseId, now) }));
      if (course && !already) {
        const st = res.state;
        void notifyAdmin(
          `📝 <b>Заявка на программу</b>\n«${esc(course.title)}»\nКлиент: ${userLink(init.user)}${st.lead ? ` (${esc(st.lead.name)})` : ''}\nЛандшафт: ${st.quiz ? PROFILES[st.quiz.profile].word : 'тест не пройден'}`,
        );
      }
      return res;
    },

    '/api/practice': async ({ init, body, store }) =>
      mutate(store, init.user.id, (s, now) => ({ state: engine.completePractice(s, str(body.practiceId), now) })),

    // Тестовый режим оплаты: деньги не списываются. Для боевой оплаты здесь
    // создаётся платёж (Telegram Payments / ЮKassa), а запись — по вебхуку об оплате.
    '/api/enroll': async ({ init, body, store }) => {
      const courseId = str(body.courseId);
      const method = str(body.method) as PaymentMethod;
      const res = await mutate(store, init.user.id, (s, now) => engine.enrollCourse(s, courseId, method, now, rand));
      const course = findCourse(courseId)!;
      void notifyAdmin(
        `💳 <b>Оплата (тестовый режим)</b>\n«${esc(course.title)}» — ${res.enrollment.amountRub.toLocaleString('ru-RU')} ₽${res.enrollment.discountPct ? ` (−${res.enrollment.discountPct}%)` : ''}\nКлиент: ${userLink(init.user)}\nЧек: <code>${res.enrollment.receipt}</code>`,
      );
      return res;
    },
  };
}

export function createApp(store: Store) {
  const routes = createRoutes();
  return createServer(async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    const path = (req.url ?? '/').split('?')[0]!;
    if (path === '/api/health') return send(res, 200, { ok: true, users: store.count() });

    const route = routes[path];
    if (!route || req.method !== 'POST') return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Не найдено' } });

    try {
      const init = auth(req);
      rateLimit(init.user.id);
      const body = await readJson(req);
      send(res, 200, await route({ init, body, store }));
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: { code: e.code, message: e.message } });
      if (e instanceof DomainError) return send(res, 400, { error: { code: e.code, message: e.message } });
      console.error('[api]', path, e);
      send(res, 500, { error: { code: 'SERVER', message: 'Внутренняя ошибка' } });
    }
  });
}
