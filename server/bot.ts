/**
 * Минимальный клиент Telegram Bot API на fetch, без зависимостей.
 * Long polling: команды /start, /guide, /help, /stop, /delete.
 */
import { env } from './config';
import { GUIDE } from '../src/domain/guide';
import { newRecord, type Store } from './store';

const API = 'https://api.telegram.org';

export class TelegramApiError extends Error {
  readonly code: number;
  constructor(code: number, description: string) {
    super(description);
    this.code = code;
  }
}

export async function callApi<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`${API}/bot${env.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string; error_code?: number };
  if (!data.ok) throw new TelegramApiError(data.error_code ?? res.status, data.description ?? 'Telegram API error');
  return data.result;
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export const guideUrl = () => new URL(GUIDE.pdfPath, env.webAppUrl).toString();

export function webAppButton(text: string, startParam?: string) {
  const url = new URL(env.webAppUrl);
  if (startParam) url.searchParams.set('startapp', startParam);
  return { text, web_app: { url: url.toString() } };
}

export async function sendGuide(chatId: number, name: string): Promise<boolean> {
  try {
    await callApi('sendDocument', {
      chat_id: chatId,
      document: guideUrl(),
      caption: `${esc(name)}, ваш гайд «${GUIDE.title}» 🌿\n\nНачните с техники №1 — дыхание 4-7-8 займёт всего 2 минуты. Интерактивная версия есть в приложении.`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[webAppButton('Открыть Атлас', 'guide')]] },
    });
    return true;
  } catch (e) {
    console.warn('[bot] sendGuide failed:', (e as Error).message);
    return false;
  }
}

/** Уведомление администратору/куратору: новые лиды, покупки, заявки. */
export async function notifyAdmin(html: string) {
  if (!env.adminChatId) return;
  try {
    await callApi('sendMessage', { chat_id: env.adminChatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  } catch (e) {
    console.warn('[bot] notifyAdmin failed:', (e as Error).message);
  }
}

export async function notifyUser(chatId: number, html: string) {
  try {
    await callApi('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML' });
  } catch {
    /* пользователь мог заблокировать бота */
  }
}

export async function isChannelMember(userId: number): Promise<boolean> {
  if (!env.channelId) return true;
  const m = await callApi<{ status: string }>('getChatMember', { chat_id: env.channelId, user_id: userId });
  return ['creator', 'administrator', 'member', 'restricted'].includes(m.status);
}

export const userLink = (u: { id: number; firstName: string; username?: string }) =>
  u.username ? `@${esc(u.username)}` : `<a href="tg://user?id=${u.id}">${esc(u.firstName)}</a>`;

export { esc };

interface Update {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { id: number; first_name: string }; text?: string };
}

/** Настраивает кнопку меню и команды бота при старте. */
export async function setupBot() {
  if (!env.webAppUrl.startsWith('https://')) {
    console.warn('[bot] WEBAPP_URL должен быть https:// — кнопка меню не настроена');
    return;
  }
  await callApi('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Атлас', web_app: { url: env.webAppUrl } } });
  await callApi('setMyCommands', {
    commands: [
      { command: 'start', description: 'Открыть Атлас' },
      { command: 'guide', description: 'Прислать гайд по тревоге' },
      { command: 'help', description: 'Помощь' },
      { command: 'stop', description: 'Отписаться от сообщений' },
      { command: 'delete', description: 'Удалить мои данные' },
    ],
  });
  await callApi('setMyDescription', {
    description:
      'Атлас — школа практической психологии.\n\nПройдите тест «Карта внутреннего состояния» и получите гайд «7 техник самопомощи при тревоге». Практики, задания и скидки на программы — внутри.',
  });
}

async function handle(update: Update, store: Store) {
  const msg = update.message;
  if (!msg?.text || msg.chat.type !== 'private' || !msg.from) return;
  const [cmd, payload] = msg.text.trim().split(/\s+/, 2);
  const chatId = msg.chat.id;
  const name = msg.from.first_name;

  // фиксируем, что пользователь написал боту: теперь бот может присылать ему сообщения
  await store.update(chatId, (rec) => {
    const base = rec ?? newRecord({ id: chatId, firstName: name }, Date.now());
    return { rec: { ...base, botStarted: true, unsubscribed: cmd === '/stop' ? true : base.unsubscribed }, result: null };
  });

  switch (cmd) {
    case '/start':
      await callApi('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `<b>${esc(name)}, добро пожаловать в Атлас</b> ✦\n\nЭто пространство, где психология становится практикой.\n\n• Пройдите тест <b>«Карта внутреннего состояния»</b> — 3 минуты\n• Заберите гайд <b>«7 техник самопомощи при тревоге»</b>\n• Копите искры в дыхательной практике и обменивайте их на курсы и консультации`,
        reply_markup: {
          inline_keyboard: [
            [webAppButton('Пройти тест · 3 мин', 'quiz')],
            [webAppButton('Открыть Атлас', payload?.startsWith('ref_') ? payload : undefined)],
          ],
        },
      });
      break;
    case '/guide': {
      const rec = store.get(chatId);
      if (rec?.state.tasks.quiz) await sendGuide(chatId, rec.state.lead?.name ?? name);
      else
        await callApi('sendMessage', {
          chat_id: chatId,
          text: 'Гайд выдаётся после теста «Карта внутреннего состояния» — это займёт 3 минуты.',
          reply_markup: { inline_keyboard: [[webAppButton('Пройти тест', 'quiz')]] },
        });
      break;
    }
    case '/stop':
      await notifyUser(chatId, 'Вы отписались от сообщений школы. Гайд и прогресс остаются в приложении.');
      break;
    case '/delete':
      await store.delete(chatId);
      await notifyUser(chatId, 'Ваши данные удалены. Если захотите вернуться — просто откройте приложение.');
      break;
    default:
      await callApi('sendMessage', {
        chat_id: chatId,
        text: 'Все практики и материалы — в приложении 👇\n\nКоманды: /guide — гайд по тревоге, /stop — отписаться, /delete — удалить данные.',
        reply_markup: { inline_keyboard: [[webAppButton('Открыть Атлас')]] },
      });
  }
}

export async function startPolling(store: Store, signal: AbortSignal) {
  let offset = 0;
  await callApi('deleteWebhook', { drop_pending_updates: false }).catch(() => undefined);
  console.log('[bot] long polling запущен');
  while (!signal.aborted) {
    try {
      const updates = await callApi<Update[]>('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, 35_000);
      for (const u of updates) {
        offset = u.update_id + 1;
        await handle(u, store).catch((e) => console.error('[bot] handler error:', e));
      }
    } catch (e) {
      if (signal.aborted) break;
      console.warn('[bot] polling error:', (e as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
