'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { validateAddress } from '@/lib/validate';

export default function SearchForm() {
  const router = useRouter();
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const address = (fd.get('address') as string | null)?.trim() ?? '';
    if (!validateAddress(address)) {
      setError('Invalid address — EVM (0x… 40 hex) or Xahau rAddress (r…)');
      return;
    }
    setError('');
    router.push(`/contract/${address}`);
  }

  return (
    <>
      <form className="search-form" onSubmit={handleSubmit} autoComplete="off">
        <input
          name="address"
          placeholder="0x… or r… contract address"
          spellCheck={false}
          aria-label="Contract address"
        />
        <button type="submit" className="btn">Explore →</button>
      </form>
      {error && <p className="form-msg error" style={{ maxWidth: 640, margin: '.5rem auto 0' }}>{error}</p>}
    </>
  );
}
