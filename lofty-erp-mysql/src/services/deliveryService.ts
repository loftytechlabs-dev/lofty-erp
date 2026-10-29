import { db, isDemoMode } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Delivery,
  DeliveryToken,
  DeliveryItem,
  ProductVerificationStatus,
  StockMovement,
  PurchaseOrder,
  BillAiVerification,
} from '../types';
import { localStore } from './store';
import { generateId, round2 } from '../lib/utils';
import { sendEmailNotification } from './mailService';
import { getBusinessMembers } from './businessService';

const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
const API_BASE = isTestEnv ? 'http://localhost:5001/api' : '/api';

export const FIREBASE_HOSTING_ORIGIN = 'https://lofty-erp.web.app';

export async function generateDeliveryToken(
  businessId: string,
  purchaseOrder: PurchaseOrder,
  createdByUid: string
): Promise<{ success: boolean; token: string; qrUrl: string; cloudUrl: string; localUrl: string }> {
  const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  const now = new Date();
  // Active until delivery is accepted and marked used (1-year validity)
  const expiresAt = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();

  const tokenData: DeliveryToken = {
    token,
    businessId,
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.orderNumber,
    vendorName: purchaseOrder.vendorName,
    warehouseId: purchaseOrder.warehouseId,
    warehouseName: purchaseOrder.warehouseName,
    items: purchaseOrder.items,
    isUsed: false,
    expiresAt,
    createdAt: now.toISOString(),
    createdBy: createdByUid,
  };

  // 1. Write to Firebase Firestore so external mobile devices can read it from anywhere
  if (!isDemoMode && db) {
    try {
      const ref = doc(db, 'deliveryTokens', token);
      await setDoc(ref, tokenData);
    } catch (err) {
      console.warn('Firestore deliveryToken write failed, fallback localStore:', err);
    }
  }

  // 2. Always persist locally
  localStore.saveDeliveryToken(tokenData);

  // 3. Cloud hosted URL points to Firebase Hosting so any phone camera scans directly
  const cloudUrl = `${FIREBASE_HOSTING_ORIGIN}/delivery-portal?token=${token}`;
  const localUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/delivery-portal?token=${token}`
    : cloudUrl;

  // Default to Firebase Hosting so drivers and users on phones can scan and access it directly
  const qrUrl = cloudUrl;

  return { success: true, token, qrUrl, cloudUrl, localUrl };
}

export async function getDeliveryToken(token: string): Promise<DeliveryToken | null> {
  if (!isDemoMode && db) {
    try {
      const snap = await getDoc(doc(db, 'deliveryTokens', token));
      if (snap.exists()) {
        return snap.data() as DeliveryToken;
      }
    } catch (err) {
      console.warn('Firestore deliveryToken lookup failed, using localStore:', err);
    }
  }
  return localStore.getDeliveryToken(token) || null;
}

export async function submitDeliveryViaToken(
  token: string,
  data: {
    challanNumber: string;
    challanDate: string;
    vehicleNumber?: string;
    driverName?: string;
    driverPhone?: string;
    items: {
      productId: string;
      productName: string;
      sku: string;
      unit: string;
      orderedQuantity: number;
      deliveredQuantity: number;
    }[];
    notes?: string;
    billPhotoBase64?: string;
    aiVerification?: BillAiVerification | null;
  }
): Promise<{ success: boolean; deliveryId: string; error?: string }> {
  const tokenRecord = await getDeliveryToken(token);

  if (!tokenRecord) {
    return { success: false, deliveryId: '', error: 'Invalid delivery registration link.' };
  }

  if (tokenRecord.isUsed) {
    return { success: false, deliveryId: '', error: 'This delivery QR token has already been submitted and accepted.' };
  }

  const deliveryId = generateId('del');
  const now = new Date().toISOString();
  const businessId = tokenRecord.businessId;

  // Check for quantity discrepancies between PO ordered count and driver delivered count
  const discrepantItems = data.items.filter(it => it.deliveredQuantity !== it.orderedQuantity);
  const hasQuantityDiscrepancy = discrepantItems.length > 0;

  const deliveryItems: DeliveryItem[] = data.items.map(it => ({
    productId: it.productId,
    productName: it.productName,
    sku: it.sku,
    unit: it.unit,
    orderedQuantity: it.orderedQuantity,
    deliveredQuantity: it.deliveredQuantity,
    acceptedQuantity: 0, // Pending physical verification by warehouse staff
    rejectedQuantity: 0,
    inspectionNotes: '',
  }));

  const delivery: Delivery = {
    id: deliveryId,
    businessId,
    purchaseOrderId: tokenRecord.purchaseOrderId,
    poNumber: tokenRecord.poNumber,
    vendorName: tokenRecord.vendorName,
    warehouseId: tokenRecord.warehouseId,
    warehouseName: tokenRecord.warehouseName,
    challanNumber: data.challanNumber.trim(),
    challanDate: data.challanDate,
    vehicleNumber: data.vehicleNumber || '',
    driverName: data.driverName || '',
    driverPhone: data.driverPhone || '',
    items: deliveryItems,
    notes: data.notes || '',
    billPhotoBase64: data.billPhotoBase64 || '',
    aiVerification: data.aiVerification || null,
    hasQuantityDiscrepancy,
    ownerConfirmationStatus: hasQuantityDiscrepancy ? 'PENDING' : 'NOT_REQUIRED',
    status: hasQuantityDiscrepancy ? 'AWAITING_OWNER_CONFIRMATION' : 'AWAITING_REVIEW',
    productVerificationStatus: 'PENDING',
    billVerificationStatus: 'PENDING',
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  // Always store in localStore immediately
  localStore.addDelivery(delivery);
  localStore.markDeliveryTokenUsed(token);

  try {
    await fetch(`${API_BASE}/businesses/${businessId}/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delivery),
    });
  } catch (err) {
    console.warn('MySQL delivery save failed:', err);
  }

  if (!isDemoMode && db) {
    try {
      const delRef = doc(db, `businesses/${businessId}/deliveries`, deliveryId);
      await setDoc(delRef, {
        ...delivery,
        createdAt: serverTimestamp(),
      });

      // Also store at root deliveries collection for guaranteed direct key lookup across devices
      const rootDelRef = doc(db, 'deliveries', deliveryId);
      await setDoc(rootDelRef, {
        ...delivery,
        createdAt: serverTimestamp(),
      });

      // Mark token as used
      const tokRef = doc(db, 'deliveryTokens', token);
      await updateDoc(tokRef, {
        isUsed: true,
        usedAt: serverTimestamp(),
        deliveryId,
      });

      // Add in-app notification
      const notifRef = doc(db, `businesses/${businessId}/notifications`, generateId('notif'));
      await setDoc(notifRef, {
        id: notifRef.id,
        type: hasQuantityDiscrepancy ? 'DELIVERY_DISCREPANCY' : 'DELIVERY_SUBMITTED',
        title: hasQuantityDiscrepancy
          ? `⚠️ Quantity Discrepancy: PO #${tokenRecord.poNumber}`
          : `Truck Check-In: PO #${tokenRecord.poNumber}`,
        message: hasQuantityDiscrepancy
          ? `Driver ${data.driverName || 'Carrier'} delivered mismatched quantities on Challan #${data.challanNumber}. Waiting for Owner confirmation.`
          : `Challan #${data.challanNumber} received from ${tokenRecord.vendorName}. Physical inspection pending.`,
        entityId: deliveryId,
        entityType: 'delivery',
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore delivery submission failed, localStore already updated:', err);
    }
  }

  // Create in-app notification in store
  localStore.addNotification({
    id: generateId('notif'),
    businessId,
    type: hasQuantityDiscrepancy ? 'DELIVERY_DISCREPANCY' : 'DELIVERY_SUBMITTED',
    title: hasQuantityDiscrepancy
      ? `⚠️ Quantity Discrepancy: PO #${tokenRecord.poNumber}`
      : `Truck Check-In: PO #${tokenRecord.poNumber}`,
    message: hasQuantityDiscrepancy
      ? `Driver ${data.driverName || 'Carrier'} brought mismatched quantities on Challan #${data.challanNumber}. Waiting for Owner confirmation.`
      : `Challan #${data.challanNumber} received from ${tokenRecord.vendorName}. Physical inspection pending.`,
    entityId: deliveryId,
    entityType: 'delivery',
    isRead: false,
    createdAt: now,
  });

  // If there is a quantity discrepancy, dispatch email notification to the business owner
  if (hasQuantityDiscrepancy) {
    try {
      let ownerEmail: string | undefined;
      const members = await getBusinessMembers(businessId);
      const ownerMember = members.find(m => m.role === 'Owner');
      ownerEmail = ownerMember?.email;

      if (!ownerEmail) {
        const fallbackBiz = localStore.getBusinessById(businessId);
        const mem = localStore.getMembers(businessId).find(m => m.role === 'Owner');
        ownerEmail = mem?.email;
      }

      if (ownerEmail) {
        const discrepancySummary = discrepantItems
          .map(
            it =>
              `• ${it.productName}: Ordered ${it.orderedQuantity} ${it.unit}, Driver Delivered ${it.deliveredQuantity} ${it.unit} (${it.deliveredQuantity > it.orderedQuantity ? '+' : ''}${it.deliveredQuantity - it.orderedQuantity} ${it.unit})`
          )
          .join('\n');

        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lofty-erp.web.app';
        const reviewUrl = `${origin}/deliveries/${deliveryId}`;

        await sendEmailNotification({
          action: 'DELIVERY_ALERT',
          to: ownerEmail,
          businessName: tokenRecord.vendorName || 'Lofty ERP Delivery Gate',
          subject: `⚠️ URGENT: PO #${tokenRecord.poNumber} Quantity Mismatch - Owner Confirmation Required`,
          poNumber: tokenRecord.poNumber,
          challanNumber: data.challanNumber,
          driverName: data.driverName || 'Driver',
          vehicleNumber: data.vehicleNumber || 'N/A',
          discrepancyDetails: discrepancySummary,
          notes: data.notes || '',
          reviewUrl,
        });
      }
    } catch (mailErr) {
      console.warn('Failed to dispatch owner discrepancy email:', mailErr);
    }
  }

  return { success: true, deliveryId };
}

export async function getDeliveries(businessId: string): Promise<Delivery[]> {
  try {
    const res = await fetch(`${API_BASE}/businesses/${businessId}/deliveries`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        localStore.setDeliveries(businessId, json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('MySQL deliveries fetch failed, using localStore:', err);
  }

  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, `businesses/${businessId}/deliveries`));
      const firestoreList = snap.docs.map(d => d.data() as Delivery);
      if (firestoreList.length > 0) {
        localStore.setDeliveries(businessId, firestoreList);
        return firestoreList;
      }
    } catch (err) {
      console.warn('Firestore deliveries fetch failed, using localStore:', err);
    }
  }
  return localStore.getDeliveries(businessId);
}

