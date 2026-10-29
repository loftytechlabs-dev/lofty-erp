import pptxgen from 'pptxgenjs';
import {
  PurchaseOrder,
  Product,
  StockBalance,
  Vendor,
  Delivery,
  SupplierBill,
  Warehouse,
} from '../types';

export type PresentationThemeId = 'lofty_warm' | 'slate_dark' | 'corporate_clean';

export interface PresentationTheme {
  id: PresentationThemeId;
  name: string;
  bgHex: string;
  cardBgHex: string;
  titleColorHex: string;
  accentColorHex: string;
  textColorHex: string;
  subtextColorHex: string;
  borderColorHex: string;
}

export const PRESENTATION_THEMES: Record<PresentationThemeId, PresentationTheme> = {
  lofty_warm: {
    id: 'lofty_warm',
    name: 'Lofty Warm (Brand)',
    bgHex: 'FFFBF7',
    cardBgHex: 'FFFFFF',
    titleColorHex: 'EA580C',
    accentColorHex: 'F97316',
    textColorHex: '1E293B',
    subtextColorHex: '64748B',
    borderColorHex: 'FED7AA',
  },
  slate_dark: {
    id: 'slate_dark',
    name: 'Executive Dark',
    bgHex: '0F172A',
    cardBgHex: '1E293B',
    titleColorHex: 'FB923C',
    accentColorHex: 'F97316',
    textColorHex: 'F8FAFC',
    subtextColorHex: '94A3B8',
    borderColorHex: '334155',
  },
  corporate_clean: {
    id: 'corporate_clean',
    name: 'Corporate White',
    bgHex: 'FFFFFF',
    cardBgHex: 'F8FAFC',
    titleColorHex: 'C2410C',
    accentColorHex: 'EA580C',
    textColorHex: '0F172A',
    subtextColorHex: '475569',
    borderColorHex: 'E2E8F0',
  },
};

export interface SlideData {
  id: string;
  type: 'title' | 'kpis' | 'spend' | 'stock' | 'pipeline' | 'recommendations';
  title: string;
  subtitle: string;
  content: any;
}

export interface PresentationContext {
  businessName: string;
  currencySymbol: string;
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  stockBalances: StockBalance[];
  vendors: Vendor[];
  deliveries: Delivery[];
  bills: SupplierBill[];
  warehouses: Warehouse[];
}

/**
 * Generates slide model based strictly on real business data
 */
