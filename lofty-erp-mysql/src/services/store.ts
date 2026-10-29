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

  const bId = 'biz_voltcraft_karnataka';
  const cleanState: DatabaseState = {
    businesses: [
      {
        id: bId,
        name: 'VoltCraft Electrical Components Ltd',
        type: 'Electrical Components Manufacturing (120 Employees)',
        country: 'India',
        currency: { code: 'INR', symbol: '₹' },
        taxSettings: { gstin: '29AABCV8912K1Z4', defaultTaxRate: 18 },
        contact: {
          phone: '+91 98450 12345',
          email: 'akhileshg.1124@gmail.com',
          address: 'Plot 84, 4th Phase, Peenya Industrial Area, Bengaluru, Karnataka 560058',
        },
        ownerUid: 'user_akhilesh_1124',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'biz_main',
        name: 'My Business',
        type: 'Manufacturing',
        country: 'India',
        currency: { code: 'INR', symbol: '₹' },
        taxSettings: { gstin: '29AAAAA0000A1Z5', defaultTaxRate: 18 },
        contact: { phone: '', email: '', address: '' },
        ownerUid: 'user_owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    members: {
      [bId]: [
        {
          uid: 'user_akhilesh_1124',
          businessId: bId,
          email: 'akhileshg.1124@gmail.com',
          displayName: 'Akhilesh G. (Owner & MD)',
          role: 'Owner',
          joinedAt: new Date().toISOString(),
        },
        {
          uid: 'user_suresh_wh',
          businessId: bId,
          email: 'suresh.rao@voltcraft.co.in',
          displayName: 'Suresh Rao (Peenya Godown Incharge)',
          role: 'Warehouse',
          assignedWarehouseId: 'wh_peenya_central',
          joinedAt: new Date().toISOString(),
        },
        {
          uid: 'user_meera_acc',
          businessId: bId,
          email: 'meera.hegde@voltcraft.co.in',
          displayName: 'Meera Hegde (GST & Accounts Lead)',
          role: 'Accountant',
          joinedAt: new Date().toISOString(),
        },
      ],
      biz_main: [
        {
          uid: 'user_owner',
          businessId: 'biz_main',
          email: 'owner@lofty.local',
          displayName: 'Business Owner',
          role: 'Owner',
          joinedAt: new Date().toISOString(),
        },
      ],
    },
    invitations: { [bId]: [], biz_main: [] },
    warehouses: {
      [bId]: [
        {
          id: 'wh_peenya_central',
          businessId: bId,
          name: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
          code: 'GD-PEE-01',
          location: 'Shed 4A, Peenya 4th Phase, Bengaluru, Karnataka 560058',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'wh_bommasandra_finished',
          businessId: bId,
          name: 'Godown 2 — Bommasandra (Assembly & 5-State Distribution)',
          code: 'GD-BOM-02',
          location: 'Plot 12, Jigani-Bommasandra Link Rd, Bengaluru, Karnataka 560099',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ],
      biz_main: [
        {
          id: 'wh_main',
          businessId: 'biz_main',
          name: 'Main Godown',
          code: 'WH-01',
          location: 'Central Storage Area',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    products: {
      [bId]: [
        { id: 'prod_copper_wire', businessId: bId, name: 'Enamelled Copper Magnet Wire (0.8mm Grade-2)', sku: 'EL-COP-08M', unit: 'Kg', category: 'Raw Materials', reorderThreshold: 150, taxRate: 18.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'prod_crgo_steel', businessId: bId, name: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)', sku: 'EL-CRGO-027', unit: 'Kg', category: 'Magnetic Cores', reorderThreshold: 300, taxRate: 18.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'prod_brass_terminals', businessId: bId, name: 'Brass Screw Terminal Connectors (Pack of 500)', sku: 'EL-BRS-TRM', unit: 'Pcs', category: 'Hardware & Connectors', reorderThreshold: 80, taxRate: 18.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'prod_fr4_pcb', businessId: bId, name: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)', sku: 'EL-PCB-FR4', unit: 'Pcs', category: 'Substrates', reorderThreshold: 100, taxRate: 18.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'prod_mini_relay_12v', businessId: bId, name: '12V DC SPDT Miniature Power Relays (Pack of 50)', sku: 'EL-RLY-12V', unit: 'Pcs', category: 'Switching Components', reorderThreshold: 50, taxRate: 18.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'prod_pa66_granules', businessId: bId, name: 'UL94V-0 Flame Retardant PA66 Granules', sku: 'EL-POLY-PA6', unit: 'Kg', category: 'Polymers & Housings', reorderThreshold: 200, taxRate: 18.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'prod_solder_wire', businessId: bId, name: 'Resin Core Solder Wire Sn60/Pb40 (1kg Spool)', sku: 'EL-SLD-6040', unit: 'Roll', category: 'Consumables', reorderThreshold: 30, taxRate: 18.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'prod_toroid_core', businessId: bId, name: 'T130-26 High-Flux Ferrite Toroid Cores', sku: 'EL-TOR-130', unit: 'Pcs', category: 'Magnetic Cores', reorderThreshold: 75, taxRate: 18.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      biz_main: [],
    },
    vendors: {
      [bId]: [
        { id: 'ven_ktech', businessId: bId, name: 'K-Tech Winding Wires & Copper Conductors', contactPerson: 'Raghavendra Bhat', email: 'sales@ktechcopper.in', phone: '9845112233', address: 'Plot 12, Peenya 1st Stage, Bengaluru, Karnataka 560058', gstin: '29AABCK1122C1Z4', paymentTerms: 'Net 30 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_deccan', businessId: bId, name: 'Deccan CRGO Steel Slitting Mills', contactPerson: 'Manjunath Kulkarni', email: 'orders@deccancrgo.example', phone: '9845223344', address: 'EPIP Zone, Whitefield, Bengaluru, Karnataka 560066', gstin: '29AAACD3344D1Z8', paymentTerms: 'Net 30 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_mysore', businessId: bId, name: 'Mysore Technical Ceramics & Insulators', contactPerson: 'Siddharth Gowda', email: 'procure@mysoreceramics.in', phone: '9845334455', address: 'Hebbal Industrial Estate, Mysuru, Karnataka 570016', gstin: '29AABCM5566M1Z2', paymentTerms: 'Net 45 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_bangalore', businessId: bId, name: 'Bangalore Precision Brass Terminals', contactPerson: 'Pradeep Shetty', email: 'sales@blrterminals.example', phone: '9845445566', address: 'Industrial Suburb, Rajajinagar, Bengaluru, Karnataka 560010', gstin: '29AABCB7788B1Z6', paymentTerms: 'Net 15 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_southern', businessId: bId, name: 'Southern FR4 Circuits & Substrates', contactPerson: 'S. Venkatesh', email: 'dispatch@southernpcb.co.in', phone: '9844556677', address: 'SIPCOT Industrial Complex, Hosur, Tamil Nadu 635126', gstin: '33AAACS9900S1Z3', paymentTerms: 'Net 30 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_vidyut', businessId: bId, name: 'Vidyut Electro-Relays Corp', contactPerson: 'K. Narayanan', email: 'commercial@vidyutrelays.example', phone: '9844667788', address: 'Peelamedu, Coimbatore, Tamil Nadu 641004', gstin: '33AABCV1234V1Z9', paymentTerms: 'Net 30 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_hindustan', businessId: bId, name: 'Hindustan Flame Retardant Polymers', contactPerson: 'Nitin Gokhale', email: 'sales@hindustanpolymers.in', phone: '9820112233', address: 'Wagle Estate, Thane, Maharashtra 400604', gstin: '27AABCH5678H1Z1', paymentTerms: 'Net 60 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_canara', businessId: bId, name: 'Canara Solder Alloys & Chemical Fluxes', contactPerson: 'Girish Shenoy', email: 'orders@canarasolder.example', phone: '9845778899', address: 'Baikampady Industrial Area, Mangaluru, Karnataka 575011', gstin: '29AABCC9012C1Z5', paymentTerms: 'Net 15 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_toroid', businessId: bId, name: 'Toroid Magnetic Cores Karnataka', contactPerson: 'Anand Deshpande', email: 'sales@toroidcores.in', phone: '9845889900', address: 'Tarihal Industrial Estate, Hubballi-Dharwad, Karnataka 580026', gstin: '29AABCT3456T1Z7', paymentTerms: 'Net 30 Days', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'ven_apex', businessId: bId, name: 'Apex Electrical Switchgear Supplies', contactPerson: 'Harish Hegde', email: 'contact@apexswitchgear.example', phone: '9845990011', address: 'Peenya 2nd Stage, Bengaluru, Karnataka 560058', gstin: '29AABCA7890A1Z2', paymentTerms: 'Immediate', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      biz_main: [],
    },
    vendorProducts: {
      [bId]: [
        { id: 'vp_ktech_cop', businessId: bId, vendorId: 'ven_ktech', productId: 'prod_copper_wire', vendorPrice: 820.0, unit: 'Kg', leadTimeDays: 5, minOrderQuantity: 50, isActive: true, createdAt: new Date().toISOString() },
        { id: 'vp_deccan_crgo', businessId: bId, vendorId: 'ven_deccan', productId: 'prod_crgo_steel', vendorPrice: 240.0, unit: 'Kg', leadTimeDays: 7, minOrderQuantity: 100, isActive: true, createdAt: new Date().toISOString() },
        { id: 'vp_blr_term', businessId: bId, vendorId: 'ven_bangalore', productId: 'prod_brass_terminals', vendorPrice: 1550.0, unit: 'Pcs', leadTimeDays: 3, minOrderQuantity: 20, isActive: true, createdAt: new Date().toISOString() },
        { id: 'vp_south_pcb', businessId: bId, vendorId: 'ven_southern', productId: 'prod_fr4_pcb', vendorPrice: 380.0, unit: 'Pcs', leadTimeDays: 6, minOrderQuantity: 50, isActive: true, createdAt: new Date().toISOString() },
        { id: 'vp_vidyut_rly', businessId: bId, vendorId: 'ven_vidyut', productId: 'prod_mini_relay_12v', vendorPrice: 2950.0, unit: 'Pcs', leadTimeDays: 10, minOrderQuantity: 25, isActive: true, createdAt: new Date().toISOString() },
        { id: 'vp_hind_pa66', businessId: bId, vendorId: 'ven_hindustan', productId: 'prod_pa66_granules', vendorPrice: 410.0, unit: 'Kg', leadTimeDays: 8, minOrderQuantity: 50, isActive: true, createdAt: new Date().toISOString() },
        { id: 'vp_can_sld', businessId: bId, vendorId: 'ven_canara', productId: 'prod_solder_wire', vendorPrice: 1750.0, unit: 'Roll', leadTimeDays: 4, minOrderQuantity: 10, isActive: true, createdAt: new Date().toISOString() },
        { id: 'vp_tor_core', businessId: bId, vendorId: 'ven_toroid', productId: 'prod_toroid_core', vendorPrice: 165.0, unit: 'Pcs', leadTimeDays: 5, minOrderQuantity: 50, isActive: true, createdAt: new Date().toISOString() },
      ],
      biz_main: [],
    },
    purchaseOrders: {
      [bId]: [
        {
          id: 'po_ka_801',
          businessId: bId,
          orderNumber: 'PO-2026-KA-801',
          vendorId: 'ven_ktech',
          vendorName: 'K-Tech Winding Wires & Copper Conductors',
          vendorGstin: '29AABCK1122C1Z4',
          warehouseId: 'wh_peenya_central',
          warehouseName: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
          subtotal: 164000.0,
          taxTotal: 29520.0,
          grandTotal: 193520.0,
          status: 'Ordered',
          expectedDeliveryDate: '2026-11-08',
          notes: 'Urgent restocking: copper coils for Karnataka & Tamil Nadu batch orders',
          createdBy: 'user_akhilesh_1124',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              productId: 'prod_copper_wire',
              productName: 'Enamelled Copper Magnet Wire (0.8mm Grade-2)',
              sku: 'EL-COP-08M',
              unit: 'Kg',
              quantity: 200,
              receivedQuantity: 0,
              unitPrice: 820.0,
              lineTotal: 164000.0,
              taxRate: 18.0,
              taxAmount: 29520.0,
              totalWithTax: 193520.0,
            },
          ],
        },
        {
          id: 'po_ka_802',
          businessId: bId,
          orderNumber: 'PO-2026-KA-802',
          vendorId: 'ven_deccan',
          vendorName: 'Deccan CRGO Steel Slitting Mills',
          vendorGstin: '29AAACD3344D1Z8',
          warehouseId: 'wh_peenya_central',
          warehouseName: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
          subtotal: 120000.0,
          taxTotal: 21600.0,
          grandTotal: 141600.0,
          status: 'Partially Received',
          expectedDeliveryDate: '2026-11-04',
          notes: 'CRGO silicon steel slit coils for transformer core assembly',
          createdBy: 'user_akhilesh_1124',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              productId: 'prod_crgo_steel',
              productName: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)',
              sku: 'EL-CRGO-027',
              unit: 'Kg',
              quantity: 500,
              receivedQuantity: 0,
              unitPrice: 240.0,
              lineTotal: 120000.0,
              taxRate: 18.0,
              taxAmount: 21600.0,
              totalWithTax: 141600.0,
            },
          ],
        },
        {
          id: 'po_ka_803',
          businessId: bId,
          orderNumber: 'PO-2026-KA-803',
          vendorId: 'ven_southern',
          vendorName: 'Southern FR4 Circuits & Substrates',
          vendorGstin: '33AAACS9900S1Z3',
          warehouseId: 'wh_bommasandra_finished',
          warehouseName: 'Godown 2 — Bommasandra (Assembly & 5-State Distribution)',
          subtotal: 95000.0,
          taxTotal: 17100.0,
          grandTotal: 112100.0,
          status: 'Received',
          expectedDeliveryDate: '2026-10-28',
          notes: 'Inter-state IGST supply of FR4 pre-sensitized PCBs',
          createdBy: 'user_akhilesh_1124',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              productId: 'prod_fr4_pcb',
              productName: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)',
              sku: 'EL-PCB-FR4',
              unit: 'Pcs',
              quantity: 250,
              receivedQuantity: 246,
              unitPrice: 380.0,
              lineTotal: 95000.0,
              taxRate: 18.0,
              taxAmount: 17100.0,
              totalWithTax: 112100.0,
            },
          ],
        },
        {
          id: 'po_ka_804',
          businessId: bId,
          orderNumber: 'PO-2026-KA-804',
          vendorId: 'ven_bangalore',
          vendorName: 'Bangalore Precision Brass Terminals',
          vendorGstin: '29AABCB7788B1Z6',
          warehouseId: 'wh_peenya_central',
          warehouseName: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
          subtotal: 93000.0,
          taxTotal: 16740.0,
          grandTotal: 109740.0,
          status: 'Ordered',
          expectedDeliveryDate: '2026-11-06',
          notes: 'Screw terminals for electrical panel assembly units',
          createdBy: 'user_akhilesh_1124',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              productId: 'prod_brass_terminals',
              productName: 'Brass Screw Terminal Connectors (Pack of 500)',
              sku: 'EL-BRS-TRM',
              unit: 'Pcs',
              quantity: 60,
              receivedQuantity: 0,
              unitPrice: 1550.0,
              lineTotal: 93000.0,
              taxRate: 18.0,
              taxAmount: 16740.0,
              totalWithTax: 109740.0,
            },
          ],
        },
      ],
      biz_main: [],
    },
    deliveries: {
      [bId]: [
        {
          id: 'del_ka_01',
          businessId: bId,
          purchaseOrderId: 'po_ka_803',
          poNumber: 'PO-2026-KA-803',
          challanNumber: 'DC/TN/2026/4102',
          challanDate: '2026-10-26',
          vendorName: 'Southern FR4 Circuits & Substrates',
          warehouseId: 'wh_bommasandra_finished',
          warehouseName: 'Godown 2 — Bommasandra (Assembly & 5-State Distribution)',
          vehicleNumber: 'KA-01-MJ-9921',
          driverName: 'Ramesh Gowda',
          driverPhone: '9845099887',
          status: 'VERIFIED',
          productVerificationStatus: 'ACCEPTED_WITH_DISCREPANCY',
          billVerificationStatus: 'VERIFIED',
          hasQuantityDiscrepancy: true,
          notes: '4 boards had copper track etching bridges; 246 passed electrical QA inspection',
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          items: [
            {
              productId: 'prod_fr4_pcb',
              productName: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)',
              sku: 'EL-PCB-FR4',
              unit: 'Pcs',
              orderedQuantity: 250,
              deliveredQuantity: 250,
              acceptedQuantity: 246,
              rejectedQuantity: 4,
              inspectionNotes: '4 boards failed etching test, 246 accepted',
            },
          ],
        },
        {
          id: 'del_ka_02',
          businessId: bId,
          purchaseOrderId: 'po_ka_802',
          poNumber: 'PO-2026-KA-802',
          challanNumber: 'DC/DC/8891',
          challanDate: '2026-10-27',
          vendorName: 'Deccan CRGO Steel Slitting Mills',
          warehouseId: 'wh_peenya_central',
          warehouseName: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
          vehicleNumber: 'KA-04-E-4512',
          driverName: 'Sanjay Kumar',
          driverPhone: '9845123490',
          status: 'AWAITING_REVIEW',
          productVerificationStatus: 'PENDING',
          billVerificationStatus: 'PENDING',
          hasQuantityDiscrepancy: false,
          notes: 'Truck arrived at Peenya Gate 2; awaiting micrometer thickness check',
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          items: [
            {
              productId: 'prod_crgo_steel',
              productName: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)',
              sku: 'EL-CRGO-027',
              unit: 'Kg',
              orderedQuantity: 500,
              deliveredQuantity: 500,
              acceptedQuantity: 0,
              rejectedQuantity: 0,
            },
          ],
        },
      ],
      biz_main: [],
    },
    deliveryTokens: {},
    supplierBills: {
      [bId]: [
        {
          id: 'bill_ka_01',
          businessId: bId,
          purchaseOrderId: 'po_ka_803',
          poNumber: 'PO-2026-KA-803',
          vendorId: 'ven_southern',
          vendorName: 'Southern FR4 Circuits & Substrates',
          vendorGstin: '33AAACS9900S1Z3',
          invoiceNumber: 'INV-SFC-2026-782',
          invoiceDate: '2026-10-26',
          subtotal: 93480.0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 16826.4,
          totalTax: 16826.4,
          totalAmount: 110306.4,
          paidAmount: 110306.4,
          status: 'VERIFIED',
          paymentStatus: 'PAID',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lineItems: [
            {
              productId: 'prod_fr4_pcb',
              productName: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)',
              sku: 'EL-PCB-FR4',
              billedQuantity: 246,
              unitPrice: 380.0,
              taxableAmount: 93480.0,
              gstRate: 18.0,
              gstAmount: 16826.4,
              totalAmount: 110306.4,
            },
          ],
        },
        {
          id: 'bill_ka_02',
          businessId: bId,
          purchaseOrderId: 'po_ka_802',
          poNumber: 'PO-2026-KA-802',
          vendorId: 'ven_deccan',
          vendorName: 'Deccan CRGO Steel Slitting Mills',
          vendorGstin: '29AAACD3344D1Z8',
          invoiceNumber: 'INV-DCRGO-2026-119',
          invoiceDate: '2026-10-27',
          subtotal: 120000.0,
          cgstAmount: 10800.0,
          sgstAmount: 10800.0,
          igstAmount: 0,
          totalTax: 21600.0,
          totalAmount: 141600.0,
          paidAmount: 0,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lineItems: [
            {
              productId: 'prod_crgo_steel',
              productName: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)',
              sku: 'EL-CRGO-027',
              billedQuantity: 500,
              unitPrice: 240.0,
              taxableAmount: 120000.0,
              gstRate: 18.0,
              gstAmount: 21600.0,
              totalAmount: 141600.0,
            },
          ],
        },
      ],
      biz_main: [],
    },
    stockBalances: {
      [bId]: [
        { id: 'stk_peenya_copper', businessId: bId, warehouseId: 'wh_peenya_central', productId: 'prod_copper_wire', productName: 'Enamelled Copper Magnet Wire (0.8mm Grade-2)', sku: 'EL-COP-08M', quantity: 65, lastUpdated: new Date().toISOString() },
        { id: 'stk_peenya_crgo', businessId: bId, warehouseId: 'wh_peenya_central', productId: 'prod_crgo_steel', productName: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)', sku: 'EL-CRGO-027', quantity: 420, lastUpdated: new Date().toISOString() },
        { id: 'stk_peenya_term', businessId: bId, warehouseId: 'wh_peenya_central', productId: 'prod_brass_terminals', productName: 'Brass Screw Terminal Connectors (Pack of 500)', sku: 'EL-BRS-TRM', quantity: 45, lastUpdated: new Date().toISOString() },
        { id: 'stk_peenya_pcb', businessId: bId, warehouseId: 'wh_peenya_central', productId: 'prod_fr4_pcb', productName: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)', sku: 'EL-PCB-FR4', quantity: 160, lastUpdated: new Date().toISOString() },
        { id: 'stk_bom_relays', businessId: bId, warehouseId: 'wh_bommasandra_finished', productId: 'prod_mini_relay_12v', productName: '12V DC SPDT Miniature Power Relays (Pack of 50)', sku: 'EL-RLY-12V', quantity: 95, lastUpdated: new Date().toISOString() },
        { id: 'stk_bom_pa66', businessId: bId, warehouseId: 'wh_bommasandra_finished', productId: 'prod_pa66_granules', productName: 'UL94V-0 Flame Retardant PA66 Granules', sku: 'EL-POLY-PA6', quantity: 280, lastUpdated: new Date().toISOString() },
        { id: 'stk_bom_solder', businessId: bId, warehouseId: 'wh_bommasandra_finished', productId: 'prod_solder_wire', productName: 'Resin Core Solder Wire Sn60/Pb40 (1kg Spool)', sku: 'EL-SLD-6040', quantity: 12, lastUpdated: new Date().toISOString() },
        { id: 'stk_bom_toroid', businessId: bId, warehouseId: 'wh_bommasandra_finished', productId: 'prod_toroid_core', productName: 'T130-26 High-Flux Ferrite Toroid Cores', sku: 'EL-TOR-130', quantity: 210, lastUpdated: new Date().toISOString() },
      ],
      biz_main: [],
    },
    stockMovements: {
      [bId]: [
        { id: 'mov_init_1', businessId: bId, productId: 'prod_copper_wire', productName: 'Enamelled Copper Magnet Wire (0.8mm Grade-2)', sku: 'EL-COP-08M', warehouseId: 'wh_peenya_central', type: 'PURCHASE_RECEIPT', quantity: 65, referenceId: 'del_ka_01', referenceType: 'DELIVERY', actorUid: 'user_suresh_wh', notes: 'Initial batch count', timestamp: new Date().toISOString() },
        { id: 'mov_init_2', businessId: bId, productId: 'prod_crgo_steel', productName: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)', sku: 'EL-CRGO-027', warehouseId: 'wh_peenya_central', type: 'PURCHASE_RECEIPT', quantity: 420, referenceId: 'del_ka_02', referenceType: 'DELIVERY', actorUid: 'user_suresh_wh', notes: 'Primary slit coil stock', timestamp: new Date().toISOString() },
        { id: 'mov_init_3', businessId: bId, productId: 'prod_brass_terminals', productName: 'Brass Screw Terminal Connectors (Pack of 500)', sku: 'EL-BRS-TRM', warehouseId: 'wh_peenya_central', type: 'PURCHASE_RECEIPT', quantity: 45, referenceId: 'del_ka_01', referenceType: 'DELIVERY', actorUid: 'user_suresh_wh', notes: 'Peenya store stock', timestamp: new Date().toISOString() },
        { id: 'mov_init_4', businessId: bId, productId: 'prod_fr4_pcb', productName: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)', sku: 'EL-PCB-FR4', warehouseId: 'wh_peenya_central', type: 'PURCHASE_RECEIPT', quantity: 160, referenceId: 'del_ka_01', referenceType: 'DELIVERY', actorUid: 'user_suresh_wh', notes: 'Substrate storage', timestamp: new Date().toISOString() },
        { id: 'mov_init_5', businessId: bId, productId: 'prod_mini_relay_12v', productName: '12V DC SPDT Miniature Power Relays (Pack of 50)', sku: 'EL-RLY-12V', warehouseId: 'wh_bommasandra_finished', type: 'PURCHASE_RECEIPT', quantity: 95, referenceId: 'del_ka_01', referenceType: 'DELIVERY', actorUid: 'user_suresh_wh', notes: 'Relay stock at Bommasandra', timestamp: new Date().toISOString() },
        { id: 'mov_init_6', businessId: bId, productId: 'prod_pa66_granules', productName: 'UL94V-0 Flame Retardant PA66 Granules', sku: 'EL-POLY-PA6', warehouseId: 'wh_bommasandra_finished', type: 'PURCHASE_RECEIPT', quantity: 280, referenceId: 'del_ka_02', referenceType: 'DELIVERY', actorUid: 'user_suresh_wh', notes: 'Polymers storage', timestamp: new Date().toISOString() },
        { id: 'mov_init_7', businessId: bId, productId: 'prod_solder_wire', productName: 'Resin Core Solder Wire Sn60/Pb40 (1kg Spool)', sku: 'EL-SLD-6040', warehouseId: 'wh_bommasandra_finished', type: 'PURCHASE_RECEIPT', quantity: 12, referenceId: 'del_ka_01', referenceType: 'DELIVERY', actorUid: 'user_suresh_wh', notes: 'Soldering station allocation', timestamp: new Date().toISOString() },
        { id: 'mov_init_8', businessId: bId, productId: 'prod_toroid_core', productName: 'T130-26 High-Flux Ferrite Toroid Cores', sku: 'EL-TOR-130', warehouseId: 'wh_bommasandra_finished', type: 'PURCHASE_RECEIPT', quantity: 210, referenceId: 'del_ka_02', referenceType: 'DELIVERY', actorUid: 'user_suresh_wh', notes: 'Ferrite toroid cores', timestamp: new Date().toISOString() },
      ],
      biz_main: [],
    },
    payments: {
      [bId]: [
        {
          id: 'pay_ka_01',
          businessId: bId,
          billId: 'bill_ka_01',
          vendorId: 'ven_southern',
          vendorName: 'Southern FR4 Circuits & Substrates',
          amount: 110306.4,
          paymentDate: '2026-10-28',
          paymentMethod: 'Bank Transfer',
          referenceNumber: 'NEFT-SBI-20261028-091',
          notes: 'Full settlement of Invoice INV-SFC-2026-782 after electrical QA signoff',
          recordedBy: 'user_meera_acc',
          createdAt: new Date().toISOString(),
        },
      ],
      biz_main: [],
    },
    notifications: { [bId]: [], biz_main: [] },
    auditLogs: {
      [bId]: [
        { id: 'aud_ka_01', businessId: bId, entityType: 'PURCHASE_ORDER_CREATED', entityId: 'po_ka_801', actorUid: 'user_akhilesh_1124', details: { poNumber: 'PO-2026-KA-801', amount: 193520 }, timestamp: new Date().toISOString() },
        { id: 'aud_ka_02', businessId: bId, entityType: 'DELIVERY_REGISTERED', entityId: 'del_ka_01', actorUid: 'user_suresh_wh', details: { challanNumber: 'DC/TN/2026/4102', discrepancy: '4 failed etching' }, timestamp: new Date().toISOString() },
        { id: 'aud_ka_03', businessId: bId, entityType: 'BILL_VERIFIED', entityId: 'bill_ka_01', actorUid: 'user_meera_acc', details: { invoice: 'INV-SFC-2026-782', total: 110306.4 }, timestamp: new Date().toISOString() },
        { id: 'aud_ka_04', businessId: bId, entityType: 'PAYMENT_RECORDED', entityId: 'pay_ka_01', actorUid: 'user_meera_acc', details: { ref: 'NEFT-SBI-20261028-091', amount: 110306.4 }, timestamp: new Date().toISOString() },
      ],
      biz_main: [],
    },
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
    // In MySQL Edition, data is persisted directly to MySQL.
    // This store functions strictly as an in-memory reactive cache.
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
    const list = this.state.warehouses[businessId] || [];
    const seen = new Set<string>();
    return list.filter(w => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
  }

  setWarehouses(businessId: string, warehouses: Warehouse[]) {
    const seen = new Set<string>();
    this.state.warehouses[businessId] = (warehouses || []).filter(w => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
    this.persist();
  }

  addWarehouse(warehouse: Warehouse) {
    if (!this.state.warehouses[warehouse.businessId]) {
      this.state.warehouses[warehouse.businessId] = [];
    }
    this.state.warehouses[warehouse.businessId] = [
      warehouse,
      ...this.state.warehouses[warehouse.businessId].filter(w => w.id !== warehouse.id),
    ];
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
    const list = this.state.purchaseOrders[businessId] || [];
    const seen = new Set<string>();
    return list.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  getPurchaseOrderById(businessId: string, poId: string): PurchaseOrder | undefined {
    if (businessId && this.state.purchaseOrders[businessId]) {
      const match = this.getPurchaseOrders(businessId).find(po => po.id === poId);
      if (match) return match;
    }
    // Cross-business fallback lookup
    for (const bId of Object.keys(this.state.purchaseOrders || {})) {
      const found = (this.state.purchaseOrders[bId] || []).find(p => p.id === poId);
      if (found) return found;
    }
    return undefined;
  }

  setPurchaseOrders(businessId: string, pos: PurchaseOrder[]) {
    const existing = this.state.purchaseOrders[businessId] || [];
    const incomingMap = new Map((pos || []).map(p => [p.id, p]));
    const merged = [...(pos || [])];
    for (const oldPo of existing) {
      if (!incomingMap.has(oldPo.id)) {
        merged.push(oldPo);
      }
    }
    const seen = new Set<string>();
    this.state.purchaseOrders[businessId] = merged.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    this.persist();
  }

  addPurchaseOrder(po: PurchaseOrder) {
    if (!this.state.purchaseOrders[po.businessId]) {
      this.state.purchaseOrders[po.businessId] = [];
    }
    this.state.purchaseOrders[po.businessId] = [
      po,
      ...this.state.purchaseOrders[po.businessId].filter(p => p.id !== po.id),
    ];
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
    const list = this.state.deliveries[businessId] || [];
    const seen = new Set<string>();
    return list.filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }

  getDeliveryById(businessId: string, id: string): Delivery | undefined {
    return this.getDeliveries(businessId).find(d => d.id === id);
  }

  setDeliveries(businessId: string, dels: Delivery[]) {
    const seen = new Set<string>();
    this.state.deliveries[businessId] = (dels || []).filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    this.persist();
  }

  addDelivery(delivery: Delivery) {
    if (!this.state.deliveries[delivery.businessId]) {
      this.state.deliveries[delivery.businessId] = [];
    }
    this.state.deliveries[delivery.businessId] = [
      delivery,
      ...this.state.deliveries[delivery.businessId].filter(d => d.id !== delivery.id),
    ];
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
    const list = this.state.supplierBills[businessId] || [];
    const seen = new Set<string>();
    return list.filter(b => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }

  getSupplierBillById(businessId: string, id: string): SupplierBill | undefined {
    return this.getSupplierBills(businessId).find(b => b.id === id);
  }

  setSupplierBills(businessId: string, bills: SupplierBill[]) {
    const seen = new Set<string>();
    this.state.supplierBills[businessId] = (bills || []).filter(b => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
    this.persist();
  }

  addSupplierBill(bill: SupplierBill) {
    if (!this.state.supplierBills[bill.businessId]) {
      this.state.supplierBills[bill.businessId] = [];
    }
    this.state.supplierBills[bill.businessId] = [
      bill,
      ...this.state.supplierBills[bill.businessId].filter(b => b.id !== bill.id),
    ];
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

  // --- Products & Vendors Setters ---
  setProducts(businessId: string, products: Product[]) {
    const seen = new Set<string>();
    this.state.products[businessId] = (products || []).filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    this.persist();
  }

  setVendors(businessId: string, vendors: Vendor[]) {
    const seen = new Set<string>();
    this.state.vendors[businessId] = (vendors || []).filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
    this.persist();
  }

  // --- Stock Balances & Movements ---
  getStockBalances(businessId: string): StockBalance[] {
    const list = this.state.stockBalances[businessId] || [];
    const seen = new Set<string>();
    return list.filter(b => {
      const key = b.id || `${b.productId}_${b.warehouseId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  setStockBalances(businessId: string, balances: StockBalance[]) {
    const seen = new Set<string>();
    this.state.stockBalances[businessId] = (balances || []).filter(b => {
      const key = b.id || `${b.productId}_${b.warehouseId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.persist();
  }

  getStockMovements(businessId: string): StockMovement[] {
    const list = this.state.stockMovements[businessId] || [];
    const seen = new Set<string>();
    return list.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }

  setStockMovements(businessId: string, movements: StockMovement[]) {
    const seen = new Set<string>();
    this.state.stockMovements[businessId] = (movements || []).filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    this.persist();
  }

  addStockMovementAndBalance(movement: StockMovement) {
    const bId = movement.businessId;
    if (!this.state.stockMovements[bId]) {
      this.state.stockMovements[bId] = [];
    }
    this.state.stockMovements[bId] = [
      movement,
      ...this.state.stockMovements[bId].filter(m => m.id !== movement.id),
    ];

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
    const list = this.state.payments[businessId] || [];
    const seen = new Set<string>();
    return list.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  setPayments(businessId: string, payments: PaymentRecord[]) {
    const seen = new Set<string>();
    this.state.payments[businessId] = (payments || []).filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    this.persist();
  }

  addPayment(payment: PaymentRecord) {
    if (!this.state.payments[payment.businessId]) {
      this.state.payments[payment.businessId] = [];
    }
    this.state.payments[payment.businessId] = [
      payment,
      ...this.state.payments[payment.businessId].filter(p => p.id !== payment.id),
    ];
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
    this.state.notifications[notif.businessId] = [
      notif,
      ...this.state.notifications[notif.businessId].filter(n => n.id !== notif.id),
    ];
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
    const list = this.state.auditLogs[businessId] || [];
    const seen = new Set<string>();
    return list.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }

  setAuditLogs(businessId: string, logs: AuditLog[]) {
    const seen = new Set<string>();
    this.state.auditLogs[businessId] = (logs || []).filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    this.persist();
  }

  addAuditLog(log: AuditLog) {
    if (!this.state.auditLogs[log.businessId]) {
      this.state.auditLogs[log.businessId] = [];
    }
    this.state.auditLogs[log.businessId] = [
      log,
      ...this.state.auditLogs[log.businessId].filter(a => a.id !== log.id),
    ];
    this.persist();

    if (typeof fetch !== 'undefined') {
      const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
      const API_BASE = isTestEnv ? 'http://localhost:5001/api' : '/api';
      fetch(`${API_BASE}/businesses/${log.businessId}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      }).catch(() => {});
    }
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
