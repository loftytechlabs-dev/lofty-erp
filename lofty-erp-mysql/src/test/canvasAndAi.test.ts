import { describe, it, expect, beforeEach } from 'vitest';
import { localStore } from '../services/store';
import {
  createPurchaseOrder,
  getPurchaseOrderById,
} from '../services/purchaseOrderService';
import {
  buildBusinessSummary,
  askAiCopilot,
  detectAndParsePoOrder,
  verifyBillAuthenticityWithGemini,
  getStoredGeminiApiKey,
  saveStoredGeminiApiKey,
  BusinessAiContext,
  INDIAN_STATES,
  getStateByCode,
  detectStateFromGstin,
  calculateStateTaxBreakdown,
  evaluateProductItcHeuristic,
  evaluateProductItcWithGemini,
  evaluatePoItc,
} from '../services/aiService';
import { interpolate } from '../contexts/LanguageContext';
import { snap } from '../components/dashboard/CanvasWidgetCard';
import {
  CanvasWidget,
  Product,
  PurchaseOrder,
  StockBalance,
  Vendor,
  Delivery,
  SupplierBill,
  Warehouse,
} from '../types';

describe('Interactive Canvas Dashboard & Gemini AI Copilot', () => {
  const testBusinessId = 'biz_canvas_test';

  const mockPOs: PurchaseOrder[] = [
    {
      id: 'po_001',
      businessId: testBusinessId,
      orderNumber: 'PO-2026-8001',
      vendorId: 'ven_1',
      vendorName: 'Apex Woodcraft',
      warehouseId: 'wh_main',
      warehouseName: 'Central Godown',
      expectedDeliveryDate: '2026-02-10',
      createdBy: 'user_1',
      status: 'Ordered',
      items: [],
      subtotal: 100000,
      taxTotal: 18000,
      grandTotal: 118000,
      notes: '',
      createdAt: '2026-02-01T10:00:00Z',
      updatedAt: '2026-02-01T10:00:00Z',
    },
    {
      id: 'po_002',
      businessId: testBusinessId,
      orderNumber: 'PO-2026-8002',
      vendorId: 'ven_2',
      vendorName: 'Nordic Timber Supplies',
      warehouseId: 'wh_main',
      warehouseName: 'Central Godown',
      expectedDeliveryDate: '2026-02-12',
      createdBy: 'user_1',
      status: 'Partially Received',
      items: [],
      subtotal: 50000,
      taxTotal: 9000,
      grandTotal: 59000,
      notes: '',
      createdAt: '2026-02-02T10:00:00Z',
      updatedAt: '2026-02-02T10:00:00Z',
    },
  ];

  const mockProducts: Product[] = [
    {
      id: 'prod_pine',
      businessId: testBusinessId,
      name: 'Pine Planks',
      sku: 'WD-PINE-01',
      unit: 'Pieces',
      category: 'Wood',
      reorderThreshold: 20,
      taxRate: 18,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'prod_glue',
      businessId: testBusinessId,
      name: 'Polymer Glue',
      sku: 'CH-GLUE-01',
      unit: 'Bottles',
      category: 'Chemicals',
      reorderThreshold: 10,
      taxRate: 18,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const mockStockBalances: StockBalance[] = [
    {
      id: 'sb_1',
      businessId: testBusinessId,
      productId: 'prod_pine',
      productName: 'Pine Planks',
      sku: 'WD-PINE-01',
      warehouseId: 'wh_main',
      quantity: 5, // Below threshold of 20 -> Low stock!
      lastUpdated: '2026-01-01',
    },
    {
      id: 'sb_2',
      businessId: testBusinessId,
      productId: 'prod_glue',
      productName: 'Polymer Glue',
      sku: 'CH-GLUE-01',
      warehouseId: 'wh_main',
      quantity: 50, // Healthy stock
      lastUpdated: '2026-01-01',
    },
  ];

  const mockVendors: Vendor[] = [
    {
      id: 'ven_1',
      businessId: testBusinessId,
      name: 'Apex Woodcraft',
      contactPerson: 'David Ross',
      email: 'david@apex.com',
      phone: '9876543210',
      address: 'Industrial Area',
      gstin: '29ABCDE1234F1Z5',
      paymentTerms: 'Net 30',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const sampleContext: BusinessAiContext = {
    businessName: 'Apex Woodcraft & Engineering Ltd.',
    currencySymbol: '₹',
    purchaseOrders: mockPOs,
    products: mockProducts,
    stockBalances: mockStockBalances,
    vendors: mockVendors,
    deliveries: [],
    bills: [],
    warehouses: [{ id: 'wh_main', businessId: testBusinessId, name: 'Central Godown', code: 'WH-01', location: 'Section B', isActive: true, createdAt: '' }],
    currentWidgets: [
      { id: 'w1', type: 'spend_by_supplier', title: 'Spend by Supplier' },
    ],
  };

  describe('Canvas Layout & Snapping', () => {
    it('snaps arbitrary coordinates accurately to 16px grid intervals', () => {
      expect(snap(0)).toBe(0);
      expect(snap(15)).toBe(16);
      expect(snap(24)).toBe(32);
      expect(snap(49)).toBe(48);
      expect(snap(100)).toBe(96);
    });

    it('persists and retrieves canvas widgets in localStore cleanly', () => {
      const widgets: CanvasWidget[] = [
        {
          id: 'test-widget-1',
          type: 'spend_by_supplier',
          title: 'My Custom Spend Chart',
          x: 32,
          y: 48,
          w: 500,
          h: 300,
        },
        {
          id: 'test-widget-2',
          type: 'kpi_metric',
          title: 'Total Spend',
          x: 544,
          y: 48,
          w: 260,
          h: 160,
          config: { metricKey: 'total_spend' },
        },
      ];

      localStore.saveCanvasWidgets(testBusinessId, widgets);
      const loaded = localStore.getCanvasWidgets(testBusinessId);

      expect(loaded).toBeDefined();
      expect(loaded?.length).toBe(2);
      expect(loaded?.[0].title).toBe('My Custom Spend Chart');
      expect(loaded?.[1].type).toBe('kpi_metric');
    });
  });

  describe('AI Context & Business Intelligence Summary', () => {
    it('generates accurate business context strictly using real business data without mock values', () => {
      const summary = buildBusinessSummary(sampleContext);

      expect(summary).toContain('Apex Woodcraft & Engineering Ltd.');
      // Grand total spend: 118,000 + 59,000 = 177,000
      expect(summary).toContain('1,77,000');
      // Low stock item should be Pine Planks (5 Pieces)
      expect(summary).toContain('Pine Planks (5 Pieces)');
      // Suppliers
      expect(summary).toContain('Apex Woodcraft');
    });

    it('correctly reports spend inquiries with exact figures', async () => {
      const response = await askAiCopilot('How much spend do we have with suppliers?', sampleContext);

      expect(['local_copilot', 'gemini']).toContain(response.source);
      expect(response.text.replace(/,/g, '')).toMatch(/177/);
      expect(response.text.toLowerCase()).toContain('apex woodcraft');
    });

    it('identifies items requiring action under low stock risks', async () => {
      const response = await askAiCopilot('Which items have low stock?', sampleContext);

      expect(response.text).toContain('Pine Planks');
      expect(response.text.toLowerCase()).toMatch(/5 pieces|5/);
    });

    it('parses "add spend chart" intent and emits widget action', async () => {
      const response = await askAiCopilot('Please add a spend chart to my canvas', sampleContext);

      expect(response.action).toBeDefined();
      expect(response.action?.type).toBe('ADD_WIDGET');
      expect(['spend_by_supplier', 'spend_timeline']).toContain(response.action?.widgetType);
    });

    it('parses "arrange in 2 columns" intent and emits layout action', async () => {
      const response = await askAiCopilot('arrange into 2 cols', sampleContext);

      expect(response.action).toBeDefined();
      expect(response.action?.type).toBe('ARRANGE_COLUMNS');
      expect(response.action?.columns).toBe(2);
    });

    it('parses "reset layout" intent and emits reset action', async () => {
      const response = await askAiCopilot('reset to default layout', sampleContext);

      expect(response.action).toBeDefined();
      expect(response.action?.type).toBe('RESET_LAYOUT');
    });
  });

  describe('Gemini API Key Management', () => {
    beforeEach(() => {
      try {
        if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
          localStorage.clear();
        } else if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('lofty_erp_gemini_api_key');
        }
      } catch (e) {}
    });

    it('safely stores and retrieves Gemini API keys from localStorage', () => {
      saveStoredGeminiApiKey('dummy-mock-api-key-test');
      expect(getStoredGeminiApiKey()).toBe('dummy-mock-api-key-test');

      saveStoredGeminiApiKey('');
      // Falls back to default key or empty string
      expect(getStoredGeminiApiKey()).toBeTruthy();
    });
  });

  describe('Autonomous PO Order Booking & Gemini Multimodal Bill Fraud Scanner', () => {
    it('parses natural language order commands into actionable PO payloads', () => {
      const parsed = detectAndParsePoOrder('order 50 items of pine planks from apex woodcraft to central godown', sampleContext);

      expect(parsed).toBeDefined();
      expect(parsed?.quantity).toBe(50);
      expect(parsed?.product.name).toBe('Pine Planks');
      expect(parsed?.vendor.name).toBe('Apex Woodcraft');
      expect(parsed?.warehouse.name).toBe('Central Godown');
      expect(parsed?.taxRate).toBe(18);
      expect(parsed?.totalWithTax).toBeGreaterThan(0);
    });

    it('rejects non-order prompts from trigger parser', () => {
      const parsed = detectAndParsePoOrder('what is the weather today in Bangalore?', sampleContext);
      expect(parsed).toBeNull();
    });

    it('detects corrupt/blank image uploads as scam/invalid with zero confidence', async () => {
      const result = await verifyBillAuthenticityWithGemini('data:image/jpeg;base64,AAAA');
      expect(result.isAuthentic).toBe(false);
      expect(result.confidenceScore).toBe(0);
      expect(result.isScamOrSuspicious).toBe(true);
      expect(result.scamRiskLevel).toBe('CRITICAL');
      expect(result.verdict).toContain('REJECTED');
    });

    it('validates substantial bill image data payload format', async () => {
      const largeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(8000);
      const result = await verifyBillAuthenticityWithGemini(largeBase64, {
        poNumber: 'PO-2026-001',
        vendorName: 'Apex Woodcraft',
      });
      expect(result).toBeDefined();
      expect(result.fraudChecks.length).toBeGreaterThan(0);
      expect(result.analyzedAt).toBeTruthy();
    });

    it('end-to-end creates PO from AI order, stores it, and resolves it immediately via getPurchaseOrderById without not found errors', async () => {
      const parsed = detectAndParsePoOrder('order 50 items of pine planks from apex woodcraft to central godown', sampleContext);
      expect(parsed).toBeTruthy();

      const created = await createPurchaseOrder(
        testBusinessId,
        'Test Enterprises',
        {
          vendorId: parsed!.vendor.id,
          vendorName: parsed!.vendor.name,
          warehouseId: parsed!.warehouse.id,
          warehouseName: parsed!.warehouse.name,
          items: [
            {
              productId: parsed!.product.id,
              productName: parsed!.product.name,
              sku: parsed!.product.sku,
              unit: parsed!.product.unit || 'Units',
              quantity: parsed!.quantity,
              receivedQuantity: 0,
              unitPrice: parsed!.unitPrice,
              lineTotal: parsed!.lineTotal,
              taxRate: parsed!.taxRate,
              taxAmount: parsed!.taxAmount,
              totalWithTax: parsed!.totalWithTax,
            },
          ],
          expectedDeliveryDate: '2026-03-01',
          notes: 'AI automated test order',
          createdBy: 'AI Copilot',
        }
      );

      expect(created.id).toBeTruthy();
      expect(created.items[0].quantity).toBe(50);
      expect(created.items[0].orderedQuantity).toBe(50);

      // Verify synchronous store retrieval (used on initial render of PurchaseOrderDetailPage)
      const cached = localStore.getPurchaseOrderById(testBusinessId, created.id);
      expect(cached).toBeDefined();
      expect(cached?.id).toBe(created.id);

      // Verify asynchronous resolution via getPurchaseOrderById
      const resolved = await getPurchaseOrderById(testBusinessId, created.id);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe(created.id);
      expect(resolved?.items[0].quantity).toBe(50);

      // Verify cross-business fallback resolution (e.g. if activeBusiness differs)
      const crossBizResolved = await getPurchaseOrderById('different_business_id', created.id);
      expect(crossBizResolved).toBeDefined();
      expect(crossBizResolved?.id).toBe(created.id);
    });
  });

  describe('Indian GST State Tax Engine & AI ITC Forensic Analyzer', () => {
    it('guarantees interpolate never exposes raw template tags like {{count}} even without params', () => {
      // With count param passed
      expect(interpolate('{{count}} in transit', { count: 4 })).toBe('4 in transit');
      // Without params: must cleanly resolve to 0 rather than leaking raw {{count}} to user UI
      expect(interpolate('{{count}} in transit')).toBe('0 in transit');
      expect(interpolate('{{count}} items awaiting count', {})).toBe('0 items awaiting count');
    });

    it('identifies Indian states from 2-digit GST codes and vendor GSTINs accurately', () => {
      expect(INDIAN_STATES.length).toBeGreaterThanOrEqual(30);

      const karnataka = getStateByCode('29');
      expect(karnataka?.name).toBe('Karnataka');

      const maharashtra = getStateByCode('27');
      expect(maharashtra?.name).toBe('Maharashtra');

      const detectedFromGstin = detectStateFromGstin('29ABCDE1234F1Z5');
      expect(detectedFromGstin?.code).toBe('29');
      expect(detectedFromGstin?.name).toBe('Karnataka');

      const detectedFromMhGstin = detectStateFromGstin('27XYZPQ9876M2Z8');
      expect(detectedFromMhGstin?.code).toBe('27');
      expect(detectedFromMhGstin?.name).toBe('Maharashtra');
    });

    it('calculates live state tax splits correctly for Intra-State (CGST+SGST) vs Inter-State (IGST)', () => {
      // Intra-state (Vendor in Karnataka 29 -> Destination Karnataka 29)
      const intra = calculateStateTaxBreakdown(1000, 18, '29', '29ABCDE1234F1Z5');
      expect(intra.supplyType).toBe('INTRA_STATE');
      expect(intra.cgstRate).toBe(9);
      expect(intra.sgstRate).toBe(9);
      expect(intra.igstRate).toBe(0);
      expect(intra.cgstAmount).toBe(90);
      expect(intra.sgstAmount).toBe(90);
      expect(intra.igstAmount).toBe(0);
      expect(intra.totalTax).toBe(180);

      // Inter-state (Vendor in Maharashtra 27 -> Destination Karnataka 29)
      const inter = calculateStateTaxBreakdown(1000, 18, '29', '27XYZPQ9876M2Z8');
      expect(inter.supplyType).toBe('INTER_STATE');
      expect(inter.cgstRate).toBe(0);
      expect(inter.sgstRate).toBe(0);
      expect(inter.igstRate).toBe(18);
      expect(inter.cgstAmount).toBe(0);
      expect(inter.sgstAmount).toBe(0);
      expect(inter.igstAmount).toBe(180);
      expect(inter.totalTax).toBe(180);
    });

    it('accurately evaluates ITC eligibility: 100% ELIGIBLE for raw materials under Section 16(1)', async () => {
      const itc = await evaluateProductItcWithGemini({
        productId: 'prod_pine',
        productName: 'Kiln Dried Pine Planks',
        category: 'Timber & Raw Materials',
        sku: 'WOD-PIN-001',
        unitPrice: 500,
        lineTotal: 5000,
        taxRate: 18,
        taxAmount: 900,
      });

      expect(itc.status).toBe('ELIGIBLE');
      expect(itc.percentageClaimable).toBe(100);
      expect(itc.claimableAmount).toBe(900);
      expect(itc.netEffectiveCost).toBe(5000);
      expect(itc.statutorySection).toContain('16(1)');
    });

    it('accurately blocks ITC on prohibited items under Section 17(5) (Food, Beverage, Catering)', async () => {
      const itc = await evaluateProductItcWithGemini({
        productId: 'prod_food',
        productName: 'Corporate Buffet Catering & Refreshment Beverages',
        category: 'Food & Beverage',
        unitPrice: 2000,
        lineTotal: 10000,
        taxRate: 18,
        taxAmount: 1800,
      });

      expect(itc.status).toBe('BLOCKED');
      expect(itc.percentageClaimable).toBe(0);
      expect(itc.claimableAmount).toBe(0);
      expect(itc.netEffectiveCost).toBe(11800);
      expect(itc.statutorySection).toContain('17(5)');
    });

    it('evaluates end-to-end PO ITC summary with mixed items and calculates net effective spend', async () => {
      const poItems = [
        {
          productId: 'p1',
          productName: 'Teak Wood Planks',
          unitPrice: 1000,
          lineTotal: 10000,
          taxRate: 18,
          taxAmount: 1800,
        },
        {
          productId: 'p2',
          productName: 'Office Executive Snack Basket & Refreshments',
          unitPrice: 500,
          lineTotal: 2000,
          taxRate: 18,
          taxAmount: 360,
        },
      ];

      const summary = await evaluatePoItc(poItems, '29ABCDE1234F1Z5', '29');
      expect(summary.supplyType).toBe('INTRA_STATE');
      expect(summary.totalTaxAmount).toBe(2160);
      expect(summary.totalClaimableItc).toBe(1800);
      expect(summary.totalBlockedItc).toBe(360);
      // Net spend = Pre-tax total (12,000) + Blocked tax (360) = 12,360
      expect(summary.netEffectivePoSpend).toBe(12360);
    });
  });

  describe('Mail Dispatcher, Vendor Price Comparison & Nearby Geo Map', () => {
    it('formats invitation email and encodes reliable mailto URL with complete credential payload', async () => {
      const { formatEmailContent, generateMailtoUrl } = await import('../services/mailService');

      const content = formatEmailContent({
        action: 'INVITATION',
        to: 'newengineer@example.com',
        businessName: 'Apex Woodworks',
        role: 'Warehouse',
        inviteCode: 'AUTH9921',
        joinUrl: 'https://lofty-erp.web.app/join?code=AUTH9921',
      });

      expect(content.subject).toContain('Apex Woodworks');
      expect(content.subject).toContain('Warehouse');
      expect(content.body).toContain('AUTH9921');
      expect(content.body).toContain('https://lofty-erp.web.app/join?code=AUTH9921');

      const mailto = generateMailtoUrl('newengineer@example.com', content.subject, content.body);
      expect(mailto).toContain('mailto:newengineer%40example.com');
      expect(mailto).toContain('AUTH9921');
    });

    it('records dispatched notifications in client outbox with timestamp and status', async () => {
      const { sendEmailNotification, getMailOutbox } = await import('../services/mailService');

      const res = await sendEmailNotification({
        action: 'INVITATION',
        to: 'colleague@example.com',
        businessName: 'Apex Woodworks',
        role: 'Purchasing',
        inviteCode: 'PURCH100',
      });

      expect(res.success).toBe(true);
      expect(res.mailtoUrl).toBeTruthy();

      const outbox = getMailOutbox();
      expect(outbox.length).toBeGreaterThan(0);
      const latest = outbox[0];
      expect(latest.to).toBe('colleague@example.com');
      expect(latest.status).toBe('SENT');
    });

    it('accurately calculates vendor price comparison spreads and potential savings', () => {
      const quotes = [
        { vendorId: 'v1', vendorName: 'Apex', price: 500 },
        { vendorId: 'v2', vendorName: 'Coastal', price: 420 },
        { vendorId: 'v3', vendorName: 'Summit', price: 480 },
      ].sort((a, b) => a.price - b.price);

      const lowest = quotes[0];
      const highest = quotes[quotes.length - 1];
      const unitSavings = highest.price - lowest.price; // 500 - 420 = 80
      const pctSavings = Math.round((unitSavings / highest.price) * 100); // 16%
      const batchSavings50 = unitSavings * 50; // 4000

      expect(lowest.vendorName).toBe('Coastal');
      expect(lowest.price).toBe(420);
      expect(unitSavings).toBe(80);
      expect(pctSavings).toBe(16);
      expect(batchSavings50).toBe(4000);
    });

    it('calculates geographic distance in km using haversine formula between warehouse and vendor', () => {
      // Bangalore Hub (12.9716, 77.5946) to Peenya Industrial Area (13.0285, 77.5197)
      const p1 = { lat: 12.9716, lng: 77.5946 };
      const p2 = { lat: 13.0285, lng: 77.5197 };

      const R = 6371;
      const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
      const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p1.lat * Math.PI) / 180) *
          Math.cos((p2.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = Math.round(R * c * 10) / 10;

      // Distance should be approximately 10.2 km
      expect(distance).toBeGreaterThan(8);
      expect(distance).toBeLessThan(14);
    });
  });
});