export function buildPresentationSlides(ctx: PresentationContext): SlideData[] {
  const activePOs = ctx.purchaseOrders.filter(p => p.status !== 'Cancelled');
  const totalSpend = activePOs.reduce((acc, p) => acc + (p.grandTotal || 0), 0);

  // Group spend by vendor
  const vendorSpendMap = new Map<string, { name: string; amount: number; count: number }>();
  activePOs.forEach(po => {
    const v = po.vendorName || 'Other Vendor';
    const cur = vendorSpendMap.get(v) || { name: v, amount: 0, count: 0 };
    vendorSpendMap.set(v, {
      name: v,
      amount: cur.amount + (po.grandTotal || 0),
      count: cur.count + 1,
    });
  });
  const vendorSpendList = Array.from(vendorSpendMap.values()).sort((a, b) => b.amount - a.amount);

  // Stock inventory map
  const stockMap = new Map<string, number>();
  ctx.stockBalances.forEach(sb => {
    stockMap.set(sb.productId, (stockMap.get(sb.productId) || 0) + sb.quantity);
  });

  const lowStockItems = ctx.products.filter(p => (stockMap.get(p.id) || 0) <= (p.reorderThreshold || 1));
  const totalStockUnits = ctx.stockBalances.reduce((acc, sb) => acc + sb.quantity, 0);

  const pendingDeliveries = ctx.deliveries.filter(
    d => d.productVerificationStatus === 'PENDING' || d.status === 'AWAITING_REVIEW' || d.status === 'AWAITING_OWNER_CONFIRMATION'
  );
  const pendingBills = ctx.bills.filter(b => b.status === 'PENDING');
  const unpaidBillsSum = pendingBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);

  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const slides: SlideData[] = [
    // 1. Executive Title Slide
    {
      id: 'slide-1',
      type: 'title',
      title: `${ctx.businessName}`,
      subtitle: `Operations & Supply Chain Performance Briefing`,
      content: {
        date: dateStr,
        generatedBy: 'Lofty ERP Business Intelligence',
        totalSpendFormatted: `${ctx.currencySymbol}${totalSpend.toLocaleString('en-IN')}`,
        activeOrdersCount: activePOs.length,
      },
    },

    // 2. Key Performance Indicators Slide
    {
      id: 'slide-2',
      type: 'kpis',
      title: 'Executive Performance Indicators',
      subtitle: 'Real-time overview of financial commitments, warehouse capacity, and orders',
      content: {
        kpis: [
          {
            label: 'Committed PO Spend',
            value: `${ctx.currencySymbol}${totalSpend.toLocaleString('en-IN')}`,
            subtext: `Across ${activePOs.length} active orders`,
            badge: 'Procurement',
          },
          {
            label: 'Tracked Inventory',
            value: `${ctx.products.length} Products`,
            subtext: `${totalStockUnits} units in godown`,
            badge: 'Warehouse',
          },
          {
            label: 'Stock Health Alert',
            value: `${lowStockItems.length} Items`,
            subtext: lowStockItems.length > 0 ? 'Action required: Reorder soon' : 'All stocks healthy',
            badge: lowStockItems.length > 0 ? 'Warning' : 'Optimal',
          },
          {
            label: 'Inbound Deliveries',
            value: `${pendingDeliveries.length}`,
            subtext: 'Awaiting dock verification',
            badge: 'Logistics',
          },
        ],
      },
    },

    // 3. Procurement & Supplier Spend Slide
    {
      id: 'slide-3',
      type: 'spend',
      title: 'Procurement & Supplier Spend Analysis',
      subtitle: 'Committed expenditure distribution across registered vendor partners',
      content: {
        totalSpendFormatted: `${ctx.currencySymbol}${totalSpend.toLocaleString('en-IN')}`,
        vendorSpendList: vendorSpendList.slice(0, 5).map(v => ({
          name: v.name,
          amountFormatted: `${ctx.currencySymbol}${v.amount.toLocaleString('en-IN')}`,
          percentage: totalSpend > 0 ? Math.round((v.amount / totalSpend) * 100) : 0,
          orderCount: v.count,
        })),
        keyInsight:
          vendorSpendList.length > 0
            ? `Top partner "${vendorSpendList[0].name}" accounts for ${
                totalSpend > 0 ? Math.round((vendorSpendList[0].amount / totalSpend) * 100) : 0
              }% of active procurement.`
            : 'No purchase orders recorded yet.',
      },
    },

    // 4. Inventory Health & Stock Levels Slide
    {
      id: 'slide-4',
      type: 'stock',
      title: 'Warehouse Stock & Reorder Levels',
      subtitle: 'Current physical inventory compared against established safety thresholds',
      content: {
        products: ctx.products.slice(0, 6).map(prod => {
          const qty = stockMap.get(prod.id) || 0;
          const thresh = prod.reorderThreshold || 1;
          const isLow = qty <= thresh;
          const isOut = qty <= 0;
          return {
            name: prod.name,
            sku: prod.sku,
            unit: prod.unit,
            quantity: qty,
            threshold: thresh,
            status: isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy',
          };
        }),
        lowStockCount: lowStockItems.length,
      },
    },

    // 5. Active Pipeline & Deliveries Slide
    {
      id: 'slide-5',
      type: 'pipeline',
      title: 'Active Orders Pipeline & Receipt Status',
      subtitle: 'Status breakdown of orders currently in processing, transit, or inspection',
      content: {
        orders: activePOs.slice(0, 5).map(po => ({
          orderNumber: po.orderNumber,
          vendorName: po.vendorName,
          status: po.status,
          totalFormatted: `${ctx.currencySymbol}${(po.grandTotal || 0).toLocaleString('en-IN')}`,
          expectedDeliveryDate: po.expectedDeliveryDate || 'N/A',
        })),
        pendingDeliveriesCount: pendingDeliveries.length,
        unpaidBillsFormatted: `${ctx.currencySymbol}${unpaidBillsSum.toLocaleString('en-IN')}`,
      },
    },

    // 6. Strategic Recommendations & Action Items Slide
    {
      id: 'slide-6',
      type: 'recommendations',
      title: 'Strategic Operations Next Steps',
      subtitle: 'Recommended priorities generated directly from live operational data',
      content: {
        recommendations: [
          lowStockItems.length > 0
            ? `Restock Alert: Immediately initiate purchase orders for ${lowStockItems.length} products below safety thresholds (${lowStockItems.map(p => p.name).join(', ')}).`
            : `Inventory Margins: Stock levels remain healthy across all ${ctx.products.length} catalog items.`,
          pendingDeliveries.length > 0
            ? `Dock Clearance: Expedite receipt & QR scan verification for ${pendingDeliveries.length} incoming deliveries to ensure quantity counts match POs.`
            : `Logistics Flow: Inbound receiving queue is fully up to date with zero backlog.`,
          pendingBills.length > 0
            ? `Financial Reconciliation: ${pendingBills.length} supplier bills (${ctx.currencySymbol}${unpaidBillsSum.toLocaleString('en-IN')}) await 3-way match audit against delivered receipts.`
            : `Accounting: All supplier bills and receipts are reconciled with clean status.`,
          vendorSpendList.length > 0
            ? `Supplier Relationship: Review quarterly performance terms with primary supplier ${vendorSpendList[0].name} for volume discount optimization.`
            : `Procurement: Build catalog partnerships with certified regional suppliers.`,
        ],
      },
    },
  ];

  return slides;
}

