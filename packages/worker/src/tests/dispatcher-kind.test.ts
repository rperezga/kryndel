import { describe, expect, it } from 'vitest';
import type { ContractActivity } from '@kryndel/core/full';
import { shouldDispatchRule } from '../dispatcher.js';
import type { WAlertRule } from '../types.js';

const activity = { kind: 'event', name: 'Transfer', args: {} } as ContractActivity;
const legacyRule = { eventName: '*', active: true } as WAlertRule;
const silenceRule = {
  eventName: '*',
  active: true,
  kind: 'silence',
  silenceMinutes: 60,
  silenceFiredAt: null,
} as WAlertRule;

describe('dispatcher rule kinds', () => {
  it('keeps legacy rules as event rules and isolates silence rules', () => {
    expect(shouldDispatchRule(legacyRule, activity, 'event')).toBe(true);
    expect(shouldDispatchRule(silenceRule, activity, 'event')).toBe(false);
    expect(shouldDispatchRule(silenceRule, activity, 'silence')).toBe(true);
  });
});
