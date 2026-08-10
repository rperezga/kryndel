import type { AlertTemplate } from './alert-templates';

export type AlertTemplateId = AlertTemplate['id'];

export interface AlertContractInfo {
  _id: string;
  address: string;
  name: string;
  surface: 'evm' | 'native';
  knownEvents: string[];
  hasAbi: boolean;
  active: boolean;
}

interface EnsureContractOptions {
  address: string;
  contracts: AlertContractInfo[];
  addContract: (address: string, surface: string, name: string) => Promise<{ success?: string; error?: string }>;
  applyTemplate: (contract: AlertContractInfo) => void;
}

/** Ensure a deep-linked EVM contract is watched before opening its alert template. */
export async function ensureContractForTemplate({
  address,
  contracts,
  addContract,
  applyTemplate,
}: EnsureContractOptions): Promise<{ contract?: AlertContractInfo; error?: string }> {
  const normalized = address.trim().toLowerCase();
  const existing = contracts.find((contract) => contract.address.toLowerCase() === normalized);
  if (existing) {
    applyTemplate(existing);
    return { contract: existing };
  }

  const name = `${normalized.slice(0, 8)}…${normalized.slice(-4)}`;
  const result = await addContract(normalized, 'evm', name);
  if (result.error) return { error: result.error };

  const contract: AlertContractInfo = {
    _id: `pending:${normalized}`,
    address: normalized,
    name,
    surface: 'evm',
    knownEvents: [],
    hasAbi: false,
    active: true,
  };
  applyTemplate(contract);
  return { contract };
}

/** Destination that opens the rule builder with contract and template prefilled. */
export function createAlertPath(address: string, template: AlertTemplateId = 'any'): string {
  const params = new URLSearchParams({
    contract: address,
    template,
    add: 'true',
  });
  return `/dashboard/rules?${params.toString()}`;
}

/** Public CTA destination, preserving the builder deep-link through NextAuth login. */
export function createAlertHref(
  address: string,
  isAuthenticated: boolean,
  template: AlertTemplateId = 'any',
): string {
  const destination = createAlertPath(address, template);
  return isAuthenticated
    ? destination
    : `/login?callbackUrl=${encodeURIComponent(destination)}`;
}
