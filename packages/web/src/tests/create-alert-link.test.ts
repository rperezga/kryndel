import { describe, expect, it, vi } from 'vitest';
import { createAlertHref, createAlertPath, ensureContractForTemplate } from '@/lib/create-alert-link';

const ADDRESS = '0x1234567890123456789012345678901234567890';

describe('public create-alert links', () => {
  it('opens the prefilled builder directly for an authenticated user', () => {
    expect(createAlertHref(ADDRESS, true, 'mint')).toBe(
      `/dashboard/rules?contract=${ADDRESS}&template=mint&add=true`,
    );
  });

  it('sends an anonymous user through login with the complete builder callback', () => {
    const destination = createAlertPath(ADDRESS, 'any');
    expect(createAlertHref(ADDRESS, false, 'any')).toBe(
      `/login?callbackUrl=${encodeURIComponent(destination)}`,
    );
  });

  it('adds an unregistered contract before applying the template', async () => {
    const addContract = vi.fn().mockResolvedValue({ success: 'Contract successfully added!' });
    const applyTemplate = vi.fn();

    const result = await ensureContractForTemplate({
      address: ADDRESS.toUpperCase(),
      contracts: [],
      addContract,
      applyTemplate,
    });

    expect(addContract).toHaveBeenCalledWith(ADDRESS.toLowerCase(), 'evm', '0x123456…7890');
    expect(applyTemplate).toHaveBeenCalledWith(expect.objectContaining({
      address: ADDRESS.toLowerCase(),
      surface: 'evm',
      name: '0x123456…7890',
      knownEvents: [],
      active: true,
    }));
    expect(result.error).toBeUndefined();
  });
});