export async function getDeliveryById(businessId: string, deliveryId: string): Promise<Delivery | undefined> {
  // 1. Check localStore first
  if (businessId) {
    const local = localStore.getDeliveryById(businessId, deliveryId);
    if (local) return local;
  }
  const allDeliveries = Object.values((localStore as any).state?.deliveries || {}).flat() as Delivery[];
  const foundInLocal = allDeliveries.find(d => d.id === deliveryId);
  if (foundInLocal) return foundInLocal;

  // 2. Query Firestore
  if (!isDemoMode && db) {
    try {
      if (businessId) {
        const snap = await getDoc(doc(db, `businesses/${businessId}/deliveries`, deliveryId));
        if (snap.exists()) {
          const d = snap.data() as Delivery;
          localStore.addDelivery(d);
          return d;
        }
      }
      // Top-level root collection lookup
      const rootSnap = await getDoc(doc(db, 'deliveries', deliveryId));
      if (rootSnap.exists()) {
        const d = rootSnap.data() as Delivery;
        localStore.addDelivery(d);
        return d;
      }
    } catch (err) {
      console.warn('Firestore delivery getDoc failed, using localStore:', err);
    }
  }

  return undefined;
}

/**
 * Owner Confirmation for Quantity Discrepancy
 * Action can be 'APPROVED' (Owner says "ok fine") or 'REJECTED' (Owner rejects shipment)
 */
