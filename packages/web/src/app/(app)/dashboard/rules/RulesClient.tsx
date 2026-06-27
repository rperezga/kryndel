'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ds/DataTable';
import { AddressPill } from '@/components/ds/AddressPill';
import { StatusChip, Button, EmptyWorkbench } from '@/components/ds';
import {
  addRuleAction,
  deleteRuleAction,
  toggleRuleActiveAction,
  previewMatchesAction,
  sendTestAlertAction,
  type ActionResponse,
} from './actions';
import { ALERT_TEMPLATES, getAlertTemplate, type AlertTemplate } from '@/lib/alert-templates';

interface RuleData {
  _id: string;
  contractAddress: string;
  surface: 'evm' | 'native';
  eventName: string;
  name: string;
  channel: string;
  target: string;
  filter?: Record<string, any>;
  active: boolean;
  lastMatchAt?: string;
  createdAt: string;
}

interface ContractInfo {
  _id: string;
  address: string;
  name: string;
  surface: 'evm' | 'native';
  knownEvents: string[];
  hasAbi: boolean;
}

interface Props {
  initialRules: RuleData[];
  contracts: ContractInfo[];
  initialContractFilter: string;
  limits: {
    maxRulesPerContract: number;
    channels: string[];
  };
  plan: string;
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Never';
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

function formatCondition(filter?: Record<string, any>): string {
  if (!filter || Object.keys(filter).length === 0) return '—';
  const entries = Object.entries(filter);
  if (entries.length === 0) return '—';
  const [argName, val] = entries[0];
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const opEntries = Object.entries(val);
    if (opEntries.length > 0) {
      const [op, threshold] = opEntries[0];
      const opSignMap: Record<string, string> = {
        $gt: '>',
        $lt: '<',
        $gte: '>=',
        $lte: '<=',
        $eq: '=',
      };
      const sign = opSignMap[op] || op;
      
      let displayThreshold = String(threshold);
      try {
        const num = BigInt(displayThreshold);
        displayThreshold = num.toLocaleString();
      } catch {}
      
      return `${argName} ${sign} ${displayThreshold}`;
    }
  }
  return `${argName} = ${String(val)}`;
}

const STEP_NAMES = [
  'Select Trigger Type',
  'Define Target & Event',
  'Set Alert Criteria',
  'Configure Destinations',
];

