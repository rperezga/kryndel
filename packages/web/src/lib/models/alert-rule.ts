/**
 * AlertRule model — persisted alert rules per user + contract.
 *
 * Replaces the current in-memory rules in the CLI pipeline.
 * The worker reads these from MongoDB to dispatch alerts for watched contracts.
 *
 * Stored in MongoDB collection `alert_rules`.
 */
import type { Collection, ObjectId } from 'mongodb';
import { getDb } from '../db';
import type { Surface } from '@kryndel/core';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertChannel = 'telegram' | 'discord' | 'webhook' | 'email';

export interface KAlertRule {
  _id:             ObjectId;
  userId:          ObjectId;
  contractAddress: string;   // lowercase EVM address or XRPL account
  surface:         Surface;  // 'evm' | 'native'
  eventName:       string;   // e.g. 'Transfer', '*' for all events
  channel:         AlertChannel;
  /** Channel-specific target: Telegram chat_id, webhook URL, email address, etc. */
  target:          string;
  /** Optional argument filter: { "to": "0x123..." } — matched against decoded args. */
  filter?:         Record<string, unknown>;
  active:          boolean;
  createdAt:       Date;
  updatedAt:       Date;
}

export type KAlertRuleInsert = Omit<KAlertRule, '_id'>;

// ── Collection accessor ───────────────────────────────────────────────────────

export async function alertRulesCollection(): Promise<Collection<KAlertRule>> {
  const db = await getDb();
  return db.collection<KAlertRule>('alert_rules');
}
