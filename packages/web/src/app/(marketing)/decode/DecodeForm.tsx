'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client form for the public decoder. Validates the hash shape locally, then
 * navigates to /decode/<hash> (a server-rendered, shareable, cacheable URL).
 */
export function DecodeForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = value.trim().toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(h)) {
      setError('Enter a valid transaction hash — 0x followed by 64 hex characters.');
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/decode/${h}`);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="0x… transaction hash"
          spellCheck={false}
          aria-label="Transaction hash"
          className="flex-1 bg-ds-shell border border-solid border-ds-border rounded px-4 py-3 font-ds-mono text-sm text-ds-text focus:border-ds-green outline-none placeholder:text-ds-text-3"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 bg-ds-green text-ds-shell rounded font-ds-mono text-sm uppercase font-bold tracking-wider cursor-pointer outline-none hover:opacity-90 transition-opacity disabled:opacity-60 select-none"
        >
          {pending ? 'Decoding…' : 'Decode'}
        </button>
      </div>
      {error && <p className="mt-2 font-ds-mono text-xs text-ds-red">{error}</p>}
    </form>
  );
}
