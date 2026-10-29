import { db, isDemoMode } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { SupplierBill, BillStatus, PaymentStatus, BillLineItem, PurchaseOrder } from '../types';
import { localStore } from './store';
import { generateId, round2, formatCurrency } from '../lib/utils';
import { sendEmailNotification } from './mailService';

export async function getSupplierBills(businessId: string): Promise<SupplierBill[]> {
  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, `businesses/${businessId}/supplierBills`));
      return snap.docs.map(d => d.data() as SupplierBill);
    } catch (err) {
      console.warn('Firestore supplierBills fetch failed, using localStore:', err);
    }
  }
  return localStore.getSupplierBills(businessId);
}

export async function getSupplierBillById(businessId: string, billId: string): Promise<SupplierBill | undefined> {
  if (!isDemoMode && db) {
    try {
      const snap = await getDoc(doc(db, `businesses/${businessId}/supplierBills`, billId));
      if (snap.exists()) {
        return snap.data() as SupplierBill;
      }
    } catch (err) {
      console.warn('Firestore bill getDoc failed, using localStore:', err);
    }
  }
  return localStore.getSupplierBillById(businessId, billId);
}

export async function createSupplierBill(
  businessId: string,
  purchaseOrder: PurchaseOrder,
  data: {
    invoiceNumber: string;
    invoiceDate: string;
    lineItems: {
      productId: string;
      productName: string;
      sku: string;
      billedQuantity: number;
      unitPrice: number;
      taxRate: number;
    }[];
    notes?: string;
  }
): Promise<SupplierBill> {
  const billId = generateId('bill');
  const now = new Date().toISOString();

  let subtotal = 0;
  let totalTax = 0;

  const sanitizedItems: BillLineItem[] = data.lineItems.map(item => {
    const qty = Math.max(0, item.billedQuantity);
    const price = Math.max(0, item.unitPrice);
    const taxable = round2(qty * price);
    const gstRate = Math.max(0, item.taxRate || 18);
    const gstAmt = round2((taxable * gstRate) / 100);
    const total = round2(taxable + gstAmt);

    subtotal += taxable;
    totalTax += gstAmt;

    return {
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      billedQuantity: qty,
      unitPrice: price,
      taxableAmount: taxable,
      gstRate,
      gstAmount: gstAmt,
      totalAmount: total,
    };
  });

  const totalAmount = round2(subtotal + totalTax);

  // Divide GST equally between CGST and SGST for intrastate or IGST
  const cgstAmount = round2(totalTax / 2);
  const sgstAmount = round2(totalTax - cgstAmount);

  const bill: SupplierBill = {
    id: billId,
    businessId,
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.orderNumber,
    vendorId: purchaseOrder.vendorId,
    vendorName: purchaseOrder.vendorName,
    vendorGstin: purchaseOrder.vendorGstin || '',
    invoiceNumber: data.invoiceNumber.trim(),
    invoiceDate: data.invoiceDate,
    lineItems: sanitizedItems,
    subtotal: round2(subtotal),
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
    totalTax: round2(totalTax),
    totalAmount,
    paidAmount: 0,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    createdAt: now,
    updatedAt: now,
  };

  if (!isDemoMode && db) {
    try {
      const ref = doc(db, `businesses/${businessId}/supplierBills`, billId);
      await setDoc(ref, {
        ...bill,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore bill write failed, using localStore:', err);
      localStore.addSupplierBill(bill);
    }
  } else {
    localStore.addSupplierBill(bill);
  }

  return bill;
}

/**
 * Independent Bill Verification
 * Strictly financial check. Does NOT alter inventory or stock balances!
 */
export async function verifySupplierBill(
  businessId: string,
  businessName: string,
  billId: string,
  actorUid: string,
  action: 'ACCEPT' | 'REJECT' | 'REQUEST_CORRECTION',
  details?: {
    rejectionReason?: string;
    correctionDetails?: string;
    vendorEmail?: string;
  }
): Promise<{ success: boolean; status: BillStatus; error?: string }> {
  const bill = await getSupplierBillById(businessId, billId);
  if (!bill) {
    return { success: false, status: 'PENDING', error: 'Supplier bill not found.' };
  }

  const now = new Date().toISOString();
  let newStatus: BillStatus = 'PENDING';

  if (action === 'ACCEPT') {
    newStatus = 'VERIFIED';
  } else if (action === 'REJECT') {
    if (!details?.rejectionReason) {
      return { success: false, status: bill.status, error: 'A rejection reason is required.' };
    }
    newStatus = 'REJECTED';
  } else {
    newStatus = 'CORRECTION_REQUESTED';
  }

  const updatedBill: SupplierBill = {
    ...bill,
    status: newStatus,
    rejectionReason: action === 'REJECT' ? details?.rejectionReason : undefined,
    correctionDetails: action === 'REQUEST_CORRECTION' ? details?.correctionDetails : undefined,
    verifiedBy: actorUid,
    verifiedAt: now,
    updatedAt: now,
  };

  localStore.updateSupplierBill(updatedBill);

  // If correction or rejection requested and vendor email is known, dispatch mail notification
  if (details?.vendorEmail && (action === 'REQUEST_CORRECTION' || action === 'REJECT')) {
    sendEmailNotification({
      action: 'BILL_CORRECTION',
      to: details.vendorEmail,
      businessName,
      vendorName: bill.vendorName,
      invoiceNumber: bill.invoiceNumber,
      poNumber: bill.poNumber,
      details: action === 'REJECT' ? details.rejectionReason : details.correctionDetails,
    });
  }

  // Update associated delivery's billVerificationStatus if linked
  const deliveries = localStore.getDeliveries(businessId);
  const matchedDel = deliveries.find(d => d.purchaseOrderId === bill.purchaseOrderId);
  if (matchedDel) {
    const updatedDel = {
      ...matchedDel,
      billVerificationStatus: newStatus,
      billVerifiedBy: actorUid,
      billVerifiedAt: now,
      status: (newStatus === 'VERIFIED' && matchedDel.productVerificationStatus === 'ACCEPTED') ? 'VERIFIED' : matchedDel.status,
      updatedAt: now,
    };
    localStore.updateDelivery(updatedDel as any);
  }

  // Record Audit Log
  localStore.addAuditLog({
    id: generateId('audit'),
    businessId,
    entityType: 'SUPPLIER_BILL_VERIFIED',
    entityId: billId,
    actorUid,
    details: {
      action,
      status: newStatus,
      invoiceNumber: bill.invoiceNumber,
      poNumber: bill.poNumber,
      amount: bill.totalAmount,
    },
    timestamp: now,
  });

  return { success: true, status: newStatus };
}
