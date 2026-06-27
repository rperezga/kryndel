/**
 * /contract/[address] — Etapa 12 re-skin
 * RSC: validates address, fetches all data, passes to ContractClient (8 tabs).
 */
import type { Metadata }  from 'next';
import { notFound }       from 'next/navigation';
import { getDb }          from '@/lib/db';
import { validateAddress } from '@/lib/validate';
import { auth }           from '@/auth';
import { addContractToDashboard } from './actions';
import ContractClient     from './ContractClient';

interface Props { params: Promise<{ address: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  if (!validateAddress(address)) return { title: 'Contract not found' };
  const short = address.slice(0, 10) + '…';
  return {
    title: `${short} · Contract · Kryndel`,
    description: `Decode calls, trace events and set alerts for contract ${address} on XRPL EVM Sidechain.`,
  };
}

// ── Serialise helper ──────────────────────────────────────────────────────────

function ser<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && val.constructor?.name === 'ObjectId') return String(val);
    if (val instanceof Date) return val.toISOString();
    return val;
  }));
}

// ── "Add to Dashboard" slot (Server Action lives here, NOT in client) ─────────

async function AddToDashboardButton({
  address,
  surface,
  userHasContract,
  isAuthenticated,
}: {
  address: string;
  surface: string;
  userHasContract: boolean;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return (
      <a
        href={`/login?callbackUrl=${encodeURIComponent(`/contract/${address}`)}`}
        className="font-ds-mono text-xs text-ds-text-2 border border-solid border-ds-border hover:border-ds-green/40 hover:text-ds-green px-3.5 py-1.5 rounded no-underline transition-colors"
      >
        + Add to Dashboard
      </a>
    );
  }

  if (userHasContract) {
    return (
      <span className="font-ds-mono text-[10px] text-ds-green bg-ds-green/5 border border-solid border-ds-green/20 px-3 py-1 rounded-full">
        ✓ Monitored
      </span>
    );
  }

  return (
    <form
      action={async () => {
        'use server';
        await addContractToDashboard(address, surface);
      }}
    >
      <button
        type="submit"
        className="font-ds-mono text-xs text-ds-text-2 border border-solid border-ds-border hover:border-ds-green/40 hover:text-ds-green bg-transparent px-3.5 py-1.5 rounded cursor-pointer transition-colors"
      >
        + Add to Dashboard
      </button>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ContractPage({ params }: Props) {
  const { address } = await params;

  if (!validateAddress(address)) notFound();

  const db       = await getDb();
  const addrLow  = address.toLowerCase();

  // Contract metadata
  const contract = await db.collection('contracts').findOne({
    $or: [{ address: addrLow }, { address }],
  });

  // Calls + events (50 each) — no userId filter, public explorer
  const [calls, events, allCalls] = await Promise.all([
    db.collection('calls')
      .find({ $or: [{ contract: addrLow }, { contract: address }] })
      .sort({ indexedAt: -1 })
      .limit(50)
      .toArray(),
    db.collection('events')
      .find({ $or: [
        { contract: addrLow }, { contract: address },
        { contractAddress: addrLow }, { contractAddress: address },
      ]})
      .sort({ indexedAt: -1 })
      .limit(50)
      .toArray(),
    // count for stats
    db.collection('calls')
      .countDocuments({ $or: [{ contract: addrLow }, { contract: address }] }),
  ]);

  const surface: string = (contract?.surface as string | undefined) ?? 'evm';

  // Auth check for "Add to Dashboard" + alerts
  const session = await auth();
  let isAuthenticated = false;
  let userHasContract = false;
  let userId: string | null = null;
  let userAlertRules: Record<string, unknown>[] = [];

  if (session?.user?.email) {
    const user = await db.collection('users').findOne({ email: session.user.email.toLowerCase() });
    if (user) {
      isAuthenticated = true;
      userId = String(user._id);
      const owned = await db.collection('contracts').findOne({
        userId: user._id,
        $or: [{ address: addrLow }, { address }],
      });
      userHasContract = !!owned;

      // Fetch user's alert rules for this contract
      userAlertRules = await db.collection('alert_rules')
        .find({ userId: user._id, $or: [{ contract: addrLow }, { contract: address }] })
        .sort({ createdAt: -1 })
        .toArray() as unknown as Record<string, unknown>[];
    }
  }

  const eventNames = [...new Set(events.map((e) => e.name as string).filter(Boolean))].slice(0, 30);

  // Public page: never expose internal owner fields (_id / userId) in the raw doc.
  const rawContractSafe: Record<string, unknown> = (() => {
    if (!contract) return { address, surface, notIndexed: true };
    const { _id, userId, ...rest } = contract as Record<string, unknown>;
    void _id;
    void userId;
    return rest;
  })();

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `Contract ${address}`,
          url: `https://kryndel.dev/contract/${address}`,
          description: `Calls, events and alerts for XRPL EVM Sidechain contract ${address}.`,
        }) }}
      />

      <ContractClient
        address={address}
        surface={surface}
        contractName={(contract?.name ?? contract?.label ?? '') as string}
        firstSeenAt={(contract?.firstSeenAt ?? null) as string | null}
        updatedAt={(contract?.updatedAt ?? null) as string | null}
        contractAbi={ser(contract?.abi ?? null) as unknown[] | null}
        calls={ser(calls) as Record<string, unknown>[]}
        events={ser(events) as Record<string, unknown>[]}
        totalCallsCount={allCalls}
        eventNames={eventNames}
        isAuthenticated={isAuthenticated}
        userHasContract={userHasContract}
        userId={userId}
        alertRules={ser(userAlertRules) as Record<string, unknown>[]}
        rawContract={ser(rawContractSafe) as Record<string, unknown>}
        actionButton={
          <AddToDashboardButton
            address={address}
            surface={surface}
            userHasContract={userHasContract}
            isAuthenticated={isAuthenticated}
          />
        }
      />
    </>
  );
}