export function RulesClient({
  initialRules,
  contracts,
  initialContractFilter,
  limits,
  plan,
}: Props) {
  const [rules, setRules] = useState<RuleData[]>(initialRules);
  const [filterContract, setFilterContract] = useState<string>(initialContractFilter);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Wizard state machine
  const [step, setStep] = useState(1);
  const [triggerType, setTriggerType] = useState<'event' | 'function' | 'failed' | 'state'>('event');
  const [selectedContractAddress, setSelectedContractAddress] = useState(
    contracts.length > 0 ? contracts[0].address : ''
  );
  const [selectedEventName, setSelectedEventName] = useState('Transfer');
  const [isCustomEvent, setIsCustomEvent] = useState(false);
  const [customEventInput, setCustomEventInput] = useState('');

  // Criteria filters
  const [enableFilter, setEnableFilter] = useState(false);
  const [filterArgName, setFilterArgName] = useState('');
  const [filterOp, setFilterOp] = useState('>');
  const [filterValue, setFilterValue] = useState('');

  // Destination channel target
  const [selectedChannel, setSelectedChannel] = useState<'telegram' | 'slack' | 'discord' | 'webhook' | 'email'>('telegram');
  const [destinationTarget, setDestinationTarget] = useState('');
  const [alertName, setAlertName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Live Matches Preview State
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Send Test Alert Live State
  const [testResult, setTestResult] = useState<ActionResponse | null>(null);
  const [isTesting, startTestTransition] = useTransition();

  // Apply a one-click template: pre-fill the builder and jump to the step that
  // still needs input (threshold for large-transfer, else destinations).
  const applyTemplate = (t: AlertTemplate, contractAddr?: string) => {
    setTriggerType('event');
    if (contractAddr) setSelectedContractAddress(contractAddr);
    // Use the custom-event input for every template so the value can't be reset
    // by the "event not in knownEvents" effect (matters for '*' = any event).
    setIsCustomEvent(true);
    setCustomEventInput(t.eventName);
    setEnableFilter(t.enableFilter);
    setFilterArgName(t.filterArgName ?? '');
    setFilterOp(t.filterOp ?? '>');
    setFilterValue('');
    setAlertName(t.defaultName);
    setAddError(null);
    setIsAddSheetOpen(true);
    setStep(t.requiresThreshold ? 3 : 4);
  };

  // Open drawer if 'add=true' search param is present
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsAddSheetOpen(true);
    }
  }, [searchParams]);

  // Deep-link from the contracts "Watch" menu:
  // /dashboard/rules?template=<id>[&contract=<addr>] → open the builder pre-filled.
  useEffect(() => {
    const t = getAlertTemplate(searchParams.get('template'));
    if (!t) return;
    const c = searchParams.get('contract');
    const match = c
      ? contracts.find((x) => x.address.toLowerCase() === c.toLowerCase())
      : undefined;
    applyTemplate(t, match?.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Set default event name when contract selection changes
  const activeContract = useMemo(() => {
    return contracts.find((c) => c.address === selectedContractAddress);
  }, [contracts, selectedContractAddress]);

  useEffect(() => {
    if (activeContract && activeContract.knownEvents.length > 0) {
      if (!activeContract.knownEvents.includes(selectedEventName)) {
        setSelectedEventName(activeContract.knownEvents[0]);
      }
    }
  }, [selectedContractAddress, activeContract]);

  // Dynamic Event Name selection
  const computedEventName = useMemo(() => {
    if (triggerType === 'failed') return '*';
    if (isCustomEvent) return customEventInput;
    return selectedEventName;
  }, [triggerType, isCustomEvent, customEventInput, selectedEventName]);

  // Debounced matches preview calculator
  useEffect(() => {
    if (!selectedContractAddress || !computedEventName) {
      setPreviewCount(null);
      return;
    }

    setIsPreviewLoading(true);
    const handler = setTimeout(async () => {
      try {
        const res = await previewMatchesAction(
          selectedContractAddress,
          computedEventName,
          enableFilter ? filterArgName : undefined,
          enableFilter ? filterOp : undefined,
          enableFilter ? filterValue : undefined
        );
        setPreviewCount(res.count);
      } catch (err) {
        console.error(err);
      } finally {
        setIsPreviewLoading(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [selectedContractAddress, computedEventName, enableFilter, filterArgName, filterOp, filterValue]);

  // Filtered Rules list
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (filterContract !== 'all' && r.contractAddress.toLowerCase() !== filterContract.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [rules, filterContract]);

  // Inline Actions handlers
  const handleToggleActive = async (id: string, nextState: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r._id === id ? { ...r, active: nextState } : r))
    );
    const res = await toggleRuleActiveAction(id, nextState);
    if (res.error) {
      alert(`Error updating rule: ${res.error}`);
      setRules((prev) =>
        prev.map((r) => (r._id === id ? { ...r, active: !nextState } : r))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;
    const backup = [...rules];
    setRules((prev) => prev.filter((r) => r._id !== id));
    const res = await deleteRuleAction(id);
    if (res.error) {
      alert(`Error deleting rule: ${res.error}`);
      setRules(backup);
    }
  };

  // Channel test action dispatch
  const handleSendTestAlert = () => {
    if (!destinationTarget) {
      setTestResult({ error: 'Destination target is required to send a test alert.' });
      return;
    }
    setTestResult(null);
    startTestTransition(async () => {
      const res = await sendTestAlertAction(selectedChannel, destinationTarget, computedEventName);
      setTestResult(res);
    });
  };

  // Rule creation submit handler
  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    startTransition(async () => {
      const res = await addRuleAction(
        selectedContractAddress,
        alertName,
        computedEventName,
        selectedChannel,
        destinationTarget,
        enableFilter ? filterArgName : undefined,
        enableFilter ? filterOp : undefined,
        enableFilter ? filterValue : undefined
      );

      if (res.error) {
        setAddError(res.error);
      } else {
        setIsAddSheetOpen(false);
        setStep(1);
        setFilterArgName('');
        setFilterValue('');
        setDestinationTarget('');
        setAlertName('');
        setEnableFilter(false);
        // Page reload to pull fresh data
        window.location.reload();
      }
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'name',
      header: () => <span className="font-label-caps text-label-caps">Rule Name</span>,
      cell: ({ row }) => (
        <span className="font-headline-md text-headline-md text-ds-green font-bold block truncate max-w-[150px]" title={row.original.name}>
          {row.original.name}
        </span>
      ),
      size: 150,
    },
    {
      accessorKey: 'contractAddress',
      header: () => <span className="font-label-caps text-label-caps">Contract</span>,
      cell: ({ row }) => <AddressPill address={row.original.contractAddress} />,
      size: 160,
    },
    {
      accessorKey: 'eventName',
      header: () => <span className="font-label-caps text-label-caps">Event / Trigger</span>,
      cell: ({ row }) => (
        <span className="font-ds-mono text-xs text-ds-text font-bold uppercase">
          {row.original.eventName === '*' ? 'ALL (*)' : row.original.eventName}
        </span>
      ),
      size: 120,
    },
    {
      id: 'condition',
      header: () => <span className="font-label-caps text-label-caps">Condition</span>,
      cell: ({ row }) => (
        <span className="font-ds-mono text-xs text-ds-text-2">
          {formatCondition(row.original.filter)}
        </span>
      ),
      size: 140,
    },
    {
      accessorKey: 'channel',
      header: () => <span className="font-label-caps text-label-caps">Channel</span>,
      cell: ({ row }) => {
        const chan = row.original.channel;
        const colorMap: Record<string, string> = {
          telegram: 'text-ds-green border-ds-green/30 bg-ds-green/5',
          discord: 'text-indigo-400 border-indigo-400/30 bg-indigo-400/5',
          slack: 'text-pink-400 border-pink-400/30 bg-pink-400/5',
          webhook: 'text-ds-amber border-ds-amber/30 bg-ds-amber/5',
          email: 'text-sky-400 border-sky-400/30 bg-sky-400/5',
        };
        const color = colorMap[chan] || 'text-ds-text-2 border-ds-border bg-ds-shell';
        return (
          <span className={`px-2 py-0.5 border border-solid rounded font-ds-mono text-[9px] uppercase font-bold select-none ${color}`}>
            {chan}
          </span>
        );
      },
      size: 90,
    },
    {
      accessorKey: 'lastMatchAt',
      header: () => <span className="font-label-caps text-label-caps">Last Match</span>,
      cell: ({ row }) => (
        <span className="font-ds-mono text-xs text-ds-text-2 font-medium">
          {formatRelativeTime(row.original.lastMatchAt)}
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
          label={row.original.active ? 'ACTIVE' : 'MUTED'}
        />
      ),
      size: 90,
    },
    {
      id: 'actions',
      header: () => <span className="font-label-caps text-label-caps text-right block">Actions</span>,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end gap-3.5 items-center select-none">
            <button
              onClick={() => handleToggleActive(r._id, !r.active)}
              className="p-1 hover:text-ds-green text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none"
              title={r.active ? 'Mute' : 'Activate'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {r.active ? 'notifications_paused' : 'notifications_active'}
              </span>
            </button>
            <button
              onClick={() => handleDelete(r._id)}
              className="p-1 hover:text-ds-red text-ds-text-3 bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none"
              title="Delete Rule"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
            </button>
          </div>
        );
      },
      size: 100,
    },
  ];

  const handleNextStep = () => {
    if (step < 4) setStep(step + 1);
  };

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const isChannelAllowed = (chan: string) => limits.channels.includes(chan);

  return (
    <div className="space-y-6">
      {/* Drawer slide animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes term-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: term-slide-in 0.2s ease-out forwards;
        }
      ` }} />

      {/* Header section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-0 border-b border-solid border-ds-border/50">
        <div className="space-y-1 select-none">
          <h1 className="font-ds-sans text-2xl font-bold tracking-tight text-ds-text m-0">Alert Rules</h1>
          <p className="font-ds-mono text-xs text-ds-text-3 m-0">
            {plan.toUpperCase()} Plan · Dispatching contract events to Slack, Discord, Telegram & Webhooks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 select-none">
          {/* Contracts dropdown filter */}
          <div className="flex bg-ds-panel border border-solid border-ds-border p-1 rounded">
            <div className="flex items-center gap-2 px-3">
              <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase font-bold">Filter Contract</span>
              <select
                value={filterContract}
                onChange={(e) => setFilterContract(e.target.value)}
                className="bg-transparent border-none font-ds-mono text-[10px] text-ds-green focus:ring-0 p-0 pr-4 cursor-pointer outline-none uppercase font-bold max-w-[200px]"
              >
                <option value="all">ALL_CONTRACTS</option>
                {contracts.map((c) => (
                  <option key={c._id} value={c.address}>
                    {c.name.toUpperCase()} ({c.address.slice(0, 6)}…)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsAddSheetOpen(true)}
            className="h-[36px] px-6 font-ds-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(43,217,111,0.25)] border-0"
          >
            + New Alert
          </Button>
        </div>
      </header>

      {/* Quick templates — one-click watch presets that pre-fill the builder */}
      {contracts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-ds-mono text-[10px] text-ds-text-3 uppercase font-bold mr-1 select-none">
            Quick templates
          </span>
          {ALERT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              title={t.blurb}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-solid border-ds-border hover:border-ds-green rounded bg-ds-panel text-ds-text-2 hover:text-ds-green font-ds-mono text-[11px] uppercase font-bold cursor-pointer outline-none transition-colors select-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Grid table / list */}
      {rules.length === 0 ? (
        <EmptyWorkbench
          title="No alert rules set"
          description="Configure alert triggers on your watched smart contracts to dispatch decoded events directly to Slack, Discord, Telegram, or Webhook endpoints."
          actionLabel="Configure Alert"
          onActionClick={() => setIsAddSheetOpen(true)}
        />
      ) : (
        <>
          {/* Desktop DataTable view */}
          <div className="hidden md:block bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
            <DataTable
              columns={columns}
              data={filteredRules}
              emptyTitle="No rules match your filters"
              emptyDescription="Adjust your contract selector filter to show hidden alert rules."
            />
          </div>

          {/* Mobile responsive Cards list */}
          <div className="block md:hidden space-y-4">
            {filteredRules.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-ds-border rounded-lg text-ds-text-3 font-ds-mono text-xs select-none">
                No matching alert rules found.
              </div>
            ) : (
              filteredRules.map((r) => (
                <div
                  key={r._id}
                  className="bg-ds-panel border border-solid border-ds-border rounded-lg p-4 space-y-3"
                >
                  {/* Card Header: Name & Status */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-bold text-sm text-ds-text">{r.name}</div>
                    <StatusChip
                      status={r.active ? 'ok' : 'neutral'}
                      label={r.active ? 'ACTIVE' : 'MUTED'}
                    />
                  </div>

                  {/* Card content rows */}
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-ds-mono text-ds-text-2 border-0 border-t border-b border-solid border-ds-border/30 py-3">
                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Contract</div>
                    <div className="text-right flex justify-end">
                      <AddressPill address={r.contractAddress} />
                    </div>

                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Event / Trigger</div>
                    <div className="text-right font-bold uppercase text-ds-text text-[10px]">
                      {r.eventName === '*' ? 'ALL (*)' : r.eventName}
                    </div>

                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Condition</div>
                    <div className="text-right">{formatCondition(r.filter)}</div>

                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Channel</div>
                    <div className="text-right">
                      <span className="px-1.5 py-0.5 border border-solid border-ds-border bg-ds-panel-2 rounded uppercase text-[9px] text-ds-text-2 font-bold select-none">
                        {r.channel}
                      </span>
                    </div>

                    <div className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider select-none">Last Match</div>
                    <div className="text-right font-medium">{formatRelativeTime(r.lastMatchAt)}</div>
                  </div>

                  {/* Card actions */}
                  <div className="flex justify-end gap-2 pt-1 select-none">
                    <button
                      onClick={() => handleToggleActive(r._id, !r.active)}
                      className="px-3 py-1.5 text-xs text-ds-text-2 hover:text-ds-green border border-solid border-ds-border rounded bg-ds-panel-2/20 cursor-pointer outline-none font-ds-mono"
                    >
                      {r.active ? 'Mute' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(r._id)}
                      className="px-3 py-1.5 text-xs text-ds-red hover:bg-ds-red/10 border border-solid border-ds-border rounded bg-ds-panel-2/20 cursor-pointer outline-none font-ds-mono"
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

      {/* Slide-Over Drawer Alert Builder Wizard */}
      {isAddSheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ds-shell/80 backdrop-blur-xs select-none">
          <div className="fixed inset-0" onClick={() => { setIsAddSheetOpen(false); setStep(1); }} />
          <div className="relative w-full max-w-[480px] h-screen bg-ds-panel border-0 border-l border-solid border-ds-border flex flex-col z-10 animate-slide-in">
            
            {/* Drawer Header */}
            <div className="flex justify-between items-center px-6 py-5 border-0 border-b border-solid border-ds-border">
              <h2 className="font-ds-mono text-sm font-bold text-ds-green uppercase tracking-wider m-0">
                New Alert Rule
              </h2>
              <button
                onClick={() => { setIsAddSheetOpen(false); setStep(1); }}
                className="bg-transparent border-0 text-ds-text-3 hover:text-ds-text text-xl cursor-pointer outline-none"
              >
                &times;
              </button>
            </div>

            {/* Steps Progress header */}
            <div className="px-6 py-3 border-0 border-b border-solid border-ds-border flex justify-between items-center text-[10px] font-ds-mono font-bold select-none text-ds-text-3">
              <span>STEP {step} OF 4</span>
              <span className="text-ds-green uppercase">{STEP_NAMES[step - 1]}</span>
            </div>

            {/* Visual Progress indicators line */}
            <div className="flex px-6 pt-2 bg-ds-panel select-none">
              <div className="flex items-center gap-1.5 w-full">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className="flex-1 flex items-center gap-1.5">
                    <div className={`h-1.5 rounded-full flex-1 transition-all ${
                      s <= step ? 'bg-ds-green/70' : 'bg-ds-border'
                    }`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Step Forms */}
            <form onSubmit={handleSaveRule} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col m-0">
              
              {/* STEP 1: Select Trigger */}
              {step === 1 && (
                <div className="space-y-4 flex-1">
                  <p className="text-xs text-ds-text-3 leading-relaxed m-0 font-ds-sans">
                    Choose what action on the blockchain triggers alert rule dispatches.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => setTriggerType('event')}
                      className={`p-3.5 border border-solid rounded-lg text-left transition-all cursor-pointer flex items-start gap-3.5 outline-none ${
                        triggerType === 'event'
                          ? 'border-ds-green text-ds-green bg-ds-green/5'
                          : 'border-ds-border text-ds-text-2 bg-transparent hover:border-ds-text-3'
                      }`}
                    >
                      <span className="material-symbols-outlined mt-0.5" style={{ fontSize: '20px' }}>notifications</span>
                      <div>
                        <div className="text-xs font-bold font-ds-mono uppercase">Event Emitted</div>
                        <div className="text-[10px] text-ds-text-3 mt-1 normal-case leading-relaxed font-ds-sans">
                          Emits whenever the contract registers logs (e.g. Transfers, Approvals, Deposits).
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTriggerType('function')}
                      className={`p-3.5 border border-solid rounded-lg text-left transition-all cursor-pointer flex items-start gap-3.5 outline-none ${
                        triggerType === 'function'
                          ? 'border-ds-green text-ds-green bg-ds-green/5'
                          : 'border-ds-border text-ds-text-2 bg-transparent hover:border-ds-text-3'
                      }`}
                    >
                      <span className="material-symbols-outlined mt-0.5" style={{ fontSize: '20px' }}>call</span>
                      <div>
                        <div className="text-xs font-bold font-ds-mono uppercase">Function Called</div>
                        <div className="text-[10px] text-ds-text-3 mt-1 normal-case leading-relaxed font-ds-sans">
                          Triggers when a specific smart contract method is invoked on-chain.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTriggerType('failed')}
                      className={`p-3.5 border border-solid rounded-lg text-left transition-all cursor-pointer flex items-start gap-3.5 outline-none ${
                        triggerType === 'failed'
                          ? 'border-ds-green text-ds-green bg-ds-green/5'
                          : 'border-ds-border text-ds-text-2 bg-transparent hover:border-ds-text-3'
                      }`}
                    >
                      <span className="material-symbols-outlined mt-0.5" style={{ fontSize: '20px' }}>error</span>
                      <div>
                        <div className="text-xs font-bold font-ds-mono uppercase">Failed Call / Revert</div>
                        <div className="text-[10px] text-ds-text-3 mt-1 normal-case leading-relaxed font-ds-sans">
                          Fires alerts immediately when calls to monitored contracts revert/fail.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTriggerType('state')}
                      className={`p-3.5 border border-solid rounded-lg text-left transition-all cursor-pointer flex items-start gap-3.5 outline-none ${
                        triggerType === 'state'
                          ? 'border-ds-green text-ds-green bg-ds-green/5'
                          : 'border-ds-border text-ds-text-2 bg-transparent hover:border-ds-text-3'
                      }`}
                    >
                      <span className="material-symbols-outlined mt-0.5" style={{ fontSize: '20px' }}>query_stats</span>
                      <div>
                        <div className="text-xs font-bold font-ds-mono uppercase">State Variable Change</div>
                        <div className="text-[10px] text-ds-text-3 mt-1 normal-case leading-relaxed font-ds-sans">
                          Observes changes to specific storage variables (e.g. Owner updates, Pool lock flags).
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Target & Event */}
              {step === 2 && (
                <div className="space-y-5 flex-1">
                  {/* Select Contract */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                      Watched Contract
                    </label>
                    <select
                      value={selectedContractAddress}
                      onChange={(e) => setSelectedContractAddress(e.target.value)}
                      className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none uppercase font-bold"
                    >
                      {contracts.map((c) => (
                        <option key={c._id} value={c.address}>
                          {c.name.toUpperCase()} ({c.address.slice(0, 10)}…)
                        </option>
                      ))}
                    </select>
                  </div>

                  {triggerType !== 'failed' && (
                    <div className="space-y-4">
                      {/* Select Event */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                          Select Trigger Name
                        </label>
                        
                        <div className="flex items-center gap-4 text-xs select-none">
                          <label className="flex items-center gap-2 cursor-pointer text-ds-text-2">
                            <input
                              type="radio"
                              checked={!isCustomEvent}
                              onChange={() => setIsCustomEvent(false)}
                              className="accent-ds-green"
                            />
                            Known Names list
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-ds-text-2">
                            <input
                              type="radio"
                              checked={isCustomEvent}
                              onChange={() => setIsCustomEvent(true)}
                              className="accent-ds-green"
                            />
                            Custom input
                          </label>
                        </div>

                        {!isCustomEvent ? (
                          <select
                            value={selectedEventName}
                            onChange={(e) => setSelectedEventName(e.target.value)}
                            className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none"
                          >
                            <option value="*">All events (*)</option>
                            {activeContract?.knownEvents.map((ev) => (
                              <option key={ev} value={ev}>
                                {ev}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            value={customEventInput}
                            onChange={(e) => setCustomEventInput(e.target.value)}
                            placeholder="e.g. SwapExactTokens"
                            className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none"
                          />
                        )}
                        
                        {activeContract?.hasAbi ? (
                          <div className="text-[10px] text-ds-green font-ds-mono">
                            ✓ Custom ABI loaded for this contract. ABI event names resolved.
                          </div>
                        ) : (
                          <div className="text-[10px] text-ds-amber font-ds-mono">
                            ⚠ No ABI verified for this contract. Displaying standard event names suggestions.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {triggerType === 'failed' && (
                    <div className="p-4 border border-solid border-ds-border rounded-lg bg-ds-panel-2/50 font-ds-sans text-xs text-ds-text-2 leading-relaxed select-none">
                      <span className="font-bold text-ds-red uppercase font-ds-mono block mb-1">Failed Tx Alert Mode</span>
                      Configuring a rule on all transaction failures/reverts for this contract. The trigger event is set to `*`.
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Criteria Condition */}
              {step === 3 && (
                <div className="space-y-6 flex-1">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enableFilter}
                        onChange={(e) => setEnableFilter(e.target.checked)}
                        className="accent-ds-green"
                      />
                      Enable argument filter criteria
                    </label>
                    <p className="text-[10px] text-ds-text-3 leading-relaxed m-0 font-ds-sans normal-case font-normal select-none">
                      Alert only when a specific argument in the logs matches a numeric comparison.
                    </p>
                  </div>

                  {enableFilter && (
                    <div className="space-y-4 p-4 border border-solid border-ds-border rounded bg-ds-panel-2/30">
                      {/* Arg Name */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                          Argument Name
                        </label>
                        <input
                          type="text"
                          required
                          value={filterArgName}
                          onChange={(e) => setFilterArgName(e.target.value)}
                          placeholder="e.g. value or amount"
                          className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none"
                        />
                      </div>

                      {/* Criteria operator */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                          Operator
                        </label>
                        <select
                          value={filterOp}
                          onChange={(e) => setFilterOp(e.target.value)}
                          className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none font-bold text-ds-green"
                        >
                          <option value=">">&gt; Greater Than</option>
                          <option value="<">&lt; Less Than</option>
                          <option value=">=">&gt;= Greater or Equal</option>
                          <option value="<=">&lt;= Less or Equal</option>
                          <option value="=">= Equals</option>
                        </select>
                      </div>

                      {/* Target value */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                          Value <span className="text-ds-amber lowercase font-normal">(raw on-chain units / wei)</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={filterValue}
                          onChange={(e) => setFilterValue(e.target.value)}
                          placeholder="e.g. 1000000000000000000"
                          className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none"
                        />
                        <span className="block text-[9px] text-ds-text-3 font-ds-sans leading-relaxed">
                          Wei for amounts — no decimals applied (e.g. 1 XRP = 1,000,000 drops, 1 ETH = 10^18 wei).
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Destinations */}
              {step === 4 && (
                <div className="space-y-5 flex-1">
                  {/* Select Destination Channel */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold select-none">
                      Notification Channel
                    </label>
                    <div className="grid grid-cols-2 gap-2 select-none">
                      {[
                        { id: 'telegram', label: 'Telegram Bot' },
                        { id: 'slack', label: 'Slack Webhook' },
                        { id: 'discord', label: 'Discord Webhook' },
                        { id: 'webhook', label: 'Custom HTTP Webhook' },
                        { id: 'email', label: 'Email Address' },
                      ].map((ch) => {
                        const active = selectedChannel === ch.id;
                        const allowed = isChannelAllowed(ch.id);
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            disabled={!allowed}
                            onClick={() => {
                              setSelectedChannel(ch.id as any);
                              setDestinationTarget('');
                              setTestResult(null);
                            }}
                            className={`p-2.5 border border-solid rounded text-left flex justify-between items-center text-[10px] font-ds-mono font-bold uppercase transition-all outline-none ${
                              active
                                ? 'border-ds-green text-ds-green bg-ds-green/5 cursor-pointer'
                                : allowed
                                ? 'border-ds-border text-ds-text-2 bg-transparent hover:border-ds-text-3 cursor-pointer'
                                : 'border-ds-border/40 text-ds-text-3 bg-ds-shell/50 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <span>{ch.label}</span>
                            {!allowed && (
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>lock</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {plan === 'free' && (
                      <span className="block text-[9px] text-ds-amber font-ds-sans leading-relaxed select-none">
                        Free plan is limited to Telegram. Upgrade to Pro to unlock Slack, Discord, Email and raw Webhooks.
                      </span>
                    )}
                  </div>

                  {/* Destination input target */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                      {selectedChannel === 'telegram' && 'Telegram Chat ID'}
                      {selectedChannel === 'slack' && 'Slack Webhook URL'}
                      {selectedChannel === 'discord' && 'Discord Webhook URL'}
                      {selectedChannel === 'webhook' && 'HTTP Endpoint Webhook URL'}
                      {selectedChannel === 'email' && 'Email Address'}
                    </label>
                    <input
                      type="text"
                      required
                      value={destinationTarget}
                      onChange={(e) => {
                        setDestinationTarget(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder={
                        selectedChannel === 'telegram'
                          ? 'e.g. -1001234567890'
                          : selectedChannel === 'email'
                          ? 'e.g. alerts@company.com'
                          : 'https://...'
                      }
                      className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none"
                    />
                    <span className="block text-[10px] text-ds-text-3 font-ds-sans leading-relaxed">
                      {selectedChannel === 'telegram' && 'Chat ID from a group containing your bot.'}
                      {selectedChannel === 'email' && 'Where alerts are dispatched as HTML notification emails.'}
                      {(selectedChannel === 'webhook' || selectedChannel === 'discord' || selectedChannel === 'slack') &&
                        'Outbound signed request that passes validation filters.'}
                    </span>
                  </div>

                  {/* Optional rule name */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider font-bold">
                      Alert Name / Alias <span className="lowercase font-normal text-ds-text-3">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={alertName}
                      onChange={(e) => setAlertName(e.target.value)}
                      placeholder="e.g. USDC Whale Transfer"
                      className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-sans text-ds-text focus:border-ds-green outline-none"
                    />
                  </div>
                </div>
              )}

              {addError && (
                <div className="p-3 border border-solid border-ds-red/30 bg-ds-red/5 text-ds-red text-xs font-ds-mono rounded">
                  {addError}
                </div>
              )}

              {/* Wizard Preview Matches & Channel Test Panel */}
              {selectedContractAddress && (
                <div className="mt-auto pt-4 border-0 border-t border-solid border-ds-border space-y-3">
                  <div className="p-4 rounded-lg bg-ds-panel-2 border border-solid border-ds-border/50 flex flex-col gap-3 font-ds-mono text-xs select-none">
                    <div className="flex justify-between items-center">
                      <span className="text-ds-text-3 font-bold uppercase text-[9px] tracking-wider">Historical Preview (24h)</span>
                      {isPreviewLoading ? (
                        <span className="text-[10px] text-ds-text-3">CALCULATING…</span>
                      ) : (
                        <span className="font-bold text-ds-green">
                          {previewCount !== null ? `${previewCount} MATCH(ES)` : '—'}
                        </span>
                      )}
                    </div>
                    
                    {step === 4 && (
                      <div className="flex items-center gap-3 pt-2 border-0 border-t border-solid border-ds-border/30">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isTesting || !destinationTarget}
                          onClick={handleSendTestAlert}
                          className="font-ds-mono text-[9px] uppercase px-3 py-1 flex items-center gap-1.5 h-[26px]"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>send</span>
                          {isTesting ? 'Sending…' : 'Send test alert'}
                        </Button>

                        {testResult && (
                          <div className={`text-[10px] font-ds-sans leading-none flex-1 truncate ${
                            testResult.success ? 'text-ds-green' : 'text-ds-red'
                          }`}>
                            {testResult.success ? '✓ Sent!' : testResult.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stepper Wizard Actions */}
                  <div className="flex gap-3 pt-2">
                    {step > 1 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handlePrevStep}
                        className="flex-1 font-ds-mono text-xs uppercase"
                      >
                        Back
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => { setIsAddSheetOpen(false); setStep(1); }}
                        className="flex-1 font-ds-mono text-xs uppercase"
                      >
                        Cancel
                      </Button>
                    )}

                    {step < 4 ? (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleNextStep}
                        className="flex-1 font-ds-mono text-xs uppercase"
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isPending || !destinationTarget}
                        className="flex-1 font-ds-mono text-xs uppercase"
                      >
                        {isPending ? 'Saving…' : 'Save Rule'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