/**
 * Exports true PowerPoint (.pptx) file using pptxgenjs
 */
export async function exportSlidesToPptx(
  slides: SlideData[],
  ctx: PresentationContext,
  themeId: PresentationThemeId = 'lofty_warm'
): Promise<void> {
  const theme = PRESENTATION_THEMES[themeId] || PRESENTATION_THEMES.lofty_warm;
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  const isDark = theme.id === 'slate_dark';
  const bgColor = theme.bgHex;
  const cardBg = theme.cardBgHex;
  const titleColor = theme.titleColorHex;
  const textColor = theme.textColorHex;
  const subtextColor = theme.subtextColorHex;
  const accentColor = theme.accentColorHex;

  slides.forEach(slideData => {
    const slide = pptx.addSlide();
    slide.background = { color: bgColor };

    // Slide Type: Title
    if (slideData.type === 'title') {
      slide.addText(slideData.title, {
        x: 1.0,
        y: 1.8,
        w: 11.3,
        h: 1.2,
        fontSize: 44,
        bold: true,
        color: titleColor,
        align: 'center',
        valign: 'middle',
      });

      slide.addText(slideData.subtitle, {
        x: 1.0,
        y: 3.1,
        w: 11.3,
        h: 0.6,
        fontSize: 22,
        color: subtextColor,
        align: 'center',
      });

      // Bottom banner info
      slide.addText(
        `Generated by ${slideData.content.generatedBy} • ${slideData.content.date} • Total Spend: ${slideData.content.totalSpendFormatted}`,
        {
          x: 1.0,
          y: 4.8,
          w: 11.3,
          h: 0.5,
          fontSize: 14,
          color: isDark ? '94A3B8' : '64748B',
          align: 'center',
        }
      );
    }
    // Slide Type: KPIs
    else if (slideData.type === 'kpis') {
      // Header
      slide.addText(slideData.title, {
        x: 0.8,
        y: 0.6,
        w: 11.7,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: titleColor,
      });
      slide.addText(slideData.subtitle, {
        x: 0.8,
        y: 1.2,
        w: 11.7,
        h: 0.4,
        fontSize: 14,
        color: subtextColor,
      });

      // 4 KPI Cards
      const kpis = slideData.content.kpis || [];
      const cardWidth = 2.7;
      const cardGap = 0.3;
      const startX = 0.8;
      const cardY = 2.2;
      const cardHeight = 3.2;

      kpis.forEach((kpi: any, idx: number) => {
        const x = startX + idx * (cardWidth + cardGap);

        // Card background shape
        slide.addShape(pptx.ShapeType.roundRect, {
          x,
          y: cardY,
          w: cardWidth,
          h: cardHeight,
          fill: { color: cardBg },
          line: { color: theme.borderColorHex, width: 1.5 },
          rectRadius: 0.15,
        });

        // Badge pill
        slide.addText(kpi.badge.toUpperCase(), {
          x: x + 0.2,
          y: cardY + 0.3,
          w: cardWidth - 0.4,
          h: 0.3,
          fontSize: 10,
          bold: true,
          color: accentColor,
        });

        // Value
        slide.addText(kpi.value, {
          x: x + 0.2,
          y: cardY + 0.8,
          w: cardWidth - 0.4,
          h: 1.0,
          fontSize: 26,
          bold: true,
          color: textColor,
          valign: 'middle',
        });

        // Label
        slide.addText(kpi.label, {
          x: x + 0.2,
          y: cardY + 1.9,
          w: cardWidth - 0.4,
          h: 0.4,
          fontSize: 13,
          bold: true,
          color: subtextColor,
        });

        // Subtext
        slide.addText(kpi.subtext, {
          x: x + 0.2,
          y: cardY + 2.3,
          w: cardWidth - 0.4,
          h: 0.6,
          fontSize: 11,
          color: subtextColor,
        });
      });
    }
    // Slide Type: Spend / Suppliers
    else if (slideData.type === 'spend') {
      slide.addText(slideData.title, {
        x: 0.8,
        y: 0.6,
        w: 11.7,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: titleColor,
      });
      slide.addText(slideData.subtitle, {
        x: 0.8,
        y: 1.2,
        w: 11.7,
        h: 0.4,
        fontSize: 14,
        color: subtextColor,
      });

      // Left Box: Key Metric & Insight
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y: 2.0,
        w: 4.2,
        h: 4.4,
        fill: { color: cardBg },
        line: { color: theme.borderColorHex, width: 1.5 },
        rectRadius: 0.15,
      });

      slide.addText('TOTAL COMMITTED SPEND', {
        x: 1.1,
        y: 2.3,
        w: 3.6,
        h: 0.3,
        fontSize: 11,
        bold: true,
        color: accentColor,
      });

      slide.addText(slideData.content.totalSpendFormatted, {
        x: 1.1,
        y: 2.7,
        w: 3.6,
        h: 0.8,
        fontSize: 32,
        bold: true,
        color: textColor,
      });

      slide.addText('Key Procurement Insight:', {
        x: 1.1,
        y: 3.8,
        w: 3.6,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: textColor,
      });

      slide.addText(slideData.content.keyInsight, {
        x: 1.1,
        y: 4.2,
        w: 3.6,
        h: 1.8,
        fontSize: 13,
        color: subtextColor,
      });

      // Right Box: Supplier Breakdown Table
      const headers = [
        { text: 'Supplier Partner', options: { bold: true, color: titleColor, fill: { color: cardBg } } },
        { text: 'Spend Amount', options: { bold: true, color: titleColor, fill: { color: cardBg } } },
        { text: 'Share (%)', options: { bold: true, color: titleColor, fill: { color: cardBg } } },
        { text: 'Orders', options: { bold: true, color: titleColor, fill: { color: cardBg } } },
      ];

      const rows: any[] = [headers];
      slideData.content.vendorSpendList.forEach((v: any) => {
        rows.push([
          { text: v.name, options: { color: textColor } },
          { text: v.amountFormatted, options: { bold: true, color: textColor } },
          { text: `${v.percentage}%`, options: { color: accentColor, bold: true } },
          { text: `${v.orderCount} POs`, options: { color: subtextColor } },
        ]);
      });

      slide.addTable(rows, {
        x: 5.3,
        y: 2.0,
        w: 7.2,
        h: 4.4,
        fontSize: 12,
        rowH: 0.55,
        border: { type: 'solid', color: theme.borderColorHex, pt: 1 },
      });
    }
    // Slide Type: Stock
    else if (slideData.type === 'stock') {
      slide.addText(slideData.title, {
        x: 0.8,
        y: 0.6,
        w: 11.7,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: titleColor,
      });
      slide.addText(slideData.subtitle, {
        x: 0.8,
        y: 1.2,
        w: 11.7,
        h: 0.4,
        fontSize: 14,
        color: subtextColor,
      });

      const headers = [
        { text: 'Item Name', options: { bold: true, color: titleColor } },
        { text: 'SKU', options: { bold: true, color: titleColor } },
        { text: 'On-Hand Stock', options: { bold: true, color: titleColor } },
        { text: 'Reorder Threshold', options: { bold: true, color: titleColor } },
        { text: 'Status', options: { bold: true, color: titleColor } },
      ];

      const rows: any[] = [headers];
      slideData.content.products.forEach((p: any) => {
        const isProblem = p.status !== 'Healthy';
        rows.push([
          { text: p.name, options: { color: textColor, bold: true } },
          { text: p.sku, options: { color: subtextColor } },
          { text: `${p.quantity} ${p.unit}`, options: { bold: true, color: isProblem ? 'DC2626' : textColor } },
          { text: `${p.threshold} ${p.unit}`, options: { color: subtextColor } },
          {
            text: p.status,
            options: {
              bold: true,
              color: isProblem ? 'DC2626' : '16A34A',
            },
          },
        ]);
      });

      slide.addTable(rows, {
        x: 0.8,
        y: 2.0,
        w: 11.7,
        h: 4.4,
        fontSize: 12,
        rowH: 0.5,
        border: { type: 'solid', color: theme.borderColorHex, pt: 1 },
      });
    }
    // Slide Type: Pipeline
    else if (slideData.type === 'pipeline') {
      slide.addText(slideData.title, {
        x: 0.8,
        y: 0.6,
        w: 11.7,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: titleColor,
      });
      slide.addText(slideData.subtitle, {
        x: 0.8,
        y: 1.2,
        w: 11.7,
        h: 0.4,
        fontSize: 14,
        color: subtextColor,
      });

      const headers = [
        { text: 'Order #', options: { bold: true, color: titleColor } },
        { text: 'Supplier Partner', options: { bold: true, color: titleColor } },
        { text: 'Order Value', options: { bold: true, color: titleColor } },
        { text: 'Expected Date', options: { bold: true, color: titleColor } },
        { text: 'Pipeline Status', options: { bold: true, color: titleColor } },
      ];

      const rows: any[] = [headers];
      slideData.content.orders.forEach((o: any) => {
        rows.push([
          { text: o.orderNumber, options: { bold: true, color: textColor } },
          { text: o.vendorName, options: { color: textColor } },
          { text: o.totalFormatted, options: { bold: true, color: textColor } },
          { text: o.expectedDeliveryDate, options: { color: subtextColor } },
          { text: o.status, options: { bold: true, color: accentColor } },
        ]);
      });

      slide.addTable(rows, {
        x: 0.8,
        y: 2.0,
        w: 11.7,
        h: 4.4,
        fontSize: 12,
        rowH: 0.55,
        border: { type: 'solid', color: theme.borderColorHex, pt: 1 },
      });
    }
    // Slide Type: Recommendations
    else if (slideData.type === 'recommendations') {
      slide.addText(slideData.title, {
        x: 0.8,
        y: 0.6,
        w: 11.7,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: titleColor,
      });
      slide.addText(slideData.subtitle, {
        x: 0.8,
        y: 1.2,
        w: 11.7,
        h: 0.4,
        fontSize: 14,
        color: subtextColor,
      });

      const recs = slideData.content.recommendations || [];
      recs.forEach((recText: string, idx: number) => {
        const y = 2.0 + idx * 1.1;

        // Background box for each recommendation
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.8,
          y,
          w: 11.7,
          h: 0.95,
          fill: { color: cardBg },
          line: { color: theme.borderColorHex, width: 1.2 },
          rectRadius: 0.1,
        });

        // Step number
        slide.addText(`0${idx + 1}`, {
          x: 1.0,
          y: y + 0.15,
          w: 0.6,
          h: 0.6,
          fontSize: 20,
          bold: true,
          color: accentColor,
          valign: 'middle',
        });

        // Text
        slide.addText(recText, {
          x: 1.7,
          y: y + 0.1,
          w: 10.6,
          h: 0.75,
          fontSize: 13,
          color: textColor,
          valign: 'middle',
        });
      });
    }
  });

  const cleanBizName = ctx.businessName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanBizName}_Operations_Presentation.pptx`;
  await pptx.writeFile({ fileName: filename });
}
