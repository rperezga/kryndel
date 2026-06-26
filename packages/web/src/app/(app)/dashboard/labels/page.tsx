import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { LabelsClient } from './LabelsClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Address Labels · Kryndel' };

export default async function LabelsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const db = await getDb();
  const docs = await db
    .collection('address_labels')
    .find({ userId: user._id })
    .sort({ updatedAt: -1 })
    .toArray();

  const initialLabels = docs.map((l) => ({
    address: String(l.address ?? ''),
    label:   String(l.label ?? ''),
    surface: (String(l.surface ?? 'evm') === 'native' ? 'native' : 'evm') as 'evm' | 'native',
  }));

  return <LabelsClient initialLabels={initialLabels} />;
}
