/**
 * Sentinel loop — 24/7 watcher for XRPL issuer accounts.
 *
 * For each active issuer in the `issuers` collection:
 *  1. Refreshes its snapshot (also feeds the dashboard/public tool cache).
 *  2. Scans account_tx for new security-relevant transactions
 *     (SetRegularKey / SignerListSet / AccountSet flag changes) → instant alert.
 *  3. Diffs issued supply vs the last cycle → supply-anomaly alert.
 *
 * State per issuer (lastTxLedger, lastSupply, baselined) avoids re-alerting and
 * suppresses history on the first cycle. Read-only on-chain — no custody.
 */
import {
  fetchIssuerSnapshot,
  fetchAccountSecurityTxs,
  totalSupplyByCurrency,
  escapeMarkdownV2,
  type IssuerSnapshot,
  type SecurityChange,
} from '@kryndel/core/full';
import { ObjectId } from 'mongodb';
import { getDb } from './db.js';
import { sendTelegram, sendWebhook, sendDiscord } from './dispatcher.js';

const XRPL_RPC_URL = process.env.XRPL_RPC_URL ?? 'https://xrplcluster.com';
const INTERVAL_MS = 90_000;
const SUPPLY_ANOMALY_PCT = 0.05; // alert on >= 5% change in a currency's supply

interface WIssuer {
  _id: ObjectId;
  address: string;
  label?: string;
  active?: boolean;
  alertChannel?: string;
  alertTarget?: string;
  lastTxLedger?: number;
  lastSupply?: Record<string, number>;
  baselined?: boolean;
}

function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));
}

let _active = true;

export function startSentinelLoop(): () => void {
  void loop();
  return () => {
    _active = false;
  };
}

async function loop(): Promise<void> {
  while (_active) {
    try {
      const db = await getDb();
      const issuers = (await db
        .collection('issuers')
        .find({ active: { $ne: false } })
        .toArray()) as unknown as WIssuer[];
      for (const issuer of issuers) {
        await processIssuer(issuer).catch((e) =>
          console.error(`[sentinel] ${issuer.address} error:`, e),
        );
      }
    } catch (e) {
      console.error('[sentinel] loop error:', e);
    }
    await new Promise<void>((r) => setTimeout(r, INTERVAL_MS));
  }
}

async function processIssuer(issuer: WIssuer): Promise<void> {
  const db = await getDb();
  const addr = issuer.address;

  // 1. Snapshot (fresh) — store for dashboard/public + supply diffing.
  let snapshot: IssuerSnapshot | null = null;
  try {
    snapshot = await fetchIssuerSnapshot(addr, { endpoint: XRPL_RPC_URL });
    await db.collection('sentinel_snapshots').updateOne(
      { address: addr },
      { $set: { address: addr, snapshot: plain(snapshot), cachedAt: new Date() } },
      { upsert: true },
    );
  } catch (e) {
    console.error(`[sentinel] snapshot ${addr} failed:`, e);
  }

  // 2. First cycle → baseline only (no alerts on history).
  if (!issuer.baselined || issuer.lastTxLedger == null) {
    try {
      const base = await fetchAccountSecurityTxs(addr, { endpoint: XRPL_RPC_URL, limit: 1 });
      await db.collection('issuers').updateOne(
        { _id: issuer._id },
        {
          $set: {
            lastTxLedger: base.maxLedger,
            baselined: true,
            lastSupply: snapshot ? totalSupplyByCurrency(snapshot) : {},
            updatedAt: new Date(),
          },
        },
      );
    } catch (e) {
      console.error(`[sentinel] baseline ${addr} failed:`, e);
    }
    return;
  }

  // 3. New security transactions → instant alerts.
  try {
    const res = await fetchAccountSecurityTxs(addr, {
      endpoint: XRPL_RPC_URL,
      ledgerIndexMin: issuer.lastTxLedger + 1,
      limit: 30,
    });
    for (const change of res.changes) {
      await alert(issuer, securityMessage(issuer, change));
    }

    // 4. Supply anomaly (from the fresh snapshot).
    const updates: Record<string, unknown> = {
      lastTxLedger: Math.max(issuer.lastTxLedger, res.maxLedger),
      updatedAt: new Date(),
    };
    if (snapshot) {
      const cur = totalSupplyByCurrency(snapshot);
      const prev = issuer.lastSupply ?? {};
      for (const [ccy, val] of Object.entries(cur)) {
        const before = prev[ccy];
        if (before != null && before > 0 && Math.abs(val - before) / before >= SUPPLY_ANOMALY_PCT) {
          await alert(issuer, supplyMessage(issuer, ccy, before, val));
        }
      }
      updates.lastSupply = cur;
    }
    await db.collection('issuers').updateOne({ _id: issuer._id }, { $set: updates });
  } catch (e) {
    console.error(`[sentinel] tx scan ${addr} failed:`, e);
  }
}

// ── Alert dispatch ─────────────────────────────────────────────────────────

async function alert(issuer: WIssuer, text: string): Promise<void> {
  const ch = issuer.alertChannel;
  const target = issuer.alertTarget;
  if (!ch || !target) return; // monitor-only: state still tracked, just no push
  try {
    if (ch === 'telegram') await sendTelegram(target, escapeMarkdownV2(text));
    else if (ch === 'discord') await sendDiscord(target, text);
    else if (ch === 'webhook')
      await sendWebhook(target, {
        source: 'kryndel-sentinel',
        issuer: issuer.address,
        label: issuer.label ?? null,
        message: text,
        ts: new Date().toISOString(),
      });
  } catch (e) {
    console.error('[sentinel] alert dispatch failed:', e);
  }
}

function securityMessage(issuer: WIssuer, change: SecurityChange): string {
  const name = issuer.label || issuer.address;
  const sev = change.level === 'risk' ? '🚨' : change.level === 'ok' ? '✅' : '⚠️';
  const tx = change.hash ? `\nTx: ${change.hash}` : '';
  return `${sev} Kryndel Sentinel — ${name}\n${change.title}\n${change.detail}${tx}`;
}

function supplyMessage(issuer: WIssuer, ccy: string, before: number, after: number): string {
  const name = issuer.label || issuer.address;
  const dir = after > before ? 'increased' : 'decreased';
  return `📊 Kryndel Sentinel — ${name}\nSupply of ${ccy} ${dir}: ${before.toLocaleString('en-US')} → ${after.toLocaleString('en-US')}`;
}
