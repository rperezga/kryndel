'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { validateAddress } from '@/lib/validate';

interface Props {
  suggestions?: string[];
}

export default function SearchForm({ suggestions }: Props) {
  const router = useRouter();
  const [addressValue, setAddressValue] = useState('');
  const [error, setError] = useState('');

  function doSearch(addr: string) {
    if (!validateAddress(addr)) {
      setError('Invalid address — EVM (0x… 40 hex) or XLS-0101 native (r…)');
      return;
    }
    setError('');
    router.push(`/contract/${addr}`);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    doSearch(addressValue.trim());
  }

  return (
    <>
      <form className="search-form" onSubmit={handleSubmit} autoComplete="off">
        <input
          name="address"
          value={addressValue}
          onChange={(e) => setAddressValue(e.target.value)}
          placeholder="0x… or r… contract address"
          spellCheck={false}
          aria-label="Contract address"
        />
        <button type="submit" className="btn">Explore →</button>
      </form>
      {error && <p className="form-msg error" style={{ maxWidth: 640, margin: '.5rem auto 0' }}>{error}</p>}

      {suggestions && suggestions.length > 0 && (
        <p style={{ marginTop: '1rem', fontSize: '.8rem', color: 'var(--muted2)' }}>
          Try:{' '}
          {suggestions.map((suggestion, idx) => {
            const isLast = idx === suggestions.length - 1;
            const displayLabel = suggestion.startsWith('0x')
              ? `${suggestion.slice(0, 8)}…`
              : suggestion;
            return (
              <span key={suggestion}>
                <button
                  type="button"
                  onClick={() => {
                    setAddressValue(suggestion);
                    doSearch(suggestion);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--signal)',
                    fontFamily: 'var(--mono)',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                    fontSize: 'inherit',
                  }}
                >
                  {displayLabel}
                </button>
                {!isLast && ' or '}
              </span>
            );
          })}
        </p>
      )}
    </>
  );
}

