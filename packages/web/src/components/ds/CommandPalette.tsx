'use client';

import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const handleToggle = () => setOpen((o) => !o);
    window.addEventListener('toggle-command-palette', handleToggle);
    return () => window.removeEventListener('toggle-command-palette', handleToggle);
  }, []);

  if (!open) return null;

  const navigateTo = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const handleAction = (action: string) => {
    setOpen(false);
    if (action === 'copy-secret') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText('whsec_mock_webhook_secret_value');
        alert('Mock webhook secret copied to clipboard!');
      } else {
        alert('Clipboard not available in this environment. Webhook secret: whsec_mock_webhook_secret_value');
      }
    } else if (action === 'replay-tx') {
      alert('Transaction replay sequence initiated!');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ds-shell/80 backdrop-blur-sm">
      <div className="fixed inset-0" onClick={() => setOpen(false)} />
      <Command className="relative bg-ds-panel border border-solid border-ds-border w-full max-w-[540px] rounded-lg shadow-[0_0_24px_rgba(43,217,111,0.1)] overflow-hidden font-ds-sans z-10">
        <div className="flex items-center border-b border-solid border-ds-border px-4 py-3">
          <Command.Input
            placeholder="Type a command or search..."
            className="w-full bg-transparent border-0 text-ds-text placeholder:text-ds-text-3 font-ds-mono text-sm outline-none focus:outline-none"
            autoFocus
          />
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <Command.Empty className="p-4 text-xs font-ds-mono text-ds-text-3 text-center">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Navigation"
            className="text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider px-3 py-2"
          >
            <Command.Item
              onSelect={() => navigateTo('/dashboard')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Go to Overview
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('/explorer')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Go to Explorer
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('/dashboard/events')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Go to Events
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('/dashboard/webhooks')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Go to Webhooks
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('/docs')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Go to Docs
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('/status')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Go to Status
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Actions"
            className="text-[10px] font-ds-mono text-ds-text-3 uppercase tracking-wider px-3 py-2 pt-4"
          >
            <Command.Item
              onSelect={() => navigateTo('/dashboard/add-contract')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Open contract 0x... / Deploy New
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('/dashboard/rules')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Create alert
            </Command.Item>
            <Command.Item
              onSelect={() => handleAction('replay-tx')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Replay tx
            </Command.Item>
            <Command.Item
              onSelect={() => handleAction('copy-secret')}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-ds-mono text-ds-text-2 hover:bg-ds-panel-2 hover:text-ds-green cursor-pointer select-none outline-none focus-visible:bg-ds-panel-2 focus-visible:text-ds-green"
            >
              Copy webhook secret
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
