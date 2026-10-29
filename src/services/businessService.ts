import { db, isDemoMode } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  collectionGroup,
} from 'firebase/firestore';
import { Business, BusinessMember, BusinessInvitation, Warehouse, BusinessRole } from '../types';
import { localStore } from './store';
import { generateId, withTimeout } from '../lib/utils';
import { sendEmailNotification } from './mailService';

export async function createBusiness(
  uid: string,
  userEmail: string,
  userDisplayName: string,
  data: {
    name: string;
    type: string;
    country: string;
    currency: { code: string; symbol: string };
    taxSettings: { gstin?: string; defaultTaxRate: number };
    contact?: { phone?: string; email?: string; address?: string };
  }
): Promise<{ success: boolean; business: Business }> {
  const businessId = generateId('biz');
  const now = new Date().toISOString();

  const business: Business = {
    id: businessId,
    name: data.name.trim(),
    type: data.type || 'Manufacturing',
    country: data.country || 'India',
    currency: data.currency || { code: 'INR', symbol: '₹' },
    taxSettings: {
      gstin: data.taxSettings?.gstin || '',
      defaultTaxRate: data.taxSettings?.defaultTaxRate ?? 18,
    },
    contact: data.contact || {},
    ownerUid: uid,
    createdAt: now,
    updatedAt: now,
  };

  const member: BusinessMember = {
    uid,
    businessId,
    email: userEmail,
    displayName: userDisplayName || 'Business Owner',
    role: 'Owner',
    joinedAt: now,
  };

  const defaultWarehouse: Warehouse = {
    id: generateId('wh'),
    businessId,
    name: 'Main Godown / Warehouse 1',
    code: 'WH-01',
    location: 'Central Storage Area',
    isActive: true,
    createdAt: now,
  };

  if (!isDemoMode && db) {
    try {
      const batch = writeBatch(db);

      // Business doc
      const bizRef = doc(db, 'businesses', businessId);
      batch.set(bizRef, {
        ...business,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Member doc
      const memberRef = doc(db, `businesses/${businessId}/members`, uid);
      batch.set(memberRef, {
        ...member,
        joinedAt: serverTimestamp(),
      });

      // Warehouse doc
      const whRef = doc(db, `businesses/${businessId}/warehouses`, defaultWarehouse.id);
      batch.set(whRef, {
        ...defaultWarehouse,
        createdAt: serverTimestamp(),
      });

      // Update user doc
      const userRef = doc(db, 'users', uid);
      batch.set(
        userRef,
        {
          uid,
          email: userEmail,
          displayName: userDisplayName,
          businessIds: [businessId],
          onboardingCompleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();
    } catch (err) {
      console.warn('Firestore write failed, falling back to local persistence:', err);
      localStore.addBusiness(business, member, defaultWarehouse);
    }
  } else {
    localStore.addBusiness(business, member, defaultWarehouse);
  }

  return { success: true, business };
}

export async function getBusinessesForUser(uid: string): Promise<Business[]> {
  const fallback = localStore.getBusinesses();
  if (!isDemoMode && db) {
    try {
      return await withTimeout(
        (async () => {
          const userDoc = await getDoc(doc(db, 'users', uid));
          const businessIds: string[] = userDoc.exists() ? userDoc.data()?.businessIds || [] : [];

          if (businessIds.length === 0) {
            return fallback;
          }

          const results: Business[] = [];
          for (const id of businessIds) {
            const bDoc = await getDoc(doc(db, 'businesses', id));
            if (bDoc.exists()) {
              results.push(bDoc.data() as Business);
            }
          }
          return results.length > 0 ? results : fallback;
        })(),
        1800,
        fallback
      );
    } catch (err) {
      console.warn('Firestore read error, using local businesses:', err);
    }
  }
  return fallback;
}

export async function getBusinessMembers(businessId: string): Promise<BusinessMember[]> {
  const fallback = localStore.getMembers(businessId);
  if (!isDemoMode && db) {
    try {
      return await withTimeout(
        (async () => {
          const snap = await getDocs(collection(db, `businesses/${businessId}/members`));
          return snap.docs.map(d => d.data() as BusinessMember);
        })(),
        1800,
        fallback
      );
    } catch (err) {
      console.warn('Firestore members fetch failed, fallback to localStore:', err);
    }
  }
  return fallback;
}

export async function createBusinessInvitation(
  businessId: string,
  businessName: string,
  role: BusinessRole,
  createdByUid: string,
  recipientEmail?: string
): Promise<{ success: boolean; inviteCode: string }> {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const now = new Date();
  // Valid until accepted (1 year expiration window)
  const expiresAt = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();

  const invitation: BusinessInvitation = {
    code,
    businessId,
    businessName: businessName.trim(),
    role,
    recipientEmail: recipientEmail ? recipientEmail.toLowerCase().trim() : null,
    createdBy: createdByUid,
    status: 'PENDING',
    expiresAt,
    createdAt: now.toISOString(),
  };

  if (!isDemoMode && db) {
    try {
      const invRef = doc(db, `businesses/${businessId}/invitations`, code);
      await setDoc(invRef, invitation);
      // Also persist at top-level for instant code lookup without composite indexes
      const topInvRef = doc(db, 'invitations', code);
      await setDoc(topInvRef, invitation);
    } catch (err) {
      console.warn('Firestore invitation write failed, fallback:', err);
      localStore.addInvitation(invitation);
    }
  } else {
    localStore.addInvitation(invitation);
  }

  // If email was provided, dispatch invitation via Google Apps Script Mailer!
  if (recipientEmail) {
    sendEmailNotification({
      action: 'INVITATION',
      to: recipientEmail,
      businessName,
      role,
      inviteCode: code,
      joinUrl: `${window.location.origin}/join?code=${code}`,
    });
  }

  return { success: true, inviteCode: code };
}

export async function getInvitationDetails(
  inviteCode: string
): Promise<{ success: boolean; invitation?: BusinessInvitation; businessName?: string; error?: string }> {
  const code = inviteCode.trim().toUpperCase();
  if (!code) return { success: false, error: 'No invitation code provided.' };

  // 1. Check localStore first
  const localInv = localStore.findInvitationByCode(code);
  if (localInv) {
    const biz = localStore.getBusinessById(localInv.businessId);
    const bName = localInv.businessName || biz?.name || 'the business';
    return { success: true, invitation: localInv, businessName: bName };
  }

  // 2. Check Firestore
  if (!isDemoMode && db) {
    try {
      const topSnap = await getDoc(doc(db, 'invitations', code));
      if (topSnap.exists()) {
        const inv = topSnap.data() as BusinessInvitation;
        let bName = inv.businessName || 'the business';
        if (!inv.businessName) {
          try {
            const bDoc = await getDoc(doc(db, 'businesses', inv.businessId));
            if (bDoc.exists()) bName = bDoc.data()?.name || bName;
          } catch (_) {}
        }
        return { success: true, invitation: inv, businessName: bName };
      }

      // Fallback query across collection group
      const snap = await getDocs(
        query(collectionGroup(db, 'invitations'), where('code', '==', code))
      );
      if (!snap.empty) {
        const inv = snap.docs[0].data() as BusinessInvitation;
        let bName = inv.businessName || 'the business';
        if (!inv.businessName) {
          try {
            const bDoc = await getDoc(doc(db, 'businesses', inv.businessId));
            if (bDoc.exists()) bName = bDoc.data()?.name || bName;
          } catch (_) {}
        }
        return { success: true, invitation: inv, businessName: bName };
      }
    } catch (e) {
      console.warn('Firestore getInvitationDetails failed, checking localStore:', e);
    }
  }

  return { success: false, error: 'Invitation not found or code is invalid.' };
}

export async function acceptBusinessInvitation(
  uid: string,
  userEmail: string,
  userDisplayName: string,
  inviteCode: string
): Promise<{ success: boolean; businessId: string; role: BusinessRole; error?: string }> {
  const code = inviteCode.trim().toUpperCase();

  let invite: BusinessInvitation | undefined;
  let businessId: string = '';

  if (!isDemoMode && db) {
    try {
      // 1. Direct O(1) document lookup by code
      const topSnap = await getDoc(doc(db, 'invitations', code));
      if (topSnap.exists()) {
        invite = topSnap.data() as BusinessInvitation;
        businessId = invite.businessId;
      } else {
        // Fallback query across collection group
        const snap = await getDocs(
          query(collectionGroup(db, 'invitations'), where('code', '==', code))
        );
        if (!snap.empty) {
          invite = snap.docs[0].data() as BusinessInvitation;
          businessId = invite.businessId;
        }
      }

      if (invite) {
        if (invite.status === 'ACCEPTED') {
          return { success: false, businessId: '', role: 'Warehouse', error: 'This invitation code has already been accepted.' };
        }

        if (invite.recipientEmail && userEmail && invite.recipientEmail.toLowerCase() !== userEmail.toLowerCase()) {
          return { success: false, businessId: '', role: 'Warehouse', error: `This invitation was designated for ${invite.recipientEmail}.` };
        }

        // Add to members
        const memberRef = doc(db, `businesses/${businessId}/members`, uid);
        await setDoc(memberRef, {
          uid,
          businessId,
          email: userEmail,
          displayName: userDisplayName || userEmail.split('@')[0] || 'Team Member',
          role: invite.role,
          joinedAt: serverTimestamp(),
        });

        // Mark as accepted in both places
        await updateDoc(doc(db, `businesses/${businessId}/invitations`, code), {
          status: 'ACCEPTED',
          acceptedBy: uid,
          acceptedAt: serverTimestamp(),
        }).catch(() => {});

        await updateDoc(doc(db, 'invitations', code), {
          status: 'ACCEPTED',
          acceptedBy: uid,
          acceptedAt: serverTimestamp(),
        }).catch(() => {});

        // Add business to user's list
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const currentBizs: string[] = userSnap.exists() ? userSnap.data()?.businessIds || [] : [];
        if (!currentBizs.includes(businessId)) {
          await setDoc(userRef, { businessIds: [...currentBizs, businessId] }, { merge: true });
        }

        return { success: true, businessId, role: invite.role };
      }
    } catch (err: any) {
      console.warn('Firestore accept invite error, checking localStore:', err);
    }
  }

  // Fallback to localStore
  invite = localStore.findInvitationByCode(code);
  if (!invite) {
    return { success: false, businessId: '', role: 'Warehouse', error: 'Invalid invitation code.' };
  }

  if (invite.status === 'ACCEPTED') {
    return { success: false, businessId: '', role: 'Warehouse', error: 'This invitation code has already been accepted.' };
  }

  localStore.addMember({
    uid,
    businessId: invite.businessId,
    email: userEmail,
    displayName: userDisplayName || 'Team Member',
    role: invite.role,
    joinedAt: new Date().toISOString(),
  });
  localStore.updateInvitationStatus(code, 'ACCEPTED');

  return { success: true, businessId: invite.businessId, role: invite.role };
}
