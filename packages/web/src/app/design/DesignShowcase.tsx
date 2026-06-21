'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  MetricTile,
  AddressPill,
  TxPill,
  EmptyWorkbench,
  RawJsonViewer,
  BottomFilterSheet,
  DataTable,
  EventStream,
  Button,
  StatusChip,
  Pill,
  cn,
} from '@/components/ds';
import { type ColumnDef } from '@tanstack/react-table';

// Type definition for mock data table
interface MockTx {
  id: string;
  time: string;
  type: string;
  contract: string;
  hash: string;
  amount: string;
  status: 'success' | 'reverted' | 'pending';
}

export function DesignShowcase() {
  // ── DataTable Demos State ──
  const [loadingTable, setLoadingTable] = useState(false);
  const [emptyTable, setEmptyTable] = useState(false);

  const mockTxData: MockTx[] = [
    {
      id: 'tx-1',
      time: '12:04:12',
      type: 'Transfer',
      contract: '0x4ba8028b1234567890123456789012345678deb6',
      hash: '0x9c8e1a7b8c9d1234567890abcdef1234567890abcdef1234567890abcdef',
      amount: '1,250.00 WXRP',
      status: 'success',
    },
    {
      id: 'tx-2',
      time: '12:05:30',
      type: 'Swap',
      contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      hash: '0x5c7b8c9d01234567890abcdef1234567890abcdef1234567890abcdef123',
      amount: '450.00 USDC',
      status: 'success',
    },
    {
      id: 'tx-3',
      time: '12:06:55',
      type: 'Approval',
      contract: '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67',
      hash: '0x3b8c9d01234567890abcdef1234567890abcdef1234567890abcdef12345',
      amount: 'Unlimited',
      status: 'success',
    },
    {
      id: 'tx-4',
      time: '12:08:01',
      type: 'Mint',
      contract: '0x53f6b432a123456789012345678901234567abcd',
      hash: '0x1c8d01234567890abcdef1234567890abcdef1234567890abcdef1234567',
      amount: '1 NFT',
      status: 'pending',
    },
    {
      id: 'tx-5',
      time: '12:09:44',
      type: 'Withdrawal',
      contract: '0x2bd96fb123456789012345678901234567890123',
      hash: '0xabcde01234567890abcdef1234567890abcdef1234567890abcdef123456',
      amount: '10.50 EVM_XRP',
      status: 'reverted',
    },
  ];

  const columns: ColumnDef<MockTx>[] = [
    {
      accessorKey: 'time',
      header: 'Time',
      size: 80,
      cell: (info) => <span className="font-ds-mono text-xs">{String(info.getValue())}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Event / Action',
      size: 110,
      cell: (info) => (
        <span className="font-ds-mono text-xs font-bold text-ds-green uppercase tracking-wide">
          {String(info.getValue())}
        </span>
      ),
    },
    {
      accessorKey: 'contract',
      header: 'Contract Address',
      size: 200,
      cell: (info) => (
        <AddressPill
          address={String(info.getValue())}
          showWatchIcon
          explorerUrl={`https://explorer.xrplevm.org/address/${info.getValue()}`}
        />
      ),
    },
    {
      accessorKey: 'hash',
      header: 'Tx Hash',
      size: 180,
      cell: (info) => {
        const row = info.row.original;
        return <TxPill hash={String(info.getValue())} status={row.status} />;
      },
    },
    {
      accessorKey: 'amount',
      header: 'Value / Volume',
      size: 120,
      cell: (info) => <span className="font-ds-mono text-xs text-ds-text">{String(info.getValue())}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      cell: (info) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => alert(`Replay Tx: ${info.row.original.hash}`)}
            className="h-6 font-ds-mono text-[9px] uppercase px-2"
          >
            Replay
          </Button>
        </div>
      ),
    },
  ];

  // ── EventStream Demos State ──
  const [streamEvents, setStreamEvents] = useState<any[]>([
    {
      id: 'evt-1',
      timestamp: '12:15:30',
      type: 'DECODE_SUCCESS',
      description: 'Successfully decoded contract event logs for Uniswap V2: Swap on EVM Sidechain.',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      hash: '0x9c8e1a7b8c9d1234567890abcdef1234567890abcdef1234567890abcdef',
      status: 'success',
    },
    {
      id: 'evt-2',
      timestamp: '12:15:00',
      type: 'ALERT_DISPATCHED',
      description: 'Alert rule "USDC Whale Transfer" matched. Dispatched webhook payload to https://api.whale.bot/receiver.',
      address: '0x4ba8028b1234567890123456789012345678deb6',
    },
    {
      id: 'evt-3',
      timestamp: '12:14:15',
      type: 'CONTRACT_WATCH',
      description: 'Indexer pool added watcher key "evm:0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67" on block 12,345,678.',
      address: '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67',
    },
  ]);

  // Append a live mock event every 3.5s
  useEffect(() => {
    const types = ['DECODE_SUCCESS', 'ALERT_DISPATCHED', 'CONTRACT_WATCH', 'INDEXER_LAG_WARN'];
    const descriptions = [
      'Token Transfer emitted: 1,000 WXRP transfer verified from bridging vault.',
      'Discord alert successfully fired for rule ID "Rule_Alert_Discord_v1".',
      'XLS-0101 indexer block sync benchmark: 0.1s block latency recorded.',
      'EVM RPC server responded with degraded status: block latency exceeds 2.5s.',
    ];
    const addresses = [
      '0x4ba8028b1234567890123456789012345678deb6',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67',
    ];
    const hashes = [
      '0x9c8e1a7b8c9d1234567890abcdef1234567890abcdef1234567890abcdef',
      '0x5c7b8c9d01234567890abcdef1234567890abcdef1234567890abcdef123',
    ];

    const timer = setInterval(() => {
      const type = types[Math.floor(Math.random() * types.length)];
      const desc = descriptions[Math.floor(Math.random() * descriptions.length)];
      const addr = Math.random() > 0.3 ? addresses[Math.floor(Math.random() * addresses.length)] : undefined;
      const hash = Math.random() > 0.5 ? hashes[Math.floor(Math.random() * hashes.length)] : undefined;
      const status = hash ? (Math.random() > 0.2 ? 'success' as const : 'reverted' as const) : undefined;

      const date = new Date();
      const timestamp = date.toTimeString().split(' ')[0];

      const newEvent = {
        id: `evt-${Date.now()}`,
        timestamp,
        type,
        description: desc,
        address: addr,
        hash,
        status,
        isNew: true,
      };

      setStreamEvents((prev) => {
        // Clear isNew pulse flag on older elements
        const clearedPrev = prev.map((item) => ({ ...item, isNew: false }));
        return [newEvent, ...clearedPrev].slice(0, 50); // Keep max 50 logs
      });
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // ── RawJsonViewer Demo Mock JSON ──
  const mockJsonAbi = {
    contractName: "UniswapV2Pair",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    status: "active",
    syncedBlocks: 12345678,
    metrics: {
      transactionsCount: 152044,
      totalVolume: "4,500,102.50 USD",
      healthCheck: {
        dbLatencyMs: 14,
        indexerLagSec: 0.4,
        nodes: ["rpc.xrplevm.org", "rpc.xrpl.org"]
      }
    },
    abi: [
      {
        anonymous: false,
        name: "Swap",
        type: "event",
        inputs: [
          { indexed: true, name: "sender", type: "address" },
          { indexed: false, name: "amount0In", type: "uint256" },
          { indexed: false, name: "amount1In", type: "uint256" },
          { indexed: false, name: "amount0Out", type: "uint256" },
          { indexed: false, name: "amount1Out", type: "uint256" },
          { indexed: true, name: "to", type: "address" }
        ]
      },
      {
        anonymous: false,
        name: "Sync",
        type: "event",
        inputs: [
          { indexed: false, name: "reserve0", type: "uint112" },
          { indexed: false, name: "reserve1", type: "uint112" }
        ]
      }
    ]
  };

  // ── BottomFilterSheet Filters Mock state ──
  const [filterChain, setFilterChain] = useState<string>('evm');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  return (
    <div className="space-y-12">
      {/* ── MetricTile Demos ── */}
      <div>
        <h3 className="font-ds-mono text-xs text-ds-text-3 mb-4 select-none">MetricTile Grid</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricTile
            label="Indexer Sync Lag"
            value="0.28s"
            delta="-0.12s (10m)"
            trend="up"
            status="ok"
          />
          <MetricTile
            label="Active Event Watchers"
            value="182"
            delta="+14 today"
            trend="up"
            status="ok"
          />
          <MetricTile
            label="API Latency (p95)"
            value="44ms"
            delta="+12ms"
            trend="down"
            status="warn"
          />
          <MetricTile
            label="Webhook Delivery Rate"
            value="99.82%"
            delta="Stable"
            status="ok"
          />
          <MetricTile
            label="Failed Alert Dispatches"
            value="4"
            delta="+2 (1h)"
            trend="down"
            status="fail"
          />
          <MetricTile
            label="System Health Rate"
            value="100.0%"
            status="ok"
          />
        </div>
      </div>

      {/* ── AddressPill & TxPill Demos ── */}
      <div>
        <h3 className="font-ds-mono text-xs text-ds-text-3 mb-4 select-none">AddressPill & TxPill</h3>
        <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 flex flex-col gap-4">
          <div>
            <p className="font-ds-sans text-xs text-ds-text-3 mb-2 font-semibold">AddressPills (with Watch icon, Explorer shortcuts, and hover highlights)</p>
            <div className="flex flex-wrap gap-3">
              <AddressPill
                address="0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67"
                showWatchIcon
                isWatching
                onWatchToggle={(addr, state) => alert(`Address: ${addr} watching status is: ${state}`)}
              />
              <AddressPill
                address="0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
                explorerUrl="https://explorer.xrplevm.org/address/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
              />
              <AddressPill
                address="rMX1D1cE653d7861cf236b2bea4bdb2a2612"
                showWatchIcon={false}
              />
            </div>
          </div>
          <div>
            <p className="font-ds-sans text-xs text-ds-text-3 mb-2 font-semibold">TxPills (with transaction status flags)</p>
            <div className="flex flex-wrap gap-3">
              <TxPill
                hash="0x9c8e1a7b8c9d1234567890abcdef1234567890abcdef1234567890abcdef"
                status="success"
                explorerUrl="https://explorer.xrplevm.org/tx/0x9c8e1a7b8c9d1234567890abcdef1234567890abcdef1234567890abcdef"
              />
              <TxPill
                hash="0x5c7b8c9d01234567890abcdef1234567890abcdef1234567890abcdef123"
                status="reverted"
              />
              <TxPill
                hash="0x3b8c9d01234567890abcdef1234567890abcdef1234567890abcdef12345"
                status="pending"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── EmptyWorkbench Demo ── */}
      <div>
        <h3 className="font-ds-mono text-xs text-ds-text-3 mb-4 select-none">EmptyWorkbench State</h3>
        <EmptyWorkbench
          title="No Contract ABI Uploaded"
          description="Upload your Solidity Smart Contract JSON ABI structure to enrich indexing names, decode parameters, and enable filter triggers on rules."
          actionLabel="Upload ABI JSON"
          onActionClick={() => alert('ABI upload trigger simulated!')}
          codeExample={`[\n  {\n    "anonymous": false,\n    "name": "Transfer",\n    "type": "event",\n    "inputs": [\n      { "indexed": true, "name": "from", "type": "address" },\n      { "indexed": true, "name": "to", "type": "address" },\n      { "indexed": false, "name": "value", "type": "uint256" }\n    ]\n  }\n]`}
          codeLanguage="json"
        />
      </div>

      {/* ── RawJsonViewer Demo ── */}
      <div>
        <h3 className="font-ds-mono text-xs text-ds-text-3 mb-4 select-none">RawJsonViewer (Interactive tree collapsing)</h3>
        <RawJsonViewer data={mockJsonAbi} initiallyExpanded={false} />
      </div>

      {/* ── BottomFilterSheet Demo ── */}
      <div>
        <h3 className="font-ds-mono text-xs text-ds-text-3 mb-4 select-none">BottomFilterSheet (Mobile filter drawer trigger)</h3>
        <div className="flex gap-4 items-center bg-ds-panel border border-solid border-ds-border p-6 rounded-lg">
          <span className="text-sm text-ds-text-2">Test the bottom sheet drawer trigger on mobile viewport heights.</span>
          <BottomFilterSheet
            title="Refine Log Searches"
            description="Toggle on/off chains, contracts filters, or status errors."
            trigger={
              <Button variant="secondary" size="md">
                Open Filters Drawer
              </Button>
            }
            onApply={() => alert(`Filters applied: Chain: ${filterChain}, Status: ${filterStatus}`)}
            onClear={() => {
              setFilterChain('evm');
              setFilterStatus('all');
              alert('Filters cleared');
            }}
          >
            <div className="space-y-6 pt-4 font-ds-sans">
              <div className="space-y-2.5">
                <label className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest block">
                  Select Blockchain / Network
                </label>
                <div className="flex gap-2">
                  {['evm', 'xls'].map((chain) => (
                    <button
                      key={chain}
                      onClick={() => setFilterChain(chain)}
                      className={cn(
                        'flex-1 py-2 px-3 border border-solid rounded text-xs font-ds-mono uppercase cursor-pointer outline-none transition-colors',
                        filterChain === chain
                          ? 'border-ds-green text-ds-green bg-ds-green/5'
                          : 'border-ds-border text-ds-text-3 hover:border-ds-text-2 hover:text-ds-text'
                      )}
                    >
                      {chain === 'evm' ? 'XRPL EVM' : 'XLS-0101'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest block">
                  Alert Trigger Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-ds-shell border border-solid border-ds-border rounded py-2 px-3 font-ds-mono text-xs text-ds-text outline-none focus:border-ds-green transition-all"
                >
                  <option value="all">ALL STAGES</option>
                  <option value="success">DECODE SUCCESS</option>
                  <option value="failed">REVERTED TX</option>
                  <option value="pending">PENDING BENCHMARK</option>
                </select>
              </div>
            </div>
          </BottomFilterSheet>
        </div>
      </div>

      {/* ── EventStream Demo ── */}
      <div>
        <h3 className="font-ds-mono text-xs text-ds-text-3 mb-4 select-none">
          EventStream (Live stream simulator, auto-scroll and pulse)
        </h3>
        <p className="text-xs text-ds-text-3 mb-3 select-none">
          Simulating a new blockchain decodification entry every 3.5 seconds. Scroll down inside the stream to freeze autoscroll and test the floating "Resume live" widget.
        </p>
        <EventStream events={streamEvents} maxHeight="260px" />
      </div>

      {/* ── DataTable Demos ── */}
      <div>
        <h3 className="font-ds-mono text-xs text-ds-text-3 mb-4 select-none">
          DataTable (TanStack Table sorting, dynamic URL filtering, skeletons, inline actions)
        </h3>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 select-none">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLoadingTable((prev) => !prev)}
            >
              Toggle Loading Skeleton: {loadingTable ? 'ON' : 'OFF'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEmptyTable((prev) => !prev)}
            >
              Toggle Empty State: {emptyTable ? 'ON' : 'OFF'}
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={emptyTable ? [] : mockTxData}
            loading={loadingTable}
            filterParamKey="q"
            emptyTitle="No transactions found matching criteria"
            emptyDescription="Ensure the global search keyword matches any transaction hash or type currently listed."
          />
        </div>
      </div>
    </div>
  );
}
