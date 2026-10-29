import { PurchaseOrder, POStatus, POLineItem } from '../types';
import { localStore } from './store';
import { generateId, round2, formatCurrency } from '../lib/utils';
import { sendEmailNotification } from './mailService';

const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
const API_BASE = isTestEnv ? 'http://localhost:5001/api' : '/api';

export async function getPurchaseOrders(businessId: string): Promise<PurchaseOrder[]> {
  try {
    const res = await fetch(`${API_BASE}/businesses/${businessId}/purchase-orders`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        localStore.setPurchaseOrders(businessId, json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('MySQL purchaseOrders fetch failed, using localStore fallback:', err);
  }

  return localStore.getPurchaseOrders(businessId);
}

export async function getPurchaseOrderById(businessId: string, poId: string): Promise<PurchaseOrder | undefined> {
  // 1. Check localStore first (fast, synchronous)
  const localPo = localStore.getPurchaseOrderById(businessId, poId);
  if (localPo) return localPo;

  // 2. Try direct API lookup by PO ID
  try {
    const res = await fetch(`${API_BASE}/purchase-orders/${poId}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        localStore.addPurchaseOrder(json.data);
        return json.data;
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // 3. Try business-scoped fetch
  if (businessId) {
    try {
      const bizRes = await fetch(`${API_BASE}/businesses/${businessId}/purchase-orders/${poId}`);
      if (bizRes.ok) {
        const json = await bizRes.json();
        if (json.success && json.data) {
          localStore.addPurchaseOrder(json.data);
          return json.data;
        }
      }
    } catch (err) {
      // Continue to fallback
    }

    const all = await getPurchaseOrders(businessId);
    return all.find(p => p.id === poId);
  }

  return undefined;
}

export async function createPurchaseOrder(
  businessId: string,
  businessName: string,
  data: {
    vendorId: string;
    vendorName: string;
    vendorEmail?: string;
    vendorGstin?: string;
    warehouseId: string;
    warehouseName: string;
    items: POLineItem[];
    expectedDeliveryDate: string;
    notes?: string;
    createdBy: string;
  }
): Promise<PurchaseOrder> {
  const poId = generateId('po');
  const now = new Date().toISOString();

  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `PO-${year}-${randomSuffix}`;

  let subtotal = 0;
  let taxTotal = 0;

  const sanitizedItems = data.items.map(item => {
    const qty = Math.max(0, item.quantity);
    const price = Math.max(0, item.unitPrice);
    const lineTotal = round2(qty * price);
    const taxAmt = round2((lineTotal * (item.taxRate || 0)) / 100);
    const lineWithTax = round2(lineTotal + taxAmt);

    subtotal += lineTotal;
    taxTotal += taxAmt;

    return {
      ...item,
      quantity: qty,
      orderedQuantity: qty,
      receivedQuantity: 0,
      unitPrice: price,
      lineTotal,
      taxAmount: taxAmt,
      totalWithTax: lineWithTax,
    };
  });

  const grandTotal = round2(subtotal + taxTotal);

  const newPO: PurchaseOrder = {
    id: poId,
    businessId,
    orderNumber,
    vendorId: data.vendorId,
    vendorName: data.vendorName,
    vendorGstin: data.vendorGstin || '',
    warehouseId: data.warehouseId,
    warehouseName: data.warehouseName,
    items: sanitizedItems,
    subtotal: round2(subtotal),
    taxTotal: round2(taxTotal),
    grandTotal,
    status: 'Ordered',
    expectedDeliveryDate: data.expectedDeliveryDate,
    notes: data.notes || '',
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  localStore.addPurchaseOrder(newPO);

  try {
    await fetch(`${API_BASE}/businesses/${businessId}/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPO),
    });
  } catch (err) {
    console.warn('MySQL PO write failed (retained in local cache):', err);
  }

  // Dispatch email notification to supplier via Google Apps Script if email provided
  if (data.vendorEmail) {
    sendEmailNotification({
      action: 'PURCHASE_ORDER',
      to: data.vendorEmail,
      businessName,
      orderNumber,
      vendorName: data.vendorName,
      warehouseName: data.warehouseName,
      expectedDeliveryDate: data.expectedDeliveryDate,
      notes: data.notes,
      items: sanitizedItems.map(i => ({
        productName: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        unit: i.unit,
        unitPriceFormatted: formatCurrency(i.unitPrice),
        lineTotalFormatted: formatCurrency(i.lineTotal),
      })),
      grandTotalFormatted: formatCurrency(grandTotal),
    });
  }

  localStore.addAuditLog({
    id: generateId('audit'),
    businessId,
    entityType: 'PURCHASE_ORDER_CREATED',
    entityId: poId,
    actorUid: data.createdBy,
    details: { orderNumber, vendor: data.vendorName, grandTotal },
    timestamp: now,
  });

  return newPO;
}

export async function updatePurchaseOrderStatus(
  businessId: string,
  poId: string,
  newStatus: POStatus
): Promise<void> {
  const po = await getPurchaseOrderById(businessId, poId);
  if (!po) return;

  const updated = {
    ...po,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  localStore.updatePurchaseOrder(updated);

  try {
    await fetch(`${API_BASE}/businesses/${businessId}/purchase-orders/${poId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  } catch (err) {
    console.warn('MySQL PO update status failed:', err);
  }
}
