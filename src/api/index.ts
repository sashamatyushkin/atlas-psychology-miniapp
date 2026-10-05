import { config } from '../config';
import { isTelegram } from '../telegram/webapp';
import { toApiError } from './errors';
import { HttpApi } from './httpApi';
import { MockApi } from './mockApi';
import type { Api, Session } from './types';

/**
 * Если задан VITE_API_URL и мы внутри Telegram — работаем с сервером.
 * Если сервер недоступен при запуске (например, локальный сервер выключен),
 * приложение не падает, а переходит в автономный режим до следующего запуска.
 */
class ResilientApi implements Api {
  private impl: Api;
  /** сервер был настроен, но не ответил */
  offline = false;

  constructor(primary: Api) {
    this.impl = primary;
  }

  get kind() {
    return this.impl.kind;
  }

  async session(startParam?: string): Promise<Session> {
    try {
      return await this.impl.session(startParam);
    } catch (e) {
      if (this.impl.kind === 'http' && toApiError(e).code === 'NETWORK') {
        console.warn('[api] сервер недоступен — автономный режим');
        this.offline = true;
        this.impl = new MockApi();
        return this.impl.session(startParam);
      }
      throw e;
    }
  }

  syncTaps: Api['syncTaps'] = (...a) => this.impl.syncTaps(...a);
  claimDaily: Api['claimDaily'] = () => this.impl.claimDaily();
  refillEnergy: Api['refillEnergy'] = () => this.impl.refillEnergy();
  buyUpgrade: Api['buyUpgrade'] = (...a) => this.impl.buyUpgrade(...a);
  completeTask: Api['completeTask'] = (...a) => this.impl.completeTask(...a);
  submitQuiz: Api['submitQuiz'] = (...a) => this.impl.submitQuiz(...a);
  claimLeadMagnet: Api['claimLeadMagnet'] = (...a) => this.impl.claimLeadMagnet(...a);
  purchase: Api['purchase'] = (...a) => this.impl.purchase(...a);
  applyCourse: Api['applyCourse'] = (...a) => this.impl.applyCourse(...a);
  completePractice: Api['completePractice'] = (...a) => this.impl.completePractice(...a);
  enrollCourse: Api['enrollCourse'] = (...a) => this.impl.enrollCourse(...a);

  /** Сброс прогресса доступен только в автономном (демо) режиме. */
  get canResetDemo() {
    return Boolean(this.impl.resetDemo);
  }
  resetDemo() {
    if (!this.impl.resetDemo) throw new Error('Сброс недоступен при работе с сервером');
    return this.impl.resetDemo();
  }
}

export const api = new ResilientApi(config.apiUrl && isTelegram ? new HttpApi(config.apiUrl) : new MockApi());

export * from './types';
export * from './errors';
