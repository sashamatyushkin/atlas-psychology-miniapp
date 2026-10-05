import { config } from '../config';
import { isTelegram } from '../telegram/webapp';
import { HttpApi } from './httpApi';
import { MockApi } from './mockApi';
import type { Api } from './types';

/**
 * Выбор реализации: если задан VITE_API_URL и мы внутри Telegram (есть initData) —
 * работаем с сервером; иначе — автономный мок-режим.
 */
export const api: Api = config.apiUrl && isTelegram ? new HttpApi(config.apiUrl) : new MockApi();

export * from './types';
export * from './errors';
