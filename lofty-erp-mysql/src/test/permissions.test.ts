import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '../lib/constants';

describe('Role-Based Permissions Matrix', () => {
  it('verifies Owner has complete administrative authority', () => {
    const perms = ROLE_PERMISSIONS.Owner;
    expect(perms.canManageVendors).toBe(true);
    expect(perms.canManageProducts).toBe(true);
    expect(perms.canManageWarehouses).toBe(true);
    expect(perms.canCreatePO).toBe(true);
    expect(perms.canVerifyDelivery).toBe(true);
    expect(perms.canVerifyBill).toBe(true);
    expect(perms.canRecordPayment).toBe(true);
    expect(perms.canManageMembers).toBe(true);
    expect(perms.canManageSettings).toBe(true);
  });

  it('verifies Purchasing role cannot verify delivery or alter members', () => {
    const perms = ROLE_PERMISSIONS.Purchasing;
    expect(perms.canManageVendors).toBe(true);
    expect(perms.canCreatePO).toBe(true);
    expect(perms.canVerifyDelivery).toBe(false);
    expect(perms.canVerifyBill).toBe(false);
    expect(perms.canManageMembers).toBe(false);
  });

  it('verifies Warehouse role can inspect physical deliveries but cannot create PO or verify bills', () => {
    const perms = ROLE_PERMISSIONS.Warehouse;
    expect(perms.canVerifyDelivery).toBe(true);
    expect(perms.canCreatePO).toBe(false);
    expect(perms.canVerifyBill).toBe(false);
    expect(perms.canRecordPayment).toBe(false);
  });

  it('verifies Accountant role can review bills and record payments but cannot create POs or verify physical deliveries', () => {
    const perms = ROLE_PERMISSIONS.Accountant;
    expect(perms.canVerifyBill).toBe(true);
    expect(perms.canRecordPayment).toBe(true);
    expect(perms.canCreatePO).toBe(false);
    expect(perms.canVerifyDelivery).toBe(false);
    expect(perms.canManageWarehouses).toBe(false);
  });
});
