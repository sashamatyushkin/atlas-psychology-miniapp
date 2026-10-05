/**
 * Хранилище пользователей. Реализация — JSON-файл с атомарной записью:
 * хватает для пилота на тысячи пользователей. Для масштаба замените на
 * Postgres/Redis, реализовав тот же интерфейс Store.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInitialState, normalizeState } from '../src/domain/engine';
import type { GameState, TgUser } from '../src/domain/types';

export interface UserRecord {
  user: TgUser;
  state: GameState;
  referredBy?: number;
  /** пользователь написал боту /start — бот может ему писать */
  botStarted?: boolean;
  /** гайд уже выдавался через бота (имя для повторной отправки) */
  guideName?: string;
  /** отписался от рассылок (/stop) */
  unsubscribed?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Store {
  get(id: number): UserRecord | undefined;
  /** Атомарное обновление: операции над одним пользователем выполняются по очереди. */
  update<T>(id: number, fn: (rec: UserRecord | undefined) => { rec: UserRecord; result: T }): Promise<T>;
  delete(id: number): Promise<void>;
  count(): number;
}

export class JsonStore implements Store {
  private data = new Map<number, UserRecord>();
  private locks = new Map<number, Promise<unknown>>();
  private timer: NodeJS.Timeout | null = null;
  private readonly file: string;

  constructor(file: string) {
    this.file = file;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, UserRecord>;
      const now = Date.now();
      for (const [id, rec] of Object.entries(raw)) {
        this.data.set(Number(id), { ...rec, state: normalizeState(rec.state, now) });
      }
    } catch {
      /* первый запуск */
    }
  }

  get(id: number) {
    return this.data.get(id);
  }

  count() {
    return this.data.size;
  }

  update<T>(id: number, fn: (rec: UserRecord | undefined) => { rec: UserRecord; result: T }): Promise<T> {
    const prev = this.locks.get(id) ?? Promise.resolve();
    const job = prev.then(() => {
      const { rec, result } = fn(this.data.get(id));
      this.data.set(id, { ...rec, updatedAt: Date.now() });
      this.scheduleFlush();
      return result;
    });
    const tail = job.catch(() => undefined);
    this.locks.set(id, tail);
    void tail.then(() => {
      if (this.locks.get(id) === tail) this.locks.delete(id);
    });
    return job;
  }

  async delete(id: number) {
    this.data.delete(id);
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 1000);
  }

  flush() {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.data)));
    renameSync(tmp, this.file);
  }
}

export function newRecord(user: TgUser, now: number): UserRecord {
  return { user, state: createInitialState(now), createdAt: now, updatedAt: now };
}
