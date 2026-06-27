'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const R_ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

/** Client form for the public Sentinel tool: validates an r-address, then
 *  navigates to /sentinel/<address> (server-rendered, shareable, cacheable). */
export function SentinelForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = value.trim();
    if (!R_ADDR.test(a)) {
      setError('Enter a valid XRPL classic address — starts with “r”.');
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/sentinel/${a}`);
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
          placeholder="r… issuer account"
          spellCheck={false}
          aria-label="XRPL issuer account"
          className="flex-1 bg-ds-shell border border-solid border-ds-border rounded px-4 py-3 font-ds-mono text-sm text-ds-text focus:border-ds-green outline-none placeholder:text-ds-text-3"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 bg-ds-green text-ds-shell rounded font-ds-mono text-sm uppercase font-bold tracking-wider cursor-pointer outline-none hover:opacity-90 transition-opacity disabled:opacity-60 select-none"
        >
          {pending ? 'Checking…' : 'Check'}
        </button>
      </div>
      {error && <p className="mt-2 font-ds-mono text-xs text-ds-red">{error}</p>}
    </form>
  );
}
