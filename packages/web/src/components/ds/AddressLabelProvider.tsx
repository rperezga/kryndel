'use client';

/**
 * AddressLabelProvider — makes the user's address-label map available to any
 * AddressPill (or other component) deep in the (app) tree, so addresses render
 * with human names without threading props through every call site.
 *
 * Fed once by (app)/layout.tsx with a `{ "0x…(lowercase)": "Label" }` map
 * (built-in + contract names + user labels merged). `useAddressLabel` falls back
 * to built-in well-known addresses even when no provider is mounted.
 */
import * as React from 'react';
import { resolveAddressLabel } from '@/lib/address-labels';

const AddressLabelContext = React.createContext<Record<string, string>>({});

export function AddressLabelProvider({
  labels,
  children,
}: {
  labels: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <AddressLabelContext.Provider value={labels ?? {}}>
      {children}
    </AddressLabelContext.Provider>
  );
}

/** Resolve a label for `address` (user/contract map + built-in), or null. */
export function useAddressLabel(address: string): string | null {
  const labels = React.useContext(AddressLabelContext);
  return React.useMemo(() => resolveAddressLabel(address, labels), [address, labels]);
}
