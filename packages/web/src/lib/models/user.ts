/**
 * User model — Kryndel Cloud accounts.
 *
 * Stored in MongoDB collection `users`.
 * Auth is handled by magic link (email); wallet auth is deferred to Fase B.
 * Billing fields (stripeCustomerId, stripeSubscriptionId) populated in PA-billing.
 */
import type { Collection, ObjectId } from 'mongodb';
import { getDb } from '../db.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro';

export interface KUser {
  _id:                   ObjectId;
  email:                 string;    // unique, always lowercase
  plan:                  Plan;
  /** Populated in PA-billing when user upgrades via Stripe. */
  stripeCustomerId?:     string;
  stripeSubscriptionId?: string;
  createdAt:             Date;
  updatedAt:             Date;
}

export type KUserInsert = Omit<KUser, '_id'>;

// ── Collection accessor ───────────────────────────────────────────────────────

export async function usersCollection(): Promise<Collection<KUser>> {
  const db = await getDb();
  return db.collection<KUser>('users');
}

// ── Plan limits (query-side — events are never deleted, only visibility gated) ─

export type Plan_ = Plan; // re-export alias for worker

export const PLAN_LIMITS: Record<Plan, {
  maxContracts:        number;
  maxRulesPerContract: number;
  historyDays:         number;   // how far back events are shown in queries
  channels:            string[]; // allowed alert dispatch channels
}> = {
  free: {
    maxContracts:        3,
    maxRulesPerContract: 1,
    historyDays:         7,
    channels:            ['telegram'],
  },
  pro: {
    maxContracts:        20,
    maxRulesPerContract: 10,
    historyDays:         90,
    channels:            ['telegram', 'discord', 'webhook', 'email'],
  },
};

/** Returns the Date cutoff for event history queries for a given plan. */
export function historyCutoff(plan: Plan): Date {
  const days = PLAN_LIMITS[plan].historyDays;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
}
