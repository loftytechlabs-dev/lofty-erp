import {
  Business,
  BusinessMember,
  BusinessInvitation,
  Vendor,
  Product,
  VendorProduct,
  Warehouse,
  PurchaseOrder,
  Delivery,
  DeliveryToken,
  SupplierBill,
  StockBalance,
  StockMovement,
  PaymentRecord,
  AppNotification,
  AuditLog,
  CanvasWidget,
} from '../types';
interface DatabaseState {
  businesses: Business[];
  members: Record<string, BusinessMember[]>; // businessId -> members
  invitations: Record<string, BusinessInvitation[]>;
  warehouses: Record<string, Warehouse[]>;
  products: Record<string, Product[]>;
  vendors: Record<string, Vendor[]>;
  vendorProducts: Record<string, VendorProduct[]>;
  purchaseOrders: Record<string, PurchaseOrder[]>;
  deliveries: Record<string, Delivery[]>;
  deliveryTokens: Record<string, DeliveryToken>; // token -> details
  supplierBills: Record<string, SupplierBill[]>;
  stockBalances: Record<string, StockBalance[]>;
  stockMovements: Record<string, StockMovement[]>;
  payments: Record<string, PaymentRecord[]>;
  notifications: Record<string, AppNotification[]>;
  auditLogs: Record<string, AuditLog[]>;
  canvasWidgets?: Record<string, CanvasWidget[]>;
}

const STORAGE_KEY = 'lofty_erp_local_db_v1';

const DEMO_PRODUCT_IDS = new Set([
  'prod_teak_plank',
  'prod_pine_plank',
  'prod_wood_glue',
  'prod_brass_screws',
  'prod_sandpaper_120',
  'prod_polyurethane_finish',
]);

const DEMO_VENDOR_IDS = new Set([
  'ven_sample_timberland',
  'ven_sample_nordic',
  'ven_sample_fastenright',
  'ven_sample_chemcoat',
]);

const DEMO_PO_IDS = new Set([
  'po_2026_001',
  'po_2026_002',
  'po_2026_003',
  'po_2026_004',
]);

const DEMO_DELIVERY_IDS = new Set([
  'del_2026_001',
  'del_2026_002',
]);

const DEMO_BILL_IDS = new Set([
  'bill_2026_001',
  'bill_2026_002',
]);

const DEMO_BALANCE_IDS = new Set([
  'sb_1', 'sb_2', 'sb_3', 'sb_4', 'sb_5', 'sb_6',
]);

const DEMO_MOVEMENT_IDS = new Set([
  'sm_1', 'sm_2', 'sm_3', 'sm_4',
]);

const DEMO_NOTIFICATION_IDS = new Set([
  'notif_1', 'notif_2', 'notif_3',
]);

const DEMO_AUDIT_IDS = new Set([
  'audit_1', 'audit_2', 'audit_3',
]);

