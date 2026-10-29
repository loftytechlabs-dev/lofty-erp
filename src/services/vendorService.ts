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
  serverTimestamp,
} from 'firebase/firestore';
import { Vendor, VendorProduct } from '../types';
import { localStore } from './store';
import { generateId } from '../lib/utils';

export async function getVendors(businessId: string): Promise<Vendor[]> {
  let list: Vendor[] = localStore.getVendors(businessId);

  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, `businesses/${businessId}/vendors`));
      if (!snap.empty) {
        const remoteVendors = snap.docs.map(d => d.data() as Vendor);
        for (const rv of remoteVendors) {
          const idx = list.findIndex(v => v.id === rv.id);
          if (idx === -1) {
            localStore.addVendor(rv);
          } else {
            localStore.updateVendor(rv);
          }
        }
        list = localStore.getVendors(businessId);
      }
    } catch (err) {
      console.warn('Firestore vendors fetch failed, using localStore:', err);
    }
  }

  return list;
}

export async function getVendorById(businessId: string, vendorId: string): Promise<Vendor | undefined> {
  const localList = localStore.getVendors(businessId);
  const found = localList.find(v => v.id === vendorId);
  if (found) return found;

  if (!isDemoMode && db) {
    try {
      const snap = await getDoc(doc(db, `businesses/${businessId}/vendors`, vendorId));
      if (snap.exists()) {
        const remoteV = snap.data() as Vendor;
        localStore.addVendor(remoteV);
        return remoteV;
      }
    } catch (err) {
      console.warn('Firestore getVendorById failed:', err);
    }
  }

  return undefined;
}

export async function createVendor(
  businessId: string,
  data: Omit<Vendor, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>
): Promise<Vendor> {
  const vendorId = generateId('ven');
  const now = new Date().toISOString();

  const newVendor: Vendor = {
    ...data,
    id: vendorId,
    businessId,
    createdAt: now,
    updatedAt: now,
  };

  // Always update local store immediately for instant UI availability
  localStore.addVendor(newVendor);

  // Sync to Firestore if configured
  if (!isDemoMode && db) {
    try {
      const ref = doc(db, `businesses/${businessId}/vendors`, vendorId);
      await setDoc(ref, {
        ...newVendor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore vendor write failed (retained in local cache):', err);
    }
  }

  return newVendor;
}

export async function updateVendor(
  businessId: string,
  vendor: Vendor
): Promise<void> {
  const updated: Vendor = {
    ...vendor,
    updatedAt: new Date().toISOString(),
  };

  localStore.updateVendor(updated);

  if (!isDemoMode && db) {
    try {
      const ref = doc(db, `businesses/${businessId}/vendors`, vendor.id);
      await updateDoc(ref, {
        ...updated,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore vendor update failed:', err);
    }
  }
}

export async function getVendorProducts(businessId: string, vendorId?: string): Promise<VendorProduct[]> {
  let list = localStore.getVendorProducts(businessId, vendorId);

  if (!isDemoMode && db) {
    try {
      const col = collection(db, `businesses/${businessId}/vendorProducts`);
      const q = vendorId ? query(col, where('vendorId', '==', vendorId)) : col;
      const snap = await getDocs(q);
      if (!snap.empty) {
        const remoteVPs = snap.docs.map(d => d.data() as VendorProduct);
        if (vendorId) {
          localStore.setVendorProducts(businessId, vendorId, remoteVPs);
        }
        list = localStore.getVendorProducts(businessId, vendorId);
      }
    } catch (err) {
      console.warn('Firestore vendorProducts fetch failed:', err);
    }
  }

  return list;
}

export async function saveVendorProducts(
  businessId: string,
  vendorId: string,
  associations: (Omit<VendorProduct, 'id' | 'businessId' | 'vendorId' | 'createdAt'> & { id?: string; createdAt?: string })[]
): Promise<VendorProduct[]> {
  const fullList: VendorProduct[] = associations.map(a => ({
    ...a,
    id: a.id || generateId('vp'),
    businessId,
    vendorId,
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  localStore.setVendorProducts(businessId, vendorId, fullList);

  if (!isDemoMode && db) {
    try {
      for (const item of fullList) {
        const ref = doc(db, `businesses/${businessId}/vendorProducts`, item.id);
        await setDoc(ref, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('Firestore vendor product save failed:', err);
    }
  }

  return fullList;
}

export async function upsertVendorProduct(
  businessId: string,
  vendorId: string,
  productData: Omit<VendorProduct, 'id' | 'businessId' | 'vendorId' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<VendorProduct> {
  const existingList = await getVendorProducts(businessId, vendorId);
  const now = new Date().toISOString();

  let targetId = productData.id;
  const isExisting = targetId && existingList.some(vp => vp.id === targetId);

  if (!targetId || !isExisting) {
    targetId = targetId || generateId('vp');
  }

  const updatedItem: VendorProduct = {
    ...productData,
    id: targetId,
    businessId,
    vendorId,
    createdAt: productData.createdAt || now,
    updatedAt: now,
  };

  const newList = isExisting
    ? existingList.map(vp => (vp.id === targetId ? updatedItem : vp))
    : [...existingList.filter(vp => vp.productId !== productData.productId), updatedItem];

  await saveVendorProducts(businessId, vendorId, newList);
  return updatedItem;
}

export async function deleteVendorProduct(
  businessId: string,
  vendorId: string,
  vendorProductId: string
): Promise<void> {
  const existingList = await getVendorProducts(businessId, vendorId);
  const filtered = existingList.filter(vp => vp.id !== vendorProductId);
  await saveVendorProducts(businessId, vendorId, filtered);
}