export async function confirmDeliveryDiscrepancy(
  businessId: string,
  deliveryId: string,
  actorUid: string,
  action: 'APPROVED' | 'REJECTED',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const delivery = await getDeliveryById(businessId, deliveryId);
  if (!delivery) {
    return { success: false, error: 'Delivery record not found.' };
  }

  const now = new Date().toISOString();
  const updatedDelivery: Delivery = {
    ...delivery,
    ownerConfirmationStatus: action,
    ownerConfirmedBy: actorUid,
    ownerConfirmedAt: now,
    ownerConfirmationNotes:
      notes?.trim() || (action === 'APPROVED' ? 'Approved by business owner' : 'Rejected by business owner'),
    status: action === 'APPROVED' ? 'AWAITING_REVIEW' : 'REJECTED',
    productVerificationStatus: action === 'REJECTED' ? 'REJECTED' : delivery.productVerificationStatus,
    updatedAt: now,
  };

  localStore.updateDelivery(updatedDelivery);

  try {
    await fetch(`${API_BASE}/businesses/${delivery.businessId}/deliveries/${deliveryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDelivery),
    });
  } catch (err) {
    console.warn('MySQL delivery discrepancy update failed:', err);
  }

  if (!isDemoMode && db) {
    try {
      const delRef = doc(db, `businesses/${delivery.businessId}/deliveries`, deliveryId);
      await updateDoc(delRef, {
        ownerConfirmationStatus: updatedDelivery.ownerConfirmationStatus,
        ownerConfirmedBy: updatedDelivery.ownerConfirmedBy,
        ownerConfirmedAt: updatedDelivery.ownerConfirmedAt,
        ownerConfirmationNotes: updatedDelivery.ownerConfirmationNotes,
        status: updatedDelivery.status,
        productVerificationStatus: updatedDelivery.productVerificationStatus,
        updatedAt: now,
      });

      const rootDelRef = doc(db, 'deliveries', deliveryId);
      await setDoc(rootDelRef, updatedDelivery, { merge: true });
    } catch (err) {
      console.warn('Firestore delivery update failed:', err);
    }
  }

  if (!isDemoMode && db) {
    try {
      const delRef = doc(db, `businesses/${delivery.businessId}/deliveries`, deliveryId);
      await updateDoc(delRef, {
        ownerConfirmationStatus: updatedDelivery.ownerConfirmationStatus,
        ownerConfirmedBy: updatedDelivery.ownerConfirmedBy,
        ownerConfirmedAt: updatedDelivery.ownerConfirmedAt,
        ownerConfirmationNotes: updatedDelivery.ownerConfirmationNotes,
        status: updatedDelivery.status,
        productVerificationStatus: updatedDelivery.productVerificationStatus,
        updatedAt: now,
      });

      const rootDelRef = doc(db, 'deliveries', deliveryId);
      await setDoc(rootDelRef, updatedDelivery, { merge: true });
    } catch (err) {
      console.warn('Firestore delivery update failed:', err);
    }
  }

  // Audit log
  localStore.addAuditLog({
    id: generateId('audit'),
    businessId: delivery.businessId,
    entityType: action === 'APPROVED' ? 'DELIVERY_DISCREPANCY_APPROVED' : 'DELIVERY_DISCREPANCY_REJECTED',
    entityId: deliveryId,
    actorUid,
    details: {
      action,
      notes: updatedDelivery.ownerConfirmationNotes,
    },
    timestamp: now,
  });

  return { success: true };
}

/**
 * Attach or update Supplier Bill photo on an existing Delivery
 */
export async function attachBillPhotoToDelivery(
  businessId: string,
  deliveryId: string,
  billPhotoBase64: string,
  aiVerification?: BillAiVerification | null
): Promise<{ success: boolean; error?: string }> {
  const delivery = await getDeliveryById(businessId, deliveryId);
  if (!delivery) return { success: false, error: 'Delivery record not found' };

  const now = new Date().toISOString();
  const updatedDelivery: Delivery = {
    ...delivery,
    billPhotoBase64,
    aiVerification: aiVerification !== undefined ? aiVerification : delivery.aiVerification,
    updatedAt: now,
  };

  localStore.updateDelivery(updatedDelivery);

  try {
    await fetch(`${API_BASE}/businesses/${delivery.businessId}/deliveries/${deliveryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDelivery),
    });
  } catch (err) {
    console.warn('MySQL delivery bill update failed:', err);
  }

  if (!isDemoMode && db) {
    try {
      const delRef = doc(db, `businesses/${delivery.businessId}/deliveries`, deliveryId);
      await updateDoc(delRef, { billPhotoBase64, updatedAt: now });

      const rootDelRef = doc(db, 'deliveries', deliveryId);
      await setDoc(rootDelRef, { billPhotoBase64, updatedAt: now }, { merge: true });
    } catch (e) {
      console.warn('Failed to update billPhotoBase64 in Firestore:', e);
    }
  }

  return { success: true };
}

