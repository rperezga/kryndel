'use client';

import { useState } from 'react';

// ── Code block with copy button ───────────────────────────────────────────────
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-6 rounded-lg overflow-hidden border border-solid border-ds-border bg-ds-panel">
      <div className="flex items-center justify-between px-4 py-2 border-b border-solid border-ds-border">
        <span className="font-ds-mono text-xs text-ds-text-3">{language}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-ds-text-3 hover:text-ds-green transition-colors font-ds-mono text-xs bg-transparent border-0 cursor-pointer outline-none focus-visible:text-ds-green"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 font-ds-mono text-xs text-ds-green/90 leading-relaxed overflow-x-auto bg-ds-shell select-all m-0">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── API endpoint data ─────────────────────────────────────────────────────────
type Method = 'GET' | 'POST' | 'DELETE';

interface Endpoint {
  method: Method;
  path: string;
  summary: string;
  auth: boolean;
  params?: string[];
  response: string;
}

const API_ENDPOINTS: { group: string; items: Endpoint[] }[] = [
  {
    group: 'Identity',
    items: [
      { method: 'GET', path: '/api/v1/me', summary: 'Get current user info', auth: true, response: '{ plan, contractLimit, email, createdAt }' },
    ],
  },
  {
    group: 'Contracts',
    items: [
      { method: 'GET',    path: '/api/v1/contracts',     summary: 'List watched contracts',          auth: true, response: '[{ address, label, chainId, createdAt }]' },
      { method: 'GET',    path: '/api/v1/events',        summary: 'List events across all contracts', auth: true, params: ['limit', 'skip', 'contractAddress'], response: '[{ name, args, txHash, indexedAt }]' },
      { method: 'GET',    path: '/api/v1/contracts/:address/events', summary: 'List events for a contract', auth: true, params: ['address', 'limit', 'skip'], response: '[{ name, args, txHash, indexedAt }]' },
      { method: 'GET',    path: '/api/v1/contracts/:address/rules',  summary: 'List alert rules for a contract', auth: true, params: ['address'], response: '[{ id, eventName, channel, condition }]' },
    ],
  },
  {
    group: 'Webhooks',
    items: [
      { method: 'GET',    path: '/api/v1/webhooks',           summary: 'List outbound webhook endpoints',          auth: true, response: '[{ id, url, secret, createdAt }]' },
      { method: 'POST',   path: '/api/v1/webhooks',           summary: 'Create outbound webhook endpoint',         auth: true, response: '{ id, url, secret }' },
      { method: 'DELETE', path: '/api/v1/webhooks/:id',       summary: 'Revoke a webhook endpoint',                auth: true, params: ['id'], response: '{ ok: true }' },
      { method: 'GET',    path: '/api/v1/webhooks/:id/deliveries', summary: 'List recent deliveries for a webhook', auth: true, params: ['id', 'limit'], response: '[{ status, payload, deliveredAt }]' },
    ],
  },
  {
    group: 'Meta',
    items: [
      { method: 'GET', path: '/api/v1/openapi.json', summary: 'OpenAPI 3.1 specification', auth: false, response: 'OpenAPI JSON document' },
    ],
  },
];

const METHOD_STYLE: Record<Method, string> = {
  GET:    'bg-ds-green/10 text-ds-green border-ds-green/30',
  POST:   'bg-ds-amber/10 text-ds-amber border-ds-amber/30',
  DELETE: 'bg-ds-red/10 text-ds-red border-ds-red/30',
};

