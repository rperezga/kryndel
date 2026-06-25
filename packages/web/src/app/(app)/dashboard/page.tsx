import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { PLAN_LIMITS, type Plan } from '@/lib/models/index';
import BillingButtons from './BillingButtons';
import { MetricTile, StatusChip, Button } from '@/components/ds';
import { LiveEventStream } from './LiveEventStream';
import { WebhookDeliveriesTable } from './WebhookDeliveriesTable';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Overview Dashboard · Kryndel' };

function formatTimeOnly(d: unknown): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d as string);
  const hrs = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ upgrade?: string }>;
}) {
  const upgrade = (await searchParams)?.upgrade;
  const user = await currentUser();
  if (!user) redirect('/login');

  const db = await getDb();

  // 1. Fetch User contracts
  const contracts = await db
    .collection('contracts')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  const userAddresses = contracts.map((c) => c.address.toLowerCase());

  // 2. Plan limits
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits = PLAN_LIMITS[plan];
  const atLimit = contracts.length >= limits.maxContracts;

  // 3. Active alert rules count
  const activeAlerts = await db
    .collection('alert_rules')
    .countDocuments({ userId: user._id, active: true });

  // 4. Failed calls in the last 24h
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let failedCallsCount = 0;
  if (userAddresses.length > 0) {
    const [failedCalls, failedEvents] = await Promise.all([
      db.collection('calls').countDocuments({
        contract: { $in: userAddresses },
        status: { $in: ['fail', 'failed', 'reverted'] },
        indexedAt: { $gte: cutoff24h },
      }),
      db.collection('events').countDocuments({
        contract: { $in: userAddresses },
        status: { $in: ['fail', 'failed', 'reverted'] },
        indexedAt: { $gte: cutoff24h },
      }),
    ]);
    failedCallsCount = failedCalls + failedEvents;
  }

  // 4b. Events indexed in the last 24h (activity volume — real signal of pipeline life)
  let events24hCount = 0;
  if (userAddresses.length > 0) {
    events24hCount = await db.collection('events').countDocuments({
      $or: [
        { contractAddress: { $in: userAddresses } },
        { contract: { $in: userAddresses } },
      ],
      indexedAt: { $gte: cutoff24h },
    });
  }

  // 5. Fetch recent webhook deliveries & map to endpoints
  const deliveries = await db
    .collection('webhook_deliveries')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const endpoints = await db
    .collection('webhook_endpoints')
    .find({ userId: user._id })
    .toArray();

  const endpointMap: Record<string, string> = {};
  for (const ep of endpoints) {
    endpointMap[ep._id.toString()] = ep.url;
  }

  // 6. EVM Block Lag: query EVM head block number via JSON-RPC
  let headBlockNumber: number | null = null;
  try {
    const evmEndpoint = process.env.EVM_RPC_URL ?? 'https://rpc.xrplevm.org';
    const rpcRes = await fetch(evmEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (rpcRes.ok) {
      const data = await rpcRes.json();
      if (data.result) {
        headBlockNumber = parseInt(data.result, 16);
      }
    }
  } catch (e) {
    console.error('Error fetching EVM block number:', e);
  }

  let lastIndexedBlock: number | null = null;
  if (userAddresses.length > 0) {
    const lastEvent = await db.collection('events').findOne(
      {
        $or: [
          { contractAddress: { $in: userAddresses } },
          { contract: { $in: userAddresses } },
        ],
      },
      { sort: { ledgerOrBlock: -1 } }
    );
    if (lastEvent && lastEvent.ledgerOrBlock !== undefined) {
      lastIndexedBlock = lastEvent.ledgerOrBlock;
    }
  }

  let blockLagText = '—';
  let blockLagStatus: 'ok' | 'warn' | 'fail' | 'neutral' = 'neutral';
  let blockLagDelta = '';

  if (headBlockNumber !== null && lastIndexedBlock !== null) {
    const diff = Math.max(0, headBlockNumber - lastIndexedBlock);
    blockLagText = `${diff} blocks`;
    blockLagStatus = diff > 50 ? 'fail' : diff > 10 ? 'warn' : 'ok';
    blockLagDelta = `Head: #${headBlockNumber.toLocaleString()}`;
  } else if (lastIndexedBlock !== null) {
    blockLagText = `—`;
    blockLagDelta = `Last: #${lastIndexedBlock.toLocaleString()}`;
  }

  // 7. Indexer Health: Ping db & check if latest event is within 15 minutes
  let indexerHealthText = '—';
  let indexerHealthStatus: 'ok' | 'warn' | 'fail' | 'neutral' = 'neutral';
  try {
    await db.command({ ping: 1 });
    const lastGlobalEvent = await db
      .collection('events')
      .findOne({}, { sort: { indexedAt: -1 } });
    if (lastGlobalEvent) {
      const lastTime = lastGlobalEvent.indexedAt ? new Date(lastGlobalEvent.indexedAt).getTime() : 0;
      const diffMin = (Date.now() - lastTime) / 60000;
      if (diffMin <= 15) {
        indexerHealthText = '100.0%';
        indexerHealthStatus = 'ok';
      } else {
        indexerHealthText = 'Degraded';
        indexerHealthStatus = 'warn';
      }
    } else {
      indexerHealthText = '100.0%';
      indexerHealthStatus = 'ok';
    }
  } catch {
    indexerHealthText = 'Offline';
    indexerHealthStatus = 'fail';
  }

  // 8. Map deliveries to Active Alerts / Incidents
  const recentIncidents = deliveries.slice(0, 10).map((d: any) => {
    const url = endpointMap[d.endpointId?.toString()] ?? '—';
    const time = formatTimeOnly(d.createdAt);

    let status: 'ok' | 'warn' | 'fail' | 'neutral' = 'neutral';
    let severityLabel = 'INFO';
    if (d.status === 'failed') {
      status = 'fail';
      severityLabel = 'CRITICAL';
    } else if (d.status === 'retrying') {
      status = 'warn';
      severityLabel = 'WARNING';
    } else if (d.status === 'success') {
      status = 'ok';
      severityLabel = 'DELIVERED';
    }

    return {
      id: d._id.toString(),
      time,
      severityLabel,
      status,
      title: `Webhook Alert: ${d.eventName}`,
      description: `URL: ${url} (HTTP ${d.httpStatus || '—'})`,
    };
  });

  // 9. Fetch recent events for stream initial load
  let initialEvents: any[] = [];
  if (userAddresses.length > 0) {
    initialEvents = await db
      .collection('events')
      .find({
        $or: [
          { contractAddress: { $in: userAddresses } },
          { contract: { $in: userAddresses } },
        ],
      })
      .sort({ indexedAt: -1 })
      .limit(30)
      .toArray();
  }

  // JSON safe parsing for clients
  const serializeMongo = (arr: any[]) =>
    arr.map((item) => JSON.parse(JSON.stringify(item)));

  return (
    <div className="space-y-8">
      {/* ── Dashboard Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-4 border-0 border-b border-solid border-ds-border/50">
        <div>
          <h1 className="font-ds-sans text-2xl font-bold tracking-tight text-ds-text">Overview</h1>
          <p className="font-ds-mono text-xs text-ds-text-3 mt-1">
            {user.email} · <span className="uppercase text-ds-green font-bold">{plan}</span>
            {' '}· {contracts.length} / {limits.maxContracts} monitored contracts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!atLimit && (
            <Button asChild variant="primary" size="md">
              <a href="/dashboard/add-contract" className="no-underline text-ds-shell font-bold">
                + Watch Contract
              </a>
            </Button>
          )}
          <BillingButtons plan={plan} />
        </div>
      </div>

      {/* ── Banners & Feedback ── */}
      {upgrade === 'success' && (
        <div className="p-4 border border-solid border-ds-green/30 bg-ds-green/5 text-ds-green text-xs font-ds-mono rounded-lg">
          🎉 Upgrade complete. Your account is now on the Pro plan.
        </div>
      )}
      {upgrade === 'cancel' && (
        <div className="p-4 border border-solid border-ds-amber/30 bg-ds-amber/5 text-ds-amber text-xs font-ds-mono rounded-lg">
          Upgrade canceled. No charges were made.
        </div>
      )}
      {atLimit && (
        <div className="p-4 border border-solid border-ds-amber/30 bg-ds-amber/5 text-ds-amber text-xs font-ds-mono rounded-lg">
          You&apos;ve reached the Free plan limit ({limits.maxContracts} contracts).{' '}
          <a href="#" className="text-ds-green underline font-bold">
            Upgrade to Pro
          </a>{' '}
          for up to {PLAN_LIMITS.pro.maxContracts}.
        </div>
      )}

      {/* ── Health Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricTile
          label="Monitored Contracts"
          value={contracts.length}
          delta={`${contracts.length}/${limits.maxContracts}`}
          status="ok"
        />
        <MetricTile
          label="Latest Block Lag"
          value={blockLagText}
          delta={blockLagDelta}
          status={blockLagStatus}
        />
        <MetricTile
          label="Active Alerts"
          value={activeAlerts}
          delta="Enabled"
          status={activeAlerts > 0 ? 'ok' : 'neutral'}
        />
        <MetricTile
          label="Failed Calls 24h"
          value={userAddresses.length > 0 ? failedCallsCount : '—'}
          delta="Errors detected"
          status={failedCallsCount > 0 ? 'fail' : 'ok'}
        />
        <MetricTile
          label="Events 24h"
          value={userAddresses.length > 0 ? events24hCount : '—'}
          delta="Indexed"
          status={events24hCount > 0 ? 'ok' : 'neutral'}
        />
        <MetricTile
          label="Indexer Health"
          value={indexerHealthText}
          delta="Worker Railway"
          status={indexerHealthStatus}
        />
      </div>

      {/* ── Middle Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
        {/* Left Column: Active Alerts & Incidents */}
        <div className="lg:col-span-5 flex flex-col min-w-0 bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden h-[418px]">
          <div className="flex justify-between items-center border-0 border-b border-solid border-ds-border px-5 py-3.5 select-none bg-ds-panel-2/10">
            <span className="font-ds-mono text-[10px] text-ds-text-3 font-bold uppercase tracking-widest">
              Active Alerts & Incidents
            </span>
            <span className="px-2 py-0.5 border border-solid border-ds-border text-ds-text-3 font-ds-mono text-[9px] rounded bg-ds-panel">
              LAST 24H
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-solid divide-ds-border/30">
            {recentIncidents.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full gap-2">
                <span className="font-ds-mono text-xs text-ds-text-3">No active incidents detected</span>
                <span className="font-ds-sans text-[11px] text-ds-text-3 max-w-[280px]">
                  All contract observation pipelines and outgoing alert integrations are running normally.
                </span>
              </div>
            ) : (
              recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="p-4 hover:bg-ds-panel-2/20 transition-all duration-100 flex flex-col gap-1 cursor-pointer group"
                >
                  <div className="flex justify-between items-center select-none">
                    <StatusChip status={incident.status} label={incident.severityLabel} />
                    <span className="font-ds-mono text-[10px] text-ds-text-3 opacity-80">
                      {incident.time}
                    </span>
                  </div>
                  <span className="font-ds-sans text-xs font-bold text-ds-text group-hover:text-ds-green transition-colors mt-0.5">
                    {incident.title}
                  </span>
                  <span className="font-ds-mono text-[10px] text-ds-text-3 truncate mt-0.5" title={incident.description}>
                    {incident.description}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Live Event Stream */}
        <div className="lg:col-span-7 flex flex-col min-w-0 h-[418px]">
          <LiveEventStream initialEvents={serializeMongo(initialEvents)} />
        </div>
      </div>

      {/* ── Bottom Column: Webhook Deliveries ── */}
      <div className="w-full">
        <WebhookDeliveriesTable
          initialDeliveries={serializeMongo(deliveries)}
          endpointMap={endpointMap}
        />
      </div>
    </div>
  );
}
