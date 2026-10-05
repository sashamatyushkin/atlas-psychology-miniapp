import { describe, expect, it } from 'vitest';
import { AuthError, signInitData, validateInitData } from './telegramAuth';

const TOKEN = '123456:TEST-token';
const now = Date.UTC(2026, 9, 5);
const user = JSON.stringify({ id: 42, first_name: 'Алина', username: 'alina' });
const signed = (authDate = now / 1000, extra: Record<string, string> = {}) =>
  signInitData({ auth_date: String(authDate), user, query_id: 'AAH', ...extra }, TOKEN);

describe('validateInitData', () => {
  it('принимает корректно подписанные данные', () => {
    const d = validateInitData(signed(undefined, { start_param: 'ref_7' }), TOKEN, 86_400, now);
    expect(d.user).toMatchObject({ id: 42, firstName: 'Алина', username: 'alina' });
    expect(d.startParam).toBe('ref_7');
  });

  it('отклоняет подделку', () => {
    const tampered = signed().replace('%D0%90%D0%BB%D0%B8%D0%BD%D0%B0', 'Hacker');
    expect(() => validateInitData(tampered, TOKEN, 86_400, now)).toThrow(AuthError);
    expect(() => validateInitData(signed(), 'other:token', 86_400, now)).toThrow(AuthError);
  });

  it('отклоняет устаревшие данные и пустой ввод', () => {
    expect(() => validateInitData(signed(now / 1000 - 90_000), TOKEN, 86_400, now)).toThrow(/устарели/);
    expect(() => validateInitData('', TOKEN, 86_400, now)).toThrow(AuthError);
  });
});