function MethodBadge({ method }: { method: Method }) {
  return (
    <span className={`font-ds-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-solid shrink-0 ${METHOD_STYLE[method]}`}>
      {method === 'DELETE' ? 'DEL' : method}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DocsClient() {
  const [activeTab, setActiveTab] = useState<string>('getting-started');
  const [openEndpoint, setOpenEndpoint] = useState<string | null>(null);

  const NavBtn = ({ id, label }: { id: string; label: string }) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full text-left py-1.5 pl-3 text-xs font-ds-mono bg-transparent border-0 border-l-2 border-solid cursor-pointer transition-colors focus-visible:outline-none ${
          active
            ? 'border-ds-green text-ds-green'
            : 'border-transparent text-ds-text-3 hover:text-ds-text-2 hover:border-ds-text-3'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="wrap" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
      <div className="flex gap-12">

        {/* Sidebar — always visible */}
        <aside className="w-52 shrink-0 hidden md:block">
          <div className="sticky top-[80px]">
            <div className="mb-8">
              <p className="font-ds-mono text-[10px] text-ds-green/60 uppercase tracking-widest font-bold mb-1">Documentation</p>
              <p className="font-ds-mono text-[10px] text-ds-text-3">v0.4.0 Stable</p>
            </div>
            <nav className="space-y-6">
              <div>
                <p className="font-ds-mono text-[9px] text-ds-text-3/60 uppercase tracking-widest mb-2 font-bold">Platform</p>
                <div className="flex flex-col gap-0.5">
                  <NavBtn id="getting-started" label="Getting started" />
                  <NavBtn id="xrpl-evm"        label="XRPL EVM" />
                  <NavBtn id="xls-0101"         label="XLS-0101" />
                </div>
              </div>
              <div>
                <p className="font-ds-mono text-[9px] text-ds-text-3/60 uppercase tracking-widest mb-2 font-bold">Data Ingestion</p>
                <div className="flex flex-col gap-0.5">
                  <NavBtn id="webhooks" label="Webhooks Signing" />
                </div>
              </div>
              <div>
                <p className="font-ds-mono text-[9px] text-ds-text-3/60 uppercase tracking-widest mb-2 font-bold">Reference</p>
                <div className="flex flex-col gap-0.5">
                  <NavBtn id="api-reference" label="API Reference" />
                </div>
              </div>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">

          {/* Mobile nav select */}
          <div className="block md:hidden mb-6">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full bg-ds-panel border border-solid border-ds-border text-ds-text rounded px-3 py-2 font-ds-mono text-sm outline-none focus:border-ds-green"
            >
              <option value="getting-started">Platform: Getting started</option>
              <option value="xrpl-evm">Platform: XRPL EVM</option>
              <option value="xls-0101">Platform: XLS-0101</option>
              <option value="webhooks">Data Ingestion: Webhooks Signing</option>
              <option value="api-reference">Reference: API Reference</option>
            </select>
          </div>

          <article className="max-w-3xl">

            {/* ── Getting started ── */}
            {activeTab === 'getting-started' && (
              <div>
                <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-4">Introduction to High-Frequency Observability</h1>
                <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
                  Kryndel provides sub-millisecond visibility into the XRP Ledger. Our API is designed for institutions requiring low-latency transaction confirmation and real-time ledger state updates.
                </p>
                <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-solid border-ds-border pb-1">Quickstart</h2>
                <p className="text-ds-text-2 text-sm mb-4">Initialize the client with your API key and subscribe to the ledger stream.</p>
                <CodeBlock language="javascript" code={`import { KryndelClient } from '@kryndel/sdk';

const sdk = new KryndelClient({
  apiKey: process.env.KRYNDEL_API_KEY,
  environment: 'mainnet'
});

await sdk.subscribe(['transactions', 'ledger'], (event) => {
  console.log(\`New Event: \${event.id}\`);
});`} />
                <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-solid border-ds-border pb-1">Authentication</h2>
                <p className="text-ds-text-2 text-sm mb-4">
                  All REST API requests require a Bearer token in the{' '}
                  <code className="bg-ds-panel px-1.5 py-0.5 rounded text-ds-green font-ds-mono text-xs">Authorization</code> header.
                  Manage keys in the Kryndel Console under the Security tab.
                </p>
                <div className="bg-ds-green/5 border-l-4 border-solid border-ds-green p-4 my-6 rounded-r">
                  <p className="font-ds-mono text-[10px] text-ds-green uppercase tracking-wider font-bold mb-2">Note</p>
                  <p className="text-xs text-ds-text-2 italic">
                    For heavy streaming workloads, use our WebSocket endpoints to avoid rate-limiting overhead from REST polling.
                  </p>
                </div>
              </div>
            )}

            {/* ── XRPL EVM ── */}
            {activeTab === 'xrpl-evm' && (
              <div>
                <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-4">Observability on XRPL EVM Sidechain</h1>
                <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
                  Kryndel indexes contracts deployed on the XRPL EVM Sidechain mainnet. Our pipeline processes block events, traces method executions, and issues alerts in real time.
                </p>
                <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-solid border-ds-border pb-1">Polling Logs</h2>
                <p className="text-ds-text-2 text-sm mb-4">
                  Since some EVM endpoints reject direct WS log subscriptions, Kryndel polls <code className="bg-ds-panel px-1 py-0.5 rounded text-ds-green font-ds-mono text-xs">eth_getLogs</code> every 4 seconds with efficient client-side filtering.
                </p>
                <CodeBlock language="javascript" code={`const logs = await sdk.evm.getLogs({
  address: '0x2585B2226939DB7cb543eE8b1187bD3212e8A84D',
  event: 'Transfer(address,address,uint256)',
  fromBlock: 'latest'
});`} />
                <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-solid border-ds-border pb-1">Decoding EVM Logs</h2>
                <p className="text-ds-text-2 text-sm mb-4">
                  Kryndel uses <code className="bg-ds-panel px-1 py-0.5 rounded text-ds-green font-ds-mono text-xs">viem</code> to decode events and inputs against contract ABIs — exact method parameters and event arguments without manual hex parsing.
                </p>
              </div>
            )}

            {/* ── XLS-0101 ── */}
            {activeTab === 'xls-0101' && (
              <div>
                <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-4">Native Smart Contracts (XLS-0101)</h1>
                <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
                  XLS-0101 introduces WASM-based hooks execution directly inside the XRP Ledger. Kryndel includes built-in watchers for native contract transactions.
                </p>
                <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-solid border-ds-border pb-1">Hook Execution Watcher</h2>
                <CodeBlock language="javascript" code={`const nativeWatcher = sdk.native.createWatcher({
  endpoint: 'wss://alphanet.nerdnest.xyz',
  contractTypes: ['HookSet', 'Payment', 'Invoke']
});

nativeWatcher.on('hook_exec', (trace) => {
  console.log('Hook Executed:', trace.result);
});`} />
                <div className="bg-ds-amber/5 border-l-4 border-solid border-ds-amber p-4 my-6 rounded-r">
                  <p className="font-ds-mono text-[10px] text-ds-amber uppercase tracking-wider font-bold mb-2">Status Alert</p>
                  <p className="text-xs text-ds-text-2 italic">
                    Public AlphaNet RPC nodes occasionally encounter outages. Check the Status page for current sync status.
                  </p>
                </div>
              </div>
            )}

            {/* ── Webhooks ── */}
            {activeTab === 'webhooks' && (
              <div>
                <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-4">Webhook Signature Verification</h1>
                <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
                  Kryndel sends webhook payloads as JSON POST requests to your callback URLs. Verify each webhook was signed by Kryndel to protect against spoofing.
                </p>
                <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-solid border-ds-border pb-1">Signature Header</h2>
                <p className="text-ds-text-2 text-sm mb-4">
                  Each request contains <code className="bg-ds-panel px-1 py-0.5 rounded text-ds-green font-ds-mono text-xs">X-Kryndel-Signature</code> with a timestamp and SHA-256 HMAC:
                </p>
                <pre className="p-3 font-ds-mono text-xs bg-ds-panel rounded border border-solid border-ds-border text-ds-text-2 mb-6 overflow-x-auto">
                  X-Kryndel-Signature: t=1782012839,v1=sha256_hash_value
                </pre>
                <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-solid border-ds-border pb-1">Verification Example</h2>
                <CodeBlock language="javascript" code={`import crypto from 'crypto';

function verifySignature(payload, signatureHeader, secret) {
  const parts = signatureHeader.split(',');
  const t = parts.find(p => p.startsWith('t=')).split('=')[1];
  const sig = parts.find(p => p.startsWith('v1=')).split('=')[1];

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${t}.\${payload}\`)
    .digest('hex');

  return expected === sig;
}`} />
              </div>
            )}

            {/* ── API Reference (custom, no Redoc) ── */}
            {activeTab === 'api-reference' && (
              <div>
                <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
                  <div>
                    <p className="mkt-eyebrow mb-2">Reference</p>
                    <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-2">REST API v1</h1>
                    <p className="text-ds-text-2 text-sm">Observability and alerting API for XRPL EVM Sidechain and XLS-0101 native contracts.</p>
                  </div>
                  <a
                    href="/api/v1/openapi.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 border border-solid border-ds-border text-ds-text-2 hover:border-ds-green hover:text-ds-green font-ds-mono text-xs rounded transition-colors no-underline"
                  >
                    openapi.json ↗
                  </a>
                </div>

                {/* Auth note */}
                <div className="bg-ds-green/5 border-l-4 border-solid border-ds-green p-4 mb-8 rounded-r">
                  <p className="font-ds-mono text-[10px] text-ds-green uppercase tracking-wider font-bold mb-1">Authentication</p>
                  <p className="text-xs text-ds-text-2">
                    All endpoints (except <code className="text-ds-green font-ds-mono">/api/v1/openapi.json</code>) require{' '}
                    <code className="text-ds-green font-ds-mono">Authorization: Bearer &lt;api_key&gt;</code>
                  </p>
                </div>

                {/* Endpoint groups */}
                <div className="space-y-8">
                  {API_ENDPOINTS.map((group) => (
                    <section key={group.group}>
                      <h2 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest font-bold mb-3 pb-2 border-b border-solid border-ds-border">
                        {group.group}
                      </h2>
                      <div className="space-y-2">
                        {group.items.map((ep) => {
                          const key = `${ep.method}-${ep.path}`;
                          const isOpen = openEndpoint === key;
                          return (
                            <div key={key} className="border border-solid border-ds-border rounded-lg overflow-hidden">
                              <button
                                onClick={() => setOpenEndpoint(isOpen ? null : key)}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-transparent hover:bg-ds-panel-2 transition-colors cursor-pointer border-0 text-left"
                              >
                                <MethodBadge method={ep.method} />
                                <code className="font-ds-mono text-xs text-ds-text flex-1 min-w-0 truncate">{ep.path}</code>
                                <span className="text-ds-text-2 text-xs hidden sm:block shrink-0">{ep.summary}</span>
                                <span className="text-ds-text-3 font-ds-mono text-[10px] shrink-0 ml-auto">{isOpen ? '↑' : '↓'}</span>
                              </button>

                              {isOpen && (
                                <div className="border-t border-solid border-ds-border bg-ds-panel px-4 py-4 space-y-4">
                                  <p className="text-ds-text-2 text-sm">{ep.summary}</p>
                                  {ep.auth && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-ds-mono text-[9px] text-ds-amber uppercase tracking-wider">Auth required</span>
                                      <span className="font-ds-mono text-[9px] text-ds-text-3">Bearer token</span>
                                    </div>
                                  )}
                                  {ep.params && ep.params.length > 0 && (
                                    <div>
                                      <p className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider mb-2">Parameters</p>
                                      <div className="flex flex-wrap gap-2">
                                        {ep.params.map(p => (
                                          <code key={p} className="font-ds-mono text-[10px] text-ds-green bg-ds-shell px-2 py-0.5 rounded border border-solid border-ds-border">{p}</code>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider mb-2">Response shape</p>
                                    <pre className="font-ds-mono text-[11px] text-ds-green/80 bg-ds-shell px-3 py-2 rounded border border-solid border-ds-border overflow-x-auto m-0">{ep.response}</pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="mt-10 pt-6 border-t border-solid border-ds-border">
                  <p className="text-ds-text-3 text-xs font-ds-mono">
                    Full schema available at{' '}
                    <a href="/api/v1/openapi.json" className="text-ds-green hover:underline" target="_blank" rel="noopener noreferrer">
                      /api/v1/openapi.json
                    </a>
                    {' '}— compatible with Postman, Insomnia, and any OpenAPI 3.1 client.
                  </p>
                </div>
              </div>
            )}

          </article>
        </main>
      </div>
    </div>
  );
}
