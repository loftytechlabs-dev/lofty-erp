import { Vendor, VendorProduct } from '../types';
import { localStore } from './store';
import { generateId } from '../lib/utils';

const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
const API_BASE = isTestEnv ? 'http://localhost:5001/api' : '/api';

export async function getVendors(businessId: string): Promise<Vendor[]> {
  try {
    const res = await fetch(`${API_BASE}/businesses/${businessId}/vendors`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        localStore.setVendors(businessId, json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('MySQL fetch vendors failed, using localStore fallback:', err);
  }

  return localStore.getVendors(businessId);
}

export async function getVendorById(businessId: string, vendorId: string): Promise<Vendor | undefined> {
  const localList = localStore.getVendors(businessId);
  const found = localList.find(v => v.id === vendorId);
  if (found) return found;

  const all = await getVendors(businessId);
  return all.find(v => v.id === vendorId);
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

  // Immediate local cache for reactive UI
  localStore.addVendor(newVendor);

  try {
    const res = await fetch(`${API_BASE}/businesses/${businessId}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVendor),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      if (errJson?.error) {
        // Rollback localStore cache if API validation rejected it
        const current = localStore.getVendors(businessId).filter(v => v.id !== vendorId);
        // localStore does not have removeVendor, but we can avoid persisting
        throw new Error(errJson.error);
      }
    }
  } catch (err: any) {
    if (err?.message && !err.message.includes('fetch')) {
      throw err;
    }
    console.warn('MySQL vendor insert failed (retained in local cache):', err);
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

  try {
    const res = await fetch(`${API_BASE}/businesses/${businessId}/vendors/${vendor.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      if (errJson?.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (err: any) {
    if (err?.message && !err.message.includes('fetch')) {
      throw err;
    }
    console.warn('MySQL vendor update failed:', err);
  }
}

export async function getVendorProducts(businessId: string, vendorId?: string): Promise<VendorProduct[]> {
  try {
    const res = await fetch(`${API_BASE}/businesses/${businessId}/vendor-products`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const list: VendorProduct[] = json.data;
        if (vendorId) {
          const filtered = list.filter(vp => vp.vendorId === vendorId);
          localStore.setVendorProducts(businessId, vendorId, filtered);
          return filtered;
        }
        return list;
      }
    }
  } catch (err) {
    console.warn('MySQL vendorProducts fetch failed:', err);
  }

  return localStore.getVendorProducts(businessId, vendorId);
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

  for (const item of fullList) {
    try {
      await fetch(`${API_BASE}/businesses/${businessId}/vendor-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
    } catch (err) {
      console.warn('MySQL vendor product save failed:', err);
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
  try {
    await fetch(`${API_BASE}/businesses/${businessId}/vendor-products/${vendorProductId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('MySQL vendor product delete failed:', err);
  }

  const existingList = await getVendorProducts(businessId, vendorId);
  const filtered = existingList.filter(vp => vp.id !== vendorProductId);
  localStore.setVendorProducts(businessId, vendorId, filtered);
}
