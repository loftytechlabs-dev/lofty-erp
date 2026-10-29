import express from 'express';
import cors from 'cors';
import pool from './db.js';
import { validateVendorPayload } from './validation.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' })); // Support base64 delivery bill photos

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as isLive');
    res.json({ status: 'ok', database: 'MySQL', connected: rows[0].isLive === 1 });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// 0. User Accounts & Google Auth Sync
app.post('/api/users', async (req, res) => {
  try {
    const u = req.body;
    if (!u.uid || !u.email) {
      return res.status(400).json({ success: false, error: 'uid and email are required' });
    }
    await pool.query(
      `INSERT INTO users (uid, email, display_name, photo_url, provider_id, phone_number)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         display_name = VALUES(display_name),
         photo_url = VALUES(photo_url),
         provider_id = VALUES(provider_id),
         phone_number = VALUES(phone_number),
         last_login_at = CURRENT_TIMESTAMP`,
      [
        u.uid,
        u.email,
        u.displayName || '',
        u.photoURL || u.photo_url || '',
        u.providerId || u.provider_id || 'google.com',
        u.phoneNumber || u.phone_number || '',
      ]
    );

    // Automatically bind real Firebase Google Auth UID to pre-seeded memberships and businesses
    await pool.query('UPDATE business_members SET uid = ? WHERE email = ?', [u.uid, u.email]);
    await pool.query('UPDATE businesses SET owner_uid = ? WHERE email = ?', [u.uid, u.email]);

    const [rows] = await pool.query('SELECT * FROM users WHERE uid = ?', [u.uid]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users/:uid', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE uid = ?', [req.params.uid]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Businesses
app.get('/api/businesses', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM businesses ORDER BY created_at DESC');
    const formatted = rows.map(b => ({
      id: b.id,
      name: b.name,
      type: b.type,
      country: b.country,
      currency: { code: b.currency_code, symbol: b.currency_symbol },
      taxSettings: { gstin: b.gstin, defaultTaxRate: parseFloat(b.default_tax_rate) },
      contact: { phone: b.phone, email: b.email, address: b.address },
      ownerUid: b.owner_uid,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses', async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || `biz_${Date.now()}`;
    await pool.query(
      `INSERT INTO businesses (id, name, type, country, currency_code, currency_symbol, gstin, default_tax_rate, phone, email, address, owner_uid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        b.name,
        b.type || 'Manufacturing',
        b.country || 'India',
        b.currency?.code || 'INR',
        b.currency?.symbol || '₹',
        b.taxSettings?.gstin || '',
        b.taxSettings?.defaultTaxRate || 18.0,
        b.contact?.phone || '',
        b.contact?.email || '',
        b.contact?.address || '',
        b.ownerUid,
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Members
app.get('/api/businesses/:businessId/members', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM business_members WHERE business_id = ?', [req.params.businessId]);
    const mapped = rows.map(m => ({
      id: m.id,
      businessId: m.business_id,
      userId: m.uid || m.user_id,
      role: m.role,
      name: m.name,
      email: m.email,
      status: m.status,
      assignedWarehouseId: m.assigned_warehouse_id,
      joinedAt: m.created_at || m.joined_at,
    }));
    res.json({ success: true, data: mapped });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Warehouses
app.get('/api/businesses/:businessId/warehouses', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM warehouses WHERE business_id = ? ORDER BY name ASC', [req.params.businessId]);
    const mapped = rows.map(w => ({
      id: w.id,
      businessId: w.business_id,
      name: w.name,
      code: w.code,
      location: w.location,
      isActive: Boolean(w.is_active),
      createdAt: w.created_at,
    }));
    res.json({ success: true, data: mapped });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/warehouses', async (req, res) => {
  try {
    const w = req.body;
    const id = w.id || `wh_${Date.now()}`;
    await pool.query(
      `INSERT INTO warehouses (id, business_id, name, code, location, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.params.businessId, w.name, w.code, w.location || '', w.isActive ?? true]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Products
app.get('/api/businesses/:businessId/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE business_id = ? ORDER BY name ASC', [req.params.businessId]);
    const formatted = rows.map(p => ({
      id: p.id,
      businessId: p.business_id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      category: p.category,
      reorderThreshold: p.reorder_threshold,
      taxRate: parseFloat(p.tax_rate),
      isActive: Boolean(p.is_active),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/products', async (req, res) => {
  try {
    const p = req.body;
    const id = p.id || `prod_${Date.now()}`;
    await pool.query(
      `INSERT INTO products (id, business_id, name, sku, unit, category, reorder_threshold, tax_rate, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), sku=VALUES(sku), unit=VALUES(unit), category=VALUES(category), reorder_threshold=VALUES(reorder_threshold), tax_rate=VALUES(tax_rate), is_active=VALUES(is_active)`,
      [
        id,
        req.params.businessId,
        p.name,
        p.sku,
        p.unit,
        p.category || '',
        p.reorderThreshold || 10,
        p.taxRate || 18.0,
        p.isActive ?? true,
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/businesses/:businessId/products/:productId', async (req, res) => {
  try {
    const p = req.body;
    await pool.query(
      `UPDATE products SET name = COALESCE(?, name), sku = COALESCE(?, sku), unit = COALESCE(?, unit), category = COALESCE(?, category), reorder_threshold = COALESCE(?, reorder_threshold), tax_rate = COALESCE(?, tax_rate), is_active = COALESCE(?, is_active)
       WHERE id = ? AND business_id = ?`,
      [
        p.name,
        p.sku,
        p.unit,
        p.category,
        p.reorderThreshold,
        p.taxRate,
        p.isActive,
        req.params.productId,
        req.params.businessId,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Vendors
app.get('/api/businesses/:businessId/vendors', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vendors WHERE business_id = ? ORDER BY name ASC', [req.params.businessId]);
    const formatted = rows.map(v => ({
      id: v.id,
      businessId: v.business_id,
      name: v.name,
      contactPerson: v.contact_person,
      email: v.email,
      phone: v.phone,
      address: v.address,
      gstin: v.gstin,
      paymentTerms: v.payment_terms,
      isActive: Boolean(v.is_active),
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/vendors', async (req, res) => {
  try {
    const v = req.body;
    const validation = validateVendorPayload(v);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: Object.values(validation.errors)[0],
        errors: validation.errors,
      });
    }

    const id = v.id || `ven_${Date.now()}`;
    const cleanPhone = (v.phone || '').replace(/\D/g, '').slice(-10);
    const cleanGstin = (v.gstin || '').trim().toUpperCase();

    await pool.query(
      `INSERT INTO vendors (id, business_id, name, contact_person, email, phone, address, gstin, payment_terms, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), contact_person=VALUES(contact_person), email=VALUES(email), phone=VALUES(phone), address=VALUES(address), gstin=VALUES(gstin), payment_terms=VALUES(payment_terms), is_active=VALUES(is_active)`,
      [
        id,
        req.params.businessId,
        v.name.trim(),
        (v.contactPerson || '').trim(),
        (v.email || '').trim().toLowerCase(),
        cleanPhone,
        (v.address || '').trim(),
        cleanGstin,
        v.paymentTerms || 'Net 30',
        v.isActive ?? true,
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/businesses/:businessId/vendors/:vendorId', async (req, res) => {
  try {
    const v = req.body;
    // If updating critical fields, validate
    if (v.name || v.contactPerson || v.phone || v.email || v.gstin) {
      const validation = validateVendorPayload({
        name: v.name,
        contactPerson: v.contactPerson,
        phone: v.phone,
        email: v.email,
        gstin: v.gstin,
      });
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: Object.values(validation.errors)[0],
          errors: validation.errors,
        });
      }
    }

    const cleanPhone = v.phone ? v.phone.replace(/\D/g, '').slice(-10) : undefined;
    const cleanGstin = v.gstin ? v.gstin.trim().toUpperCase() : undefined;

    await pool.query(
      `UPDATE vendors SET name = COALESCE(?, name), contact_person = COALESCE(?, contact_person), email = COALESCE(?, email), phone = COALESCE(?, phone), address = COALESCE(?, address), gstin = COALESCE(?, gstin), payment_terms = COALESCE(?, payment_terms), is_active = COALESCE(?, is_active)
       WHERE id = ? AND business_id = ?`,
      [
        v.name ? v.name.trim() : null,
        v.contactPerson ? v.contactPerson.trim() : null,
        v.email ? v.email.trim().toLowerCase() : null,
        cleanPhone ?? null,
        v.address ? v.address.trim() : null,
        cleanGstin ?? null,
        v.paymentTerms ?? null,
        v.isActive ?? null,
        req.params.vendorId,
        req.params.businessId,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/businesses/:businessId/vendors/:vendorId', async (req, res) => {
  try {
    await pool.query('DELETE FROM vendors WHERE id = ? AND business_id = ?', [req.params.vendorId, req.params.businessId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Vendor Products (Catalog)
app.get('/api/businesses/:businessId/vendor-products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vendor_products WHERE business_id = ?', [req.params.businessId]);
    const formatted = rows.map(vp => ({
      id: vp.id,
      businessId: vp.business_id,
      vendorId: vp.vendor_id,
      productId: vp.product_id,
      vendorPrice: parseFloat(vp.vendor_price),
      isActive: Boolean(vp.is_active),
      createdAt: vp.created_at,
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/vendor-products', async (req, res) => {
  try {
    const vp = req.body;
    const id = vp.id || `vp_${Date.now()}`;
    await pool.query(
      `INSERT INTO vendor_products (id, business_id, vendor_id, product_id, vendor_price, is_active)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vendor_price=VALUES(vendor_price), is_active=VALUES(is_active)`,
      [
        id,
        req.params.businessId,
        vp.vendorId,
        vp.productId,
        vp.vendorPrice || 0,
        vp.isActive ?? true,
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/businesses/:businessId/vendor-products/:id', async (req, res) => {
  try {
    const vp = req.body;
    await pool.query(
      `UPDATE vendor_products SET vendor_price = COALESCE(?, vendor_price), is_active = COALESCE(?, is_active)
       WHERE id = ? AND business_id = ?`,
      [vp.vendorPrice, vp.isActive, req.params.id, req.params.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/businesses/:businessId/vendor-products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM vendor_products WHERE id = ? AND business_id = ?', [req.params.id, req.params.businessId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Purchase Orders (with Line Items)
app.get('/api/businesses/:businessId/purchase-orders', async (req, res) => {
  try {
    const [poRows] = await pool.query(
      'SELECT * FROM purchase_orders WHERE business_id = ? ORDER BY created_at DESC',
      [req.params.businessId]
    );

    const poIds = poRows.map(p => p.id);
    let itemMap = new Map();

    if (poIds.length > 0) {
      const [itemRows] = await pool.query(
        `SELECT * FROM po_line_items WHERE po_id IN (?)`,
        [poIds]
      );
      itemRows.forEach(item => {
        const list = itemMap.get(item.po_id) || [];
        const unitPrice = parseFloat(item.unit_price) || 0;
        const taxRate = parseFloat(item.tax_rate) || 0;
        const lineTotal = parseFloat(item.line_total) || 0;
        const totalWithTax = parseFloat(item.total_with_tax) || 0;
        list.push({
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          orderedQuantity: item.ordered_quantity,
          quantity: item.ordered_quantity,
          receivedQuantity: item.received_quantity,
          unitPrice,
          taxRate,
          taxAmount: parseFloat((totalWithTax - lineTotal).toFixed(2)) || 0,
          lineTotal,
          totalWithTax,
        });
        itemMap.set(item.po_id, list);
      });
    }

    const formatted = poRows.map(po => ({
      id: po.id,
      businessId: po.business_id,
      orderNumber: po.order_number,
      vendorId: po.vendor_id,
      vendorName: po.vendor_name,
      vendorGstin: po.vendor_gstin,
      warehouseId: po.warehouse_id,
      warehouseName: po.warehouse_name,
      items: itemMap.get(po.id) || [],
      subtotal: parseFloat(po.subtotal) || 0,
      taxTotal: parseFloat(po.tax_total) || 0,
      grandTotal: parseFloat(po.grand_total) || 0,
      status: po.status,
      expectedDeliveryDate: po.expected_delivery_date ? (po.expected_delivery_date.toISOString ? po.expected_delivery_date.toISOString().split('T')[0] : String(po.expected_delivery_date).split('T')[0]) : '',
      notes: po.notes || '',
      createdBy: po.created_by,
      createdAt: po.created_at,
      updatedAt: po.updated_at,
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single Purchase Order by ID
app.get('/api/purchase-orders/:id', async (req, res) => {
  try {
    const [poRows] = await pool.query(
      'SELECT * FROM purchase_orders WHERE id = ?',
      [req.params.id]
    );

    if (poRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase Order not found' });
    }

    const po = poRows[0];
    const [itemRows] = await pool.query(
      'SELECT * FROM po_line_items WHERE po_id = ?',
      [po.id]
    );

    const items = itemRows.map(item => {
      const unitPrice = parseFloat(item.unit_price) || 0;
      const taxRate = parseFloat(item.tax_rate) || 0;
      const lineTotal = parseFloat(item.line_total) || 0;
      const totalWithTax = parseFloat(item.total_with_tax) || 0;
      return {
        productId: item.product_id,
        productName: item.product_name,
        sku: item.sku,
        orderedQuantity: item.ordered_quantity,
        quantity: item.ordered_quantity,
        receivedQuantity: item.received_quantity,
        unitPrice,
        taxRate,
        taxAmount: parseFloat((totalWithTax - lineTotal).toFixed(2)) || 0,
        lineTotal,
        totalWithTax,
      };
    });

    const formatted = {
      id: po.id,
      businessId: po.business_id,
      orderNumber: po.order_number,
      vendorId: po.vendor_id,
      vendorName: po.vendor_name,
      vendorGstin: po.vendor_gstin,
      warehouseId: po.warehouse_id,
      warehouseName: po.warehouse_name,
      items,
      subtotal: parseFloat(po.subtotal) || 0,
      taxTotal: parseFloat(po.tax_total) || 0,
      grandTotal: parseFloat(po.grand_total) || 0,
      status: po.status,
      expectedDeliveryDate: po.expected_delivery_date ? (po.expected_delivery_date.toISOString ? po.expected_delivery_date.toISOString().split('T')[0] : String(po.expected_delivery_date).split('T')[0]) : '',
      notes: po.notes || '',
      createdBy: po.created_by,
      createdAt: po.created_at,
      updatedAt: po.updated_at,
    };

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single Purchase Order by Business & ID
app.get('/api/businesses/:businessId/purchase-orders/:id', async (req, res) => {
  try {
    const [poRows] = await pool.query(
      'SELECT * FROM purchase_orders WHERE id = ? AND business_id = ?',
      [req.params.id, req.params.businessId]
    );

    if (poRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase Order not found' });
    }

    const po = poRows[0];
    const [itemRows] = await pool.query(
      'SELECT * FROM po_line_items WHERE po_id = ?',
      [po.id]
    );

    const items = itemRows.map(item => {
      const unitPrice = parseFloat(item.unit_price) || 0;
      const taxRate = parseFloat(item.tax_rate) || 0;
      const lineTotal = parseFloat(item.line_total) || 0;
      const totalWithTax = parseFloat(item.total_with_tax) || 0;
      return {
        productId: item.product_id,
        productName: item.product_name,
        sku: item.sku,
        orderedQuantity: item.ordered_quantity,
        quantity: item.ordered_quantity,
        receivedQuantity: item.received_quantity,
        unitPrice,
        taxRate,
        taxAmount: parseFloat((totalWithTax - lineTotal).toFixed(2)) || 0,
        lineTotal,
        totalWithTax,
      };
    });

    const formatted = {
      id: po.id,
      businessId: po.business_id,
      orderNumber: po.order_number,
      vendorId: po.vendor_id,
      vendorName: po.vendor_name,
      vendorGstin: po.vendor_gstin,
      warehouseId: po.warehouse_id,
      warehouseName: po.warehouse_name,
      items,
      subtotal: parseFloat(po.subtotal) || 0,
      taxTotal: parseFloat(po.tax_total) || 0,
      grandTotal: parseFloat(po.grand_total) || 0,
      status: po.status,
      expectedDeliveryDate: po.expected_delivery_date ? (po.expected_delivery_date.toISOString ? po.expected_delivery_date.toISOString().split('T')[0] : String(po.expected_delivery_date).split('T')[0]) : '',
      notes: po.notes || '',
      createdBy: po.created_by,
      createdAt: po.created_at,
      updatedAt: po.updated_at,
    };

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/purchase-orders', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const po = req.body;
    const poId = po.id || `po_${Date.now()}`;

    await conn.query(
      `INSERT INTO purchase_orders (id, business_id, order_number, vendor_id, vendor_name, vendor_gstin, warehouse_id, warehouse_name, subtotal, tax_total, grand_total, status, expected_delivery_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poId,
        req.params.businessId,
        po.orderNumber,
        po.vendorId,
        po.vendorName,
        po.vendorGstin || '',
        po.warehouseId,
        po.warehouseName,
        po.subtotal || 0,
        po.taxTotal || 0,
        po.grandTotal || 0,
        po.status || 'Ordered',
        po.expectedDeliveryDate || null,
        po.notes || '',
        po.createdBy,
      ]
    );

    if (Array.isArray(po.items)) {
      for (const item of po.items) {
        const qty = item.orderedQuantity !== undefined && item.orderedQuantity !== null
          ? item.orderedQuantity
          : (item.quantity !== undefined && item.quantity !== null ? item.quantity : 1);
        const receivedQty = item.receivedQuantity || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const taxRate = parseFloat(item.taxRate) || 0;
        const lineTotal = item.lineTotal !== undefined && item.lineTotal !== null ? parseFloat(item.lineTotal) : (qty * unitPrice);
        const totalWithTax = item.totalWithTax !== undefined && item.totalWithTax !== null ? parseFloat(item.totalWithTax) : (lineTotal + (lineTotal * taxRate / 100));

        await conn.query(
          `INSERT INTO po_line_items (id, po_id, product_id, product_name, sku, ordered_quantity, received_quantity, unit_price, tax_rate, line_total, total_with_tax)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id || `poi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            poId,
            item.productId,
            item.productName,
            item.sku,
            qty,
            receivedQty,
            unitPrice,
            taxRate,
            lineTotal,
            totalWithTax,
          ]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, id: poId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

app.put('/api/businesses/:businessId/purchase-orders/:id', async (req, res) => {
  try {
    const po = req.body;
    await pool.query(
      `UPDATE purchase_orders SET status = COALESCE(?, status), notes = COALESCE(?, notes), expected_delivery_date = COALESCE(?, expected_delivery_date)
       WHERE id = ? AND business_id = ?`,
      [po.status, po.notes, po.expectedDeliveryDate || null, req.params.id, req.params.businessId]
    );

    if (Array.isArray(po.items)) {
      for (const item of po.items) {
        if (item.productId && item.receivedQuantity !== undefined) {
          await pool.query(
            `UPDATE po_line_items SET received_quantity = ? WHERE po_id = ? AND product_id = ?`,
            [item.receivedQuantity, req.params.id, item.productId]
          );
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Deliveries & Discrepancies
app.get('/api/businesses/:businessId/deliveries', async (req, res) => {
  try {
    const [delRows] = await pool.query(
      'SELECT * FROM deliveries WHERE business_id = ? ORDER BY created_at DESC',
      [req.params.businessId]
    );

    const delIds = delRows.map(d => d.id);
    let itemMap = new Map();

    if (delIds.length > 0) {
      const [itemRows] = await pool.query(
        `SELECT * FROM delivery_items WHERE delivery_id IN (?)`,
        [delIds]
      );
      itemRows.forEach(item => {
        const list = itemMap.get(item.delivery_id) || [];
        list.push({
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          orderedQuantity: item.ordered_quantity,
          deliveredQuantity: item.delivered_quantity,
          verificationStatus: item.verification_status,
          discrepancyReason: item.discrepancy_reason,
        });
        itemMap.set(item.delivery_id, list);
      });
    }

    const formatted = delRows.map(d => ({
      id: d.id,
      businessId: d.business_id,
      poId: d.po_id,
      poNumber: d.po_number,
      vendorId: d.vendor_id,
      vendorName: d.vendor_name,
      warehouseId: d.warehouse_id,
      warehouseName: d.warehouse_name,
      items: itemMap.get(d.id) || [],
      status: d.status,
      productVerificationStatus: d.product_verification_status,
      billVerificationStatus: d.bill_verification_status,
      ownerConfirmationStatus: d.owner_confirmation_status,
      ownerConfirmationNote: d.owner_confirmation_note,
      hasQuantityDiscrepancy: Boolean(d.has_quantity_discrepancy),
      driverName: d.driver_name,
      driverPhone: d.driver_phone,
      vehicleNumber: d.vehicle_number,
      notes: d.notes,
      billPhotoBase64: d.bill_photo_base64,
      aiVerification: d.ai_verification_json ? (typeof d.ai_verification_json === 'string' ? JSON.parse(d.ai_verification_json) : d.ai_verification_json) : null,
      verifiedBy: d.verified_by,
      verifiedAt: d.verified_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/deliveries', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const d = req.body;
    const delId = d.id || `del_${Date.now()}`;
    const aiJson = d.aiVerification ? JSON.stringify(d.aiVerification) : (d.aiVerificationJson ? JSON.stringify(d.aiVerificationJson) : null);

    await conn.query(
      `INSERT INTO deliveries (id, business_id, po_id, po_number, vendor_id, vendor_name, warehouse_id, warehouse_name, status, product_verification_status, bill_verification_status, owner_confirmation_status, owner_confirmation_note, has_quantity_discrepancy, driver_name, driver_phone, vehicle_number, notes, bill_photo_base64, ai_verification_json, verified_by, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status=VALUES(status), product_verification_status=VALUES(product_verification_status), bill_verification_status=VALUES(bill_verification_status), owner_confirmation_status=VALUES(owner_confirmation_status), owner_confirmation_note=VALUES(owner_confirmation_note), has_quantity_discrepancy=VALUES(has_quantity_discrepancy), bill_photo_base64=VALUES(bill_photo_base64), ai_verification_json=VALUES(ai_verification_json), verified_by=VALUES(verified_by), verified_at=VALUES(verified_at)`,
      [
        delId,
        req.params.businessId,
        d.poId,
        d.poNumber,
        d.vendorId,
        d.vendorName,
        d.warehouseId,
        d.warehouseName,
        d.status || 'SCHEDULED',
        d.productVerificationStatus || 'PENDING',
        d.billVerificationStatus || 'PENDING',
        d.ownerConfirmationStatus || null,
        d.ownerConfirmationNote || null,
        d.hasQuantityDiscrepancy ?? false,
        d.driverName || '',
        d.driverPhone || '',
        d.vehicleNumber || '',
        d.notes || '',
        d.billPhotoBase64 || null,
        aiJson,
        d.verifiedBy || null,
        d.verifiedAt || null,
      ]
    );

    if (Array.isArray(d.items)) {
      await conn.query('DELETE FROM delivery_items WHERE delivery_id = ?', [delId]);
      for (const item of d.items) {
        await conn.query(
          `INSERT INTO delivery_items (id, delivery_id, product_id, product_name, sku, ordered_quantity, delivered_quantity, verification_status, discrepancy_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `deli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            delId,
            item.productId,
            item.productName,
            item.sku,
            item.orderedQuantity,
            item.deliveredQuantity !== undefined ? item.deliveredQuantity : item.orderedQuantity,
            item.verificationStatus || 'PENDING',
            item.discrepancyReason || null,
          ]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, id: delId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

app.put('/api/businesses/:businessId/deliveries/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const d = req.body;
    const aiJson = d.aiVerification !== undefined ? (d.aiVerification ? JSON.stringify(d.aiVerification) : null) : (d.aiVerificationJson ? JSON.stringify(d.aiVerificationJson) : undefined);

    await conn.query(
      `UPDATE deliveries SET
         status = COALESCE(?, status),
         product_verification_status = COALESCE(?, product_verification_status),
         bill_verification_status = COALESCE(?, bill_verification_status),
         owner_confirmation_status = COALESCE(?, owner_confirmation_status),
         owner_confirmation_note = COALESCE(?, owner_confirmation_note),
         has_quantity_discrepancy = COALESCE(?, has_quantity_discrepancy),
         bill_photo_base64 = COALESCE(?, bill_photo_base64),
         ai_verification_json = COALESCE(?, ai_verification_json),
         notes = COALESCE(?, notes),
         verified_by = COALESCE(?, verified_by),
         verified_at = COALESCE(?, verified_at)
       WHERE id = ? AND business_id = ?`,
      [
        d.status,
        d.productVerificationStatus,
        d.billVerificationStatus,
        d.ownerConfirmationStatus,
        d.ownerConfirmationNote,
        d.hasQuantityDiscrepancy,
        d.billPhotoBase64,
        aiJson,
        d.notes,
        d.verifiedBy,
        d.verifiedAt,
        req.params.id,
        req.params.businessId,
      ]
    );

    if (Array.isArray(d.items)) {
      for (const item of d.items) {
        if (item.productId) {
          await conn.query(
            `UPDATE delivery_items SET delivered_quantity = COALESCE(?, delivered_quantity), verification_status = COALESCE(?, verification_status), discrepancy_reason = COALESCE(?, discrepancy_reason)
             WHERE delivery_id = ? AND product_id = ?`,
            [item.deliveredQuantity, item.verificationStatus, item.discrepancyReason, req.params.id, item.productId]
          );
        }
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// 9. Stock Balances
app.get('/api/businesses/:businessId/stock-balances', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM stock_balances WHERE business_id = ?', [req.params.businessId]);
    const formatted = rows.map(sb => ({
      id: sb.id,
      businessId: sb.business_id,
      productId: sb.product_id,
      productName: sb.product_name,
      sku: sb.sku,
      warehouseId: sb.warehouse_id,
      quantity: sb.quantity,
      lastUpdated: sb.last_updated,
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/stock-balances', async (req, res) => {
  try {
    const sb = req.body;
    const id = sb.id || `${sb.productId}_${sb.warehouseId}`;
    await pool.query(
      `INSERT INTO stock_balances (id, business_id, product_id, product_name, sku, warehouse_id, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), product_name = VALUES(product_name), sku = VALUES(sku)`,
      [
        id,
        req.params.businessId,
        sb.productId,
        sb.productName,
        sb.sku,
        sb.warehouseId,
        sb.quantity || 0,
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Supplier Bills
app.get('/api/businesses/:businessId/bills', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM supplier_bills WHERE business_id = ? ORDER BY created_at DESC', [req.params.businessId]);
    const formatted = rows.map(b => ({
      id: b.id,
      businessId: b.business_id,
      poId: b.po_id,
      poNumber: b.po_number,
      vendorId: b.vendor_id,
      vendorName: b.vendor_name,
      billNumber: b.bill_number,
      billDate: b.bill_date ? b.bill_date.toISOString().split('T')[0] : '',
      subtotal: parseFloat(b.subtotal),
      taxAmount: parseFloat(b.tax_amount),
      totalAmount: parseFloat(b.total_amount),
      status: b.status,
      billPhotoBase64: b.bill_photo_base64,
      aiVerification: b.ai_verification_json ? (typeof b.ai_verification_json === 'string' ? JSON.parse(b.ai_verification_json) : b.ai_verification_json) : null,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/bills', async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || `bill_${Date.now()}`;
    const aiJson = b.aiVerification ? JSON.stringify(b.aiVerification) : (b.aiVerificationJson ? JSON.stringify(b.aiVerificationJson) : null);
    await pool.query(
      `INSERT INTO supplier_bills (id, business_id, po_id, po_number, vendor_id, vendor_name, bill_number, bill_date, subtotal, tax_amount, total_amount, bill_photo_base64, ai_verification_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status=VALUES(status), bill_photo_base64=VALUES(bill_photo_base64), ai_verification_json=VALUES(ai_verification_json)`,
      [
        id,
        req.params.businessId,
        b.poId,
        b.poNumber,
        b.vendorId,
        b.vendorName,
        b.billNumber,
        b.billDate || new Date().toISOString().split('T')[0],
        b.subtotal || 0,
        b.taxAmount || 0,
        b.totalAmount || 0,
        b.billPhotoBase64 || null,
        aiJson,
        b.status || 'PENDING',
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/businesses/:businessId/bills/:id', async (req, res) => {
  try {
    const b = req.body;
    const aiJson = b.aiVerification !== undefined ? (b.aiVerification ? JSON.stringify(b.aiVerification) : null) : (b.aiVerificationJson ? JSON.stringify(b.aiVerificationJson) : undefined);
    await pool.query(
      `UPDATE supplier_bills SET status = COALESCE(?, status), bill_photo_base64 = COALESCE(?, bill_photo_base64), ai_verification_json = COALESCE(?, ai_verification_json)
       WHERE id = ? AND business_id = ?`,
      [b.status, b.billPhotoBase64, aiJson, req.params.id, req.params.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Canvas Dashboard Widgets (Direct MySQL Persistence)
app.get('/api/businesses/:businessId/canvas-widgets', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM canvas_widgets WHERE business_id = ? ORDER BY created_at ASC',
      [req.params.businessId]
    );
    const formatted = rows.map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      config: typeof w.config === 'string' ? JSON.parse(w.config) : w.config || {},
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/canvas-widgets', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const widgets = req.body.widgets || [];
    const businessId = req.params.businessId;

    // Remove existing widgets for this business and replace with new layout
    await conn.query('DELETE FROM canvas_widgets WHERE business_id = ?', [businessId]);

    for (const w of widgets) {
      await conn.query(
        `INSERT INTO canvas_widgets (id, business_id, type, title, x, y, w, h, config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [w.id, businessId, w.type, w.title, w.x, w.y, w.w, w.h, JSON.stringify(w.config || {})]
      );
    }

    await conn.commit();
    res.json({ success: true, count: widgets.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// 12. Stock Movements
app.get('/api/businesses/:businessId/stock-movements', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sm.*, p.name as product_name, p.sku 
       FROM stock_movements sm 
       LEFT JOIN products p ON sm.product_id = p.id 
       WHERE sm.business_id = ? 
       ORDER BY sm.created_at DESC`,
      [req.params.businessId]
    );
    const formatted = rows.map(m => ({
      id: m.id,
      businessId: m.business_id,
      productId: m.product_id,
      productName: m.product_name || '',
      sku: m.sku || '',
      warehouseId: m.warehouse_id,
      type: m.type,
      quantity: m.quantity,
      referenceId: m.reference_id,
      referenceType: m.reference_type,
      actorUid: m.actor_uid,
      notes: m.notes,
      timestamp: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/stock-movements', async (req, res) => {
  try {
    const m = req.body;
    const id = m.id || `mov_${Date.now()}`;
    await pool.query(
      `INSERT INTO stock_movements (id, business_id, product_id, warehouse_id, type, quantity, reference_id, reference_type, actor_uid, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.params.businessId,
        m.productId,
        m.warehouseId,
        m.type,
        m.quantity,
        m.referenceId || null,
        m.referenceType || null,
        m.actorUid || null,
        m.notes || null,
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Payments
app.get('/api/businesses/:businessId/payments', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM payment_records WHERE business_id = ? ORDER BY created_at DESC',
      [req.params.businessId]
    );
    const formatted = rows.map(p => ({
      id: p.id,
      businessId: p.business_id,
      billId: p.bill_id,
      vendorId: p.vendor_id,
      vendorName: p.vendor_name,
      amount: parseFloat(p.amount),
      paymentDate: p.payment_date ? new Date(p.payment_date).toISOString().split('T')[0] : '',
      paymentMethod: p.payment_method,
      referenceNumber: p.reference_number || '',
      notes: p.notes || '',
      recordedBy: p.recorded_by,
      createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/payments', async (req, res) => {
  try {
    const p = req.body;
    const id = p.id || `pay_${Date.now()}`;
    await pool.query(
      `INSERT INTO payment_records (id, business_id, bill_id, vendor_id, vendor_name, amount, payment_date, payment_method, reference_number, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.params.businessId,
        p.billId,
        p.vendorId,
        p.vendorName,
        p.amount || 0,
        p.paymentDate || new Date().toISOString().split('T')[0],
        p.paymentMethod || 'BANK_TRANSFER',
        p.referenceNumber || null,
        p.notes || null,
        p.recordedBy || null,
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Audit Logs
app.get('/api/businesses/:businessId/audit-logs', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM audit_logs WHERE business_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.params.businessId]
    );
    const formatted = rows.map(a => ({
      id: a.id,
      businessId: a.business_id,
      entityType: a.entity_type,
      entityId: a.entity_id,
      actorUid: a.actor_uid,
      details: typeof a.details === 'string' ? JSON.parse(a.details) : a.details || {},
      timestamp: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/businesses/:businessId/audit-logs', async (req, res) => {
  try {
    const a = req.body;
    const id = a.id || `audit_${Date.now()}`;
    await pool.query(
      `INSERT INTO audit_logs (id, business_id, entity_type, entity_id, actor_uid, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.params.businessId,
        a.entityType,
        a.entityId,
        a.actorUid || 'system',
        JSON.stringify(a.details || {}),
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/businesses/:id', async (req, res) => {
  try {
    const b = req.body;
    await pool.query(
      `UPDATE businesses SET
         name = COALESCE(?, name),
         type = COALESCE(?, type),
         country = COALESCE(?, country),
         currency_code = COALESCE(?, currency_code),
         currency_symbol = COALESCE(?, currency_symbol),
         gstin = COALESCE(?, gstin),
         default_tax_rate = COALESCE(?, default_tax_rate),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email),
         address = COALESCE(?, address)
       WHERE id = ?`,
      [
        b.name ?? null,
        b.type ?? null,
        b.country ?? null,
        b.currency?.code ?? null,
        b.currency?.symbol ?? null,
        b.taxSettings?.gstin ?? null,
        b.taxSettings?.defaultTaxRate ?? null,
        b.contact?.phone ?? null,
        b.contact?.email ?? null,
        b.contact?.address ?? null,
        req.params.id,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Mail Notification & Outbox Dispatcher ---
const mailOutbox = [];

app.post('/api/send-mail', async (req, res) => {
  try {
    const { to, subject, body, action, businessName, role, inviteCode, joinUrl } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Recipient email "to" is required' });
    }

    const mailRecord = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      to: to.trim().toLowerCase(),
      subject: subject || `Notification from ${businessName || 'Lofty ERP'}`,
      body: body || '',
      action: action || 'INVITATION',
      businessName: businessName || '',
      role: role || '',
      inviteCode: inviteCode || '',
      joinUrl: joinUrl || '',
      sentAt: new Date().toISOString(),
      status: 'SENT',
    };

    mailOutbox.unshift(mailRecord);
    if (mailOutbox.length > 200) mailOutbox.pop();

    console.log(`✉️ [Mail Dispatcher] Dispatched ${mailRecord.action} to: ${mailRecord.to} | Subject: "${mailRecord.subject}"`);

    res.json({
      success: true,
      message: `Email queued and dispatched successfully to ${to}`,
      data: mailRecord,
    });
  } catch (err) {
    console.error('Mail dispatch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/mail-outbox', (req, res) => {
  res.json({ success: true, data: mailOutbox });
});

app.listen(PORT, () => {
  console.log(`Lofty ERP MySQL Backend Server running on http://localhost:${PORT}`);
});
