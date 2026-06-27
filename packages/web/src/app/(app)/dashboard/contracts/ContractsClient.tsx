'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ds/DataTable';
import { AddressPill } from '@/components/ds/AddressPill';
import { StatusChip, Button, EmptyWorkbench } from '@/components/ds';
import {
  toggleContractActive,
  deleteContract,
  addContractAction,
  renameContract,
  autoFetchAbi,
} from './actions';
import AbiUploadModal from '../AbiUploadModal';

interface ContractData {
  _id: string;
  address: string;
  surface: 'evm' | 'native';
  name: string;
  active: boolean;
  abi?: any[];
  createdAt: string;
  updatedAt: string;
}

interface AlertRuleData {
  _id: string;
  contractAddress: string;
  eventName: string;
  active: boolean;
}

interface Props {
  initialContracts: ContractData[];
  alertRules: AlertRuleData[];
  eventCounts: Record<string, number>;
  lastActivities: Record<string, string>;
  limits: {
    maxContracts: number;
    maxRulesPerContract: number;
  };
  plan: string;
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
    const remSec = diffSec % 60;
    return `${diffMin}m ${remSec}s ago`;
  }
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) {
    const remMin = diffMin % 60;
    return `${diffHrs}h ${remMin}m ago`;
  }
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function ContractsClient({
  initialContracts,
  alertRules,
  eventCounts,
  lastActivities,
  limits,
  plan,
}: Props) {
  const [data, setData] = useState<ContractData[]>(initialContracts);
  const [filterSurface, setFilterSurface] = useState<'all' | 'evm' | 'native'>('all');
  const [filterAbi, setFilterAbi] = useState<'all' | 'verified' | 'unverified'>('all');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Inline label editing
  const [editingAddr, setEditingAddr] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // ABI auto-fetch (address currently being fetched)
  const [abiFetching, setAbiFetching] = useState<string | null>(null);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsAddSheetOpen(true);
    }
  }, [searchParams]);

  // Add contract form fields
  const [addAddress, setAddAddress] = useState('');
  const [addSurface, setAddSurface] = useState<'evm' | 'native'>('evm');
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Address validation checks
  const isAddrValid = useMemo(() => {
    if (!addAddress) return false;
    if (addSurface === 'evm') {
      return /^0x[0-9a-fA-F]{40}$/.test(addAddress);
    } else {
      return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addAddress);
    }
  }, [addAddress, addSurface]);

  // Compute stats for contracts
  const processedContracts = useMemo(() => {
    return data.map((c) => {
      const addr = c.address.toLowerCase();
      // rules filter
      const contractRules = alertRules.filter(
        (r) => r.contractAddress.toLowerCase() === addr
      );
      const uniqueEvents = Array.from(new Set(contractRules.map((r) => r.eventName)));
      const eventsCount = eventCounts[addr] ?? 0;
      
      let watchedEventsText = 'None';
      if (uniqueEvents.length > 0) {
        watchedEventsText = uniqueEvents.includes('*')
          ? 'All (*)'
          : uniqueEvents.join(', ');
      }
      
      const lastActivityText = formatRelativeTime(lastActivities[addr]);

      return {
        ...c,
        rulesCount: contractRules.length,
        watchedEventsText: `${watchedEventsText} (${eventsCount} indexed)`,
        lastActivityText,
        eventsCount,
      };
    });
  }, [data, alertRules, eventCounts, lastActivities]);

  // Filtered Contracts
  const filteredContracts = useMemo(() => {
    return processedContracts.filter((c) => {
      if (filterSurface === 'evm' && c.surface !== 'evm') return false;
      if (filterSurface === 'native' && c.surface !== 'native') return false;
      if (filterAbi === 'verified' && !c.abi) return false;
      if (filterAbi === 'unverified' && c.abi) return false;
      return true;
    });
  }, [processedContracts, filterSurface, filterAbi]);

  // Inline Actions
  const handleToggleActive = async (address: string, nextState: boolean) => {
    // Optimistic UI update
    setData((prev) =>
      prev.map((c) => (c.address === address ? { ...c, active: nextState } : c))
    );
    const res = await toggleContractActive(address, nextState);
    if (res.error) {
      alert(`Error updating status: ${res.error}`);
      // Rollback
      setData((prev) =>
        prev.map((c) => (c.address === address ? { ...c, active: !nextState } : c))
      );
    }
  };

  const handleDelete = async (address: string) => {
    if (!confirm('Are you sure you want to unwatch this contract? This will also delete all associated alert rules.')) {
      return;
    }
    const backup = [...data];
    setData((prev) => prev.filter((c) => c.address !== address));
    const res = await deleteContract(address);
    if (res.error) {
      alert(`Error deleting contract: ${res.error}`);
      setData(backup);
    }
  };

  // Inline rename handlers
  const startRename = (address: string, currentName: string) => {
    setEditingAddr(address);
    setEditValue(currentName);
  };

  const cancelRename = () => {
    setEditingAddr(null);
    setEditValue('');
  };

  const commitRename = async (address: string) => {
    const next = editValue.trim();
    const current = data.find((c) => c.address === address)?.name ?? '';
    cancelRename();
    if (!next || next === current) return;

    const backup = [...data];
    setData((prev) => prev.map((c) => (c.address === address ? { ...c, name: next } : c)));
    const res = await renameContract(address, next);
    if (res.error) {
      alert(`Error renaming: ${res.error}`);
      setData(backup);
    }
  };

  // Auto-fetch the verified ABI from the explorer for a contract.
  const handleAutoFetchAbi = async (address: string) => {
    setAbiFetching(address);
    const res = await autoFetchAbi(address);
    setAbiFetching(null);
    if (res.error) {
      alert(res.error);
      return;
    }
    alert(res.success ?? 'ABI fetched.');
    window.location.reload();
  };

  // Add contract submit handler
  const handleAddContract = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!isAddrValid) {
      setAddError('Invalid contract address format.');
      return;
    }

    startTransition(async () => {
      const res = await addContractAction(addAddress, addSurface, addName);
      if (res.error) {
        setAddError(res.error);
      } else {
        // Successful add
        setIsAddSheetOpen(false);
        setAddAddress('');
        setAddName('');
        // Reload page data
        window.location.reload();
      }
    });
  };

  // Table Columns Definition
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'name',
      header: () => <span className="font-label-caps text-label-caps">Contract Label</span>,
      cell: ({ row }) => {
        const c = row.original;
        if (editingAddr === c.address) {
          return (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitRename(c.address);
                if (e.key === 'Escape') cancelRename();
              }}
              onBlur={() => void commitRename(c.address)}
              maxLength={80}
              className="w-full bg-ds-shell border border-solid border-ds-green rounded px-2 py-1 font-ds-mono text-xs text-ds-text outline-none"
            />
          );
        }
        return (
          <span className="font-headline-md text-headline-md text-ds-green font-bold">
            {c.name}
          </span>
        );
      },
      size: 180,
    },
    {
      accessorKey: 'address',
      header: () => <span className="font-label-caps text-label-caps">Address</span>,
      cell: ({ row }) => <AddressPill address={row.original.address} showLabel={false} />,
      size: 160,
    },
    {
      accessorKey: 'surface',
      header: () => <span className="font-label-caps text-label-caps">Surface</span>,
      cell: ({ row }) => (
        <span className="bg-ds-panel-2 border border-solid border-ds-border px-2 py-0.5 font-ds-mono text-[10px] text-ds-text-2 rounded uppercase select-none">
          {row.original.surface === 'evm' ? 'EVM' : 'XLS-0101'}
        </span>
      ),
      size: 90,
    },
    {
      id: 'abiStatus',
      header: () => <span className="font-label-caps text-label-caps">ABI Status</span>,
      cell: ({ row }) => {
        const hasAbi = !!row.original.abi;
        return (
          <div className={`flex items-center gap-1.5 font-ds-mono text-xs font-bold select-none ${hasAbi ? 'text-ds-green' : 'text-ds-amber'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              {hasAbi ? 'check_circle' : 'warning'}
            </span>
            <span className="font-label-caps text-[9px]">{hasAbi ? 'VERIFIED' : 'NONE'}</span>
          </div>
        );
      },
      size: 100,
    },
    {
      accessorKey: 'watchedEventsText',
      header: () => <span className="font-label-caps text-label-caps text-center block">Events</span>,
      cell: ({ row }) => (
        <span className="font-ds-mono text-xs text-ds-text-2 text-center block truncate max-w-[150px]" title={row.original.watchedEventsText}>
          {row.original.watchedEventsText}
        </span>
      ),
      size: 150,
    },
    {
      accessorKey: 'lastActivityText',
      header: () => <span className="font-label-caps text-label-caps">Last Activity</span>,
      cell: ({ row }) => (
        <span className="font-ds-mono text-xs text-ds-text-2">
          {row.original.lastActivityText}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'active',
      header: () => <span className="font-label-caps text-label-caps">Status</span>,
      cell: ({ row }) => (
        <StatusChip
          status={row.original.active ? 'ok' : 'neutral'}
          label={row.original.active ? 'ACTIVE' : 'PAUSED'}
        />
      ),
      size: 100,
    },
    {
      id: 'actions',
      header: () => <span className="font-label-caps text-label-caps text-right block">Actions</span>,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex justify-end gap-3.5 items-center select-none">
            <a
              href={`/contract/${encodeURIComponent(c.address)}`}
              className="p-1 hover:text-ds-green text-ds-text-3 transition-colors flex items-center"
              title="View in Explorer"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
            </a>
            <a
              href={`/dashboard/rules?contract=${encodeURIComponent(c.address)}`}
              className="p-1 hover:text-ds-green text-ds-text-3 transition-colors flex items-center"
              title="Alert Rules"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>notifications_active</span>
            </a>
            <button
              onClick={() => startRename(c.address, c.name)}
              className="p-1 hover:text-ds-green text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none"
              title="Rename label"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
            </button>
            <AbiUploadModal address={c.address} hasAbi={!!c.abi} />
            {c.surface === 'evm' && (
              <button
                onClick={() => handleAutoFetchAbi(c.address)}
                disabled={abiFetching === c.address}
                className="p-1 hover:text-ds-green text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none disabled:opacity-40"
                title="Auto-fetch verified ABI from explorer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {abiFetching === c.address ? 'hourglass_top' : 'cloud_download'}
                </span>
              </button>
            )}
            <button
              onClick={() => handleToggleActive(c.address, !c.active)}
              className="p-1 hover:text-ds-green text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none"
              title={c.active ? 'Pause' : 'Activate'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {c.active ? 'pause_circle' : 'play_circle'}
              </span>
            </button>
            <button
              onClick={() => handleDelete(c.address)}
              className="p-1 hover:text-ds-red text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none"
              title="Delete Contract"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
            </button>
          </div>
        );
      },
      size: 160,
    },
  ];

  const atLimit = data.length >= limits.maxContracts;

  return (
    <div className="space-y-6">
      {/* Dynamic Keyframes Sheet style */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes term-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: term-slide-in 0.2s ease-out forwards;
        }
      ` }} />

      {/* Dashboard Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-0 border-b border-solid border-ds-border/50">
        <div className="space-y-1 select-none">
          <h1 className="font-ds-sans text-2xl font-bold tracking-tight text-ds-text m-0">Contracts</h1>
          <p className="font-ds-mono text-xs text-ds-text-3 m-0">
            {plan.toUpperCase()} Plan · Live monitoring of {data.length} / {limits.maxContracts} registered smart contracts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 select-none">
          {/* Surface & ABI dropdowns */}
          <div className="flex bg-ds-panel border border-solid border-ds-border p-1 rounded">
            <div className="flex items-center gap-2 px-3 border-0 border-r border-solid border-ds-border">
              <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase font-bold">Surface</span>
              <select
                value={filterSurface}
                onChange={(e: any) => setFilterSurface(e.target.value)}
                className="bg-transparent border-none font-ds-mono text-[10px] text-ds-green focus:ring-0 p-0 pr-4 cursor-pointer outline-none uppercase font-bold"
              >
                <option value="all">ALL_SYSTEMS</option>
                <option value="evm">EVM_SIDECHAIN</option>
                <option value="native">NATIVE_XLS_0101</option>
              </select>
            </div>
            <div className="flex items-center gap-2 px-3">
              <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase font-bold">ABI</span>
              <select
                value={filterAbi}
                onChange={(e: any) => setFilterAbi(e.target.value)}
                className="bg-transparent border-none font-ds-mono text-[10px] text-ds-green focus:ring-0 p-0 pr-4 cursor-pointer outline-none uppercase font-bold"
              >
                <option value="all">ALL_STATUS</option>
                <option value="verified">VERIFIED_ONLY</option>
                <option value="unverified">UNVERIFIED</option>
              </select>
            </div>
          </div>

          {!atLimit && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddSheetOpen(true)}
              className="h-[36px] px-6 font-ds-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(43,217,111,0.25)] border-0"
            >
              + Watch Contract
            </Button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {data.length === 0 ? (
        <EmptyWorkbench
          title="No contracts monitored"
          description="Register your first EVM Sidechain or XLS-0101 smart contract to start indexing logs, decoding events, and dispatching webhook alert rules."
          actionLabel="Watch Contract"
          onActionClick={() => setIsAddSheetOpen(true)}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
            <DataTable
              columns={columns}
              data={filteredContracts}
              emptyTitle="No contracts match your filters"
              emptyDescription="Adjust your surface or ABI filters to show hidden contracts."
            />
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {filteredContracts.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-ds-border rounded-lg text-ds-text-3 font-ds-mono text-xs select-none">
                No matching contracts found.
              </div>
            ) : (
              filteredContracts.map((c) => (
                <div
                  key={c._id}
                  className="bg-ds-panel border border-solid border-ds-border rounded-lg p-4 space-y-3"
                >
                  {/* Header: Name/Label & Status */}
                  <div className="flex justify-between items-start gap-2">
                    {editingAddr === c.address ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename(c.address);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        onBlur={() => void commitRename(c.address)}
                        maxLength={80}
                        className="flex-1 bg-ds-shell border border-solid border-ds-green rounded px-2 py-1 font-ds-mono text-xs text-ds-text outline-none"
                      />
                    ) : (
                      <div className="font-bold text-sm text-ds-text">{c.name}</div>
                    )}
                    <StatusChip
                      status={c.active ? 'ok' : 'neutral'}
                      label={c.active ? 'ACTIVE' : 'PAUSED'}
                    />
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-ds-mono text-ds-text-2 border-0 border-t border-b border-solid border-ds-border/30 py-3">
                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Address</div>
                    <div className="text-right flex justify-end">
                      <AddressPill address={c.address} showLabel={false} />
                    </div>

                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Surface</div>
                    <div className="text-right">
                      <span className="bg-ds-panel-2 border border-solid border-ds-border px-1.5 py-0.5 text-[9px] text-ds-text-2 rounded uppercase font-bold select-none">
                        {c.surface === 'evm' ? 'EVM' : 'XLS-0101'}
                      </span>
                    </div>

                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">ABI Status</div>
                    <div className={`text-right flex justify-end items-center gap-1 font-bold text-[10px] select-none ${c.abi ? 'text-ds-green' : 'text-ds-amber'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        {c.abi ? 'check_circle' : 'warning'}
                      </span>
                      {c.abi ? 'VERIFIED' : 'NONE'}
                    </div>

                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Events</div>
                    <div className="text-right truncate max-w-[160px] font-medium" title={c.watchedEventsText}>
                      {c.watchedEventsText}
                    </div>

                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Last Activity</div>
                    <div className="text-right font-medium">{c.lastActivityText}</div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex flex-wrap justify-end gap-2 pt-1 select-none">
                    <a
                      href={`/contract/${encodeURIComponent(c.address)}`}
                      className="px-3 py-1.5 text-xs text-ds-text-2 hover:text-ds-green border border-solid border-ds-border rounded bg-ds-panel-2/20 no-underline"
                    >
                      Explorer
                    </a>
                    <a
                      href={`/dashboard/rules?contract=${encodeURIComponent(c.address)}`}
                      className="px-3 py-1.5 text-xs text-ds-text-2 hover:text-ds-green border border-solid border-ds-border rounded bg-ds-panel-2/20 no-underline"
                    >
                      Rules
                    </a>
                    <button
                      onClick={() => startRename(c.address, c.name)}
                      className="px-3 py-1.5 text-xs text-ds-text-2 hover:text-ds-green border border-solid border-ds-border rounded bg-ds-panel-2/20 cursor-pointer outline-none"
                    >
                      Rename
                    </button>
                    <AbiUploadModal address={c.address} hasAbi={!!c.abi} />
                    {c.surface === 'evm' && (
                      <button
                        onClick={() => handleAutoFetchAbi(c.address)}
                        disabled={abiFetching === c.address}
                        className="px-3 py-1.5 text-xs text-ds-text-2 hover:text-ds-green border border-solid border-ds-border rounded bg-ds-panel-2/20 cursor-pointer outline-none disabled:opacity-40"
                      >
                        {abiFetching === c.address ? 'Fetching…' : 'Auto ABI'}
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleActive(c.address, !c.active)}
                      className="px-3 py-1.5 text-xs text-ds-text-2 hover:text-ds-green border border-solid border-ds-border rounded bg-ds-panel-2/20 cursor-pointer outline-none"
                    >
                      {c.active ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(c.address)}
                      className="px-3 py-1.5 text-xs text-ds-red hover:bg-ds-red/10 border border-solid border-ds-border rounded bg-ds-panel-2/20 cursor-pointer outline-none"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Slide-Over Drawer: Add Contract */}
      {isAddSheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ds-shell/80 backdrop-blur-xs select-none">
          <div className="fixed inset-0" onClick={() => setIsAddSheetOpen(false)} />
          <div className="relative w-full max-w-[460px] h-screen bg-ds-panel border-0 border-l border-solid border-ds-border flex flex-col z-10 animate-slide-in">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-0 border-b border-solid border-ds-border">
              <h2 className="font-ds-mono text-sm font-bold text-ds-green uppercase tracking-wider m-0">
                Watch New Contract
              </h2>
              <button
                onClick={() => setIsAddSheetOpen(false)}
                className="bg-transparent border-0 text-ds-text-3 hover:text-ds-text text-xl cursor-pointer outline-none"
              >
                &times;
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleAddContract} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col m-0">
              {/* Network Selector */}
              <div className="space-y-2">
                <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                  Network / Surface
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAddSurface('evm');
                      setAddAddress('');
                    }}
                    className={`py-2 px-3 border border-solid rounded text-xs font-ds-mono font-bold uppercase transition-all cursor-pointer ${
                      addSurface === 'evm'
                        ? 'border-ds-green text-ds-green bg-ds-green/5'
                        : 'border-ds-border text-ds-text-2 bg-transparent hover:border-ds-text-3'
                    }`}
                  >
                    XRPL EVM Sidechain
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddSurface('native');
                      setAddAddress('');
                    }}
                    className={`py-2 px-3 border border-solid rounded text-xs font-ds-mono font-bold uppercase transition-all cursor-pointer ${
                      addSurface === 'native'
                        ? 'border-ds-green text-ds-green bg-ds-green/5'
                        : 'border-ds-border text-ds-text-2 bg-transparent hover:border-ds-text-3'
                    }`}
                  >
                    XLS-0101 Native
                  </button>
                </div>
              </div>

              {/* Address input */}
              <div className="space-y-2">
                <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                  Contract Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={addAddress}
                    onChange={(e) => setAddAddress(e.target.value)}
                    placeholder={addSurface === 'evm' ? '0x...' : 'r...'}
                    className={`w-full bg-ds-shell border border-solid rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none pr-24 ${
                      addAddress
                        ? isAddrValid
                          ? 'border-ds-green/50'
                          : 'border-ds-red/50'
                        : 'border-ds-border'
                    }`}
                  />
                  {addAddress && (
                    <div className="absolute right-3 top-3.5 text-[9px] font-ds-mono uppercase font-bold">
                      {isAddrValid ? (
                        <span className="text-ds-green">✓ Valid format</span>
                      ) : (
                        <span className="text-ds-red">✕ Invalid format</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-ds-text-3 font-ds-sans leading-relaxed m-0">
                  {addSurface === 'evm'
                    ? 'Enter 40-character hexadecimal EVM address (e.g. 0xe4c3...1ea67).'
                    : 'Enter 25-35 character base58 XRPL account rAddress (e.g. rMqL1h...JzV9n).'}
                </p>
              </div>

              {/* Label */}
              <div className="space-y-2">
                <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                  Label / Alias <span className="lowercase font-normal text-[10px] text-ds-text-3">(optional)</span>
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Uniswap V2 Router"
                  className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-sans text-ds-text focus:border-ds-green outline-none"
                />
              </div>

              {addError && (
                <div className="p-3 border border-solid border-ds-red/30 bg-ds-red/5 text-ds-red text-xs font-ds-mono rounded">
                  {addError}
                </div>
              )}

              {/* Submit button */}
              <div className="mt-auto pt-6 border-0 border-t border-solid border-ds-border flex gap-3">
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
                  disabled={isPending || !isAddrValid}
                  className="flex-1 font-ds-mono text-xs uppercase"
                >
                  {isPending ? 'Watching…' : 'Watch contract'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
