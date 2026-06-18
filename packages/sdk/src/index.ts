/**
 * @kryndel/sdk -- Official Kryndel API client.
 *
 * Usage:
 *   import { KryndelClient } from '@kryndel/sdk';
 *   const client = new KryndelClient({ apiKey: 'kr_live_...' });
 *   const { data } = await client.contracts.list();
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

// ── Response types ─────────────────────────────────────────────────────────────

export interface Pagination {
  page:    number;
  limit:   number;
  total:   number;
  hasMore: boolean;
}

export interface Contract {
  _id:       string;
  userId:    string;
  address:   string;
  surface:   'evm' | 'native';
  name?:     string;
  active:    boolean;
  createdAt: string;
}

export interface Event {
  _id:             string;
  contractAddress: string;
  name:            string;
  args:            Record<string, unknown>;
  txHash?:         string;
  createdAt:       string;
}

export interface Rule {
  _id:             string;
  userId:          string;
  contractAddress: string;
  eventName:       string;
  channel:         string;
  target:          string;
  active:          boolean;
}

export interface Webhook {
  _id:               string;
  userId:            string;
  url:               string;
  secretPrefix:      string;
  description?:      string;
  active:            boolean;
  contractAddresses: string[];
  eventNames:        string[];
  createdAt:         string;
}

export interface Delivery {
  _id:             string;
  endpointId:      string;
  contractAddress: string;
  eventName:       string;
  attempt:         number;
  status:          'pending' | 'success' | 'failed' | 'retrying';
  httpStatus?:     number;
  createdAt:       string;
  deliveredAt?:    string;
}

export interface PlanLimits {
  maxContracts:        number;
  maxRulesPerContract: number;
  historyDays:         number;
  channels:            string[];
}

export interface ContractListResponse { data: Contract[]; pagination: Pagination }
export interface EventListResponse    { data: Event[];    pagination: Pagination }
export interface RuleListResponse     { data: Rule[] }
export interface WebhookCreateResponse { webhook: Webhook; secret: string }
export interface WebhookListResponse  { data: Webhook[] }
export interface DeliveryListResponse { data: Delivery[] }
export interface MeResponse { plan: 'free' | 'pro'; limits: PlanLimits; contracts: number; rules: number }

// ── Error class ───────────────────────────────────────────────────────────────

export class KryndelError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'KryndelError';
  }
}

// ── Client ────────────────────────────────────────────────────────────────────

export class KryndelClient {
  private baseUrl: string;

  constructor(private opts: { apiKey: string; baseUrl?: string }) {
    this.baseUrl = opts.baseUrl ?? 'https://kryndel.vercel.app';
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.opts.apiKey}`,
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { message: res.statusText } })) as {
        error?: { message?: string; code?: string };
      };
      throw new KryndelError(
        res.status,
        body.error?.message ?? res.statusText,
        body.error?.code,
      );
    }

    return res.json() as Promise<T>;
  }

  contracts = {
    list: (params?: { page?: number; limit?: number }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString() : '';
      return this.request<ContractListResponse>(`/contracts${qs}`);
    },

    events: (address: string, params?: { page?: number; limit?: number; surface?: string }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString() : '';
      return this.request<EventListResponse>(`/contracts/${address}/events${qs}`);
    },

    rules: (address: string) =>
      this.request<RuleListResponse>(`/contracts/${address}/rules`),
  };

  webhooks = {
    create: (body: { url: string; description?: string; contractAddresses?: string[]; eventNames?: string[] }) =>
      this.request<WebhookCreateResponse>('/webhooks', { method: 'POST', body: JSON.stringify(body) }),

    list: () =>
      this.request<WebhookListResponse>('/webhooks'),

    delete: (id: string) =>
      this.request<void>(`/webhooks/${id}`, { method: 'DELETE' }),

    deliveries: (id: string) =>
      this.request<DeliveryListResponse>(`/webhooks/${id}/deliveries`),
  };

  me = () => this.request<MeResponse>('/me');
}

// ── Webhook signature verification ───────────────────────────────────────────

export interface VerifyWebhookOpts {
  payload:      string | Buffer;
  signature:    string;   // "sha256=<hex>"
  secret:       string;
  timestamp:    string | number;
  toleranceMs?: number;   // default 300_000 (5 min)
}

/**
 * Verify a Kryndel webhook delivery signature.
 *
 * Usage:
 *   const valid = verifyWebhookSignature({
 *     payload:   rawBody,
 *     signature: req.headers['x-kryndel-signature'],
 *     secret:    process.env.WEBHOOK_SECRET,
 *     timestamp: req.headers['x-kryndel-timestamp'],
 *   });
 *   if (!valid) return res.status(401).end();
 */
export function verifyWebhookSignature(opts: VerifyWebhookOpts): boolean {
  const { payload, signature, secret, timestamp, toleranceMs = 300_000 } = opts;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > toleranceMs) return false;

  const buf = typeof payload === 'string' ? Buffer.from(payload) : payload;
  const expected = `sha256=${createHmac('sha256', secret).update(buf).digest('hex')}`;

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
