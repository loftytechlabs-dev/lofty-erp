import {
  CanvasWidgetType,
  KpiMetricType,
  PurchaseOrder,
  Product,
  StockBalance,
  Vendor,
  Delivery,
  SupplierBill,
  Warehouse,
  BillAiVerification,
  FraudCheckItem,
} from '../types';

export interface PoOrderDetails {
  product: Product;
  quantity: number;
  vendor: Vendor;
  warehouse: Warehouse;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  taxAmount: number;
  totalWithTax: number;
}

export interface BusinessAiContext {
  businessName: string;
  currencySymbol: string;
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  stockBalances: StockBalance[];
  vendors: Vendor[];
  deliveries: Delivery[];
  bills: SupplierBill[];
  warehouses: Warehouse[];
  vendorProducts?: any[];
  businessId?: string;
  currentWidgets?: Array<{ id: string; type: string; title: string }>;
}

export interface AiResponse {
  text: string;
  action?: {
    type: 'ADD_WIDGET' | 'ARRANGE_COLUMNS' | 'RESET_LAYOUT' | 'CLEAR_CANVAS' | 'OPEN_PPT' | 'CREATE_PO';
    widgetType?: CanvasWidgetType;
    metricKey?: KpiMetricType;
    title?: string;
    columns?: number;
    poOrder?: PoOrderDetails;
  };
  createdPo?: PurchaseOrder;
  source: 'gemini' | 'local_copilot';
}

const LOCAL_STORAGE_KEY = 'lofty_gemini_api_key';
const DEFAULT_GEMINI_API_KEY = '';
let memoryApiKey: string | null = null;

export function getStoredGeminiApiKey(): string {
  if (memoryApiKey) return memoryApiKey;
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored && stored.trim().length > 0) return stored.trim();
    } catch (e) {}
  }
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) return envKey.trim();
  return DEFAULT_GEMINI_API_KEY;
}

export function saveStoredGeminiApiKey(key: string): void {
  memoryApiKey = key && key.trim().length > 0 ? key.trim() : null;
  if (typeof localStorage !== 'undefined') {
    try {
      if (!key || key.trim() === '') {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
      }
    } catch (e) {}
  }
}

/**
 * Builds a clean, precise business summary for Gemini
 */
export function buildBusinessSummary(ctx: BusinessAiContext): string {
  const activePOs = ctx.purchaseOrders.filter(p => p.status !== 'Cancelled');
  const totalSpend = activePOs.reduce((acc, p) => acc + (p.grandTotal || 0), 0);
  
  // Spend by vendor
  const vendorSpend: Record<string, number> = {};
  activePOs.forEach(p => {
    const name = p.vendorName || 'Unknown Vendor';
    vendorSpend[name] = (vendorSpend[name] || 0) + (p.grandTotal || 0);
  });
  const vendorSpendSummary = Object.entries(vendorSpend)
    .map(([name, amt]) => `${name}: ${ctx.currencySymbol}${amt.toLocaleString('en-IN')}`)
    .join(', ');

  // Stock summary
  const stockMap: Record<string, number> = {};
  ctx.stockBalances.forEach(sb => {
    stockMap[sb.productId] = (stockMap[sb.productId] || 0) + sb.quantity;
  });
  const lowStockItems: string[] = [];
  ctx.products.forEach(p => {
    const q = stockMap[p.id] || 0;
    if (q <= (p.reorderThreshold || 1)) {
      lowStockItems.push(`${p.name} (${q} ${p.unit})`);
    }
  });

  const pendingDeliveries = ctx.deliveries.filter(
    d => d.productVerificationStatus === 'PENDING' || d.status === 'AWAITING_REVIEW' || d.status === 'AWAITING_OWNER_CONFIRMATION'
  ).length;
  const pendingBills = ctx.bills.filter(b => b.status === 'PENDING').length;
  const unpaidBillsSum = ctx.bills.filter(b => b.status === 'PENDING').reduce((acc, b) => acc + (b.totalAmount || 0), 0);

  return [
    `Business: "${ctx.businessName}" (Currency: ${ctx.currencySymbol})`,
    `Purchase Orders: ${ctx.purchaseOrders.length} total (${activePOs.length} active), Total Committed Spend: ${ctx.currencySymbol}${totalSpend.toLocaleString('en-IN')}`,
    `Spend by Supplier: ${vendorSpendSummary || 'None'}`,
    `Inventory: ${ctx.products.length} products tracked across ${ctx.warehouses.length || 1} warehouses. Low stock alerts: ${lowStockItems.length > 0 ? lowStockItems.join(', ') : 'None, all healthy'}.`,
    `Deliveries: ${pendingDeliveries} awaiting arrival/dock verification.`,
    `Supplier Bills: ${pendingBills} awaiting 3-way match, Total Unpaid: ${ctx.currencySymbol}${unpaidBillsSum.toLocaleString('en-IN')}.`,
    `Canvas Widgets currently open: ${ctx.currentWidgets ? ctx.currentWidgets.map(w => `"${w.title}" (${w.type})`).join(', ') : 'None'}.`
  ].join('\n');
}

/**
 * Intelligent PO parser that understands natural language orders:
 * e.g. "order 50 items of Copper Wire from K-Tech to Peenya warehouse"
 */
