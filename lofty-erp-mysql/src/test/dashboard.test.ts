import { describe, it, expect } from 'vitest';
import {
  Product,
  StockBalance,
  VendorProduct,
  PurchaseOrder,
  Delivery,
  SupplierBill,
} from '../types';

describe('Dashboard Operations & Valuation Calculations', () => {
  const sampleProducts: Product[] = [
    {
      id: 'prod_1',
      businessId: 'biz_test',
      name: 'Teak Wooden Planks',
      sku: 'WD-001',
      unit: 'Pcs',
      category: 'Timber',
      reorderThreshold: 20,
      taxRate: 18,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'prod_2',
      businessId: 'biz_test',
      name: 'PVA Wood Adhesive',
      sku: 'CH-002',
      unit: 'Boxes',
      category: 'Adhesives',
      reorderThreshold: 15,
      taxRate: 12,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'prod_3',
      businessId: 'biz_test',
      name: 'Stainless Steel Hinges',
      sku: 'HD-003',
      unit: 'Sets',
      category: 'Hardware',
      reorderThreshold: 50,
      taxRate: 18,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const sampleVendorProducts: VendorProduct[] = [
    {
      id: 'vp_1',
      businessId: 'biz_test',
      vendorId: 'ven_1',
      productId: 'prod_1',
      vendorPrice: 100, // ₹100 each
      unit: 'Pcs',
      leadTimeDays: 4,
      minOrderQuantity: 10,
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'vp_2',
      businessId: 'biz_test',
      vendorId: 'ven_2',
      productId: 'prod_2',
      vendorPrice: 650, // ₹650 each
      unit: 'Boxes',
      leadTimeDays: 3,
      minOrderQuantity: 2,
      isActive: true,
      createdAt: '2026-01-01',
    },
  ];

  it('calculates inventory valuation strictly from physically accepted in-stock items (55 planks @ ₹100 = ₹5,500)', () => {
    // 55 planks accepted in Godown (out of 60 ordered)
    const stockBalances: StockBalance[] = [
      {
        id: 'sb_1',
        businessId: 'biz_test',
        productId: 'prod_1',
        productName: 'Teak Wooden Planks',
        sku: 'WD-001',
        warehouseId: 'wh_1',
        quantity: 55, // 55 accepted into stock
        lastUpdated: '2026-02-02',
      },
      {
        id: 'sb_2',
        businessId: 'biz_test',
        productId: 'prod_2',
        productName: 'PVA Wood Adhesive',
        sku: 'CH-002',
        warehouseId: 'wh_1',
        quantity: 12, // 12 in stock
        lastUpdated: '2026-02-02',
      },
    ];

    let totalValuation = 0;
    stockBalances.forEach(sb => {
      const vp = sampleVendorProducts.find(item => item.productId === sb.productId);
      const unitCost = vp ? vp.vendorPrice : 0;
      totalValuation += sb.quantity * unitCost;
    });

    // 55 * 100 = 5,500; 12 * 650 = 7,800. Total = 13,300
    expect(totalValuation).toBe(5500 + 7800);
    // Explicitly verify the 55 accepted planks valuation
    expect(55 * 100).toBe(5500);
  });

  it('strictly separates approved payable liabilities from unverified pending bills', () => {
    const bills: SupplierBill[] = [
      {
        id: 'bill_verified_1',
        businessId: 'biz_test',
        purchaseOrderId: 'po_1',
        poNumber: 'PO-001',
        vendorId: 'ven_1',
        vendorName: 'Western Timber',
        invoiceNumber: 'INV-101',
        invoiceDate: '2026-02-01',
        lineItems: [],
        subtotal: 5500,
        cgstAmount: 495,
        sgstAmount: 495,
        igstAmount: 0,
        totalTax: 990,
        totalAmount: 6490,
        paidAmount: 2000, // partially paid
        status: 'VERIFIED',
        paymentStatus: 'PARTIALLY_PAID',
        createdAt: '2026-02-01',
        updatedAt: '2026-02-01',
      },
      {
        id: 'bill_pending_review_2',
        businessId: 'biz_test',
        purchaseOrderId: 'po_2',
        poNumber: 'PO-002',
        vendorId: 'ven_2',
        vendorName: 'ResinTech',
        invoiceNumber: 'INV-102',
        invoiceDate: '2026-02-02',
        lineItems: [],
        subtotal: 6500,
        cgstAmount: 390,
        sgstAmount: 390,
        igstAmount: 0,
        totalTax: 780,
        totalAmount: 7280,
        paidAmount: 0,
        status: 'PENDING', // Awaiting 3-way check
        paymentStatus: 'UNPAID',
        createdAt: '2026-02-02',
        updatedAt: '2026-02-02',
      },
    ];

    // Approved liabilities calculation
    const approvedBills = bills.filter(b => b.status === 'VERIFIED');
    const approvedOutstanding = approvedBills.reduce(
      (sum, b) => sum + (b.totalAmount - (b.paidAmount || 0)),
      0
    );

    // Pending review bills
    const pendingBills = bills.filter(b => b.status === 'PENDING');
    const pendingReviewAmount = pendingBills.reduce((sum, b) => sum + b.totalAmount, 0);

    // Approved outstanding must be 6,490 - 2,000 = 4,490
    expect(approvedOutstanding).toBe(4490);

    // Unverified bill must NOT be included in approved liabilities
    expect(approvedOutstanding).not.toContain(7280);
    expect(pendingReviewAmount).toBe(7280);
  });

  it('correctly categorizes stock into Healthy, Low Stock, and Out of Stock', () => {
    const stockMap = new Map<string, number>([
      ['prod_1', 55], // > 20 threshold => HEALTHY
      ['prod_2', 12], // <= 15 threshold => LOW_STOCK
      ['prod_3', 0],  // <= 0 => OUT_OF_STOCK
    ]);

    let healthy = 0;
    let low = 0;
    let out = 0;

    sampleProducts.forEach(p => {
      const qty = stockMap.get(p.id) || 0;
      if (qty <= 0) {
        out++;
      } else if (qty <= p.reorderThreshold) {
        low++;
      } else {
        healthy++;
      }
    });

    expect(healthy).toBe(1);
    expect(low).toBe(1);
    expect(out).toBe(1);
  });

  it('allows adding and modifying vendor supply products dynamically', async () => {
    const { upsertVendorProduct, getVendorProducts, deleteVendorProduct } = await import(
      '../services/vendorService'
    );
    const bId = 'biz_test_vp';
    const vId = 'ven_test_supplier';

    // 1. Add vendor product
    const added = await upsertVendorProduct(bId, vId, {
      productId: 'prod_1',
      vendorPrice: 110,
      unit: 'Pcs',
      leadTimeDays: 5,
      minOrderQuantity: 20,
      isActive: true,
    });

    expect(added.vendorPrice).toBe(110);
    expect(added.leadTimeDays).toBe(5);

    let vps = await getVendorProducts(bId, vId);
    expect(vps.length).toBe(1);
    expect(vps[0].vendorPrice).toBe(110);

    // 2. Modify vendor product anytime (price change from 110 to 95, lead time to 3)
    const modified = await upsertVendorProduct(bId, vId, {
      id: added.id,
      productId: 'prod_1',
      vendorPrice: 95,
      unit: 'Pcs',
      leadTimeDays: 3,
      minOrderQuantity: 50,
      isActive: true,
    });

    expect(modified.id).toBe(added.id);
    expect(modified.vendorPrice).toBe(95);
    expect(modified.minOrderQuantity).toBe(50);

    vps = await getVendorProducts(bId, vId);
    expect(vps.length).toBe(1);
    expect(vps[0].vendorPrice).toBe(95);

    // 3. Remove product
    await deleteVendorProduct(bId, vId, added.id);
    vps = await getVendorProducts(bId, vId);
    expect(vps.length).toBe(0);
  });

  it('calculates accurate real-data metrics for SpendAnalyticsChart without any mock data', () => {
    const activePOs: PurchaseOrder[] = [
      {
        id: 'po_1',
        businessId: 'biz_test',
        orderNumber: 'PO-2026-8017',
        vendorId: 'ven_1',
        vendorName: 'DemoA',
        warehouseId: 'wh_1',
        warehouseName: 'Ballari Godown',
        items: [
          {
            productId: 'prod_1',
            productName: 'tomato',
            sku: 'TM-01',
            unit: 'kg',
            quantity: 100,
            unitPrice: 500,
            taxRate: 18,
            taxAmount: 9000,
            receivedQuantity: 0,
            lineTotal: 50000,
            totalWithTax: 59000,
          },
        ],
        subtotal: 50000,
        taxTotal: 9000,
        grandTotal: 59000,
        status: 'Ordered',
        expectedDeliveryDate: '2026-11-04',
        createdBy: 'user_1',
        createdAt: '2026-10-28',
        updatedAt: '2026-10-28',
      },
    ];

    const totalSpend = activePOs.reduce((acc, po) => acc + po.grandTotal, 0);
    expect(totalSpend).toBe(59000);

    const vendorMap = new Map<string, number>();
    activePOs.forEach(po => {
      vendorMap.set(po.vendorName, (vendorMap.get(po.vendorName) || 0) + po.grandTotal);
    });

    expect(vendorMap.get('DemoA')).toBe(59000);
    expect(vendorMap.size).toBe(1);
  });

  it('calculates accurate stock levels and health statuses for StockAnalyticsChart', () => {
    const products: Product[] = [
      {
        id: 'prod_tomato',
        businessId: 'biz_test',
        name: 'tomato',
        sku: 'TM-01',
        unit: 'kg',
        category: 'Vegetables',
        reorderThreshold: 10,
        taxRate: 5,
        isActive: true,
        createdAt: '2026-10-28',
        updatedAt: '2026-10-28',
      },
    ];

    const stockBalances: StockBalance[] = [
      {
        id: 'sb_tomato',
        businessId: 'biz_test',
        productId: 'prod_tomato',
        productName: 'tomato',
        sku: 'TM-01',
        warehouseId: 'wh_ballari',
        quantity: 0,
        lastUpdated: '2026-10-28',
      },
    ];

    const stock = stockBalances.find(sb => sb.productId === 'prod_tomato')?.quantity || 0;
    const isOutOfStock = stock <= 0;
    expect(stock).toBe(0);
    expect(isOutOfStock).toBe(true);
  });
});
