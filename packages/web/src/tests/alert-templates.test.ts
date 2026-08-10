import { describe, expect, it } from 'vitest';
import { buildAlertFilter } from '@/lib/alert-filter';
import { getAlertTemplate } from '@/lib/alert-templates';

const ZERO = '0x0000000000000000000000000000000000000000';

describe('complete alert templates', () => {
  it.each([
    ['mint', 'Mints', 'Transfer', 'from'],
    ['burn', 'Burns', 'Transfer', 'to'],
  ] as const)('%s presets an address equality filter against 0x0', (id, label, eventName, argName) => {
    const template = getAlertTemplate(id);
    expect(template).toMatchObject({
      id,
      label,
      eventName,
      enableFilter: true,
      filterArgName: argName,
      filterOp: '=',
      filterValue: ZERO,
      defaultName: label,
    });
    expect(buildAlertFilter(template!.filterArgName, template!.filterOp, template!.filterValue)).toEqual({
      [argName]: { $eq: ZERO },
    });
  });

  it('admin-activity watches OwnershipTransferred without a filter', () => {
    expect(getAlertTemplate('admin-activity')).toMatchObject({
      id: 'admin-activity',
      label: 'Admin activity',
      eventName: 'OwnershipTransferred',
      enableFilter: false,
      defaultName: 'Admin activity',
    });
  });
});