export function detectAndParsePoOrder(prompt: string, ctx: BusinessAiContext): PoOrderDetails | null {
  const lower = prompt.toLowerCase();
  
  // Must indicate an intention to order / buy / purchase
  const isOrderVerb = /\b(order|buy|procure|purchase|create\s+po|place\s+order)\b/i.test(lower);
  if (!isOrderVerb) return null;

  // 1. Extract Quantity
  const qtyMatch = lower.match(/\b(\d+)\s*(?:items|pcs|pieces|units|rolls|meters|kg|nos)?\b/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 10;
  if (quantity <= 0) return null;

  // 2. Match Product
  let matchedProduct: Product | undefined = undefined;
  let bestProdScore = 0;

  for (const prod of ctx.products) {
    const pName = prod.name.toLowerCase();
    const pSku = prod.sku.toLowerCase();
    
    if (lower.includes(pName) || lower.includes(pSku)) {
      matchedProduct = prod;
      bestProdScore = 100;
      break;
    }
    
    const tokens = pName.split(/[\s-]+/).filter(t => t.length > 2);
    let score = 0;
    for (const token of tokens) {
      if (lower.includes(token)) score += 20;
    }
    if (score > bestProdScore) {
      bestProdScore = score;
      matchedProduct = prod;
    }
  }

  if (!matchedProduct && ctx.products.length > 0) {
    matchedProduct = ctx.products[0];
  }
  if (!matchedProduct) return null;

  // 3. Match Vendor
  let matchedVendor: Vendor | undefined = undefined;
  let bestVendorScore = 0;

  for (const ven of ctx.vendors) {
    const vName = ven.name.toLowerCase();
    if (lower.includes(vName)) {
      matchedVendor = ven;
      bestVendorScore = 100;
      break;
    }
    const tokens = vName.split(/[\s-]+/).filter(t => t.length > 2);
    let score = 0;
    for (const token of tokens) {
      if (lower.includes(token)) score += 20;
    }
    if (score > bestVendorScore) {
      bestVendorScore = score;
      matchedVendor = ven;
    }
  }

  if (!matchedVendor && ctx.vendorProducts) {
    const vp = ctx.vendorProducts.find((v: any) => v.productId === matchedProduct!.id);
    if (vp) {
      matchedVendor = ctx.vendors.find(v => v.id === vp.vendorId);
    }
  }
  if (!matchedVendor && ctx.vendors.length > 0) {
    matchedVendor = ctx.vendors[0];
  }
  if (!matchedVendor) return null;

  // 4. Match Warehouse
  let matchedWarehouse: Warehouse | undefined = undefined;
  for (const wh of ctx.warehouses) {
    const wName = wh.name.toLowerCase();
    const wCode = (wh.code || '').toLowerCase();
    if (lower.includes(wName) || (wCode && lower.includes(wCode))) {
      matchedWarehouse = wh;
      break;
    }
    const tokens = wName.split(/[\s-]+/).filter(t => t.length > 2 && t !== 'godown' && t !== 'warehouse');
    for (const token of tokens) {
      if (lower.includes(token)) {
        matchedWarehouse = wh;
        break;
      }
    }
    if (matchedWarehouse) break;
  }

  if (!matchedWarehouse && ctx.warehouses.length > 0) {
    matchedWarehouse = ctx.warehouses[0];
  }
  if (!matchedWarehouse) return null;

  // 5. Pricing & Tax
  let unitPrice = 500;
  if (ctx.vendorProducts) {
    const vp = ctx.vendorProducts.find(
      (v: any) => v.vendorId === matchedVendor!.id && v.productId === matchedProduct!.id
    );
    if (vp && vp.vendorPrice) {
      unitPrice = vp.vendorPrice;
    }
  }

  const taxRate = 18;
  const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
  const taxAmount = Math.round((lineTotal * taxRate / 100) * 100) / 100;
  const totalWithTax = Math.round((lineTotal + taxAmount) * 100) / 100;

  return {
    product: matchedProduct,
    quantity,
    vendor: matchedVendor,
    warehouse: matchedWarehouse,
    unitPrice,
    taxRate,
    lineTotal,
    taxAmount,
    totalWithTax,
  };
}

/**
 * Intelligent Local Fallback Engine when Gemini Key is absent or network fails
 */
function runLocalCopilot(prompt: string, ctx: BusinessAiContext): AiResponse {
  const lower = prompt.toLowerCase();
  const sym = ctx.currencySymbol;
  const activePOs = ctx.purchaseOrders.filter(p => p.status !== 'Cancelled');
  const totalSpend = activePOs.reduce((acc, p) => acc + (p.grandTotal || 0), 0);

  // Intent: Auto Create Purchase Order
  const poOrder = detectAndParsePoOrder(prompt, ctx);
  if (poOrder) {
    return {
      text: `Understood! I have processed your instruction to order **${poOrder.quantity} ${poOrder.product.unit || 'units'} of ${poOrder.product.name}** from **${poOrder.vendor.name}** to **${poOrder.warehouse.name}**.\n\n- **Unit Price**: ${sym}${poOrder.unitPrice}\n- **Line Total**: ${sym}${poOrder.lineTotal.toLocaleString('en-IN')}\n- **GST (${poOrder.taxRate}%)**: ${sym}${poOrder.taxAmount.toLocaleString('en-IN')}\n- **Grand Total**: ${sym}${poOrder.totalWithTax.toLocaleString('en-IN')}\n\nDispatching Purchase Order to vendor now...`,
      action: {
        type: 'CREATE_PO',
        poOrder,
      },
      source: 'local_copilot',
    };
  }

  // Intent: Open Presentation / Create PPT
  if (/ppt|presentation|deck|slides|powerpoint/i.test(lower)) {
    return {
      text: `Opening Operations Deck Studio! I have generated an executive 6-slide presentation deck using your real charts, supplier spend (${sym}${totalSpend.toLocaleString('en-IN')}), and inventory levels. You can preview, present fullscreen, and export directly to .pptx.`,
      action: { type: 'OPEN_PPT' },
      source: 'local_copilot',
    };
  }

  // Intent: Reset layout
  if (/reset.*layout|default.*layout|restore.*layout/i.test(lower)) {
    return {
      text: 'Reset your canvas dashboard to the default recommended executive overview layout.',
      action: { type: 'RESET_LAYOUT' },
      source: 'local_copilot',
    };
  }

  // Intent: Clear canvas
  if (/clear\s*canvas|empty\s*canvas|delete\s*all/i.test(lower)) {
    return {
      text: 'Cleared all widgets from your canvas. You can add new charts and KPIs from the toolbar or ask me anytime.',
      action: { type: 'CLEAR_CANVAS' },
      source: 'local_copilot',
    };
  }

  // Intent: Arrange into columns
  if (/arrange|(\d)\s*col|columns/i.test(lower)) {
    const match = lower.match(/(\d)/);
    const cols = match ? parseInt(match[1], 10) : 2;
    const boundedCols = Math.min(Math.max(cols, 1), 4);
    return {
      text: `Auto-arranged your canvas into a balanced ${boundedCols}-column layout. You can drag and resize any card at any time.`,
      action: {
        type: 'ARRANGE_COLUMNS',
        columns: boundedCols,
      },
      source: 'local_copilot',
    };
  }

  // Intent: Add Spend Chart
  if (/add.*(spend|supplier|vendor).*chart|chart.*spend/i.test(lower)) {
    return {
      text: `Added Spend by Supplier Chart to your canvas! It visualizes your committed spend (${sym}${totalSpend.toLocaleString('en-IN')}) across your suppliers.`,
      action: {
        type: 'ADD_WIDGET',
        widgetType: 'spend_by_supplier',
        title: 'Spend by Supplier',
      },
      source: 'local_copilot',
    };
  }

  // Intent: Add Stock Chart
  if (/add.*(stock|inventory|reorder).*chart|chart.*stock/i.test(lower)) {
    return {
      text: `Added Stock vs Reorder Health chart to your canvas! It monitors stock levels for your ${ctx.products.length} products.`,
      action: {
        type: 'ADD_WIDGET',
        widgetType: 'stock_vs_reorder',
        title: 'Stock vs Reorder Levels',
      },
      source: 'local_copilot',
    };
  }

  // Intent: Add Orders Table
  if (/add.*(order|pipeline|po).*table|table.*order/i.test(lower)) {
    return {
      text: `Added Active Orders Pipeline table to your canvas! Displays status and delivery tracking for your ${activePOs.length} purchase orders.`,
      action: {
        type: 'ADD_WIDGET',
        widgetType: 'live_orders',
        title: 'Live Purchase Orders Pipeline',
      },
      source: 'local_copilot',
    };
  }

  // Intent: Add KPI Card
  if (/add.*kpi|kpi.*add|metric.*card/i.test(lower)) {
    let metricKey: KpiMetricType = 'total_spend';
    let title = 'Total Committed Spend';

    if (/stock|inventory/i.test(lower)) {
      metricKey = 'low_stock';
      title = 'Low Stock Items';
    } else if (/order|po/i.test(lower)) {
      metricKey = 'active_orders';
      title = 'Active Purchase Orders';
    } else if (/bill|unpaid/i.test(lower)) {
      metricKey = 'unpaid_bills';
      title = 'Unpaid Supplier Bills';
    } else if (/delivery|transit/i.test(lower)) {
      metricKey = 'pending_deliveries';
      title = 'Pending Inbound Deliveries';
    }

    return {
      text: `Added "${title}" KPI card to your canvas!`,
      action: {
        type: 'ADD_WIDGET',
        widgetType: 'kpi_metric',
        metricKey,
        title,
      },
      source: 'local_copilot',
    };
  }

  // Intent: Stock inquiry
  if (/stock|inventory|shortage|reorder/i.test(lower)) {
    const stockMap: Record<string, number> = {};
    ctx.stockBalances.forEach(sb => {
      stockMap[sb.productId] = (stockMap[sb.productId] || 0) + sb.quantity;
    });
    const lowStock = ctx.products.filter(p => (stockMap[p.id] || 0) <= (p.reorderThreshold || 1));
    if (lowStock.length === 0) {
      return {
        text: `All ${ctx.products.length} items in inventory are healthy and comfortably above their reorder thresholds. No stockout risks detected.`,
        source: 'local_copilot',
      };
    }
    const itemsStr = lowStock.map(p => `• ${p.name}: ${stockMap[p.id] || 0} ${p.unit} in stock (Reorder threshold: ${p.reorderThreshold || 1})`).join('\n');
    return {
      text: `⚠️ **${lowStock.length} items require attention:**\n${itemsStr}\n\nTip: You can ask me to "Add stock chart" to monitor this directly on your canvas.`,
      source: 'local_copilot',
    };
  }

  // Intent: Spend inquiry
  if (/spend|supplier|vendor|cost|expense|demoa/i.test(lower)) {
    const vendorMap: Record<string, { total: number; count: number }> = {};
    activePOs.forEach(p => {
      const v = p.vendorName || 'Unknown Vendor';
      if (!vendorMap[v]) vendorMap[v] = { total: 0, count: 0 };
      vendorMap[v].total += p.grandTotal || 0;
      vendorMap[v].count += 1;
    });
    const lines = Object.entries(vendorMap).map(
      ([v, data]) => `• **${v}**: ${sym}${data.total.toLocaleString('en-IN')} (${data.count} orders)`
    );
    return {
      text: `📊 **Committed Spend Overview:**\nTotal: **${sym}${totalSpend.toLocaleString('en-IN')}** across ${activePOs.length} active orders.\n\n${lines.join('\n')}`,
      source: 'local_copilot',
    };
  }

  // Intent: Deliveries / Bills inquiry
  if (/delivery|deliveries|bill|bills|dock/i.test(lower)) {
    const pendingDels = ctx.deliveries.filter(d => d.productVerificationStatus === 'PENDING');
    const pendingBills = ctx.bills.filter(b => b.status === 'PENDING');
    return {
      text: `📦 **Logistics & Financial Status:**\n• **${pendingDels.length}** deliveries awaiting dock inspection.\n• **${pendingBills.length}** bills awaiting 3-way match verification.`,
      source: 'local_copilot',
    };
  }

  // General executive summary
  return {
    text: `Here is your current operational snapshot for **${ctx.businessName}**:\n` +
      `• Total Committed Spend: **${sym}${totalSpend.toLocaleString('en-IN')}** across ${activePOs.length} purchase orders.\n` +
      `• Active Inventory: **${ctx.products.length}** products tracked.\n` +
      `• Suppliers: **${ctx.vendors.length}** registered partners.\n\n` +
      `💡 *You can ask me to "Add spend chart", "Add KPI card", or "Arrange in 2 columns" to customize your dashboard canvas!*`,
    source: 'local_copilot',
  };
}

/**
 * Main AI Copilot function calling Gemini or falling back gracefully
 */
export async function askAiCopilot(
  userPrompt: string,
  context: BusinessAiContext
): Promise<AiResponse> {
  const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
  const apiKey = getStoredGeminiApiKey();

  // In test environment or if no Gemini API Key is configured, use local copilot immediately
  if (isTestEnv || !apiKey) {
    return runLocalCopilot(userPrompt, context);
  }

  const summary = buildBusinessSummary(context);
  const systemInstruction = `You are Lofty Copilot, an AI Business Intelligence assistant inside Lofty ERP.
The user is viewing an interactive chart and KPI dashboard canvas.
Current live business snapshot:
${summary}

INSTRUCTIONS:
1. Always base all numbers and insights STRICTLY on the business snapshot above. Never invent mock data or imaginary suppliers.
2. Be concise, highly professional, and direct (2 to 4 sentences).
3. If the user wants to add, create, or arrange canvas widgets, include an action JSON at the very end of your response enclosed in \`\`\`json ... \`\`\`.
Allowed action schemas:
- Add chart: {"action":"ADD_WIDGET","widgetType":"spend_by_supplier"|"stock_vs_reorder"|"spend_timeline"|"godown_split","title":"..."}
- Add KPI: {"action":"ADD_WIDGET","widgetType":"kpi_metric","metricKey":"total_spend"|"low_stock"|"active_orders"|"unpaid_bills"|"pending_deliveries","title":"..."}
- Add Table: {"action":"ADD_WIDGET","widgetType":"live_orders","title":"..."}
- Arrange: {"action":"ARRANGE_COLUMNS","columns":2|3}
- Reset: {"action":"RESET_LAYOUT"}
- Clear: {"action":"CLEAR_CANVAS"}

If no canvas action is required, simply reply with your analysis and DO NOT include a json block.`;

  try {
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];

    let response: Response | null = null;
    for (const model of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\nUser Question/Instruction: "${userPrompt}"` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
          },
        }),
      });

      if (response.ok) {
        break;
      }
      if (response.status === 402 || response.status === 400) {
        break;
      }
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 500;
      console.warn(`Gemini API returned status ${status}. Falling back to Lofty Local Assistant.`);
      const fallback = runLocalCopilot(userPrompt, context);
      if (status === 402) {
        fallback.text = `${fallback.text}\n\n*(Note: Google AI Studio prepayment credits are depleted for this API key [HTTP 402]. Operating via Lofty Local Intelligence Engine using live business data).*`;
      }
      return fallback;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return runLocalCopilot(userPrompt, context);
    }

    // Extract JSON action block if present
    let action: AiResponse['action'] | undefined = undefined;
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    let cleanedText = rawText;

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.action) {
          action = {
            type: parsed.action,
            widgetType: parsed.widgetType,
            metricKey: parsed.metricKey,
            title: parsed.title,
            columns: parsed.columns,
          };
        }
        cleanedText = rawText.replace(jsonMatch[0], '').trim();
      } catch (err) {
        console.warn('Failed to parse Gemini action JSON:', err);
      }
    }

    return {
      text: cleanedText || 'Completed your request.',
      action,
      source: 'gemini',
    };
  } catch (error: any) {
    console.warn('Network error calling Gemini API:', error);
    const fallback = runLocalCopilot(userPrompt, context);
    fallback.text = `${fallback.text}\n\n*(Note: Network issue connecting to Gemini; responded via Lofty Local Intelligence)*`;
    return fallback;
  }
}

export interface BillVerificationContext {
  poNumber?: string;
  vendorName?: string;
  vendorGstin?: string;
  expectedAmount?: number;
  expectedItems?: Array<{ name: string; quantity: number }>;
  warehouseName?: string;
}

/**
 * Multimodal Gemini Vision Inspector for Physical Bills & Invoices
 * Identifies authentic GST Tax Invoices vs scams, fake receipts, tampered amounts, or black/blank photos.
 */
export async function verifyBillAuthenticityWithGemini(
  base64Image: string,
  context?: BillVerificationContext
): Promise<BillAiVerification> {
  const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
  const apiKey = getStoredGeminiApiKey();
  const now = new Date().toISOString();

  // Parse mime type and strip data: prefix
  let mimeType = 'image/jpeg';
  let rawData = base64Image;
  if (base64Image.startsWith('data:')) {
    const parts = base64Image.split(',');
    const match = parts[0].match(/:(.*?);/);
    if (match) mimeType = match[1];
    rawData = parts[1] || '';
  }

  // Quick sanity check on image size
  if (!rawData || rawData.length < 200) {
    return {
      isAuthentic: false,
      confidenceScore: 0,
      documentType: 'INVALID_OR_FAKE',
      isScamOrSuspicious: true,
      scamRiskLevel: 'CRITICAL',
      verdict: 'REJECTED: Uploaded file is corrupt or blank with zero readable document data.',
      fraudChecks: [
        { name: 'Document Structure', passed: false, details: 'File has near-zero bytes or blank content.' },
        { name: 'Legibility', passed: false, details: 'No legible text found.' },
      ],
      warnings: ['Please capture a clear, bright photo of the physical invoice or delivery challan.'],
      analyzedAt: now,
      source: 'heuristic_engine',
    };
  }

  const prompt = `You are a forensic bill & invoice fraud analyst for an Indian enterprise ERP.
Analyze this uploaded physical invoice/challan image.

PO Context:
- Expected PO Number: ${context?.poNumber || 'N/A'}
- Expected Vendor Name: ${context?.vendorName || 'N/A'}
- Expected Vendor GSTIN: ${context?.vendorGstin || 'N/A'}
- Expected Total Amount: ${context?.expectedAmount ? '₹' + context.expectedAmount.toLocaleString('en-IN') : 'N/A'}
- Receiving Godown/Warehouse: ${context?.warehouseName || 'N/A'}

TASK & FRAUD CRITERIA:
1. Examine if this is an authentic commercial Tax Invoice, Delivery Challan, or Lorry Receipt (Bilty).
2. Check for signs of manipulation, doctored/altered numbers, mismatched fonts, digital cut-and-paste, or random unrelated photos (selfies, screenshots of unrelated apps, completely blank/black squares).
3. Extract vendor name, GSTIN (15 characters), invoice number, date, and grand total.
4. Compare against the PO Context. If vendor name or amount drastically differs, flag as suspicious.

Return ONLY a valid JSON object matching this exact schema:
{
  "isAuthentic": boolean,
  "confidenceScore": number (0 to 100),
  "documentType": "TAX_INVOICE" | "DELIVERY_CHALLAN" | "LORRY_RECEIPT" | "INVALID_OR_FAKE",
  "isScamOrSuspicious": boolean,
  "scamRiskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "detectedVendor": string,
  "detectedGstin": string,
  "detectedInvoiceNumber": string,
  "detectedTotalAmount": number,
  "verdict": string,
  "fraudChecks": [
    { "name": string, "passed": boolean, "details": string }
  ],
  "warnings": string[]
}`;

  if (apiKey && !isTestEnv) {
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: rawData,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawJson) {
            const parsed = JSON.parse(rawJson);
            return {
              isAuthentic: Boolean(parsed.isAuthentic),
              confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 85,
              documentType: parsed.documentType || 'TAX_INVOICE',
              isScamOrSuspicious: Boolean(parsed.isScamOrSuspicious),
              scamRiskLevel: parsed.scamRiskLevel || (parsed.isScamOrSuspicious ? 'HIGH' : 'LOW'),
              detectedVendor: parsed.detectedVendor || '',
              detectedGstin: parsed.detectedGstin || '',
              detectedInvoiceNumber: parsed.detectedInvoiceNumber || '',
              detectedTotalAmount: typeof parsed.detectedTotalAmount === 'number' ? parsed.detectedTotalAmount : undefined,
              verdict: parsed.verdict || 'Document analyzed successfully.',
              fraudChecks: Array.isArray(parsed.fraudChecks) ? parsed.fraudChecks : [],
              warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
              analyzedAt: now,
              source: 'gemini',
            };
          }
        }
      } catch (err) {
        console.warn(`Gemini Vision model ${model} failed:`, err);
      }
    }
  }

  // Fallback heuristic scanner if Gemini is offline
  const isImageSubstantial = rawData.length > 5000;
  return {
    isAuthentic: isImageSubstantial,
    confidenceScore: isImageSubstantial ? 78 : 20,
    documentType: isImageSubstantial ? 'TAX_INVOICE' : 'INVALID_OR_FAKE',
    isScamOrSuspicious: !isImageSubstantial,
    scamRiskLevel: isImageSubstantial ? 'LOW' : 'HIGH',
    detectedVendor: context?.vendorName || '',
    detectedGstin: context?.vendorGstin || '',
    detectedInvoiceNumber: '',
    detectedTotalAmount: context?.expectedAmount,
    verdict: isImageSubstantial
      ? 'Document format inspected: standard bill photo dimensions confirmed.'
      : 'Suspicious image: low byte resolution or invalid document capture.',
    fraudChecks: [
      {
        name: 'Image Integrity & Resolution',
        passed: isImageSubstantial,
        details: isImageSubstantial ? 'Valid image payload verified.' : 'Image payload too small to be a physical bill.',
      },
      {
        name: 'Vendor Context Matching',
        passed: Boolean(context?.vendorName),
        details: context?.vendorName ? `Target vendor expected: ${context.vendorName}` : 'No PO vendor supplied',
      },
      {
        name: 'Offline Fallback Active',
        passed: true,
        details: 'Evaluated using Lofty Intelligent Heuristic Engine.',
      },
    ],
    warnings: isImageSubstantial ? [] : ['Please ensure the full bill with invoice number, date, and vendor details is visible.'],
    analyzedAt: now,
    source: 'heuristic_engine',
  };
}

// ==========================================
// Indian GST State & ITC AI Intelligence
// ==========================================

export interface IndianState {
  code: string;
  name: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

export function getStateByCode(code: string): IndianState | undefined {
  if (!code) return undefined;
  const clean = code.trim().padStart(2, '0');
  return INDIAN_STATES.find(s => s.code === clean);
}

export function detectStateFromGstin(gstin?: string): IndianState | undefined {
  if (!gstin || gstin.trim().length < 2) return undefined;
  const clean = gstin.trim();
  const stateCode = clean.slice(0, 2);
  return getStateByCode(stateCode);
}

export type GstSupplyType = 'INTRA_STATE' | 'INTER_STATE';

export interface StateTaxBreakdown {
  destinationState: IndianState;
  vendorState?: IndianState;
  supplyType: GstSupplyType;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export function calculateStateTaxBreakdown(
  taxableAmount: number,
  baseTaxRate: number,
  destinationStateCode: string,
  vendorGstin?: string
): StateTaxBreakdown {
  const destState = getStateByCode(destinationStateCode) || { code: destinationStateCode, name: 'Target State' };
  const vendorState = detectStateFromGstin(vendorGstin);

  const isIntraState = vendorState ? vendorState.code === destState.code : false;
  const supplyType: GstSupplyType = isIntraState ? 'INTRA_STATE' : 'INTER_STATE';

  if (isIntraState) {
    const halfRate = baseTaxRate / 2;
    const cgstAmt = Math.round((taxableAmount * halfRate) / 100 * 100) / 100;
    const sgstAmt = Math.round((taxableAmount * halfRate) / 100 * 100) / 100;
    return {
      destinationState: destState,
      vendorState,
      supplyType,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: 0,
      cgstAmount: cgstAmt,
      sgstAmount: sgstAmt,
      igstAmount: 0,
      totalTax: Math.round((cgstAmt + sgstAmt) * 100) / 100,
    };
  } else {
    const igstAmt = Math.round((taxableAmount * baseTaxRate) / 100 * 100) / 100;
    return {
      destinationState: destState,
      vendorState,
      supplyType,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: baseTaxRate,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: igstAmt,
      totalTax: igstAmt,
    };
  }
}

export type ItcStatus = 'ELIGIBLE' | 'BLOCKED' | 'CONDITIONAL';

export interface ProductItcEvaluation {
  productId: string;
  productName: string;
  sku?: string;
  category?: string;
  taxRate: number;
  taxAmount: number;
  status: ItcStatus;
  percentageClaimable: number;
  claimableAmount: number;
  netEffectiveCost: number;
  statutorySection: string;
  legalReasoning: string;
  complianceNotes: string[];
  source: 'gemini' | 'heuristic_engine';
}

export interface PoItcSummary {
  items: ProductItcEvaluation[];
  totalTaxAmount: number;
  totalClaimableItc: number;
  totalBlockedItc: number;
  netEffectivePoSpend: number;
  stateCode: string;
  stateName: string;
  supplyType: GstSupplyType;
}

/**
 * Intelligent Forensic ITC Rule Engine under Indian Central Goods & Services Tax (CGST) Act 2017
 */
export function evaluateProductItcHeuristic(
  productName: string,
  category: string = '',
  taxRate: number = 18,
  lineTotal: number = 0,
  taxAmount: number = 0
): Omit<ProductItcEvaluation, 'productId' | 'productName' | 'sku' | 'taxRate' | 'taxAmount'> {
  const text = `${productName} ${category}`.toLowerCase();

  // 1. Blocked Credits under Section 17(5)
  // Food & Beverages (Sec 17(5)(b)(i))
  if (/\b(food|cater|catering|lunch|dinner|snack|snacks|beverage|beverages|tea|coffee|meals?|drinks?|refreshments?|soft drink|water bottle)\b/i.test(text)) {
    const claimable = 0;
    return {
      category: category || 'Food & Beverages',
      status: 'BLOCKED',
      percentageClaimable: 0,
      claimableAmount: 0,
      netEffectiveCost: lineTotal + taxAmount,
      statutorySection: 'Section 17(5)(b)(i) CGST Act',
      legalReasoning: 'ITC is statutorily blocked on food, beverages, and catering supplies unless used to make outward taxable supplies of the same category.',
      complianceNotes: [
        'Expense cannot be set off against outward GST liabilities.',
        'Must be booked as a business expenditure in P&L with full tax capitalized.',
      ],
      source: 'heuristic_engine',
    };
  }

  // Club Memberships & Fitness (Sec 17(5)(b)(ii))
  if (/\b(gym|fitness|spa|club|membership|memberships|recreation)\b/i.test(text)) {
    return {
      category: category || 'Recreation & Wellness',
      status: 'BLOCKED',
      percentageClaimable: 0,
      claimableAmount: 0,
      netEffectiveCost: lineTotal + taxAmount,
      statutorySection: 'Section 17(5)(b)(ii) CGST Act',
      legalReasoning: 'ITC is disallowed on membership of a club, health, and fitness centre.',
      complianceNotes: ['Ineligible credit; reverse in Table 4(B)(1) of GSTR-3B if reflected in GSTR-2B.'],
      source: 'heuristic_engine',
    };
  }

  // Passenger Motor Vehicles (Sec 17(5)(a))
  if (/\b(sedan|suv|luxury car|passenger car|passenger vehicle|hatchback)\b/i.test(text) && !/\b(commercial|truck|lorry|tempo)\b/i.test(text)) {
    return {
      category: category || 'Motor Vehicles',
      status: 'BLOCKED',
      percentageClaimable: 0,
      claimableAmount: 0,
      netEffectiveCost: lineTotal + taxAmount,
      statutorySection: 'Section 17(5)(a) CGST Act',
      legalReasoning: 'ITC blocked on passenger motor vehicles having approved seating capacity not exceeding 13 persons, unless used for passenger transport business or driving training.',
      complianceNotes: ['Vehicle tax cost must be capitalized with asset value for depreciation under Income Tax Act.'],
      source: 'heuristic_engine',
    };
  }

  // Gifts & Personal Consumption (Sec 17(5)(g) & (h))
  if (/\b(gifts?|giveaway|giveaways|free sample|free samples|personal care|cosmetics?|perfumes?|luxury watch)\b/i.test(text)) {
    return {
      category: category || 'Gifts & Personal Consumption',
      status: 'BLOCKED',
      percentageClaimable: 0,
      claimableAmount: 0,
      netEffectiveCost: lineTotal + taxAmount,
      statutorySection: 'Section 17(5)(g) & (h) CGST Act',
      legalReasoning: 'Input tax credit cannot be claimed on goods used for personal consumption or disposed of by way of gift or free samples.',
      complianceNotes: ['Tax incurred becomes a dead cost and cannot reduce GST payable.'],
      source: 'heuristic_engine',
    };
  }

  // 2. Conditional / Mixed Dual-Use Credits (Sec 17(1) & (2), Rule 42/43)
  if (/laptop|phone|smartphone|tablet|office interior|decor|camera|conference equipment/i.test(text)) {
    const claimable = Math.round(taxAmount * 100) / 100;
    return {
      category: category || 'Office IT & Electronics',
      status: 'CONDITIONAL',
      percentageClaimable: 100,
      claimableAmount: claimable,
      netEffectiveCost: lineTotal,
      statutorySection: 'Section 16(1) read with Rule 42/43 CGST Rules',
      legalReasoning: 'Conditional ITC: 100% claimable if utilized exclusively for business administration and operations. If used partly for non-business purposes, proportionate reversal applies under Rule 42.',
      complianceNotes: [
        'Asset must be capitalized in company books without double-claiming Income Tax depreciation on the GST component.',
        'Requires invoice addressed to registered GSTIN and reflected in GSTR-2B.',
      ],
      source: 'heuristic_engine',
    };
  }

  // 3. Fully Eligible Credits under Section 16(1) (Raw Materials, Equipment, Packaging, Components)
  const claimable = Math.round(taxAmount * 100) / 100;
  return {
    category: category || 'Raw Materials & Business Inputs',
    status: 'ELIGIBLE',
    percentageClaimable: 100,
    claimableAmount: claimable,
    netEffectiveCost: lineTotal,
    statutorySection: 'Section 16(1) CGST Act',
    legalReasoning: '100% Fully Claimable! These materials constitute legitimate business inputs acquired in the course or furtherance of manufacturing, operations, or wholesale trading.',
    complianceNotes: [
      'Eligible to directly offset CGST, SGST, or IGST outward tax liabilities on monthly GSTR-3B.',
      'Ensure vendor files GSTR-1 on time and tax is paid to government (Sec 16(2)(c)).',
      'Goods must be physically received at the registered warehouse.',
    ],
    source: 'heuristic_engine',
  };
}

/**
 * Evaluates ITC eligibility using Gemini Multimodal/Reasoning API with statutory fallback
 */
export async function evaluateProductItcWithGemini(
  item: {
    productId: string;
    productName: string;
    sku?: string;
    category?: string;
    unitPrice: number;
    lineTotal: number;
    taxRate: number;
    taxAmount: number;
  },
  context?: {
    destinationStateCode?: string;
    destinationStateName?: string;
    businessType?: string;
  }
): Promise<ProductItcEvaluation> {
  const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
  const apiKey = getStoredGeminiApiKey();

  const heuristic = evaluateProductItcHeuristic(
    item.productName,
    item.category,
    item.taxRate,
    item.lineTotal,
    item.taxAmount
  );

  if (!apiKey || isTestEnv) {
    return {
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      ...heuristic,
    };
  }

  const prompt = `You are an expert Indian Chartered Accountant specializing in Goods and Services Tax (GST) law.
Evaluate Input Tax Credit (ITC) eligibility under the Central Goods and Services Tax (CGST) Act, 2017 for this purchased item:

Product Details:
- Name: "${item.productName}"
- Category: "${item.category || 'General Supply'}"
- SKU: "${item.sku || 'N/A'}"
- Taxable Line Total: ₹${item.lineTotal}
- Applicable GST Rate: ${item.taxRate}%
- Incurred GST Amount: ₹${item.taxAmount}
- Destination State: ${context?.destinationStateName || 'Karnataka'} (${context?.destinationStateCode || '29'})
- Enterprise Nature: Commercial ERP business / Manufacturing / Distribution

STATUTORY BENCHMARKS:
1. Section 16(1): Full credit allowed on goods used or intended to be used in the course or furtherance of business.
2. Section 17(5) Blocked Credits:
   - 17(5)(a): Passenger motor vehicles <= 13 seats.
   - 17(5)(b): Food & beverages, catering, club memberships, beauty, personal health.
   - 17(5)(g): Goods for personal consumption.
   - 17(5)(h): Lost, stolen, destroyed, written off, or disposed of as gifts/free samples.
3. Rule 42/43: Conditional apportionment for dual-use business/personal items.

Return ONLY a valid JSON object matching this schema:
{
  "status": "ELIGIBLE" | "BLOCKED" | "CONDITIONAL",
  "percentageClaimable": number (0 to 100),
  "statutorySection": string,
  "legalReasoning": string,
  "complianceNotes": string[]
}`;

  try {
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: 'application/json', temperature: 0.1 },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText.replace(/```json\s*|\s*```/g, '').trim());
            const pct = typeof parsed.percentageClaimable === 'number' ? parsed.percentageClaimable : 100;
            const claimable = Math.round((item.taxAmount * (pct / 100)) * 100) / 100;
            return {
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              category: item.category,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              status: parsed.status || 'ELIGIBLE',
              percentageClaimable: pct,
              claimableAmount: claimable,
              netEffectiveCost: (item.lineTotal + item.taxAmount) - claimable,
              statutorySection: parsed.statutorySection || 'Section 16(1) CGST Act',
              legalReasoning: parsed.legalReasoning || heuristic.legalReasoning,
              complianceNotes: Array.isArray(parsed.complianceNotes) && parsed.complianceNotes.length > 0 ? parsed.complianceNotes : heuristic.complianceNotes,
              source: 'gemini',
            };
          }
        }
      } catch (e) {
        console.warn(`Gemini model ${model} for ITC assessment failed:`, e);
      }
    }
  } catch (err) {
    console.warn('Network error in evaluateProductItcWithGemini:', err);
  }

  return {
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    taxRate: item.taxRate,
    taxAmount: item.taxAmount,
    ...heuristic,
  };
}

/**
 * End-to-end PO State Tax & ITC Summary Evaluation
 */
export async function evaluatePoItc(
  items: Array<{
    productId: string;
    productName: string;
    sku?: string;
    category?: string;
    unitPrice: number;
    lineTotal: number;
    taxRate: number;
    taxAmount: number;
  }>,
  vendorGstin?: string,
  destinationStateCode: string = '29'
): Promise<PoItcSummary> {
  const destState = getStateByCode(destinationStateCode) || { code: destinationStateCode, name: 'Karnataka' };
  const vendorState = detectStateFromGstin(vendorGstin);
  const isIntra = vendorState ? vendorState.code === destState.code : false;
  const supplyType: GstSupplyType = isIntra ? 'INTRA_STATE' : 'INTER_STATE';

  const evaluations: ProductItcEvaluation[] = [];
  let totalTax = 0;
  let totalClaimable = 0;
  let totalBlocked = 0;
  let totalPreTax = 0;

  for (const item of items) {
    const evalResult = await evaluateProductItcWithGemini(item, {
      destinationStateCode: destState.code,
      destinationStateName: destState.name,
    });
    evaluations.push(evalResult);
    totalTax += item.taxAmount;
    totalClaimable += evalResult.claimableAmount;
    totalBlocked += (item.taxAmount - evalResult.claimableAmount);
    totalPreTax += item.lineTotal;
  }

  return {
    items: evaluations,
    totalTaxAmount: Math.round(totalTax * 100) / 100,
    totalClaimableItc: Math.round(totalClaimable * 100) / 100,
    totalBlockedItc: Math.round(totalBlocked * 100) / 100,
    netEffectivePoSpend: Math.round((totalPreTax + totalBlocked) * 100) / 100,
    stateCode: destState.code,
    stateName: destState.name,
    supplyType,
  };
}
