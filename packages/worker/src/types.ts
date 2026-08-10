/**
 * Worker-local MongoDB document shapes.
 * These mirror the web schemas but are defined here to avoid importing
 * Next.js-flavored packages (next-auth, etc.) into the worker.
 */
import type { ObjectId } from 'mongodb';

export type Surface = 'evm' | 'native';
export type Plan    = 'free' | 'pro';
export type AlertChannel = 'telegram' | 'discord' | 'webhook' | 'email';

/** Matches `users` collection shape from packages/web/src/lib/models/user.ts */
export interface WUser {
  _id:   ObjectId;
  email: string;
  plan:  Plan;
}

/** Registered contract document stored in `contracts` collection. */
export interface WContract {
  _id:     ObjectId;
  userId:  ObjectId;
  address: string;
  surface: Surface;
  label?:  string;
  name?:   string;
  abi?:    unknown;  // F1: user-uploaded ABI for named event decoding
  active:  boolean;
  createdAt: Date;
  lastEventAt?: Date | null;
}

/** Alert rule document stored in `alert_rules` collection. */
export interface WAlertRule {
  _id:             ObjectId;
  userId:          ObjectId;
  contractAddress: string;
  surface:         Surface;
  eventName:       string;     // event name or '*' for any
  kind?:           'event' | 'silence'; // absent on legacy rules means 'event'
  silenceMinutes?: number;
  silenceFiredAt?: Date | null;
  channel:         AlertChannel;
  target:          string;     // Telegram chat ID, webhook URL, etc.
  filter?:         Record<string, unknown>;
  active:          boolean;
  createdAt:       Date;
}
