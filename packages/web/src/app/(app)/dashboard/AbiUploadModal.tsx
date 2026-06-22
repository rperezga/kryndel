'use client';
/**
 * AbiUploadModal — "Upload ABI" button + modal for a single contract.
 *
 * The ABI is optional (not required to add a contract). If uploaded it enables:
 *   • Decoding custom events by name in the explorer and alerts.
 *   • Named event dropdown in the rules form (known-events endpoint).
 *
 * The textarea accepts a raw JSON ABI array (copy-paste from Hardhat / Foundry /
 * Etherscan "Contract ABI" section).
 */
import { useState } from 'react';

interface Props {
  address: string;
  hasAbi:  boolean;
}

export default function AbiUploadModal({ address, hasAbi: initialHasAbi }: Props) {
  const [open,    setOpen]    = useState(false);
  const [abiText, setAbiText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState(initialHasAbi);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${address}/abi`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ abi: abiText }),
      });
      const json = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string | undefined) ?? `Error ${res.status}`);
      } else {
        setDone(true);
        setOpen(false);
        setAbiText('');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`px-3 py-1.5 text-xs border border-solid rounded bg-transparent cursor-pointer whitespace-nowrap font-ds-mono outline-none hover:border-ds-green transition-all ${
          done
            ? 'border-ds-green text-ds-green'
            : 'border-ds-border text-ds-text-2 hover:text-ds-text'
        }`}
      >
        {done ? '✓ ABI' : 'Upload ABI'}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-ds-shell/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 w-full max-w-[480px] shadow-[0_0_24px_rgba(43,217,111,0.15)] flex flex-col gap-4 font-ds-sans text-ds-text text-left">
            <div className="flex justify-between items-center">
              <h2 className="m-0 font-ds-mono text-sm font-bold text-ds-green uppercase tracking-wider">
                Upload Contract ABI
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="bg-transparent border-0 text-ds-text-3 hover:text-ds-text cursor-pointer text-xl outline-none"
              >
                &times;
              </button>
            </div>

            <p className="m-0 text-xs text-ds-text-3 font-ds-sans leading-relaxed">
              Paste the JSON ABI array from Hardhat, Foundry, or Etherscan. Enables named event decoding and event dropdown in alert rules.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 m-0">
              <textarea
                value={abiText}
                onChange={(e) => setAbiText(e.target.value)}
                required
                rows={10}
                placeholder={'[\n  {\n    "type": "event",\n    "name": "Transfer",\n    "inputs": [...]\n  }\n]'}
                className="w-full bg-ds-shell border border-solid border-ds-border rounded p-3 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none resize-y min-h-[160px]"
              />
              {error && (
                <p className="m-0 text-xs text-ds-red font-ds-mono">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-ds-green text-ds-shell font-bold rounded cursor-pointer hover:bg-ds-green/90 transition-all font-ds-mono uppercase text-xs tracking-wider disabled:bg-ds-border disabled:text-ds-text-3 disabled:cursor-not-allowed border-0"
              >
                {loading ? 'Uploading…' : 'Upload ABI'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
