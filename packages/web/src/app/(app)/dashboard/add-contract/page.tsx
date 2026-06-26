/**
 * /dashboard/add-contract — form to register a new contract.
 *
 * 2026-06-17 PA-SMOKE fix: the Server Action used to call its own /api/contracts
 * via internal fetch, which did NOT propagate the session cookie — every
 * submission returned 401 Unauthorized.  The action now lives in actions.ts
 * and does the auth check + MongoDB write directly.
 *
 * 2026-06-25: re-skinned to the console design system (--ds-* tokens).
 */
import { redirect } from 'next/navigation';
import { auth }     from '@/auth';
import { addContract } from './actions';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Add contract' };

const inputCls =
  'w-full bg-ds-shell border border-solid border-ds-border rounded px-3 py-2.5 font-ds-mono text-sm text-ds-text placeholder:text-ds-text-3 outline-none focus:border-ds-green transition-colors';
const labelCls =
  'font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest font-bold select-none';

export default async function AddContractPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="max-w-xl mx-auto w-full">
      <a
        href="/dashboard"
        className="inline-flex items-center gap-1 font-ds-mono text-[11px] text-ds-text-3 hover:text-ds-green no-underline transition-colors"
      >
        ← Dashboard
      </a>

      <div className="mt-4 mb-6 select-none">
        <h1 className="font-ds-sans text-2xl font-bold tracking-tight text-ds-text">Add contract</h1>
        <p className="font-ds-mono text-xs text-ds-text-3 mt-1 leading-relaxed">
          Enter the contract address to start watching it. Kryndel will index all events and let you set alert rules.
        </p>
      </div>

      <form
        action={addContract}
        className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="address" className={labelCls}>Contract address</label>
          <input id="address" name="address" type="text" required placeholder="0x… or r…" className={inputCls} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="surface" className={labelCls}>Network</label>
          <select id="surface" name="surface" className={`${inputCls} cursor-pointer`}>
            <option value="evm">XRPL EVM Sidechain (mainnet)</option>
            <option value="native">XLS-0101 Native (AlphaNet)</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className={labelCls}>
            Label <span className="text-ds-text-3/70 lowercase tracking-normal">(optional)</span>
          </label>
          <input id="name" name="name" type="text" placeholder="e.g. WXRP staking contract" className={inputCls} />
        </div>

        <button
          type="submit"
          className="mt-1 px-5 py-2.5 bg-ds-green text-ds-shell font-ds-mono text-xs font-bold rounded hover:bg-ds-green/90 cursor-pointer border-0 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ds-green"
        >
          Start watching →
        </button>
      </form>
    </div>
  );
}
