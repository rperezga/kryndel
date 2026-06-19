/**
 * GET /api/contracts/[address]/known-events
 *
 * Returns a sorted, deduplicated list of event names for a contract, combining:
 *   1. Event entries from the user-uploaded ABI (if any).
 *   2. Standard event names from the on-chain registry (always included as hints).
 *
 * Used by the dashboard rules form to populate the event name suggestions.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser }        from '@/lib/current-user';
import { getDb }              from '@/lib/db';
import { STANDARD_EVENT_NAMES } from '@kryndel/core';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const { address } = await params;
  const db = await getDb();

  const contract = await db.collection('contracts').findOne({
    userId: user._id, address: address.toLowerCase(),
  });
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found.' }, { status: 404 });
  }

  // Extract event names from uploaded ABI (if present)
  const abiNames: string[] = [];
  if (Array.isArray(contract.abi)) {
    for (const entry of contract.abi as unknown[]) {
      if (
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        (entry as Record<string, unknown>).type === 'event' &&
        typeof (entry as Record<string, unknown>).name === 'string'
      ) {
        const name = ((entry as Record<string, unknown>).name as string).trim();
        if (name) abiNames.push(name);
      }
    }
  }

  // Merge with standard names; deduplicate; sort
  const all = [...new Set([...abiNames, ...STANDARD_EVENT_NAMES])].sort();

  return NextResponse.json({ events: all, hasCustomAbi: abiNames.length > 0 });
}
