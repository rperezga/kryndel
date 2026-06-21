'use client';

import { useEffect, useRef, useState } from 'react';

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-lg overflow-hidden border border-ds-border bg-ds-panel relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-ds-border bg-white/5">
        <div className="flex items-center gap-2">
          <span className="font-ds-mono text-xs text-ds-text-3">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-ds-text-3 hover:text-ds-green transition-colors flex items-center gap-1 font-ds-mono text-xs outline-none focus:text-ds-green"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 font-ds-mono text-xs text-ds-green/90 leading-relaxed overflow-x-auto bg-ds-shell select-all">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DocsClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>('getting-started');

  useEffect(() => {
    if (activeTab !== 'api-reference') return;

    let isMounted = true;

    function initRedoc() {
      // @ts-expect-error — Redoc is loaded via script global
      if (typeof Redoc === 'undefined' || !containerRef.current || !isMounted) return;
      // @ts-expect-error
      Redoc.init(
        '/api/v1/openapi.json',
        {
          theme: {
            colors: {
              primary: { main: '#2bd96f' },
              text: { primary: '#e8f5ec', secondary: '#92a99a' },
            },
            typography: {
              fontSize: '14px',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              headings: { fontFamily: 'var(--font-inter), system-ui, sans-serif' },
              code: { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '13px' },
            },
            sidebar: {
              backgroundColor: '#090d0a',
              textColor: '#92a99a',
            },
            rightPanel: {
              backgroundColor: '#050706',
            },
          },
          hideDownloadButton: false,
          disableSearch: false,
          expandResponses: '200,201',
          nativeScrollbars: false,
        },
        containerRef.current,
      );
    }

    if (document.getElementById('redoc-script')) {
      const timeoutId = setTimeout(initRedoc, 50);
      return () => {
        isMounted = false;
        clearTimeout(timeoutId);
      };
    }

    const script = document.createElement('script');
    script.id = 'redoc-script';
    script.src = 'https://cdn.jsdelivr.net/npm/redoc@2.0.0-rc.77/bundles/redoc.standalone.js';
    script.defer = true;
    script.onload = initRedoc;
    document.body.appendChild(script);

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  return (
    <div className="flex min-h-screen bg-ds-shell text-ds-text">
      {/* Sidebar for Quickstarts — Hidden if Reference is selected to avoid double sidebars */}
      {activeTab !== 'api-reference' && (
        <aside className="w-64 border-r border-ds-border bg-ds-panel hidden md:flex flex-col gap-4 p-6 shrink-0">
          <div className="mb-6 px-2">
            <div className="font-ds-mono text-xs font-bold text-ds-green uppercase tracking-widest opacity-60 mb-2">Documentation</div>
            <div className="flex items-center gap-2 text-ds-text-2 font-ds-mono text-[11px]">
              <span>v0.4.0 Stable</span>
            </div>
          </div>
          <nav className="space-y-6">
            <div>
              <div className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider mb-2 font-bold">Platform</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('getting-started')}
                  className={`w-full flex items-center py-2 px-3 rounded text-left text-xs font-ds-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ds-green ${
                    activeTab === 'getting-started'
                      ? 'bg-ds-border-on text-ds-green border-r-2 border-ds-green'
                      : 'text-ds-text-2 hover:bg-ds-panel-2'
                  }`}
                >
                  Getting started
                </button>
                <button
                  onClick={() => setActiveTab('xrpl-evm')}
                  className={`w-full flex items-center py-2 px-3 rounded text-left text-xs font-ds-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ds-green ${
                    activeTab === 'xrpl-evm'
                      ? 'bg-ds-border-on text-ds-green border-r-2 border-ds-green'
                      : 'text-ds-text-2 hover:bg-ds-panel-2'
                  }`}
                >
                  XRPL EVM
                </button>
                <button
                  onClick={() => setActiveTab('xls-0101')}
                  className={`w-full flex items-center py-2 px-3 rounded text-left text-xs font-ds-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ds-green ${
                    activeTab === 'xls-0101'
                      ? 'bg-ds-border-on text-ds-green border-r-2 border-ds-green'
                      : 'text-ds-text-2 hover:bg-ds-panel-2'
                  }`}
                >
                  XLS-0101
                </button>
              </div>
            </div>

            <div>
              <div className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider mb-2 font-bold">Data Ingestion</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('webhooks')}
                  className={`w-full flex items-center py-2 px-3 rounded text-left text-xs font-ds-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ds-green ${
                    activeTab === 'webhooks'
                      ? 'bg-ds-border-on text-ds-green border-r-2 border-ds-green'
                      : 'text-ds-text-2 hover:bg-ds-panel-2'
                  }`}
                >
                  Webhooks Signing
                </button>
              </div>
            </div>

            <div>
              <div className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider mb-2 font-bold">Reference</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('api-reference')}
                  className={`w-full flex items-center py-2 px-3 rounded text-left text-xs font-ds-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ds-green ${
                    activeTab === 'api-reference'
                      ? 'bg-ds-border-on text-ds-green border-r-2 border-ds-green'
                      : 'text-ds-text-2 hover:bg-ds-panel-2'
                  }`}
                >
                  API Reference
                </button>
              </div>
            </div>
          </nav>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 bg-ds-shell overflow-y-auto px-6 py-8 md:px-12">
        {/* Mobile Tab Selector dropdown */}
        {activeTab !== 'api-reference' && (
          <div className="block md:hidden mb-6">
            <label htmlFor="docs-nav-select" className="sr-only">
              Select Documentation Page
            </label>
            <select
              id="docs-nav-select"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full bg-ds-panel border border-ds-border text-ds-text rounded px-3 py-2 font-ds-mono text-sm outline-none focus:border-ds-green"
            >
              <option value="getting-started">Platform: Getting started</option>
              <option value="xrpl-evm">Platform: XRPL EVM</option>
              <option value="xls-0101">Platform: XLS-0101</option>
              <option value="webhooks">Data Ingestion: Webhooks Signing</option>
              <option value="api-reference">Reference: API Reference</option>
            </select>
          </div>
        )}

        <article className="max-w-3xl">
          {activeTab === 'getting-started' && (
            <div>
              <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-4">Introduction to High-Frequency Observability</h1>
              <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
                Kryndel provides sub-millisecond visibility into the XRP Ledger. Our API is designed for institutions requiring low-latency transaction confirmation and real-time ledger state updates.
              </p>
              <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-ds-border pb-1">Quickstart</h2>
              <p className="text-ds-text-2 text-sm mb-4">To begin monitoring the XRPL mainnet, initialize the client with your API key and subscribe to the ledger stream.</p>

              <CodeBlock
                language="javascript"
                code={`import { KryndelClient } from '@kryndel/sdk';

// Initialize secure connection
const sdk = new KryndelClient({
  apiKey: process.env.KRYNDEL_API_KEY,
  environment: 'mainnet'
});

// Subscribe to live events
await sdk.subscribe(['transactions', 'ledger'], (event) => {
  console.log(\`New Event: \${event.id}\`);
});`}
              />

              <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-ds-border pb-1">Authentication</h2>
              <p className="text-ds-text-2 text-sm mb-4">
                All REST API requests require a Bearer token provided in the <code className="bg-ds-panel px-1.5 py-0.5 rounded text-ds-green font-ds-mono text-xs">Authorization</code> header. Keys can be managed via the Kryndel Console under the Security tab.
              </p>
              <div className="bg-ds-border-on border-l-4 border-ds-green p-4 my-6 rounded-r">
                <div className="flex items-center gap-2 text-ds-green font-bold mb-2">
                  <span className="font-ds-mono text-xs uppercase tracking-wider">Note</span>
                </div>
                <p className="text-xs text-ds-text-2 italic">
                  For heavy streaming workloads, we recommend using our WebSocket endpoints to avoid rate-limiting overhead associated with REST polling.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'xrpl-evm' && (
            <div>
              <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-4">Observability on XRPL EVM Sidechain</h1>
              <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
                Kryndel indexes contracts deployed on the XRPL EVM Sidechain mainnet. Our indexing pipeline processes block events, traces method executions, and issues alerts in real time.
              </p>
              <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-ds-border pb-1">Polling Logs</h2>
              <p className="text-ds-text-2 text-sm mb-4">
                Since some EVM endpoints reject direct WS logs subscriptions, Kryndel polls `eth_getLogs` every 4 seconds and performs highly efficient client-side filtering.
              </p>

              <CodeBlock
                language="javascript"
                code={`// Poll log transfer events for ERC-20 on EVM sidechain
const logs = await sdk.evm.getLogs({
  address: '0x2585B2226939DB7cb543eE8b1187bD3212e8A84D', // Staking contract
  event: 'Transfer(address,address,uint256)',
  fromBlock: 'latest'
});`}
              />

              <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-ds-border pb-1">Decoding EVM Logs</h2>
              <p className="text-ds-text-2 text-sm mb-4">
                Kryndel utilizes the `viem` library to decode events and inputs against contract ABIs. This allows users to read exact method parameters and event arguments without manual hex parsing.
              </p>
            </div>
          )}

          {activeTab === 'xls-0101' && (
            <div>
              <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-4">Native Smart Contracts (XLS-0101)</h1>
              <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
                XLS-0101 introduces native WASM-based hooks execution directly inside the XRP Ledger. Kryndel includes built-in watchers designed specifically for native contract transactions.
              </p>
              <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-ds-border pb-1">Hook Execution Watcher</h2>
              <p className="text-ds-text-2 text-sm mb-4">
                Filter payments, hook settings, and hook executions on AlphaNet using the native client.
              </p>

              <CodeBlock
                language="javascript"
                code={`// Initialize native WASM hook watcher
const nativeWatcher = sdk.native.createWatcher({
  endpoint: 'wss://alphanet.nerdnest.xyz',
  contractTypes: ['HookSet', 'Payment', 'Invoke']
});

nativeWatcher.on('hook_exec', (trace) => {
  console.log('Hook Executed:', trace.result);
});`}
              />

              <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-ds-border pb-1">Limitations Notice</h2>
              <div className="bg-ds-amber/10 border-l-4 border-ds-amber p-4 my-6 rounded-r">
                <div className="flex items-center gap-2 text-ds-amber font-bold mb-2">
                  <span className="font-ds-mono text-xs uppercase tracking-wider">Status Alert</span>
                </div>
                <p className="text-xs text-ds-text-2 italic">
                  The public AlphaNet RPC nodes occasionally encounter network outages. If you experience connection drops, please check the Status page for current sync status.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div>
              <h1 className="font-ds-sans text-2xl md:text-3xl text-ds-text font-bold mb-4">Webhooks Signature Verification</h1>
              <p className="text-ds-text-2 text-sm leading-relaxed mb-6">
                Kryndel sends webhooks payload as JSON POST requests to your callback URLs. To protect your servers from SSRF or spoofing, verify that each webhook was signed by Kryndel.
              </p>
              <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-ds-border pb-1">Signature Headers</h2>
              <p className="text-ds-text-2 text-sm mb-4">
                Each request contains the header `X-Kryndel-Signature`. It contains a timestamp and a sha256 HMAC signature calculated using your shared endpoint secret:
              </p>
              <pre className="p-3 font-ds-mono text-xs bg-ds-panel rounded border border-ds-border text-ds-text-2 mb-4">
                X-Kryndel-Signature: t=1782012839,v1=sha256_hash_value
              </pre>

              <h2 className="font-ds-sans text-lg md:text-xl text-ds-text font-bold mt-8 mb-3 border-b border-ds-border pb-1">Verification Code Example</h2>
              <CodeBlock
                language="javascript"
                code={`import crypto from 'crypto';

function verifySignature(payload, signatureHeader, secret) {
  const parts = signatureHeader.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) return false;

  const t = timestampPart.split('=')[1];
  const signature = signaturePart.split('=')[1];

  // Compute matching HMAC hash
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${t}.\${payload}\`)
    .digest('hex');

  return expected === signature;
}`}
              />
            </div>
          )}

          {activeTab === 'api-reference' && (
            <div className="w-full">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setActiveTab('getting-started')}
                  className="font-ds-mono text-xs text-ds-green hover:underline focus-visible:outline-none"
                >
                  &larr; Back to Guides
                </button>
                <span className="text-ds-text-3 font-ds-mono text-xs">|</span>
                <span className="bg-ds-border-on border border-ds-green/20 text-ds-green rounded px-2 py-0.5 text-xs font-ds-mono">
                  REST API v1
                </span>
                <a
                  href="/api/v1/openapi.json"
                  className="font-ds-mono text-xs text-ds-green hover:underline focus-visible:outline-none"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openapi.json ↗
                </a>
              </div>
              <div
                ref={containerRef}
                id="redoc-container"
                aria-label="API documentation"
                className="w-full min-h-[80vh] border border-ds-border bg-ds-panel rounded-lg overflow-hidden"
              />
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
