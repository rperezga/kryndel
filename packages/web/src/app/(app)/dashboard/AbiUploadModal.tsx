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

  const btnStyle: React.CSSProperties = {
    padding: '0.375rem 0.625rem',
    fontSize: '0.8125rem',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: done ? '#4ade80' : 'var(--muted)',
    background: 'transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <button style={btnStyle} onClick={() => setOpen(true)}>
        {done ? '✓ ABI' : 'Upload ABI'}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '1.5rem',
            width: 'min(480px, 90vw)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1rem' }}>Upload Contract ABI</h2>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}
              >×</button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Paste the JSON ABI array from Hardhat, Foundry, or Etherscan.
              Enables named event decoding and event dropdown in alert rules.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <textarea
                value={abiText}
                onChange={(e) => setAbiText(e.target.value)}
                required
                rows={10}
                placeholder={'[\n  {\n    "type": "event",\n    "name": "Transfer",\n    "inputs": [...]\n  }\n]'}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text)',
                  fontFamily: 'var(--mono)',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  resize: 'vertical',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              {error && (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#f87171' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.5rem',
                  background: loading ? 'var(--border)' : 'var(--accent)',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: 4,
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
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