export async function updateDeliveryAiVerification(
  businessId: string,
  deliveryId: string,
  aiVerification: BillAiVerification
): Promise<{ success: boolean; error?: string }> {
  const delivery = await getDeliveryById(businessId, deliveryId);
  if (!delivery) return { success: false, error: 'Delivery record not found' };

  const now = new Date().toISOString();
  const updatedDelivery: Delivery = {
    ...delivery,
    aiVerification,
    updatedAt: now,
  };

  localStore.updateDelivery(updatedDelivery);

  try {
    await fetch(`${API_BASE}/businesses/${businessId}/deliveries/${deliveryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiVerification }),
    });
  } catch (err) {
    console.warn('MySQL delivery ai verification update failed:', err);
  }

  return { success: true };
}

/**
 * Independent Product Physical Verification
 * Atomically records physical count, checks discrepancies, updates inventory for ACCEPTED quantities only!
 * Does NOT verify bill.
 */
export async function verifyProductDelivery(
  businessId: string,
  deliveryId: string,
  actorUid: string,
  verifiedItems: {
    productId: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
    inspectionNotes?: string;
  }[],
  overallNotes?: string
): Promise<{ success: boolean; status: ProductVerificationStatus; error?: string }> {
  const delivery = await getDeliveryById(businessId, deliveryId);
  if (!delivery) {
    return { success: false, status: 'PENDING', error: 'Delivery record not found.' };
  }

  if (delivery.productVerificationStatus === 'ACCEPTED' || delivery.productVerificationStatus === 'ACCEPTED_WITH_DISCREPANCY') {
    return { success: false, status: delivery.productVerificationStatus, error: 'This delivery has already been physically verified and inventory updated.' };
  }

  // Block physical verification if there is a quantity discrepancy that has not been approved by the Owner
  if (delivery.hasQuantityDiscrepancy && delivery.ownerConfirmationStatus !== 'APPROVED') {
    return {
      success: false,
      status: delivery.productVerificationStatus,
      error:
        delivery.ownerConfirmationStatus === 'REJECTED'
          ? 'This delivery was rejected by the business owner and cannot be accepted into inventory.'
          : 'Waiting for Owner Confirmation. The business owner must review and approve this quantity discrepancy before physical goods can be verified.',
    };
  }

  const now = new Date().toISOString();
  let hasDiscrepancy = false;

  const updatedItems = delivery.items.map(item => {
    const verified = verifiedItems.find(v => v.productId === item.productId);
    const acceptedQty = verified ? Math.max(0, verified.acceptedQuantity) : 0;
    const rejectedQty = verified ? Math.max(0, verified.rejectedQuantity) : 0;
    const notes = verified?.inspectionNotes || '';

    if (acceptedQty !== item.deliveredQuantity || rejectedQty > 0) {
      hasDiscrepancy = true;
    }

    return {
      ...item,
      acceptedQuantity: acceptedQty,
      rejectedQuantity: rejectedQty,
      inspectionNotes: notes,
    };
  });

  const verificationStatus: ProductVerificationStatus = hasDiscrepancy ? 'ACCEPTED_WITH_DISCREPANCY' : 'ACCEPTED';

  // 1. Update Inventory for ONLY accepted physical quantities!
  for (const item of updatedItems) {
    if (item.acceptedQuantity > 0) {
      const movement: StockMovement = {
        id: generateId('mov'),
        businessId,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        warehouseId: delivery.warehouseId,
        type: 'PURCHASE_RECEIPT',
        quantity: item.acceptedQuantity,
        referenceType: 'DELIVERY',
        referenceId: deliveryId,
        purchaseOrderId: delivery.purchaseOrderId,
        actorUid,
        timestamp: now,
        notes: item.inspectionNotes || 'Received from physical gate verification',
      };

      localStore.addStockMovementAndBalance(movement);
    }
  }

  // 2. Update PO line item received quantities
  const po = localStore.getPurchaseOrderById(businessId, delivery.purchaseOrderId);
  if (po) {
    const updatedPoItems = po.items.map(poItem => {
      const match = updatedItems.find(i => i.productId === poItem.productId);
      const newAccepted = match ? match.acceptedQuantity : 0;
      return {
        ...poItem,
        receivedQuantity: (poItem.receivedQuantity || 0) + newAccepted,
      };
    });

    const allReceived = updatedPoItems.every(i => i.receivedQuantity >= i.quantity);
    const anyReceived = updatedPoItems.some(i => i.receivedQuantity > 0);
    const newPoStatus = allReceived ? 'Received' : (anyReceived ? 'Partially Received' : po.status);

    localStore.updatePurchaseOrder({
      ...po,
      items: updatedPoItems,
      status: newPoStatus,
      updatedAt: now,
    });
  }

  // 3. Update Delivery Document
  const updatedDelivery: Delivery = {
    ...delivery,
    items: updatedItems,
    productVerificationStatus: verificationStatus,
    productVerifiedBy: actorUid,
    productVerifiedAt: now,
    productVerificationNotes: overallNotes || '',
    status: delivery.billVerificationStatus === 'VERIFIED' ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
    updatedAt: now,
  };

  localStore.updateDelivery(updatedDelivery);

  try {
    await fetch(`${API_BASE}/businesses/${delivery.businessId}/deliveries/${deliveryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDelivery),
    });
  } catch (err) {
    console.warn('MySQL delivery discrepancy update failed:', err);
  }

  if (!isDemoMode && db) {
    try {
      const delRef = doc(db, `businesses/${delivery.businessId}/deliveries`, deliveryId);
      await updateDoc(delRef, {
        ownerConfirmationStatus: updatedDelivery.ownerConfirmationStatus,
        ownerConfirmedBy: updatedDelivery.ownerConfirmedBy,
        ownerConfirmedAt: updatedDelivery.ownerConfirmedAt,
        ownerConfirmationNotes: updatedDelivery.ownerConfirmationNotes,
        status: updatedDelivery.status,
        productVerificationStatus: updatedDelivery.productVerificationStatus,
        updatedAt: now,
      });

      const rootDelRef = doc(db, 'deliveries', deliveryId);
      await setDoc(rootDelRef, updatedDelivery, { merge: true });
    } catch (err) {
      console.warn('Firestore delivery update failed:', err);
    }
  }

  // 4. Record Audit Log
  localStore.addAuditLog({
    id: generateId('audit'),
    businessId,
    entityType: 'DELIVERY_PRODUCT_VERIFIED',
    entityId: deliveryId,
    actorUid,
    details: {
      status: verificationStatus,
      discrepancy: hasDiscrepancy,
      acceptedTotal: updatedItems.reduce((acc, i) => acc + i.acceptedQuantity, 0),
      rejectedTotal: updatedItems.reduce((acc, i) => acc + i.rejectedQuantity, 0),
    },
    timestamp: now,
  });

  return { success: true, status: verificationStatus };
}
