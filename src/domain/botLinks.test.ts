import { describe, expect, it } from 'vitest';
import { decodeBotEvent, encodeBotEvent } from './botLinks';

describe('bot deep links', () => {
  it('кодирует и декодирует лид с кириллическим именем в пределах 64 символов', () => {
    const p = encodeBotEvent({ type: 'guide', profile: 'storm', goal: 'anxiety', name: 'Анна-Мария' });
    expect(p).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(decodeBotEvent(p)).toEqual({ type: 'guide', profile: 'storm', goal: 'anxiety', name: 'Анна-Мария' });
    const long = encodeBotEvent({ type: 'guide', profile: 'harbor', goal: 'profession', name: 'Александраааааааааааааааааааааааа' });
    expect(long.length).toBeLessThanOrEqual(64);
    expect(decodeBotEvent(long)?.type).toBe('guide');
  });

  it('кодирует заявки и покупки', () => {
    expect(decodeBotEvent(encodeBotEvent({ type: 'apply', courseId: 'anxiety' }))).toEqual({ type: 'apply', courseId: 'anxiety' });
    const p = encodeBotEvent({ type: 'purchase', productId: 'consultation', code: 'BK-AB23-CD45' });
    expect(decodeBotEvent(p)).toEqual({ type: 'purchase', productId: 'consultation', code: 'BK-AB23-CD45' });
  });

  it('отклоняет мусор и подделки', () => {
    for (const bad of ['', 'g_storm_hack_QQ', 'a_unknown', 'p_consultation_<script>', 'ref_123', 'x'.repeat(65)]) {
      expect(decodeBotEvent(bad)).toBeNull();
    }
  });
});