function cleanAndPurgeDemoState(raw: DatabaseState): DatabaseState {
  const state: DatabaseState = {
    businesses: [],
    members: {},
    invitations: {},
    warehouses: {},
    products: {},
    vendors: {},
    vendorProducts: {},
    purchaseOrders: {},
    deliveries: {},
    deliveryTokens: {},
    supplierBills: {},
    stockBalances: {},
    stockMovements: {},
    payments: {},
    notifications: {},
    auditLogs: {},
    canvasWidgets: raw.canvasWidgets || {},
  };

  // 1. Clean businesses: replace "Apex Woodcraft & Engineering Ltd." with "My Business"
  const rawBizs = Array.isArray(raw.businesses) ? raw.businesses : [];
  state.businesses = rawBizs.map(b => {
    if (b.name === 'Apex Woodcraft & Engineering Ltd.' || b.name?.toLowerCase().includes('apex woodcraft')) {
      return {
        ...b,
        name: 'My Business',
        type: 'Manufacturing',
        contact: {
          phone: '',
          email: '',
          address: '',
        },
        taxSettings: {
          gstin: '',
          defaultTaxRate: 18,
        },
      };
    }
    return b;
  });

  if (state.businesses.length === 0) {
    state.businesses.push({
      id: 'biz_main',
      name: 'My Business',
      type: 'Manufacturing',
      country: 'India',
      currency: { code: 'INR', symbol: '₹' },
      taxSettings: { gstin: '', defaultTaxRate: 18 },
      contact: { phone: '', email: '', address: '' },
      ownerUid: 'user_owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Collect all valid business IDs
  const bIds = new Set(state.businesses.map(b => b.id));
  if (rawBizs.some(b => b.id === 'biz_apex_woods')) {
    bIds.add('biz_apex_woods');
  }

  bIds.forEach(bId => {
    // Members
    const members = (raw.members && raw.members[bId]) || [];
    state.members[bId] = members.map(m => ({
      ...m,
      displayName: m.displayName.replace(/rajesh patil|apex/gi, 'Owner').trim() || 'Owner',
      email: m.email.replace(/apexwoodcraft\.example/gi, 'lofty.local'),
    }));

    // Warehouses
    const warehouses = (raw.warehouses && raw.warehouses[bId]) || [];
    state.warehouses[bId] = warehouses.length > 0 ? warehouses : [
      {
        id: `wh_${bId}`,
        businessId: bId,
        name: 'Main Godown',
        code: 'WH-01',
        location: 'Central Storage Area',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    // Vendors: filter out sample demo vendors, KEEP all user-created vendors (like akhileshtech!)
    const rawVendors = (raw.vendors && raw.vendors[bId]) || [];
    state.vendors[bId] = rawVendors.filter(v =>
      !DEMO_VENDOR_IDS.has(v.id) &&
      !['Timberland Suppliers Ltd', 'Nordic Woodworks Inc', 'FastenRight Industrial Supplies', 'ChemCoat Surface Finishes'].includes(v.name)
    );

    // Products: filter out sample demo products
    const rawProds = (raw.products && raw.products[bId]) || [];
    state.products[bId] = rawProds.filter(p =>
      !DEMO_PRODUCT_IDS.has(p.id) &&
      !['WD-TEAK-001', 'WD-PINE-001', 'CH-GLUE-001', 'HW-SCRW-001', 'AB-SAND-001', 'CH-FIN-001'].includes(p.sku)
    );

    // Vendor products: filter out demo links
    const rawVps = (raw.vendorProducts && raw.vendorProducts[bId]) || [];
    state.vendorProducts[bId] = rawVps.filter(vp =>
      !DEMO_PRODUCT_IDS.has(vp.productId) && !DEMO_VENDOR_IDS.has(vp.vendorId)
    );

    // Purchase orders: filter out demo POs
    const rawPos = (raw.purchaseOrders && raw.purchaseOrders[bId]) || [];
    state.purchaseOrders[bId] = rawPos.filter(po =>
      !DEMO_PO_IDS.has(po.id) && !['PO-2026-001', 'PO-2026-002', 'PO-2026-003', 'PO-2026-004'].includes(po.orderNumber)
    );

    // Deliveries: filter out demo deliveries
    const rawDels = (raw.deliveries && raw.deliveries[bId]) || [];
    state.deliveries[bId] = rawDels.filter(del =>
      !DEMO_DELIVERY_IDS.has(del.id) && !['DC/WT/8892', 'DC/WT/9012'].includes(del.challanNumber)
    );

    // Supplier Bills: filter out demo bills
    const rawBills = (raw.supplierBills && raw.supplierBills[bId]) || [];
    state.supplierBills[bId] = rawBills.filter(bill =>
      !DEMO_BILL_IDS.has(bill.id) && !['INV/2026/0991', 'INV-9021', 'INV-8834'].includes(bill.invoiceNumber)
    );

    // Stock Balances: filter out demo stock balances
    const rawBalances = (raw.stockBalances && raw.stockBalances[bId]) || [];
    state.stockBalances[bId] = rawBalances.filter(sb =>
      !DEMO_BALANCE_IDS.has(sb.id) && !DEMO_PRODUCT_IDS.has(sb.productId)
    );

    // Stock Movements: filter out demo movements
    const rawMovements = (raw.stockMovements && raw.stockMovements[bId]) || [];
    state.stockMovements[bId] = rawMovements.filter(sm =>
      !DEMO_MOVEMENT_IDS.has(sm.id) && !DEMO_PRODUCT_IDS.has(sm.productId)
    );

    // Payments
    state.payments[bId] = (raw.payments && raw.payments[bId]) || [];

    // Notifications: filter demo
    const rawNotifs = (raw.notifications && raw.notifications[bId]) || [];
    state.notifications[bId] = rawNotifs.filter(n => !DEMO_NOTIFICATION_IDS.has(n.id));

    // Audit logs: filter demo
    const rawLogs = (raw.auditLogs && raw.auditLogs[bId]) || [];
    state.auditLogs[bId] = rawLogs.filter(a => !DEMO_AUDIT_IDS.has(a.id));

    // Invitations
    state.invitations[bId] = (raw.invitations && raw.invitations[bId]) || [];
  });

  // Delivery tokens
  if (raw.deliveryTokens) {
    Object.keys(raw.deliveryTokens).forEach(t => {
      if (t !== 'demo-token-123') {
        state.deliveryTokens[t] = raw.deliveryTokens[t];
      }
    });
  }

  return state;
}

function getInitialState(): DatabaseState {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('lofty_erp_state');
    } catch (e) {
      // ignore
    }
  }

  const bId = 'biz_main';
  const cleanState: DatabaseState = {
    businesses: [
      {
        id: bId,
        name: 'My Business',
        type: 'Manufacturing',
        country: 'India',
        currency: { code: 'INR', symbol: '₹' },
        taxSettings: { gstin: '', defaultTaxRate: 18 },
        contact: { phone: '', email: '', address: '' },
        ownerUid: 'user_owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    members: {
      [bId]: [
        {
          uid: 'user_owner',
          businessId: bId,
          email: 'owner@lofty.local',
          displayName: 'Business Owner',
          role: 'Owner',
          joinedAt: new Date().toISOString(),
        },
      ],
    },
    invitations: { [bId]: [] },
    warehouses: {
      [bId]: [
        {
          id: 'wh_main',
          businessId: bId,
          name: 'Main Godown',
          code: 'WH-01',
          location: 'Central Storage Area',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    products: { [bId]: [] },
    vendors: { [bId]: [] },
    vendorProducts: { [bId]: [] },
    purchaseOrders: { [bId]: [] },
    deliveries: { [bId]: [] },
    deliveryTokens: {},
    supplierBills: { [bId]: [] },
    stockBalances: { [bId]: [] },
    stockMovements: { [bId]: [] },
    payments: { [bId]: [] },
    notifications: { [bId]: [] },
    auditLogs: { [bId]: [] },
  };

  return cleanState;
}

class LocalDatabaseStore {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = getInitialState();
  }

  private persist() {
    this.listeners.forEach(fn => fn());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): DatabaseState {
    return this.state;
  }

  resetToDefault() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('lofty_erp_state');
      } catch (e) {}
    }
    this.state = getInitialState();
    this.persist();
  }

  // --- Businesses ---
  getBusinesses(): Business[] {
    return this.state.businesses;
  }

  getBusinessById(id: string): Business | undefined {
    return this.state.businesses.find(b => b.id === id);
  }

  addBusiness(biz: Business, member: BusinessMember, warehouse: Warehouse) {
    this.state.businesses.push(biz);
    this.state.members[biz.id] = [member];
    this.state.warehouses[biz.id] = [warehouse];
    this.state.products[biz.id] = [];
    this.state.vendors[biz.id] = [];
    this.state.vendorProducts[biz.id] = [];
    this.state.purchaseOrders[biz.id] = [];
    this.state.deliveries[biz.id] = [];
    this.state.supplierBills[biz.id] = [];
    this.state.stockBalances[biz.id] = [];
    this.state.stockMovements[biz.id] = [];
    this.state.payments[biz.id] = [];
    this.state.notifications[biz.id] = [];
    this.state.auditLogs[biz.id] = [];
    this.persist();
  }

  // --- Members ---
  getMembers(businessId: string): BusinessMember[] {
    return this.state.members[businessId] || [];
  }

  addMember(member: BusinessMember) {
    if (!this.state.members[member.businessId]) {
      this.state.members[member.businessId] = [];
    }
    this.state.members[member.businessId] = [
      ...this.state.members[member.businessId].filter(m => m.uid !== member.uid),
      member,
    ];
    this.persist();
  }

  // --- Invitations ---
  getInvitations(businessId: string): BusinessInvitation[] {
    return this.state.invitations[businessId] || [];
  }

  addInvitation(invite: BusinessInvitation) {
    if (!this.state.invitations[invite.businessId]) {
      this.state.invitations[invite.businessId] = [];
    }
    this.state.invitations[invite.businessId].push(invite);
    this.persist();
  }

  findInvitationByCode(code: string): BusinessInvitation | undefined {
    for (const bId in this.state.invitations) {
      const match = this.state.invitations[bId].find(i => i.code.toUpperCase() === code.toUpperCase() && i.status === 'PENDING');
      if (match) return match;
    }
    return undefined;
  }

  updateInvitationStatus(code: string, status: 'ACCEPTED' | 'EXPIRED') {
    for (const bId in this.state.invitations) {
      const item = this.state.invitations[bId].find(i => i.code.toUpperCase() === code.toUpperCase());
      if (item) {
        item.status = status;
        this.persist();
        return;
      }
    }
  }

  // --- Vendors ---
  getVendors(businessId: string): Vendor[] {
    const list = this.state.vendors[businessId] || [];
    const seen = new Set<string>();
    return list.filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }

  addVendor(vendor: Vendor) {
    if (!this.state.vendors[vendor.businessId]) {
      this.state.vendors[vendor.businessId] = [];
    }
    this.state.vendors[vendor.businessId] = [
      vendor,
      ...this.state.vendors[vendor.businessId].filter(v => v.id !== vendor.id),
    ];
    this.persist();
  }

  updateVendor(vendor: Vendor) {
    const list = this.state.vendors[vendor.businessId] || [];
    const index = list.findIndex(v => v.id === vendor.id);
    if (index !== -1) {
      list[index] = vendor;
      this.persist();
    }
  }

  // --- Products ---
  getProducts(businessId: string): Product[] {
    const list = this.state.products[businessId] || [];
    const seen = new Set<string>();
    return list.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  addProduct(product: Product) {
    if (!this.state.products[product.businessId]) {
      this.state.products[product.businessId] = [];
    }
    this.state.products[product.businessId] = [
      product,
      ...this.state.products[product.businessId].filter(p => p.id !== product.id),
    ];
    this.persist();
  }

  updateProduct(product: Product) {
    const list = this.state.products[product.businessId] || [];
    const index = list.findIndex(p => p.id === product.id);
    if (index !== -1) {
      list[index] = product;
      this.persist();
    }
  }

  // --- Vendor Products ---
  getVendorProducts(businessId: string, vendorId?: string): VendorProduct[] {
    const list = this.state.vendorProducts[businessId] || [];
    const filtered = vendorId ? list.filter(vp => vp.vendorId === vendorId) : list;
    const seen = new Set<string>();
    return filtered.filter(vp => {
      if (seen.has(vp.id)) return false;
      seen.add(vp.id);
      return true;
    });
  }

  setVendorProducts(businessId: string, vendorId: string, associations: VendorProduct[]) {
    if (!this.state.vendorProducts[businessId]) {
      this.state.vendorProducts[businessId] = [];
    }
    // Remove existing for this vendor and add new
    this.state.vendorProducts[businessId] = [
      ...this.state.vendorProducts[businessId].filter(vp => vp.vendorId !== vendorId),
      ...associations,
    ];
    this.persist();
  }

  // --- Warehouses ---
  getWarehouses(businessId: string): Warehouse[] {
    return this.state.warehouses[businessId] || [];
  }

  addWarehouse(warehouse: Warehouse) {
    if (!this.state.warehouses[warehouse.businessId]) {
      this.state.warehouses[warehouse.businessId] = [];
    }
    this.state.warehouses[warehouse.businessId].push(warehouse);
    this.persist();
  }

  // --- Purchase Orders ---
  getAllPurchaseOrders(): PurchaseOrder[] {
    const all: PurchaseOrder[] = [];
    const seen = new Set<string>();
    for (const bId of Object.keys(this.state.purchaseOrders || {})) {
      for (const po of this.state.purchaseOrders[bId] || []) {
        if (!seen.has(po.id)) {
          seen.add(po.id);
          all.push(po);
        }
      }
    }
    return all;
  }

  getPurchaseOrders(businessId: string): PurchaseOrder[] {
    return this.state.purchaseOrders[businessId] || [];
  }

  getPurchaseOrderById(businessId: string, poId: string): PurchaseOrder | undefined {
    if (businessId && this.state.purchaseOrders[businessId]) {
      const match = (this.state.purchaseOrders[businessId] || []).find(po => po.id === poId);
      if (match) return match;
    }
    for (const bId of Object.keys(this.state.purchaseOrders || {})) {
      const found = (this.state.purchaseOrders[bId] || []).find(p => p.id === poId);
      if (found) return found;
    }
    return undefined;
  }

  addPurchaseOrder(po: PurchaseOrder) {
    if (!this.state.purchaseOrders[po.businessId]) {
      this.state.purchaseOrders[po.businessId] = [];
    }
    this.state.purchaseOrders[po.businessId].unshift(po);
    this.persist();
  }

  updatePurchaseOrder(po: PurchaseOrder) {
    const list = this.state.purchaseOrders[po.businessId] || [];
    const index = list.findIndex(p => p.id === po.id);
    if (index !== -1) {
      list[index] = po;
      this.persist();
    }
  }

  // --- Delivery Tokens ---
  saveDeliveryToken(tokenData: DeliveryToken) {
    this.state.deliveryTokens[tokenData.token] = tokenData;
    this.persist();
  }

  getDeliveryToken(token: string): DeliveryToken | undefined {
    return this.state.deliveryTokens[token];
  }

  markDeliveryTokenUsed(token: string) {
    if (this.state.deliveryTokens[token]) {
      this.state.deliveryTokens[token].isUsed = true;
      this.persist();
    }
  }

  // --- Deliveries ---
  getDeliveries(businessId: string): Delivery[] {
    return this.state.deliveries[businessId] || [];
  }

  getDeliveryById(businessId: string, id: string): Delivery | undefined {
    return (this.state.deliveries[businessId] || []).find(d => d.id === id);
  }

  addDelivery(delivery: Delivery) {
    if (!this.state.deliveries[delivery.businessId]) {
      this.state.deliveries[delivery.businessId] = [];
    }
    this.state.deliveries[delivery.businessId].unshift(delivery);
    this.persist();
  }

  updateDelivery(delivery: Delivery) {
    const list = this.state.deliveries[delivery.businessId] || [];
    const index = list.findIndex(d => d.id === delivery.id);
    if (index !== -1) {
      list[index] = delivery;
      this.persist();
    }
  }

  // --- Supplier Bills ---
  getSupplierBills(businessId: string): SupplierBill[] {
    return this.state.supplierBills[businessId] || [];
  }

  getSupplierBillById(businessId: string, id: string): SupplierBill | undefined {
    return (this.state.supplierBills[businessId] || []).find(b => b.id === id);
  }

  addSupplierBill(bill: SupplierBill) {
    if (!this.state.supplierBills[bill.businessId]) {
      this.state.supplierBills[bill.businessId] = [];
    }
    this.state.supplierBills[bill.businessId].unshift(bill);
    this.persist();
  }

  updateSupplierBill(bill: SupplierBill) {
    const list = this.state.supplierBills[bill.businessId] || [];
    const index = list.findIndex(b => b.id === bill.id);
    if (index !== -1) {
      list[index] = bill;
      this.persist();
    }
  }

  // --- Stock Balances & Movements ---
  getStockBalances(businessId: string): StockBalance[] {
    return this.state.stockBalances[businessId] || [];
  }

  getStockMovements(businessId: string): StockMovement[] {
    return this.state.stockMovements[businessId] || [];
  }

  addStockMovementAndBalance(movement: StockMovement) {
    const bId = movement.businessId;
    if (!this.state.stockMovements[bId]) {
      this.state.stockMovements[bId] = [];
    }
    this.state.stockMovements[bId].unshift(movement);

    if (!this.state.stockBalances[bId]) {
      this.state.stockBalances[bId] = [];
    }

    const balanceKey = `${movement.productId}_${movement.warehouseId}`;
    const existing = this.state.stockBalances[bId].find(
      b => b.productId === movement.productId && b.warehouseId === movement.warehouseId
    );

    if (existing) {
      existing.quantity += movement.quantity;
      existing.lastUpdated = movement.timestamp;
    } else {
      this.state.stockBalances[bId].push({
        id: balanceKey,
        businessId: bId,
        productId: movement.productId,
        productName: movement.productName,
        sku: movement.sku,
        warehouseId: movement.warehouseId,
        quantity: movement.quantity,
        lastUpdated: movement.timestamp,
      });
    }
    this.persist();
  }

  // --- Payments ---
  getPayments(businessId: string): PaymentRecord[] {
    return this.state.payments[businessId] || [];
  }

  addPayment(payment: PaymentRecord) {
    if (!this.state.payments[payment.businessId]) {
      this.state.payments[payment.businessId] = [];
    }
    this.state.payments[payment.businessId].unshift(payment);
    this.persist();
  }

  // --- Notifications ---
  getNotifications(businessId: string): AppNotification[] {
    return this.state.notifications[businessId] || [];
  }

  addNotification(notif: AppNotification) {
    if (!this.state.notifications[notif.businessId]) {
      this.state.notifications[notif.businessId] = [];
    }
    this.state.notifications[notif.businessId].unshift(notif);
    this.persist();
  }

  markNotificationAsRead(businessId: string, notifId: string) {
    const list = this.state.notifications[businessId] || [];
    const item = list.find(n => n.id === notifId);
    if (item) {
      item.isRead = true;
      this.persist();
    }
  }

  // --- Audit Logs ---
  getAuditLogs(businessId: string): AuditLog[] {
    return this.state.auditLogs[businessId] || [];
  }

  addAuditLog(log: AuditLog) {
    if (!this.state.auditLogs[log.businessId]) {
      this.state.auditLogs[log.businessId] = [];
    }
    this.state.auditLogs[log.businessId].unshift(log);
    this.persist();
  }

  // --- Interactive Canvas Dashboard Widgets ---
  getCanvasWidgets(businessId: string): CanvasWidget[] | null {
    if (!this.state.canvasWidgets) return null;
    return this.state.canvasWidgets[businessId] || null;
  }

  saveCanvasWidgets(businessId: string, widgets: CanvasWidget[]) {
    if (!this.state.canvasWidgets) {
      this.state.canvasWidgets = {};
    }
    this.state.canvasWidgets[businessId] = widgets;
    this.persist();
  }
}

export const localStore = new LocalDatabaseStore();
