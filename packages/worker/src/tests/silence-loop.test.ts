import { describe, expect, it } from 'vitest';
import { evaluateSilence } from '../silence-loop.js';

describe('evaluateSilence', () => {
  it('fires after the threshold and does not fire again while armed', () => {
    const lastEventAt = new Date('2026-08-10T08:00:00.000Z');
    const now = new Date('2026-08-10T09:01:00.000Z');
    const baseRule = {
      kind: 'silence' as const,
      silenceMinutes: 60,
      silenceFiredAt: null,
    };

    expect(evaluateSilence(baseRule, { lastEventAt, createdAt: lastEventAt }, now)).toBe('fire');
    expect(evaluateSilence(
      { ...baseRule, silenceFiredAt: now },
      { lastEventAt, createdAt: lastEventAt },
      new Date('2026-08-10T10:30:00.000Z'),
    )).toBe('none');
  });

  it('rearms after activity newer than the silence alert', () => {
    const silenceFiredAt = new Date('2026-08-10T09:01:00.000Z');
    const lastEventAt = new Date('2026-08-10T09:05:00.000Z');

    expect(evaluateSilence(
      { kind: 'silence', silenceMinutes: 60, silenceFiredAt },
      { lastEventAt, createdAt: new Date('2026-08-10T07:00:00.000Z') },
      new Date('2026-08-10T09:06:00.000Z'),
    )).toBe('rearm');
  });

  it('uses contract creation time when no event has been observed', () => {
    const createdAt = new Date('2026-08-10T08:00:00.000Z');
    const rule = { kind: 'silence' as const, silenceMinutes: 60, silenceFiredAt: null };

    expect(evaluateSilence(
      rule,
      { lastEventAt: null, createdAt },
      new Date('2026-08-10T09:00:00.000Z'),
    )).toBe('none');
    expect(evaluateSilence(
      rule,
      { lastEventAt: null, createdAt },
      new Date('2026-08-10T09:00:00.001Z'),
    )).toBe('fire');
  });
});
