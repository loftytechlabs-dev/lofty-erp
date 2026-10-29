import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Helper to check user membership and role
async function checkMemberRole(businessId: string, uid: string, allowedRoles: string[]) {
  const memberDoc = await db.doc(`businesses/${businessId}/members/${uid}`).get();
  if (!memberDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User is not a member of this business.');
  }
  const role = memberDoc.data()?.role;
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', `Insufficient permissions. Role required: ${allowedRoles.join(' or ')}.`);
  }
  return role;
}

/**
 * 1. Create Business
 * Creates business document, default warehouse, and owner membership atomically.
 */
export const createBusiness = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { name, type, country, currency, taxSettings, contact } = data;
  if (!name || typeof name !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Business name is required.');
  }

  const uid = context.auth.uid;
  const businessRef = db.collection('businesses').doc();
  const businessId = businessRef.id;

  const batch = db.batch();

  // Create Business doc
  batch.set(businessRef, {
    id: businessId,
    name: name.trim(),
    type: type || 'Manufacturing',
    country: country || 'India',
    currency: currency || { code: 'INR', symbol: '₹' },
    taxSettings: {
      gstin: taxSettings?.gstin || '',
      defaultTaxRate: taxSettings?.defaultTaxRate ?? 18,
    },
    contact: contact || {},
    ownerUid: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create Owner member
  const memberRef = businessRef.collection('members').doc(uid);
  batch.set(memberRef, {
    uid,
    role: 'Owner',
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    email: context.auth.token.email || '',
    displayName: context.auth.token.name || 'Owner',
  });

  // Create default warehouse
  const warehouseRef = businessRef.collection('warehouses').doc();
  batch.set(warehouseRef, {
    id: warehouseRef.id,
    name: 'Main Godown / Warehouse 1',
    code: 'WH-01',
    location: 'Central Storage',
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Append businessId to user's registered list
  const userRef = db.doc(`users/${uid}`);
  batch.set(userRef, {
    uid,
    businessIds: admin.firestore.FieldValue.arrayUnion(businessId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await batch.commit();

  return { success: true, businessId, name };
});

/**
 * 2. Create Invitation
 * Generates an invitation token for a specified role.
 */
export const createInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { businessId, role, recipientEmail } = data;
  if (!businessId || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing businessId or role.');
  }

  await checkMemberRole(businessId, context.auth.uid, ['Owner', 'Manager']);

  const validRoles = ['Owner', 'Manager', 'Purchasing', 'Warehouse', 'Accountant'];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role requested.');
  }

  // Generate a random 8-character invitation code
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const inviteRef = db.collection(`businesses/${businessId}/invitations`).doc(code);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days validity

  await inviteRef.set({
    code,
    businessId,
    role,
    recipientEmail: recipientEmail ? recipientEmail.toLowerCase().trim() : null,
    createdBy: context.auth.uid,
    status: 'PENDING',
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, inviteCode: code, expiresAt };
});

/**
 * 3. Accept Invitation
 * Joins a user to the business via invite code.
 */
export const acceptInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { inviteCode } = data;
  if (!inviteCode || typeof inviteCode !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Invitation code is required.');
  }

  const code = inviteCode.trim().toUpperCase();
  const uid = context.auth.uid;

  // Search across businesses for this invitation code
  const snapshot = await db.collectionGroup('invitations')
    .where('code', '==', code)
    .where('status', '==', 'PENDING')
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new functions.https.HttpsError('not-found', 'Invalid or expired invitation code.');
  }

  const inviteDoc = snapshot.docs[0];
  const inviteData = inviteDoc.data();
  const businessId = inviteData.businessId;

  // Check expiration
  if (inviteData.expiresAt.toDate() < new Date()) {
    throw new functions.https.HttpsError('failed-precondition', 'This invitation has expired.');
  }

  // Check recipient email if restricted
  if (inviteData.recipientEmail && context.auth.token.email) {
    if (inviteData.recipientEmail.toLowerCase() !== context.auth.token.email.toLowerCase()) {
      throw new functions.https.HttpsError('permission-denied', 'This invitation was addressed to a different email address.');
    }
  }

  const batch = db.batch();

  // Create or update member doc
  const memberRef = db.doc(`businesses/${businessId}/members/${uid}`);
  batch.set(memberRef, {
    uid,
    role: inviteData.role,
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    email: context.auth.token.email || '',
    displayName: context.auth.token.name || 'Team Member',
  });

  // Mark invite as accepted
  batch.update(inviteDoc.ref, {
    status: 'ACCEPTED',
    acceptedBy: uid,
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update user's businesses
  const userRef = db.doc(`users/${uid}`);
  batch.set(userRef, {
    uid,
    businessIds: admin.firestore.FieldValue.arrayUnion(businessId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await batch.commit();

  return { success: true, businessId, role: inviteData.role };
});

/**
 * 4. Generate QR Delivery Token
 * Creates an unpredictable scoped token for mobile delivery check-in.
 */
export const generateDeliveryToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { businessId, purchaseOrderId } = data;
  if (!businessId || !purchaseOrderId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing businessId or purchaseOrderId.');
  }

  await checkMemberRole(businessId, context.auth.uid, ['Owner', 'Manager', 'Purchasing', 'Warehouse']);

  const poDoc = await db.doc(`businesses/${businessId}/purchaseOrders/${purchaseOrderId}`).get();
  if (!poDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Purchase order not found.');
  }

  // Token is 16 random hex chars
  const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  const tokenRef = db.collection('deliveryTokens').doc(token);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48); // 48-hour valid check-in window

  await tokenRef.set({
    token,
    businessId,
    purchaseOrderId,
    poNumber: poDoc.data()?.orderNumber || purchaseOrderId,
    vendorName: poDoc.data()?.vendorName || '',
    warehouseId: poDoc.data()?.warehouseId || '',
    warehouseName: poDoc.data()?.warehouseName || '',
    isUsed: false,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: context.auth.uid,
  });

  return { success: true, token, expiresAt };
});

/**
 * 5. Submit Delivery from Public Portal (No Auth Required)
 * Submits delivery details via valid token.
 */
export const submitDeliveryPortal = functions.https.onCall(async (data) => {
  const { token, challanNumber, challanDate, vehicleNumber, driverName, driverPhone, items, notes } = data;

  if (!token || !items || !Array.isArray(items) || items.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing token or delivered items.');
  }

  const tokenRef = db.collection('deliveryTokens').doc(token);
  const tokenDoc = await tokenRef.get();

  if (!tokenDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Invalid delivery registration link.');
  }

  const tokenData = tokenDoc.data();
  if (!tokenData) {
    throw new functions.https.HttpsError('not-found', 'Invalid delivery registration link.');
  }

  if (tokenData.isUsed) {
    throw new functions.https.HttpsError('failed-precondition', 'This delivery QR token has already been submitted.');
  }

  if (tokenData.expiresAt.toDate() < new Date()) {
    throw new functions.https.HttpsError('failed-precondition', 'This delivery link has expired.');
  }

  const businessId = tokenData.businessId;
  const purchaseOrderId = tokenData.purchaseOrderId;

  const deliveryRef = db.collection(`businesses/${businessId}/deliveries`).doc();
  const deliveryId = deliveryRef.id;

  const batch = db.batch();

  // Create delivery record with PENDING_REVIEW status
  batch.set(deliveryRef, {
    id: deliveryId,
    businessId,
    purchaseOrderId,
    poNumber: tokenData.poNumber,
    vendorName: tokenData.vendorName,
    warehouseId: tokenData.warehouseId,
    warehouseName: tokenData.warehouseName,
    challanNumber: challanNumber || '',
    challanDate: challanDate || new Date().toISOString().split('T')[0],
    vehicleNumber: vehicleNumber || '',
    driverName: driverName || '',
    driverPhone: driverPhone || '',
    items: items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku || '',
      unit: item.unit || 'Units',
      orderedQuantity: Number(item.orderedQuantity) || 0,
      deliveredQuantity: Number(item.deliveredQuantity) || 0,
      acceptedQuantity: 0, // Unassigned until physical product verification
      rejectedQuantity: 0,
      inspectionNotes: '',
    })),
    notes: notes || '',
    status: 'AWAITING_REVIEW', // Awaiting independent Product and Bill verifications
    productVerificationStatus: 'PENDING',
    billVerificationStatus: 'PENDING',
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Mark token as used to prevent replay
  batch.update(tokenRef, {
    isUsed: true,
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
    deliveryId,
  });

  // Create in-app notification
  const notifRef = db.collection(`businesses/${businessId}/notifications`).doc();
  batch.set(notifRef, {
    id: notifRef.id,
    type: 'DELIVERY_SUBMITTED',
    title: `New Delivery Check-In: PO #${tokenData.poNumber}`,
    message: `Challan #${challanNumber || 'N/A'} arrived from ${tokenData.vendorName}. Ready for physical verification.`,
    entityId: deliveryId,
    entityType: 'delivery',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { success: true, deliveryId };
});

/**
 * 6. Verify Product Delivery (Physical verification)
 * Updates physical accepted quantities, creates stockMovements and updates stockBalances atomically!
 * Does NOT verify bill.
 */
export const verifyProductDelivery = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { businessId, deliveryId, verifiedItems, overallNotes } = data;
  if (!businessId || !deliveryId || !Array.isArray(verifiedItems)) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing businessId, deliveryId, or verifiedItems.');
  }

  await checkMemberRole(businessId, context.auth.uid, ['Owner', 'Manager', 'Warehouse']);

  const deliveryRef = db.doc(`businesses/${businessId}/deliveries/${deliveryId}`);

  return await db.runTransaction(async (transaction) => {
    const deliveryDoc = await transaction.get(deliveryRef);
    if (!deliveryDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Delivery record not found.');
    }

    const delivery = deliveryDoc.data();
    if (delivery?.productVerificationStatus === 'ACCEPTED' || delivery?.productVerificationStatus === 'ACCEPTED_WITH_DISCREPANCY') {
      throw new functions.https.HttpsError('failed-precondition', 'This delivery has already been physically verified and inventory updated.');
    }

    const warehouseId = delivery?.warehouseId;
    const poRef = db.doc(`businesses/${businessId}/purchaseOrders/${delivery?.purchaseOrderId}`);
    const poDoc = await transaction.get(poRef);

    let hasDiscrepancy = false;
    const updatedItems = delivery?.items.map((item: any) => {
      const match = verifiedItems.find((v: any) => v.productId === item.productId);
      const acceptedQty = match ? Math.max(0, Number(match.acceptedQuantity) || 0) : 0;
      const rejectedQty = match ? Math.max(0, Number(match.rejectedQuantity) || 0) : 0;
      const notes = match ? match.inspectionNotes || '' : '';

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

    const verificationStatus = hasDiscrepancy ? 'ACCEPTED_WITH_DISCREPANCY' : 'ACCEPTED';

    // Apply stock movements ONLY for accepted physical quantity
    for (const item of updatedItems) {
      if (item.acceptedQuantity > 0) {
        // Stock Movement Doc
        const movementRef = db.collection(`businesses/${businessId}/stockMovements`).doc();
        transaction.set(movementRef, {
          id: movementRef.id,
          businessId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          warehouseId,
          type: 'PURCHASE_RECEIPT',
          quantity: item.acceptedQuantity,
          referenceType: 'DELIVERY',
          referenceId: deliveryId,
          purchaseOrderId: delivery?.purchaseOrderId,
          actorUid: context.auth?.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          notes: item.inspectionNotes || 'Received from delivery verification',
        });

        // Stock Balance Doc (Keyed by productId_warehouseId for atomic updates)
        const balanceDocId = `${item.productId}_${warehouseId}`;
        const balanceRef = db.doc(`businesses/${businessId}/stockBalances/${balanceDocId}`);
        const balanceDoc = await transaction.get(balanceRef);

        const currentQty = balanceDoc.exists ? (balanceDoc.data()?.quantity || 0) : 0;
        transaction.set(balanceRef, {
          id: balanceDocId,
          businessId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          warehouseId,
          quantity: currentQty + item.acceptedQuantity,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    // Update PO item received quantities if PO exists
    if (poDoc.exists) {
      const poData = poDoc.data();
      const updatedPoItems = poData?.items.map((poItem: any) => {
        const matchingVerified = updatedItems.find((i: any) => i.productId === poItem.productId);
        const previouslyReceived = poItem.receivedQuantity || 0;
        const newlyAccepted = matchingVerified ? matchingVerified.acceptedQuantity : 0;
        return {
          ...poItem,
          receivedQuantity: previouslyReceived + newlyAccepted,
        };
      });

      const allReceived = updatedPoItems.every((i: any) => i.receivedQuantity >= i.quantity);
      const anyReceived = updatedPoItems.some((i: any) => i.receivedQuantity > 0);
      const newPoStatus = allReceived ? 'Received' : (anyReceived ? 'Partially Received' : poData?.status);

      transaction.update(poRef, {
        items: updatedPoItems,
        status: newPoStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Update Delivery Document
    transaction.update(deliveryRef, {
      items: updatedItems,
      productVerificationStatus: verificationStatus,
      productVerifiedBy: context.auth?.uid,
      productVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      productVerificationNotes: overallNotes || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Record Audit Log
    const auditRef = db.collection(`businesses/${businessId}/auditLogs`).doc();
    transaction.set(auditRef, {
      id: auditRef.id,
      entityType: 'DELIVERY_PRODUCT_VERIFIED',
      entityId: deliveryId,
      actorUid: context.auth?.uid,
      details: {
        verificationStatus,
        itemsAccepted: updatedItems.map((i: any) => ({ productId: i.productId, accepted: i.acceptedQuantity, rejected: i.rejectedQuantity })),
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, verificationStatus };
  });
});

/**
 * 7. Verify Supplier Bill (Financial verification)
 * Independent of physical delivery! Does NOT alter inventory.
 */
export const verifySupplierBill = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { businessId, billId, action, rejectionReason, correctionDetails } = data;
  if (!businessId || !billId || !['ACCEPT', 'REJECT', 'REQUEST_CORRECTION'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid verification action.');
  }

  await checkMemberRole(businessId, context.auth.uid, ['Owner', 'Manager', 'Accountant']);

  const billRef = db.doc(`businesses/${businessId}/supplierBills/${billId}`);
  const billDoc = await billRef.get();

  if (!billDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Supplier bill not found.');
  }

  let newStatus: string;
  const updateData: Record<string, any> = {
    verifiedBy: context.auth.uid,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (action === 'ACCEPT') {
    newStatus = 'VERIFIED';
    updateData.status = newStatus;
  } else if (action === 'REJECT') {
    if (!rejectionReason) {
      throw new functions.https.HttpsError('invalid-argument', 'A rejection reason is required.');
    }
    newStatus = 'REJECTED';
    updateData.status = newStatus;
    updateData.rejectionReason = rejectionReason;
  } else {
    newStatus = 'CORRECTION_REQUESTED';
    updateData.status = newStatus;
    updateData.correctionDetails = correctionDetails || '';
  }

  await billRef.update(updateData);

  // Record Audit Log
  await db.collection(`businesses/${businessId}/auditLogs`).add({
    entityType: 'SUPPLIER_BILL_VERIFIED',
    entityId: billId,
    actorUid: context.auth.uid,
    action,
    newStatus,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, status: newStatus };
});

/**
 * 8. Record Payment
 * Records payment against a supplier bill and updates bill payment status.
 */
export const recordPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { businessId, billId, amount, paymentDate, paymentMethod, referenceNumber, notes } = data;
  if (!businessId || !billId || !amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid payment amount and billId are required.');
  }

  await checkMemberRole(businessId, context.auth.uid, ['Owner', 'Manager', 'Accountant']);

  const billRef = db.doc(`businesses/${businessId}/supplierBills/${billId}`);
  const billDoc = await billRef.get();

  if (!billDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Supplier bill not found.');
  }

  const billData = billDoc.data();
  const currentPaid = Number(billData?.paidAmount) || 0;
  const totalAmount = Number(billData?.totalAmount) || 0;
  const newPaid = currentPaid + Number(amount);

  let newPaymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'PARTIALLY_PAID';
  if (newPaid >= totalAmount) {
    newPaymentStatus = 'PAID';
  } else if (newPaid <= 0) {
    newPaymentStatus = 'UNPAID';
  }

  const batch = db.batch();

  // Create payment record
  const paymentRef = db.collection(`businesses/${businessId}/payments`).doc();
  batch.set(paymentRef, {
    id: paymentRef.id,
    businessId,
    billId,
    vendorId: billData?.vendorId,
    vendorName: billData?.vendorName,
    amount: Number(amount),
    paymentDate: paymentDate || new Date().toISOString().split('T')[0],
    paymentMethod: paymentMethod || 'Bank Transfer',
    referenceNumber: referenceNumber || '',
    notes: notes || '',
    recordedBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update Bill
  batch.update(billRef, {
    paidAmount: newPaid,
    paymentStatus: newPaymentStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { success: true, newPaid, paymentStatus: newPaymentStatus };
});
