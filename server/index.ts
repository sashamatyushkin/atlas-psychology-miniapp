/** Точка входа: API + бот (long polling). Запуск: npm run server */
import { createApp } from './app';
import { setupBot, startPolling } from './bot';
import { assertEnv, env, loadRuntime } from './config';
import { JsonStore } from './store';

assertEnv();
loadRuntime();

const store = new JsonStore(env.dataFile);
const server = createApp(store);
const abort = new AbortController();

server.listen(env.port, () => {
  console.log(`[api] слушаю :${env.port} · пользователей: ${store.count()}`);
});

if (env.polling) {
  setupBot().catch((e) => console.warn('[bot] setup:', (e as Error).message));
  void startPolling(store, abort.signal);
}

function shutdown() {
  console.log('\n[api] остановка…');
  abort.abort();
  store.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
