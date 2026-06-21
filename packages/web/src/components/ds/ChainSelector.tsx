'use client';

import { useState } from 'react';

export function ChainSelector() {
  const [chain, setChain] = useState<'evm' | 'xls'>('evm');
  const [open, setOpen] = useState(false);

  return (
    <div className="relative font-ds-mono text-xs select-none">
      <button
        onClick={() => setOpen(!open)}
        className="bg-ds-shell border border-solid border-ds-border text-ds-green px-3 py-1.5 rounded flex items-center gap-2 hover:border-ds-green/40 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ds-green"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="w-1.5 h-1.5 bg-ds-green rounded-full animate-pulse" />
        <span>{chain === 'evm' ? 'XRPL EVM' : 'XLS-0101 (AlphaNet)'}</span>
        <span className="opacity-60 font-sans">↓</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-48 bg-ds-panel border border-solid border-ds-border rounded shadow-lg z-20 overflow-hidden">
            <button
              onClick={() => {
                setChain('evm');
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-ds-panel-2 font-ds-mono text-xs cursor-pointer border-0 bg-transparent outline-none focus:bg-ds-panel-2 ${
                chain === 'evm' ? 'text-ds-green font-bold' : 'text-ds-text-2'
              }`}
            >
              XRPL EVM (Mainnet)
            </button>
            <button
              onClick={() => {
                setChain('xls');
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-ds-panel-2 font-ds-mono text-xs cursor-pointer border-0 bg-transparent outline-none focus:bg-ds-panel-2 ${
                chain === 'xls' ? 'text-ds-green font-bold' : 'text-ds-text-2'
              }`}
            >
              XLS-0101 (AlphaNet)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
