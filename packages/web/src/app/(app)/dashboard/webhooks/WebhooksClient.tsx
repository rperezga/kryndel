'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ds/DataTable';
import { StatusChip, Button, EmptyWorkbench } from '@/components/ds';
import { AddressPill } from '@/components/ds/AddressPill';
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  replayWebhookAction,
} from './actions';

interface WebhookEndpointData {
  _id: string;
  url: string;
  secretPrefix: string;
  description?: string;
  active: boolean;
  contractAddresses?: string[];
  eventNames?: string[];
  createdAt: string;
}

interface WebhookDeliveryData {
  _id: string;
  endpointId: string;
  contractAddress: string;
  eventName: string;
  payload: any;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  httpStatus?: number;
  errorMessage?: string;
  createdAt: string;
  deliveredAt?: string;
  nextRetryAt?: string;
}

interface ContractInfo {
  _id: string;
  address: string;
  name: string;
  surface: 'evm' | 'native';
}

interface Props {
  initialEndpoints: WebhookEndpointData[];
  initialDeliveries: WebhookDeliveryData[];
  contracts: ContractInfo[];
  plan: string;
  limits: any;
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) {
    return `${diffHrs}h ago`;
  }
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function WebhooksClient({
  initialEndpoints,
  initialDeliveries,
  contracts,
  plan,
  limits,
}: Props) {
  const [endpoints, setEndpoints] = useState<WebhookEndpointData[]>(initialEndpoints);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryData[]>(initialDeliveries);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Create Form State
  const [addUrl, setAddUrl] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [customEventInput, setCustomEventInput] = useState('');
  const [creationSecret, setCreationSecret] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Detail Modal State
  const [activeDetailDelivery, setActiveDetailDelivery] = useState<WebhookDeliveryData | null>(null);

  // Replay Status State (id -> boolean)
  const [replayingIds, setReplayingIds] = useState<Record<string, boolean>>({});
  const [generalFeedback, setGeneralFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isPro = plan === 'pro';

  // 1. Poll for new delivery logs every 5s (Pro only)
  useEffect(() => {
    if (!isPro) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/dashboard/webhooks/deliveries');
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.deliveries) {
          setDeliveries(data.deliveries);
        }
      } catch (err) {
        console.error('Error polling webhook deliveries:', err);
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isPro]);

  // 2. Clear notification timeouts
  useEffect(() => {
    if (generalFeedback) {
      const t = setTimeout(() => setGeneralFeedback(null), 5000);
      return () => clearTimeout(t);
    }
  }, [generalFeedback]);

  // URL Validation checks
  const isUrlValid = useMemo(() => {
    if (!addUrl) return false;
    return addUrl.startsWith('https://') && addUrl.length > 8;
  }, [addUrl]);

  // Handle create webhook
  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUrlValid) return;

    setAddError(null);
    setAddSuccess(null);
    setCreationSecret(null);

    startTransition(async () => {
      const res = await createWebhookEndpointAction(
        addUrl,
        addDesc || undefined,
        selectedContracts.length ? selectedContracts : undefined,
        selectedEvents.length ? selectedEvents : undefined
      );

      if (res.error) {
        setAddError(res.error);
      } else {
        setAddSuccess(res.success || 'Endpoint registered.');
        if (res.secret) {
          setCreationSecret(res.secret);
        }
        // Refresh endpoints list manually
        const resList = await fetch('/api/v1/webhooks', {
          headers: {
            // Wait, we don't have api key in client, but wait: we can just refresh the page data
            // actually revalidatePath does this for server side components! So we can fetch again
            // or just reload page since endpoints list updates. Let's do a hard refresh of page data:
            // or we can reload endpoints using next.js router:
          }
        });
        // A cleaner way is using router.refresh() or just updating client state.
        // Let's do a location reload or just push the new endpoint mock to client state:
        // Actually, we can fetch the list using a local route: wait, we don't have a local endpoints list GET endpoint yet,
        // but we can create one or just use location reload / router refresh:
        window.location.reload();
      }
    });
  };

  // Handle delete webhook
  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint? It will stop receiving events.')) return;
    const res = await deleteWebhookEndpointAction(id);
    if (res.error) {
      setGeneralFeedback({ type: 'error', message: res.error });
    } else {
      setGeneralFeedback({ type: 'success', message: res.success || 'Webhook endpoint deleted.' });
      setEndpoints((prev) => prev.filter((ep) => ep._id !== id));
    }
  };

  // Handle replay delivery log
  const handleReplay = async (deliveryId: string) => {
    setReplayingIds((prev) => ({ ...prev, [deliveryId]: true }));
    const res = await replayWebhookAction(deliveryId);
    setReplayingIds((prev) => ({ ...prev, [deliveryId]: false }));

    if (res.error) {
      setGeneralFeedback({ type: 'error', message: res.error });
    } else {
      setGeneralFeedback({ type: 'success', message: res.success || 'Webhook delivery replayed.' });
      // Poll instantly to fetch the new log
      try {
        const fetchRes = await fetch('/api/dashboard/webhooks/deliveries');
        if (fetchRes.ok) {
          const data = await fetchRes.json();
          if (data.deliveries) setDeliveries(data.deliveries);
        }
      } catch {}
    }
  };

  // Toggle custom event tag helper
  const addEventNameTag = () => {
    const name = customEventInput.trim();
    if (name && !selectedEvents.includes(name)) {
      setSelectedEvents((prev) => [...prev, name]);
      setCustomEventInput('');
    }
  };

  const removeEventNameTag = (name: string) => {
    setSelectedEvents((prev) => prev.filter((e) => e !== name));
  };

  // Webhook Endpoints DataTable Columns (Desktop)
  const endpointColumns: ColumnDef<WebhookEndpointData>[] = [
    {
      accessorKey: 'url',
      header: 'Webhook URL',
      cell: ({ row }) => (
        <div className="font-ds-mono text-xs font-semibold text-ds-green break-all max-w-[280px]">
          {row.original.url}
        </div>
      ),
    },
    {
      accessorKey: 'eventNames',
      header: 'Subscribed Events',
      cell: ({ row }) => {
        const ep = row.original;
        const countContracts = ep.contractAddresses?.length ?? 0;
        const countEvents = ep.eventNames?.length ?? 0;

        return (
          <div className="flex flex-col gap-1 text-[10px] font-ds-mono text-ds-text-2">
            <div>
              <span className="text-ds-text-3">Contracts: </span>
              {countContracts === 0 ? 'All Contracts' : `${countContracts} contract(s)`}
            </div>
            <div>
              <span className="text-ds-text-3">Events: </span>
              {countEvents === 0 ? 'All Events' : ep.eventNames?.join(', ')}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'secretPrefix',
      header: 'Secret Key Prefix',
      cell: ({ row }) => (
        <span className="font-ds-mono text-xs text-ds-text-3 bg-ds-panel-2 border border-solid border-ds-border px-2 py-0.5 rounded select-all">
          whsec_{row.original.secretPrefix}…
        </span>
      ),
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => (
        <StatusChip
          status={row.original.active ? 'ok' : 'neutral'}
          label={row.original.active ? 'ACTIVE' : 'PAUSED'}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <button
          onClick={() => handleDeleteEndpoint(row.original._id)}
          className="p-1 hover:text-ds-red text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none"
          title="Delete Webhook"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      ),
    },
  ];

  // Delivery Logs DataTable Columns (Desktop)
  const deliveryColumns: ColumnDef<WebhookDeliveryData>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Timestamp',
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <div className="font-ds-mono text-xs text-ds-text-2">
            {date.toLocaleDateString()} {date.toTimeString().split(' ')[0]}
          </div>
        );
      },
    },
    {
      accessorKey: 'endpointId',
      header: 'Endpoint',
      cell: ({ row }) => {
        const ep = endpoints.find((e) => e._id === row.original.endpointId);
        const url = ep ? ep.url : '—';
        return (
          <div className="font-ds-mono text-[11px] text-ds-text-3 truncate max-w-[200px]" title={url}>
            {url}
          </div>
        );
      },
    },
    {
      accessorKey: 'eventName',
      header: 'Event',
      cell: ({ row }) => (
        <span className="font-ds-mono text-[10px] font-bold text-ds-green uppercase tracking-wide">
          {row.original.eventName}
        </span>
      ),
    },
    {
      accessorKey: 'httpStatus',
      header: 'HTTP Status',
      cell: ({ row }) => {
        const d = row.original;
        const code = d.httpStatus;
        const isOk = code && code >= 200 && code < 300;

        return (
          <StatusChip
            status={isOk ? 'ok' : d.status === 'retrying' ? 'warn' : 'fail'}
            label={code ? `HTTP ${code}` : d.status.toUpperCase()}
          />
        );
      },
    },
    {
      id: 'latency',
      header: 'Latency',
      cell: ({ row }) => {
        const d = row.original;
        if (!d.deliveredAt || !d.createdAt) return <span className="font-ds-mono text-xs text-ds-text-3">—</span>;
        const diff = new Date(d.deliveredAt).getTime() - new Date(d.createdAt).getTime();
        return <span className="font-ds-mono text-xs text-ds-text-2 font-medium">{diff} ms</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Retry State',
      cell: ({ row }) => {
        const d = row.original;
        if (d.status === 'retrying') {
          return (
            <div className="flex flex-col gap-0.5 text-[9px] font-ds-mono text-ds-amber">
              <span className="font-bold">RETRY ATTEMPT {d.attempt}/6</span>
              <span className="text-[8px] text-ds-text-3">Next: {formatRelativeTime(d.nextRetryAt)}</span>
            </div>
          );
        }
        if (d.status === 'failed') {
          return (
            <span className="font-ds-mono text-[9px] text-ds-red font-bold">
              FAILED ({d.attempt} ATTEMPTS)
            </span>
          );
        }
        return <span className="font-ds-mono text-[9px] text-ds-text-3 select-none">No Retries</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const d = row.original;
        const isReplaying = !!replayingIds[d._id];

        return (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleReplay(d._id)}
              disabled={isReplaying}
              className="p-1 hover:text-ds-green text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none disabled:opacity-50"
              title="Replay Webhook Payload"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isReplaying ? 'sync' : 'replay'}
              </span>
            </button>
            <button
              onClick={() => setActiveDetailDelivery(d)}
              className="p-1 hover:text-ds-green text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none"
              title="View Raw Payload & Signature info"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      {/* Slide-over sheet styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes term-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: term-slide-in 0.2s ease-out forwards;
        }
      ` }} />

      {/* General Notification Feedback */}
      {generalFeedback && (
        <div className={`p-4 border border-solid rounded-lg font-ds-mono text-xs flex justify-between items-center ${
          generalFeedback.type === 'success'
            ? 'bg-ds-green/5 border-ds-green/30 text-ds-green'
            : 'bg-ds-red/5 border-ds-red/30 text-ds-red'
        }`}>
          <span>{generalFeedback.message}</span>
          <button
            onClick={() => setGeneralFeedback(null)}
            className="bg-transparent border-none text-ds-text-3 hover:text-ds-text font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* ── TOP SECTION: ENDPOINTS LIST ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none pb-2">
          <div>
            <h2 className="font-ds-sans text-lg font-bold text-ds-text m-0">Webhook Endpoints</h2>
            <p className="font-ds-mono text-[10px] text-ds-text-3 mt-1 m-0">
              Outbound hooks active: {endpoints.length} / 10 endpoints
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            disabled={!isPro}
            onClick={() => setIsAddSheetOpen(true)}
            className="font-ds-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(43,217,111,0.25)] h-[36px] px-5 select-none"
          >
            + Register Webhook
          </Button>
        </div>

        {/* Free Plan Lock Banner */}
        {!isPro && (
          <div className="bg-ds-panel border border-solid border-ds-amber/30 rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg select-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-ds-amber font-bold font-ds-mono text-xs uppercase">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Pro Feature Only
              </div>
              <p className="font-ds-sans text-sm text-ds-text-2 leading-relaxed m-0 max-w-xl">
                Outbound webhooks signed with HMAC-SHA256 signatures are exclusive to Pro plan workspace directories. Upgrade to integrate custom decoders with external servers.
              </p>
            </div>
            <a
              href="/pricing"
              className="inline-block border border-solid border-ds-amber text-ds-amber bg-transparent font-ds-mono text-xs font-bold px-6 py-2.5 hover:bg-ds-amber/10 rounded transition-all text-center no-underline"
            >
              UPGRADE TO PRO
            </a>
          </div>
        )}

        {isPro && endpoints.length === 0 ? (
          <EmptyWorkbench
            title="No webhook endpoints configured"
            description="Register a secure HTTPS destination URL to receive signed JSON payloads containing smart contract activities and decoded events in real-time."
            actionLabel="Register Webhook"
            onActionClick={() => setIsAddSheetOpen(true)}
          />
        ) : (
          isPro && (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
                <DataTable
                  columns={endpointColumns}
                  data={endpoints}
                  emptyTitle="No endpoints active"
                  emptyDescription="Deploy a secure HTTPS url to begin."
                />
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-4">
                {endpoints.map((ep) => (
                  <div
                    key={ep._id}
                    className="bg-ds-panel border border-solid border-ds-border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2 select-none">
                      <StatusChip
                        status={ep.active ? 'ok' : 'neutral'}
                        label={ep.active ? 'ACTIVE' : 'PAUSED'}
                      />
                      <button
                        onClick={() => handleDeleteEndpoint(ep._id)}
                        className="text-ds-text-3 hover:text-ds-red bg-transparent border-0 cursor-pointer outline-none"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>

                    <div className="space-y-2 border-0 border-t border-solid border-ds-border/30 pt-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-ds-text-3 font-ds-mono text-[9px] uppercase tracking-wider font-bold">URL</span>
                        <span className="font-ds-mono text-xs text-ds-green break-all font-semibold">{ep.url}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-ds-text-3 font-ds-mono text-[9px] uppercase tracking-wider font-bold">Secret Prefix</span>
                        <span className="font-ds-mono text-xs text-ds-text-2">whsec_{ep.secretPrefix}…</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-ds-text-3 font-ds-mono text-[9px] uppercase tracking-wider font-bold">Subscription Scope</span>
                        <span className="font-ds-mono text-[10px] text-ds-text-2">
                          {(ep.contractAddresses?.length ?? 0) === 0 ? 'All Contracts' : `${ep.contractAddresses?.length} contracts`}
                          {' · '}
                          {(ep.eventNames?.length ?? 0) === 0 ? 'All Events' : ep.eventNames?.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </section>

      {/* ── BOTTOM SECTION: DELIVERY ATTEMPTS LOG ── */}
      {isPro && (
        <section className="space-y-4 pt-6 border-0 border-t border-solid border-ds-border/50">
          <div>
            <h2 className="font-ds-sans text-lg font-bold text-ds-text m-0">Recent Webhook Deliveries</h2>
            <p className="font-ds-mono text-[10px] text-ds-text-3 mt-1 m-0">
              Last 50 signed event delivery logs and retry traces
            </p>
          </div>

          {deliveries.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-ds-border rounded-lg text-ds-text-3 font-ds-mono text-xs select-none">
              No delivery logs registered yet. Deliveries will populate here once smart contract events are detected.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
                <DataTable
                  columns={deliveryColumns}
                  data={deliveries}
                  emptyTitle="No logs available"
                  emptyDescription="Logs appear here as transactions index."
                />
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-4">
                {deliveries.map((d) => {
                  const ep = endpoints.find((e) => e._id === d.endpointId);
                  const isOk = d.httpStatus && d.httpStatus >= 200 && d.httpStatus < 300;
                  const date = new Date(d.createdAt);
                  const isReplaying = !!replayingIds[d._id];

                  return (
                    <div
                      key={d._id}
                      className="bg-ds-panel border border-solid border-ds-border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex justify-between items-center select-none">
                        <span className="font-ds-mono text-[10px] font-bold text-ds-green uppercase tracking-wide">
                          {d.eventName}
                        </span>
                        <StatusChip
                          status={isOk ? 'ok' : d.status === 'retrying' ? 'warn' : 'fail'}
                          label={d.httpStatus ? `HTTP ${d.httpStatus}` : d.status.toUpperCase()}
                        />
                      </div>

                      <div className="space-y-2 border-0 border-t border-b border-solid border-ds-border/30 py-3 text-xs font-ds-mono">
                        <div className="flex justify-between">
                          <span className="text-ds-text-3 uppercase text-[9px] tracking-wider font-bold">Endpoint URL</span>
                          <span className="text-ds-text-2 truncate max-w-[200px]" title={ep?.url}>{ep?.url || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ds-text-3 uppercase text-[9px] tracking-wider font-bold">Timestamp</span>
                          <span className="text-ds-text-2">{date.toLocaleDateString()} {date.toTimeString().split(' ')[0]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ds-text-3 uppercase text-[9px] tracking-wider font-bold">Latency</span>
                          <span className="text-ds-text-2">
                            {d.deliveredAt ? `${new Date(d.deliveredAt).getTime() - date.getTime()} ms` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ds-text-3 uppercase text-[9px] tracking-wider font-bold">Retry State</span>
                          <span className={d.status === 'retrying' ? 'text-ds-amber font-bold' : d.status === 'failed' ? 'text-ds-red font-bold' : 'text-ds-text-3'}>
                            {d.status === 'retrying' ? `RETRY ${d.attempt}/6` : d.status === 'failed' ? 'FAILED' : 'No retries'}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end items-center gap-4 pt-1 select-none">
                        <button
                          onClick={() => handleReplay(d._id)}
                          disabled={isReplaying}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-solid border-ds-border bg-transparent text-ds-text-2 hover:border-ds-green hover:text-ds-green text-xs font-ds-mono transition-all outline-none"
                        >
                          <span className="material-symbols-outlined text-[14px]">replay</span>
                          Replay
                        </button>
                        <button
                          onClick={() => setActiveDetailDelivery(d)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-solid border-ds-border bg-transparent text-ds-text-2 hover:border-ds-green hover:text-ds-green text-xs font-ds-mono transition-all outline-none"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          Payload
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── SECURITY INFO CARD ── */}
      <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 space-y-3 select-none">
        <h3 className="font-ds-sans text-sm font-bold text-ds-text flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-ds-green">security</span>
          Signature Verification Protocol
        </h3>
        <p className="font-ds-sans text-xs text-ds-text-2 leading-relaxed m-0">
          Kryndel signs all outbound webhook payloads to prevent spoofing. Every POST request includes a signature header <code>X-Kryndel-Signature</code> (computed using HMAC-SHA256) and a timestamp <code>X-Kryndel-Timestamp</code> (UNIX millisecond epoch).
        </p>
        <p className="font-ds-sans text-xs text-ds-text-2 leading-relaxed m-0">
          Your server should compute the HMAC-SHA256 signature on the raw JSON body using your secret key and assert it matches the request header signature, verifying within a standard drift window (e.g. &lt; 5 minutes) to mitigate replay attacks.
        </p>
      </section>

      {/* ── MODAL DRAWER: REGISTER NEW WEBHOOK ENDPOINT ── */}
      {isAddSheetOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
          {/* Backdrop Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => {
              setIsAddSheetOpen(false);
              setCreationSecret(null);
              setAddSuccess(null);
            }}
          />

          {/* Drawer Content Area */}
          <div className="relative w-full max-w-[460px] bg-ds-panel border-0 border-l border-solid border-ds-border flex flex-col h-full shadow-2xl animate-slide-in z-10 font-ds-sans">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-0 border-b border-solid border-ds-border select-none">
              <h2 className="font-ds-sans text-base font-bold text-ds-text m-0">
                Register Webhook Endpoint
              </h2>
              <button
                onClick={() => {
                  setIsAddSheetOpen(false);
                  setCreationSecret(null);
                  setAddSuccess(null);
                }}
                className="bg-transparent border-0 text-ds-text-3 hover:text-ds-text text-xl cursor-pointer outline-none"
              >
                &times;
              </button>
            </div>

            {/* Form & Content View */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col custom-scrollbar">
              {addSuccess && (
                <div className="space-y-4">
                  <div className="p-3 border border-solid border-ds-green/30 bg-ds-green/5 text-ds-green text-xs font-ds-mono rounded">
                    {addSuccess}
                  </div>

                  {creationSecret && (
                    <div className="p-4 border border-solid border-ds-green/40 bg-ds-shell rounded space-y-3">
                      <div className="text-[10px] font-ds-mono text-ds-green font-bold uppercase tracking-wider">
                        🔐 HMAC SHA-256 SECRET KEY (SHOWN ONCE)
                      </div>
                      <p className="text-[10px] text-ds-text-2 leading-relaxed m-0">
                        Copy this secret key to verify request signatures on your webhook receivers. You cannot view it again.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={creationSecret}
                          className="flex-1 bg-ds-panel border border-solid border-ds-border rounded p-2 text-xs font-ds-mono text-ds-text outline-none select-all"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(creationSecret);
                            alert('Webhook secret copied to clipboard!');
                          }}
                          className="px-3 py-2 border border-solid border-ds-green text-ds-green hover:bg-ds-green/10 text-xs font-ds-mono rounded cursor-pointer transition-all uppercase font-bold outline-none"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setIsAddSheetOpen(false);
                      setCreationSecret(null);
                      setAddSuccess(null);
                    }}
                    className="w-full font-ds-mono text-xs uppercase"
                  >
                    Done
                  </Button>
                </div>
              )}

              {!addSuccess && (
                <form onSubmit={handleCreateWebhook} className="space-y-5 flex flex-col flex-1 m-0">
                  {/* URL */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                      Destination Webhook URL
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        required
                        value={addUrl}
                        onChange={(e) => setAddUrl(e.target.value)}
                        placeholder="https://yourserver.com/webhooks"
                        className={`w-full bg-ds-shell border border-solid rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none pr-24 ${
                          addUrl
                            ? isUrlValid
                              ? 'border-ds-green/50'
                              : 'border-ds-red/50'
                            : 'border-ds-border'
                        }`}
                      />
                      {addUrl && (
                        <div className="absolute right-3 top-3.5 text-[9px] font-ds-mono uppercase font-bold">
                          {isUrlValid ? (
                            <span className="text-ds-green">✓ HTTPS URL</span>
                          ) : (
                            <span className="text-ds-red">✕ HTTPS required</span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-ds-text-3 font-ds-sans leading-relaxed m-0">
                      Destination endpoint must use secure HTTPS protocol to safeguard payloads.
                    </p>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                      Description <span className="lowercase font-normal text-ds-text-3">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={addDesc}
                      onChange={(e) => setAddDesc(e.target.value)}
                      placeholder="e.g. Primary server events receiver"
                      className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-sans text-ds-text focus:border-ds-green outline-none"
                    />
                  </div>

                  {/* Contracts Boundaries */}
                  <div className="space-y-2 select-none">
                    <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                      Filter Contracts <span className="lowercase font-normal text-ds-text-3">(default: All user contracts)</span>
                    </label>
                    <div className="bg-ds-shell border border-solid border-ds-border rounded p-3 space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                      {contracts.length === 0 ? (
                        <span className="text-[10px] font-ds-mono text-ds-text-3">No monitored contracts configured.</span>
                      ) : (
                        contracts.map((c) => {
                          const isChecked = selectedContracts.includes(c.address.toLowerCase());
                          return (
                            <label key={c._id} className="flex items-center gap-2 cursor-pointer text-xs font-ds-mono text-ds-text-2 hover:text-ds-text">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const key = c.address.toLowerCase();
                                  setSelectedContracts((prev) =>
                                    isChecked ? prev.filter((addr) => addr !== key) : [...prev, key]
                                  );
                                }}
                                className="accent-ds-green cursor-pointer"
                              />
                              <span className="truncate">{c.name || 'Unnamed'} ({c.address.slice(0, 6)}…)</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Events Boundaries */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                      Subscribed Events <span className="lowercase font-normal text-ds-text-3">(default: All events)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customEventInput}
                        onChange={(e) => setCustomEventInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addEventNameTag();
                          }
                        }}
                        placeholder="e.g. Transfer, OrderFilled"
                        className="flex-1 bg-ds-shell border border-solid border-ds-border rounded p-2.5 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none"
                      />
                      <button
                        type="button"
                        onClick={addEventNameTag}
                        className="px-3 border border-solid border-ds-border hover:border-ds-green text-ds-text-2 hover:text-ds-green text-xs font-ds-mono rounded cursor-pointer outline-none uppercase font-bold"
                      >
                        Add
                      </button>
                    </div>

                    {/* Tag list */}
                    {selectedEvents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedEvents.map((name) => (
                          <span
                            key={name}
                            className="bg-ds-panel-2 border border-solid border-ds-border rounded-full px-2 py-0.5 text-[9px] font-ds-mono text-ds-green font-bold flex items-center gap-1.5 select-none"
                          >
                            {name}
                            <button
                              type="button"
                              onClick={() => removeEventNameTag(name)}
                              className="bg-transparent border-0 text-ds-text-3 hover:text-ds-red cursor-pointer p-0 font-bold outline-none"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {addError && (
                    <div className="p-3 border border-solid border-ds-red/30 bg-ds-red/5 text-ds-red text-xs font-ds-mono rounded">
                      {addError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto pt-6 border-0 border-t border-solid border-ds-border flex gap-3 select-none">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsAddSheetOpen(false)}
                      className="flex-1 font-ds-mono text-xs uppercase"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isPending || !isUrlValid}
                      className="flex-1 font-ds-mono text-xs uppercase"
                    >
                      {isPending ? 'Registering…' : 'Register Webhook'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DIALOG: VIEW RAW DELIVERY DETAIL PAYLOAD ── */}
      {activeDetailDelivery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ds-shell/80 backdrop-blur-xs select-none">
          <div className="fixed inset-0" onClick={() => setActiveDetailDelivery(null)} />

          <div className="relative bg-ds-panel border border-solid border-ds-border w-full max-w-[580px] rounded-lg shadow-2xl overflow-hidden font-ds-sans z-10 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-0 border-b border-solid border-ds-border px-5 py-4">
              <h3 className="font-ds-sans text-sm font-bold text-ds-text m-0 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-ds-green">code</span>
                Webhook Attempt Details
              </h3>
              <button
                onClick={() => setActiveDetailDelivery(null)}
                className="bg-transparent border-0 text-ds-text-3 hover:text-ds-text text-lg cursor-pointer outline-none"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-5">
              {/* Event & HTTP Status */}
              <div className="flex justify-between items-center bg-ds-panel-2 border border-solid border-ds-border rounded p-3 text-xs font-ds-mono">
                <div>
                  <span className="text-ds-text-3 uppercase text-[9px] tracking-wider font-bold">Event: </span>
                  <span className="text-ds-green font-bold uppercase">{activeDetailDelivery.eventName}</span>
                </div>
                <div>
                  <span className="text-ds-text-3 uppercase text-[9px] tracking-wider font-bold">Status: </span>
                  <span className={activeDetailDelivery.status === 'success' ? 'text-ds-green font-bold' : activeDetailDelivery.status === 'retrying' ? 'text-ds-amber font-bold' : 'text-ds-red font-bold'}>
                    {activeDetailDelivery.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Error messages if any */}
              {activeDetailDelivery.errorMessage && (
                <div className="p-3 border border-solid border-ds-red/30 bg-ds-red/5 text-ds-red text-xs font-ds-mono rounded">
                  <span className="font-bold">Error Message:</span> {activeDetailDelivery.errorMessage}
                </div>
              )}

              {/* Raw JSON Payload */}
              <div className="space-y-1">
                <div className="text-[10px] font-ds-mono text-ds-text-3 font-bold uppercase tracking-wider">
                  Raw JSON Payload
                </div>
                <div className="bg-ds-shell border border-solid border-ds-border rounded p-3 overflow-x-auto select-text">
                  <pre className="font-ds-mono text-[11px] text-ds-text-2 m-0 leading-relaxed max-w-full">
                    {JSON.stringify(activeDetailDelivery.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="border-0 border-t border-solid border-ds-border px-5 py-4 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setActiveDetailDelivery(null)}
                className="font-ds-mono text-xs uppercase"
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
