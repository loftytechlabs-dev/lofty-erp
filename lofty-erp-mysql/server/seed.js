import pool from './db.js';

export async function seed() {
  const conn = await pool.getConnection();
  console.log('Seeding lofty_erp_db with 120-person Electrical Components Manufacturer data for akhileshg.1124@gmail.com...');

  try {
    await conn.beginTransaction();

    const businessId = 'biz_voltcraft_karnataka';
    const ownerUid = 'user_akhilesh_1124';
    const ownerEmail = 'akhileshg.1124@gmail.com';

    // 0. User Accounts
    await conn.query(
      `INSERT INTO users (uid, email, display_name, provider_id, phone_number)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email=VALUES(email),
         display_name=VALUES(display_name),
         phone_number=VALUES(phone_number)`,
      [ownerUid, ownerEmail, 'Akhilesh G. (Owner & MD)', 'google.com', '+91 98450 12345']
    );

    // Also seed existing demo user for backwards compatibility
    await conn.query(
      `INSERT INTO users (uid, email, display_name, provider_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE display_name=VALUES(display_name)`,
      ['user_owner', 'owner@akhiltech.com', 'Akhilesh (Owner)', 'google.com']
    );

    // 1. Business: 120-person Electrical Components Manufacturer in Karnataka
    await conn.query(
      `INSERT INTO businesses (id, name, type, country, currency_code, currency_symbol, gstin, default_tax_rate, phone, email, address, owner_uid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name),
         type=VALUES(type),
         gstin=VALUES(gstin),
         email=VALUES(email),
         address=VALUES(address),
         owner_uid=VALUES(owner_uid)`,
      [
        businessId,
        'VoltCraft Electrical Components Ltd',
        'Electrical Components Manufacturing (120 Employees)',
        'India',
        'INR',
        '₹',
        '29AABCV8912K1Z4', // 29 = Karnataka State Code
        18.0,
        '+91 98450 12345',
        ownerEmail,
        'Plot 84, 4th Phase, Peenya Industrial Area, Bengaluru, Karnataka 560058',
        ownerUid,
      ]
    );

    // Backwards compatibility legacy business
    await conn.query(
      `INSERT INTO businesses (id, name, type, country, currency_code, currency_symbol, gstin, default_tax_rate, phone, email, address, owner_uid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [
        'biz_main',
        'akhil tech',
        'Manufacturing',
        'India',
        'INR',
        '₹',
        '29AAAAA0000A1Z5',
        18.0,
        '+91 9876543210',
        'owner@akhiltech.com',
        'Tech Zone Phase 1, Bangalore',
        'user_owner',
      ]
    );

    // 2. Business Members (Owner, Warehouse Head, Accountant, Purchasing)
    const members = [
      { id: 'mem_akhilesh', uid: ownerUid, email: ownerEmail, name: 'Akhilesh G. (Owner & MD)', role: 'Owner' },
      { id: 'mem_suresh', uid: 'user_suresh_wh', email: 'suresh.rao@voltcraft.co.in', name: 'Suresh Rao (Peenya Godown Incharge)', role: 'Warehouse', whId: 'wh_peenya_central' },
      { id: 'mem_meera', uid: 'user_meera_acc', email: 'meera.hegde@voltcraft.co.in', name: 'Meera Hegde (GST & Accounts Lead)', role: 'Accountant' },
      { id: 'mem_karthik', uid: 'user_karthik_proc', email: 'karthik.nayak@voltcraft.co.in', name: 'Karthik Nayak (Procurement Manager)', role: 'Purchasing' },
    ];

    for (const m of members) {
      await conn.query(
        `INSERT INTO business_members (id, business_id, uid, email, name, role, status, assigned_warehouse_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role=VALUES(role), name=VALUES(name), email=VALUES(email)`,
        [m.id, businessId, m.uid, m.email, m.name, m.role, 'active', m.whId || null]
      );
    }

    // 3. Two Godowns (As specified: "holds stock in two godowns")
    const warehouses = [
      {
        id: 'wh_peenya_central',
        name: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
        code: 'GD-PEE-01',
        location: 'Shed 4A, Peenya 4th Phase, Bengaluru, Karnataka 560058',
      },
      {
        id: 'wh_bommasandra_finished',
        name: 'Godown 2 — Bommasandra (Assembly & 5-State Distribution)',
        code: 'GD-BOM-02',
        location: 'Plot 12, Jigani-Bommasandra Link Rd, Bengaluru, Karnataka 560099',
      },
    ];

    for (const wh of warehouses) {
      await conn.query(
        `INSERT INTO warehouses (id, business_id, name, code, location, is_active)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code), location=VALUES(location)`,
        [wh.id, businessId, wh.name, wh.code, wh.location, true]
      );
    }

    // 4. Products: Raw materials & Electrical components
    const products = [
      { id: 'prod_copper_wire', name: 'Enamelled Copper Magnet Wire (0.8mm Grade-2)', sku: 'EL-COP-08M', unit: 'Kg', category: 'Raw Materials', reorder: 150, tax: 18.0 },
      { id: 'prod_crgo_steel', name: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)', sku: 'EL-CRGO-027', unit: 'Kg', category: 'Magnetic Cores', reorder: 300, tax: 18.0 },
      { id: 'prod_brass_terminals', name: 'Brass Screw Terminal Connectors (Pack of 500)', sku: 'EL-BRS-TRM', unit: 'Pcs', category: 'Hardware & Connectors', reorder: 80, tax: 18.0 },
      { id: 'prod_fr4_pcb', name: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)', sku: 'EL-PCB-FR4', unit: 'Pcs', category: 'Substrates', reorder: 100, tax: 18.0 },
      { id: 'prod_mini_relay_12v', name: '12V DC SPDT Miniature Power Relays (Pack of 50)', sku: 'EL-RLY-12V', unit: 'Pcs', category: 'Switching Components', reorder: 50, tax: 18.0 },
      { id: 'prod_pa66_granules', name: 'UL94V-0 Flame Retardant PA66 Granules', sku: 'EL-POLY-PA6', unit: 'Kg', category: 'Polymers & Housings', reorder: 200, tax: 18.0 },
      { id: 'prod_solder_wire', name: 'Resin Core Solder Wire Sn60/Pb40 (1kg Spool)', sku: 'EL-SLD-6040', unit: 'Roll', category: 'Consumables', reorder: 30, tax: 18.0 },
      { id: 'prod_toroid_core', name: 'T130-26 High-Flux Ferrite Toroid Cores', sku: 'EL-TOR-130', unit: 'Pcs', category: 'Magnetic Cores', reorder: 75, tax: 18.0 },
    ];

    for (const p of products) {
      await conn.query(
        `INSERT INTO products (id, business_id, name, sku, unit, category, reorder_threshold, tax_rate, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), sku=VALUES(sku), reorder_threshold=VALUES(reorder_threshold), tax_rate=VALUES(tax_rate)`,
        [p.id, businessId, p.name, p.sku, p.unit, p.category, p.reorder, p.tax, true]
      );
    }

    // 5. Vendors: Specialized raw material suppliers across Karnataka and South India (representing 80 vendors)
    const vendors = [
      {
        id: 'ven_ktech',
        name: 'K-Tech Winding Wires & Copper Conductors',
        contact: 'Raghavendra Bhat',
        email: 'sales@ktechcopper.in',
        phone: '9845112233',
        address: 'Plot 12, Peenya 1st Stage, Bengaluru, Karnataka 560058',
        gstin: '29AABCK1122C1Z4',
        terms: 'Net 30 Days',
      },
      {
        id: 'ven_deccan',
        name: 'Deccan CRGO Steel Slitting Mills',
        contact: 'Manjunath Kulkarni',
        email: 'orders@deccancrgo.example',
        phone: '9845223344',
        address: 'EPIP Zone, Whitefield, Bengaluru, Karnataka 560066',
        gstin: '29AAACD3344D1Z8',
        terms: 'Net 30 Days',
      },
      {
        id: 'ven_mysore',
        name: 'Mysore Technical Ceramics & Insulators',
        contact: 'Siddharth Gowda',
        email: 'procure@mysoreceramics.in',
        phone: '9845334455',
        address: 'Hebbal Industrial Estate, Mysuru, Karnataka 570016',
        gstin: '29AABCM5566M1Z2',
        terms: 'Net 45 Days',
      },
      {
        id: 'ven_bangalore',
        name: 'Bangalore Precision Brass Terminals',
        contact: 'Pradeep Shetty',
        email: 'sales@blrterminals.example',
        phone: '9845445566',
        address: 'Industrial Suburb, Rajajinagar, Bengaluru, Karnataka 560010',
        gstin: '29AABCB7788B1Z6',
        terms: 'Net 15 Days',
      },
      {
        id: 'ven_southern',
        name: 'Southern FR4 Circuits & Substrates',
        contact: 'S. Venkatesh',
        email: 'dispatch@southernpcb.co.in',
        phone: '9844556677',
        address: 'SIPCOT Industrial Complex, Hosur, Tamil Nadu 635126',
        gstin: '33AAACS9900S1Z3', // Tamil Nadu (Inter-state IGST)
        terms: 'Net 30 Days',
      },
      {
        id: 'ven_vidyut',
        name: 'Vidyut Electro-Relays Corp',
        contact: 'K. Narayanan',
        email: 'commercial@vidyutrelays.example',
        phone: '9844667788',
        address: 'Peelamedu, Coimbatore, Tamil Nadu 641004',
        gstin: '33AABCV1234V1Z9',
        terms: 'Net 30 Days',
      },
      {
        id: 'ven_hindustan',
        name: 'Hindustan Flame Retardant Polymers',
        contact: 'Nitin Gokhale',
        email: 'sales@hindustanpolymers.in',
        phone: '9820112233',
        address: 'Wagle Estate, Thane, Maharashtra 400604',
        gstin: '27AABCH5678H1Z1', // Maharashtra (Inter-state IGST)
        terms: 'Net 60 Days',
      },
      {
        id: 'ven_canara',
        name: 'Canara Solder Alloys & Chemical Fluxes',
        contact: 'Girish Shenoy',
        email: 'orders@canarasolder.example',
        phone: '9845778899',
        address: 'Baikampady Industrial Area, Mangaluru, Karnataka 575011',
        gstin: '29AABCC9012C1Z5',
        terms: 'Net 15 Days',
      },
      {
        id: 'ven_toroid',
        name: 'Toroid Magnetic Cores Karnataka',
        contact: 'Anand Deshpande',
        email: 'sales@toroidcores.in',
        phone: '9845889900',
        address: 'Tarihal Industrial Estate, Hubballi-Dharwad, Karnataka 580026',
        gstin: '29AABCT3456T1Z7',
        terms: 'Net 30 Days',
      },
      {
        id: 'ven_apex',
        name: 'Apex Electrical Switchgear Supplies',
        contact: 'Harish Hegde',
        email: 'contact@apexswitchgear.example',
        phone: '9845990011',
        address: 'Peenya 2nd Stage, Bengaluru, Karnataka 560058',
        gstin: '29AABCA7890A1Z2',
        terms: 'Immediate',
      },
    ];

    for (const v of vendors) {
      await conn.query(
        `INSERT INTO vendors (id, business_id, name, contact_person, email, phone, address, gstin, payment_terms, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), contact_person=VALUES(contact_person), email=VALUES(email), phone=VALUES(phone), gstin=VALUES(gstin)`,
        [v.id, businessId, v.name, v.contact, v.email, v.phone, v.address, v.gstin, v.terms, true]
      );
    }

    // 6. Vendor Products (Catalog with negotiated unit prices)
    const catalog = [
      { id: 'vp_ktech_cop', vendorId: 'ven_ktech', prodId: 'prod_copper_wire', price: 820.0 },
      { id: 'vp_deccan_crgo', vendorId: 'ven_deccan', prodId: 'prod_crgo_steel', price: 240.0 },
      { id: 'vp_blr_term', vendorId: 'ven_bangalore', prodId: 'prod_brass_terminals', price: 1550.0 },
      { id: 'vp_south_pcb', vendorId: 'ven_southern', prodId: 'prod_fr4_pcb', price: 380.0 },
      { id: 'vp_vidyut_rly', vendorId: 'ven_vidyut', prodId: 'prod_mini_relay_12v', price: 2950.0 },
      { id: 'vp_hind_pa66', vendorId: 'ven_hindustan', prodId: 'prod_pa66_granules', price: 410.0 },
      { id: 'vp_can_sld', vendorId: 'ven_canara', prodId: 'prod_solder_wire', price: 1750.0 },
      { id: 'vp_tor_core', vendorId: 'ven_toroid', prodId: 'prod_toroid_core', price: 165.0 },
    ];

    for (const item of catalog) {
      await conn.query(
        `INSERT INTO vendor_products (id, business_id, vendor_id, product_id, vendor_price, is_active)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE vendor_price=VALUES(vendor_price)`,
        [item.id, businessId, item.vendorId, item.prodId, item.price, true]
      );
    }

    // 7. Stock Balances distributed between the TWO GODOWNS
    const stockData = [
      // Godown 1 (Peenya Central)
      { id: 'stk_peenya_copper', whId: 'wh_peenya_central', prodId: 'prod_copper_wire', name: 'Enamelled Copper Magnet Wire (0.8mm Grade-2)', sku: 'EL-COP-08M', qty: 65 }, // Under reorder 150
      { id: 'stk_peenya_crgo', whId: 'wh_peenya_central', prodId: 'prod_crgo_steel', name: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)', sku: 'EL-CRGO-027', qty: 420 },
      { id: 'stk_peenya_term', whId: 'wh_peenya_central', prodId: 'prod_brass_terminals', name: 'Brass Screw Terminal Connectors (Pack of 500)', sku: 'EL-BRS-TRM', qty: 45 }, // Under reorder 80
      { id: 'stk_peenya_pcb', whId: 'wh_peenya_central', prodId: 'prod_fr4_pcb', name: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)', sku: 'EL-PCB-FR4', qty: 160 },

      // Godown 2 (Bommasandra)
      { id: 'stk_bom_relays', whId: 'wh_bommasandra_finished', prodId: 'prod_mini_relay_12v', name: '12V DC SPDT Miniature Power Relays (Pack of 50)', sku: 'EL-RLY-12V', qty: 95 },
      { id: 'stk_bom_pa66', whId: 'wh_bommasandra_finished', prodId: 'prod_pa66_granules', name: 'UL94V-0 Flame Retardant PA66 Granules', sku: 'EL-POLY-PA6', qty: 280 },
      { id: 'stk_bom_solder', whId: 'wh_bommasandra_finished', prodId: 'prod_solder_wire', name: 'Resin Core Solder Wire Sn60/Pb40 (1kg Spool)', sku: 'EL-SLD-6040', qty: 12 }, // Under reorder 30
      { id: 'stk_bom_toroid', whId: 'wh_bommasandra_finished', prodId: 'prod_toroid_core', name: 'T130-26 High-Flux Ferrite Toroid Cores', sku: 'EL-TOR-130', qty: 210 },
    ];

    for (const s of stockData) {
      await conn.query(
        `INSERT INTO stock_balances (id, business_id, product_id, product_name, sku, warehouse_id, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)`,
        [s.id, businessId, s.prodId, s.name, s.sku, s.whId, s.qty]
      );
    }

    // 8. Purchase Orders (Unified Procurement Lifecycle)
    const pos = [
      {
        id: 'po_ka_801',
        number: 'PO-2026-KA-801',
        vendorId: 'ven_ktech',
        vendorName: 'K-Tech Winding Wires & Copper Conductors',
        vendorGstin: '29AABCK1122C1Z4',
        whId: 'wh_peenya_central',
        whName: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
        subtotal: 164000.0,
        tax: 29520.0,
        total: 193520.0,
        status: 'Ordered',
        date: '2026-11-08',
        notes: 'Urgent restocking: copper coils for Karnataka & Tamil Nadu batch orders',
        lineItems: [
          {
            id: 'poi_801_1',
            prodId: 'prod_copper_wire',
            name: 'Enamelled Copper Magnet Wire (0.8mm Grade-2)',
            sku: 'EL-COP-08M',
            qty: 200,
            price: 820.0,
            tax: 18.0,
            lineTotal: 164000.0,
            withTax: 193520.0,
          },
        ],
      },
      {
        id: 'po_ka_802',
        number: 'PO-2026-KA-802',
        vendorId: 'ven_deccan',
        vendorName: 'Deccan CRGO Steel Slitting Mills',
        vendorGstin: '29AAACD3344D1Z8',
        whId: 'wh_peenya_central',
        whName: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
        subtotal: 120000.0,
        tax: 21600.0,
        total: 141600.0,
        status: 'Partially Delivered',
        date: '2026-11-04',
        notes: 'CRGO silicon steel slit coils for transformer core assembly',
        lineItems: [
          {
            id: 'poi_802_1',
            prodId: 'prod_crgo_steel',
            name: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)',
            sku: 'EL-CRGO-027',
            qty: 500,
            price: 240.0,
            tax: 18.0,
            lineTotal: 120000.0,
            withTax: 141600.0,
          },
        ],
      },
      {
        id: 'po_ka_803',
        number: 'PO-2026-KA-803',
        vendorId: 'ven_southern',
        vendorName: 'Southern FR4 Circuits & Substrates',
        vendorGstin: '33AAACS9900S1Z3',
        whId: 'wh_bommasandra_finished',
        whName: 'Godown 2 — Bommasandra (Assembly & 5-State Distribution)',
        subtotal: 95000.0,
        tax: 17100.0,
        total: 112100.0,
        status: 'Delivered',
        date: '2026-10-28',
        notes: 'Inter-state IGST supply of FR4 pre-sensitized PCBs',
        lineItems: [
          {
            id: 'poi_803_1',
            prodId: 'prod_fr4_pcb',
            name: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)',
            sku: 'EL-PCB-FR4',
            qty: 250,
            price: 380.0,
            tax: 18.0,
            lineTotal: 95000.0,
            withTax: 112100.0,
          },
        ],
      },
      {
        id: 'po_ka_804',
        number: 'PO-2026-KA-804',
        vendorId: 'ven_bangalore',
        vendorName: 'Bangalore Precision Brass Terminals',
        vendorGstin: '29AABCB7788B1Z6',
        whId: 'wh_peenya_central',
        whName: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
        subtotal: 93000.0,
        tax: 16740.0,
        total: 109740.0,
        status: 'Ordered',
        date: '2026-11-06',
        notes: 'Screw terminals for electrical panel assembly units',
        lineItems: [
          {
            id: 'poi_804_1',
            prodId: 'prod_brass_terminals',
            name: 'Brass Screw Terminal Connectors (Pack of 500)',
            sku: 'EL-BRS-TRM',
            qty: 60,
            price: 1550.0,
            tax: 18.0,
            lineTotal: 93000.0,
            withTax: 109740.0,
          },
        ],
      },
    ];

    for (const po of pos) {
      await conn.query(
        `INSERT INTO purchase_orders (id, business_id, order_number, vendor_id, vendor_name, vendor_gstin, warehouse_id, warehouse_name, subtotal, tax_total, grand_total, status, expected_delivery_date, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE order_number=VALUES(order_number), status=VALUES(status)`,
        [
          po.id,
          businessId,
          po.number,
          po.vendorId,
          po.vendorName,
          po.vendorGstin,
          po.whId,
          po.whName,
          po.subtotal,
          po.tax,
          po.total,
          po.status,
          po.date,
          po.notes,
          ownerUid,
        ]
      );

      for (const item of po.lineItems) {
        await conn.query(
          `INSERT INTO po_line_items (id, po_id, product_id, product_name, sku, ordered_quantity, received_quantity, unit_price, tax_rate, line_total, total_with_tax)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE ordered_quantity=VALUES(ordered_quantity)`,
          [
            item.id,
            po.id,
            item.prodId,
            item.name,
            item.sku,
            item.qty,
            0,
            item.price,
            item.tax,
            item.lineTotal,
            item.withTax,
          ]
        );
      }
    }

    // 9. Goods Receipts & Physical Deliveries (Solving the Goods Receipts Tally Scramble)
    const deliveries = [
      {
        id: 'del_ka_01',
        poId: 'po_ka_803',
        poNumber: 'PO-2026-KA-803',
        vendorId: 'ven_southern',
        vendorName: 'Southern FR4 Circuits & Substrates',
        whId: 'wh_bommasandra_finished',
        whName: 'Godown 2 — Bommasandra (Assembly & 5-State Distribution)',
        status: 'ACCEPTED_WITH_DISCREPANCY',
        prodStatus: 'VERIFIED',
        billStatus: 'VERIFIED',
        hasDiscrepancy: 1,
        notes: 'Challan DC/TN/2026/4102: 4 boards had copper track etching bridges; 246 passed electrical QA inspection',
        items: [
          {
            id: 'deli_1',
            prodId: 'prod_fr4_pcb',
            prodName: 'FR4 Double-Sided Pre-Sensitized PCB Substrates (1.6mm)',
            sku: 'EL-PCB-FR4',
            ordered: 250,
            delivered: 250,
            status: 'ACCEPTED_WITH_DISCREPANCY',
            reason: '4 boards failed etching test, 246 accepted',
          },
        ],
      },
      {
        id: 'del_ka_02',
        poId: 'po_ka_802',
        poNumber: 'PO-2026-KA-802',
        vendorId: 'ven_deccan',
        vendorName: 'Deccan CRGO Steel Slitting Mills',
        whId: 'wh_peenya_central',
        whName: 'Godown 1 — Peenya Central (Raw Materials & Winding)',
        status: 'AWAITING_REVIEW',
        prodStatus: 'PENDING',
        billStatus: 'PENDING',
        hasDiscrepancy: 0,
        notes: 'Challan DC/DC/8891: Truck arrived at Peenya Gate 2; awaiting micrometer thickness check',
        items: [
          {
            id: 'deli_2',
            prodId: 'prod_crgo_steel',
            prodName: 'CRGO Silicon Steel M4 Slit Coils (0.27mm)',
            sku: 'EL-CRGO-027',
            ordered: 500,
            delivered: 500,
            status: 'PENDING',
            reason: null,
          },
        ],
      },
    ];

    for (const d of deliveries) {
      await conn.query(
        `INSERT INTO deliveries (id, business_id, po_id, po_number, vendor_id, vendor_name, warehouse_id, warehouse_name, status, product_verification_status, bill_verification_status, has_quantity_discrepancy, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [
          d.id,
          businessId,
          d.poId,
          d.poNumber,
          d.vendorId,
          d.vendorName,
          d.whId,
          d.whName,
          d.status,
          d.prodStatus,
          d.billStatus,
          d.hasDiscrepancy,
          d.notes,
        ]
      );

      for (const item of d.items) {
        await conn.query(
          `INSERT INTO delivery_items (id, delivery_id, product_id, product_name, sku, ordered_quantity, delivered_quantity, verification_status, discrepancy_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE delivered_quantity=VALUES(delivered_quantity)`,
          [
            item.id,
            d.id,
            item.prodId,
            item.prodName,
            item.sku,
            item.ordered,
            item.delivered,
            item.status,
            item.reason,
          ]
        );
      }
    }

    // 10. Supplier Invoices & GST Filings (Direct reconciliation without monthly scramble)
    const bills = [
      {
        id: 'bill_ka_01',
        poId: 'po_ka_803',
        poNumber: 'PO-2026-KA-803',
        vendorId: 'ven_southern',
        vendorName: 'Southern FR4 Circuits & Substrates',
        billNumber: 'INV-SFC-2026-782',
        billDate: '2026-10-26',
        subtotal: 93480.0, // 246 accepted @ 380
        tax: 16826.4,      // 18% IGST
        total: 110306.4,
        status: 'VERIFIED',
      },
      {
        id: 'bill_ka_02',
        poId: 'po_ka_802',
        poNumber: 'PO-2026-KA-802',
        vendorId: 'ven_deccan',
        vendorName: 'Deccan CRGO Steel Slitting Mills',
        billNumber: 'INV-DCRGO-2026-119',
        billDate: '2026-10-27',
        subtotal: 120000.0,
        tax: 21600.0,      // 9% CGST (10,800) + 9% SGST (10,800)
        total: 141600.0,
        status: 'PENDING',
      },
    ];

    for (const b of bills) {
      await conn.query(
        `INSERT INTO supplier_bills (id, business_id, po_id, po_number, vendor_id, vendor_name, bill_number, bill_date, subtotal, tax_amount, total_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [
          b.id,
          businessId,
          b.poId,
          b.poNumber,
          b.vendorId,
          b.vendorName,
          b.billNumber,
          b.billDate,
          b.subtotal,
          b.tax,
          b.total,
          b.status,
        ]
      );
    }

    // 11. Payment Records
    const payments = [
      {
        id: 'pay_ka_01',
        billId: 'bill_ka_01',
        vendorId: 'ven_southern',
        vendorName: 'Southern FR4 Circuits & Substrates',
        amount: 110306.4,
        paymentDate: '2026-10-28',
        method: 'BANK_TRANSFER',
        ref: 'NEFT-SBI-20261028-091',
        notes: 'Full settlement of Invoice INV-SFC-2026-782 after electrical QA signoff',
        recordedBy: 'user_meera_acc',
      },
    ];

    for (const pay of payments) {
      await conn.query(
        `INSERT INTO payment_records (id, business_id, bill_id, vendor_id, vendor_name, amount, payment_date, payment_method, reference_number, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount=VALUES(amount), payment_date=VALUES(payment_date)`,
        [
          pay.id,
          businessId,
          pay.billId,
          pay.vendorId,
          pay.vendorName,
          pay.amount,
          pay.paymentDate,
          pay.method,
          pay.ref,
          pay.notes,
          pay.recordedBy,
        ]
      );
    }

    // 12. Stock Movements
    const movements = [
      { id: 'mov_init_1', prodId: 'prod_copper_wire', whId: 'wh_peenya_central', type: 'INCOMING_DELIVERY', qty: 65, refId: 'del_ka_01', refType: 'DELIVERY', actor: 'user_suresh_wh', notes: 'Initial batch count' },
      { id: 'mov_init_2', prodId: 'prod_crgo_steel', whId: 'wh_peenya_central', type: 'INCOMING_DELIVERY', qty: 420, refId: 'del_ka_02', refType: 'DELIVERY', actor: 'user_suresh_wh', notes: 'Primary slit coil stock' },
      { id: 'mov_init_3', prodId: 'prod_brass_terminals', whId: 'wh_peenya_central', type: 'INCOMING_DELIVERY', qty: 45, refId: 'po_ka_804', refType: 'PURCHASE_ORDER', actor: 'user_suresh_wh', notes: 'Peenya store stock' },
      { id: 'mov_init_4', prodId: 'prod_fr4_pcb', whId: 'wh_peenya_central', type: 'INCOMING_DELIVERY', qty: 160, refId: 'del_ka_01', refType: 'DELIVERY', actor: 'user_suresh_wh', notes: 'Substrate storage' },
      { id: 'mov_init_5', prodId: 'prod_mini_relay_12v', whId: 'wh_bommasandra_finished', type: 'INCOMING_DELIVERY', qty: 95, refId: 'po_ka_801', refType: 'PURCHASE_ORDER', actor: 'user_suresh_wh', notes: 'Relay stock at Bommasandra' },
      { id: 'mov_init_6', prodId: 'prod_pa66_granules', whId: 'wh_bommasandra_finished', type: 'INCOMING_DELIVERY', qty: 280, refId: 'po_ka_802', refType: 'PURCHASE_ORDER', actor: 'user_suresh_wh', notes: 'Polymers storage' },
      { id: 'mov_init_7', prodId: 'prod_solder_wire', whId: 'wh_bommasandra_finished', type: 'INCOMING_DELIVERY', qty: 12, refId: 'po_ka_803', refType: 'PURCHASE_ORDER', actor: 'user_suresh_wh', notes: 'Soldering station allocation' },
      { id: 'mov_init_8', prodId: 'prod_toroid_core', whId: 'wh_bommasandra_finished', type: 'INCOMING_DELIVERY', qty: 210, refId: 'po_ka_804', refType: 'PURCHASE_ORDER', actor: 'user_suresh_wh', notes: 'Ferrite toroid cores' },
    ];

    for (const mov of movements) {
      await conn.query(
        `INSERT INTO stock_movements (id, business_id, product_id, warehouse_id, type, quantity, reference_id, reference_type, actor_uid, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)`,
        [
          mov.id,
          businessId,
          mov.prodId,
          mov.whId,
          mov.type,
          mov.qty,
          mov.refId,
          mov.refType,
          mov.actor,
          mov.notes,
        ]
      );
    }

    // 13. Audit Logs
    const audits = [
      { id: 'aud_ka_01', type: 'PURCHASE_ORDER_CREATED', entityId: 'po_ka_801', actor: ownerUid, details: { poNumber: 'PO-2026-KA-801', amount: 193520 } },
      { id: 'aud_ka_02', type: 'DELIVERY_REGISTERED', entityId: 'del_ka_01', actor: 'user_suresh_wh', details: { challanNumber: 'DC/TN/2026/4102', discrepancy: '4 failed etching' } },
      { id: 'aud_ka_03', type: 'BILL_VERIFIED', entityId: 'bill_ka_01', actor: 'user_meera_acc', details: { invoice: 'INV-SFC-2026-782', total: 110306.4 } },
      { id: 'aud_ka_04', type: 'PAYMENT_RECORDED', entityId: 'pay_ka_01', actor: 'user_meera_acc', details: { ref: 'NEFT-SBI-20261028-091', amount: 110306.4 } },
    ];

    for (const aud of audits) {
      await conn.query(
        `INSERT INTO audit_logs (id, business_id, entity_type, entity_id, actor_uid, details)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE entity_type=VALUES(entity_type)`,
        [
          aud.id,
          businessId,
          aud.type,
          aud.entityId,
          aud.actor,
          JSON.stringify(aud.details),
        ]
      );
    }

    // 14. Canvas Dashboard Widgets for Interactive Studio
    const defaultWidgets = [
      { id: 'w_spend', type: 'spend_by_supplier', title: 'Spend by Supplier', x: 24, y: 24, w: 520, h: 320 },
      { id: 'w_stock', type: 'stock_vs_reorder', title: 'Stock vs Reorder Health', x: 568, y: 24, w: 520, h: 320 },
      { id: 'w_kpi_spend', type: 'kpi_metric', title: 'Total Committed Spend', x: 24, y: 368, w: 250, h: 160, config: { metricKey: 'total_spend' } },
      { id: 'w_kpi_stock', type: 'kpi_metric', title: 'Low Stock Alerts', x: 294, y: 368, w: 250, h: 160, config: { metricKey: 'low_stock' } },
      { id: 'w_orders', type: 'live_orders', title: 'Active Orders Pipeline', x: 568, y: 368, w: 520, h: 300 },
      { id: 'w_ai_digest', type: 'ai_summary', title: 'AI Operations Digest', x: 24, y: 552, w: 520, h: 220 },
    ];

    for (const w of defaultWidgets) {
      await conn.query(
        `INSERT INTO canvas_widgets (id, business_id, type, title, x, y, w, h, config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), x=VALUES(x), y=VALUES(y), w=VALUES(w), h=VALUES(h)`,
        [w.id, businessId, w.type, w.title, w.x, w.y, w.w, w.h, JSON.stringify(w.config || {})]
      );
    }

    await conn.commit();
    console.log('✓ Successfully seeded 120-person Electrical Components Manufacturer for akhileshg.1124@gmail.com!');
  } catch (err) {
    await conn.rollback();
    console.error('Seed error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('seed.js')) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default seed;
