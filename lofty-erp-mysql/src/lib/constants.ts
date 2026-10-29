import { BusinessRole } from '../types';

export const GST_RATES = [
  { value: 0, label: '0% (Exempt)' },
  { value: 5, label: '5% GST' },
  { value: 12, label: '12% GST' },
  { value: 18, label: '18% Standard GST' },
  { value: 28, label: '28% Higher GST' },
];

export const STANDARD_UNITS = [
  'Pcs',
  'Units',
  'Kg',
  'Grams',
  'Meters',
  'Boxes',
  'Liters',
  'Bags',
  'Sets',
  'Sheets',
  'Rolls',
];

export const PAYMENT_TERMS = [
  'Immediate / Advance',
  'Due on Receipt',
  'Net 15 Days',
  'Net 30 Days',
  'Net 45 Days',
  'Net 60 Days',
];

export const ROLE_DEFINITIONS: Record<BusinessRole, { name: string; description: string; color: string }> = {
  Owner: {
    name: 'Business Owner',
    description: 'Full business administration, membership authority, and all operational modules.',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  Manager: {
    name: 'Operations Manager',
    description: 'Oversight of purchases, warehouse receipts, vendor catalogs, and bill workflows.',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  Purchasing: {
    name: 'Purchasing Specialist',
    description: 'Vendor relationship management, catalog price negotiations, and Purchase Orders.',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  Warehouse: {
    name: 'Warehouse & Godown Staff',
    description: 'Physical delivery check-in, counting accepted and damaged quantities, stock logs.',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  Accountant: {
    name: 'Financial Accountant',
    description: 'Supplier bill review against POs, GST tax verification, and recording payments.',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
};

export interface RolePermissions {
  canManageVendors: boolean;
  canManageProducts: boolean;
  canManageWarehouses: boolean;
  canCreatePO: boolean;
  canVerifyDelivery: boolean;
  canVerifyBill: boolean;
  canRecordPayment: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
}

export const ROLE_PERMISSIONS: Record<BusinessRole, RolePermissions> = {
  Owner: {
    canManageVendors: true,
    canManageProducts: true,
    canManageWarehouses: true,
    canCreatePO: true,
    canVerifyDelivery: true,
    canVerifyBill: true,
    canRecordPayment: true,
    canManageMembers: true,
    canManageSettings: true,
  },
  Manager: {
    canManageVendors: true,
    canManageProducts: true,
    canManageWarehouses: true,
    canCreatePO: true,
    canVerifyDelivery: true,
    canVerifyBill: true,
    canRecordPayment: true,
    canManageMembers: false,
    canManageSettings: false,
  },
  Purchasing: {
    canManageVendors: true,
    canManageProducts: true,
    canManageWarehouses: false,
    canCreatePO: true,
    canVerifyDelivery: false,
    canVerifyBill: false,
    canRecordPayment: false,
    canManageMembers: false,
    canManageSettings: false,
  },
  Warehouse: {
    canManageVendors: false,
    canManageProducts: false,
    canManageWarehouses: false,
    canCreatePO: false,
    canVerifyDelivery: true,
    canVerifyBill: false,
    canRecordPayment: false,
    canManageMembers: false,
    canManageSettings: false,
  },
  Accountant: {
    canManageVendors: false,
    canManageProducts: false,
    canManageWarehouses: false,
    canCreatePO: false,
    canVerifyDelivery: false,
    canVerifyBill: true,
    canRecordPayment: true,
    canManageMembers: false,
    canManageSettings: false,
  },
};
