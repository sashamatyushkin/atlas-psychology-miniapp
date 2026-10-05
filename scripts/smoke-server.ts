/**
 * Смоук-тест бэкенда: поднимает API на свободном порту с тестовым токеном,
 * подписывает initData так же, как Telegram, и проходит основной сценарий.
 *   npm run smoke
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TOKEN = '000000:SMOKE-TEST';
process.env.BOT_TOKEN = TOKEN;
process.env.BOT_POLLING = 'false';
process.env.ADMIN_CHAT_ID = '';
process.env.CHANNEL_ID = '';
process.env.WEBAPP_URL = 'https://example.github.io/atlas/';
process.env.DATA_FILE = join(mkdtempSync(join(tmpdir(), 'atlas-smoke-')), 'db.json');

const { createApp } = await import('../server/app');
const { JsonStore } = await import('../server/store');
const { signInitData } = await import('../server/telegramAuth');
const { QUIZ } = await import('../src/domain/quiz');

const store = new JsonStore(process.env.DATA_FILE);
const server = createApp(store).listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const initData = (id: number, name: string, startParam?: string) =>
  signInitData(
    {
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: 'AAEsmoke',
      user: JSON.stringify({ id, first_name: name, username: `user${id}` }),
      ...(startParam ? { start_param: startParam } : {}),
    },
    TOKEN,
  );

async function call(path: string, body: unknown, auth: string | null) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth !== null ? { Authorization: `tma ${auth}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as any };
}

const step = (name: string) => console.log(`  ✓ ${name}`);
const alice = initData(1001, 'Алина');

try {
  console.log('Smoke test API:');
  assert.equal((await call('/api/session', {}, null)).status, 401);
  assert.equal((await call('/api/session', {}, alice.replace(/hash=\w+/, 'hash=' + '0'.repeat(64)))).status, 401);
  step('запросы без подписи и с поддельной подписью отклоняются (401)');

  let r = await call('/api/session', {}, alice);
  assert.equal(r.status, 200);
  assert.equal(r.data.user.firstName, 'Алина');
  assert.equal(r.data.backend, true);
  step('сессия создаётся по валидным initData');

  await new Promise((res) => setTimeout(res, 1200));
  r = await call('/api/taps', { count: 15 }, alice);
  assert.equal(r.data.state.balance, 15);
  r = await call('/api/taps', { count: 9999 }, alice);
  assert.ok(r.data.state.balance < 200, 'антифрод должен срезать нереальное число тапов');
  step(`тапы начисляются, накрутка срезается (баланс ${r.data.state.balance})`);

  r = await call('/api/daily', {}, alice);
  assert.equal(r.data.reward, 100);
  assert.equal((await call('/api/daily', {}, alice)).data.error.code, 'ALREADY_CLAIMED');
  step('ежедневная награда выдаётся один раз в день');

  assert.equal((await call('/api/lead', { name: 'Алина', goal: 'anxiety', consent: true }, alice)).data.error.code, 'QUIZ_REQUIRED');
  r = await call('/api/quiz', { answers: QUIZ.map(() => 0) }, alice);
  assert.equal(r.data.state.quiz.profile, 'storm');
  assert.equal((await call('/api/lead', { name: '1', goal: 'anxiety', consent: true }, alice)).data.error.code, 'VALIDATION');
  r = await call('/api/lead', { name: 'Алина', goal: 'anxiety', consent: true, writeAccess: false }, alice);
  assert.equal(r.data.reward, 1000);
  assert.equal(r.data.sentToChat, false);
  step('лид-магнит: тест → валидация формы → +1000 искр');

  assert.equal((await call('/api/purchase', { productId: 'practice-harbor' }, alice)).data.error.code, 'INSUFFICIENT_FUNDS');
  // имитируем накопленные искры (как будто пользователь тапал неделю)
  await store.update(1001, (rec) => ({ rec: { ...rec!, state: { ...rec!.state, balance: 20_000, totalEarned: 20_000 } }, result: null }));
  r = await call('/api/purchase', { productId: 'practice-harbor' }, alice);
  assert.match(r.data.purchase.code, /^PR-/);
  assert.equal((await call('/api/purchase', { productId: 'practice-harbor' }, alice)).data.error.code, 'ALREADY_OWNED');
  assert.equal((await call('/api/purchase', { productId: 'consultation' }, alice)).data.error.code, 'LEVEL_REQUIRED');
  step('покупка в Лавке: проверка баланса, повторной покупки и уровня');

  r = await call('/api/enroll', { courseId: 'anxiety', method: 'sbp' }, alice);
  assert.match(r.data.enrollment.receipt, /^ATL-/);
  assert.equal((await call('/api/enroll', { courseId: 'anxiety', method: 'card' }, alice)).data.error.code, 'ALREADY_OWNED');
  assert.equal((await call('/api/enroll', { courseId: 'relations', method: 'cash' }, alice)).data.error.code, 'VALIDATION');
  step('тестовая оплата программы: чек, защита от повторной записи');

  r = await call('/api/taps', { count: 5, boosted: 9 }, alice);
  assert.equal(r.data.error.code, 'VALIDATION');
  step('вспышка: усиленных тапов не больше обычных');

  r = await call('/api/apply', { courseId: 'anxiety' }, alice);
  assert.equal(r.data.state.applications.length, 1);
  step('заявка на программу');

  const bob = initData(2002, 'Борис', 'ref_1001');
  await call('/api/session', {}, bob);
  r = await call('/api/session', {}, alice);
  assert.ok(r.data.state.tasks.invite, 'реферер должен получить награду');
  step('реферальная награда начисляется пригласившему');

  assert.equal((await call('/api/taps', { count: -5 }, alice)).data.error.code, 'VALIDATION');
  assert.equal((await call('/api/upgrade', { kind: 'hack' }, alice)).data.error.code, 'VALIDATION');
  step('некорректный ввод отклоняется');

  console.log('\nВсе проверки пройдены.');
} finally {
  server.close();
}
