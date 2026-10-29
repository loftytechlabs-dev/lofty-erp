import { db, isDemoMode } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { PaymentRecord, PaymentMethod, SupplierBill } from '../types';
import { localStore } from './store';
import { generateId, round2, formatCurrency, formatDate } from '../lib/utils';
import { sendEmailNotification } from './mailService';

export async function getPayments(businessId: string): Promise<PaymentRecord[]> {
  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, `businesses/${businessId}/payments`));
      return snap.docs.map(d => d.data() as PaymentRecord);
    } catch (err) {
      console.warn('Firestore payments fetch failed, using localStore:', err);
    }
  }
  return localStore.getPayments(businessId);
}

export async function recordSupplierPayment(
  businessId: string,
  businessName: string,
  bill: SupplierBill,
  data: {
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    referenceNumber: string;
    notes?: string;
    vendorEmail?: string;
    recordedBy: string;
  }
): Promise<{ success: boolean; payment: PaymentRecord }> {
  const paymentId = generateId('pay');
  const now = new Date().toISOString();
  const paymentAmount = round2(Math.max(0, data.amount));

  const payment: PaymentRecord = {
    id: paymentId,
    businessId,
    billId: bill.id,
    vendorId: bill.vendorId,
    vendorName: bill.vendorName,
    amount: paymentAmount,
    paymentDate: data.paymentDate,
    paymentMethod: data.paymentMethod,
    referenceNumber: data.referenceNumber.trim(),
    notes: data.notes || '',
    recordedBy: data.recordedBy,
    createdAt: now,
  };

  // Update Bill's paidAmount and paymentStatus
  const newPaidAmount = round2((bill.paidAmount || 0) + paymentAmount);
  let newPaymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'PARTIALLY_PAID';

  if (newPaidAmount >= bill.totalAmount) {
    newPaymentStatus = 'PAID';
  } else if (newPaidAmount <= 0) {
    newPaymentStatus = 'UNPAID';
  }

  const updatedBill: SupplierBill = {
    ...bill,
    paidAmount: newPaidAmount,
    paymentStatus: newPaymentStatus,
    updatedAt: now,
  };

  localStore.addPayment(payment);
  localStore.updateSupplierBill(updatedBill);

  // If vendor email is provided, send remittance advice via Google Apps Script Mailer
  if (data.vendorEmail) {
    sendEmailNotification({
      action: 'PAYMENT_RECEIPT',
      to: data.vendorEmail,
      businessName,
      vendorName: bill.vendorName,
      amountFormatted: formatCurrency(paymentAmount),
      paymentDate: formatDate(data.paymentDate),
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber,
      invoiceNumber: bill.invoiceNumber,
    });
  }

  // Audit log
  localStore.addAuditLog({
    id: generateId('audit'),
    businessId,
    entityType: 'PAYMENT_RECORDED',
    entityId: paymentId,
    actorUid: data.recordedBy,
    details: {
      billId: bill.id,
      invoiceNumber: bill.invoiceNumber,
      amount: paymentAmount,
      newPaymentStatus,
    },
    timestamp: now,
  });

  return { success: true, payment };
}
