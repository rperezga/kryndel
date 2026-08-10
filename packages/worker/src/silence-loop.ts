/**
 * Silence / dead-man's-switch alert loop.
 *
 * Every minute, evaluates active silence rules against the watched contract's
 * last observed event. The pure decision predicate is kept independent from
 * MongoDB and dispatch so fixture dates cover the state machine deterministically.
 */
import type { ContractActivity } from '@kryndel/core/full';
import { getDb } from './db.js';
import { dispatch } from './dispatcher.js';
import type { WAlertRule, WContract } from './types.js';

const INTERVAL_MS = 60_000;

export type SilenceDecision = 'fire' | 'rearm' | 'none';

export interface SilenceRuleState {
  kind?: 'event' | 'silence';
  silenceMinutes?: number;
  silenceFiredAt?: Date | null;
}

export interface SilenceContractState {
  lastEventAt?: Date | null;
  createdAt: Date;
}

export function evaluateSilence(
  rule: SilenceRuleState,
  contract: SilenceContractState,
  now: Date,
): SilenceDecision {
  if (rule.kind !== 'silence') return 'none';
  if (
    rule.silenceFiredAt != null &&
    contract.lastEventAt != null &&
    contract.lastEventAt.getTime() > rule.silenceFiredAt.getTime()
  ) {
    return 'rearm';
  }
  if (rule.silenceFiredAt != null) return 'none';
  if (!rule.silenceMinutes || !Number.isFinite(rule.silenceMinutes) || rule.silenceMinutes <= 0) {
    return 'none';
  }
  const baseline = contract.lastEventAt ?? contract.createdAt;
  return now.getTime() - baseline.getTime() > rule.silenceMinutes * 60_000
    ? 'fire'
    : 'none';
}

let _active = true;

export function startSilenceLoop(): () => void {
  console.log(`[silence] starting (interval: ${INTERVAL_MS}ms)`);
  void loop();
  return () => {
    _active = false;
    console.log('[silence] stopped');
  };
}

async function loop(): Promise<void> {
  while (_active) {
    try {
      await tick();
    } catch (error) {
      console.error('[silence] loop error:', error);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

async function tick(): Promise<void> {
  const db = await getDb();
  const rules = (await db.collection('alert_rules').find({
    active: true,
    kind: 'silence',
  }).toArray()) as unknown as WAlertRule[];
  if (rules.length === 0) return;

  const contracts = (await db.collection('contracts').find({
    active: { $ne: false },
    $or: rules.map((rule) => ({
      userId: rule.userId,
      address: rule.contractAddress,
      surface: rule.surface,
    })),
  }).toArray()) as unknown as WContract[];
  const byKey = new Map(contracts.map((contract) => [contractKey(contract), contract]));
  const now = new Date();

  for (const rule of rules) {
    const contract = byKey.get(ruleKey(rule));
    if (!contract) {
      console.warn(`[silence] contract not found for rule ${rule._id}`);
      continue;
    }
    await processRule(rule, contract, now).catch((error) =>
      console.error(`[silence] rule ${rule._id} error:`, error),
    );
  }
}

async function processRule(rule: WAlertRule, contract: WContract, now: Date): Promise<void> {
  const decision = evaluateSilence(rule, contract, now);
  if (decision === 'none') return;

  const label = contract.label ?? contract.name ?? contract.address;
  const message = decision === 'fire'
    ? `⚠️ ${label} has emitted no events for ${formatHours(rule.silenceMinutes!)} (last: ${contract.lastEventAt?.toISOString() ?? 'never'})`
    : `✅ ${label} activity resumed`;
  const activity = { kind: 'event', name: 'Silence' } as ContractActivity;

  await dispatch(activity, [rule], contract.address, { kind: 'silence', message });

  const db = await getDb();
  await db.collection('alert_rules').updateOne(
    { _id: rule._id },
    {
      $set: {
        silenceFiredAt: decision === 'fire' ? now : null,
        updatedAt: now,
      },
    },
  );
  console.log(`[silence] ${decision} rule=${rule._id} contract=${contract.surface}:${contract.address}`);
}

function formatHours(minutes: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(minutes / 60)}h`;
}

function contractKey(contract: WContract): string {
  return `${contract.userId}:${contract.surface}:${contract.address.toLowerCase()}`;
}

function ruleKey(rule: WAlertRule): string {
  return `${rule.userId}:${rule.surface}:${rule.contractAddress.toLowerCase()}`;
}
