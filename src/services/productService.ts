import { db, isDemoMode } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Product, Warehouse } from '../types';
import { localStore } from './store';
import { generateId } from '../lib/utils';

export async function getProducts(businessId: string): Promise<Product[]> {
  let list = localStore.getProducts(businessId);

  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, `businesses/${businessId}/products`));
      if (!snap.empty) {
        const remoteProds = snap.docs.map(d => d.data() as Product);
        for (const rp of remoteProds) {
          const idx = list.findIndex(p => p.id === rp.id);
          if (idx === -1) {
            localStore.addProduct(rp);
          } else {
            localStore.updateProduct(rp);
          }
        }
        list = localStore.getProducts(businessId);
      }
    } catch (err) {
      console.warn('Firestore products fetch failed, using localStore:', err);
    }
  }

  return list;
}

export async function createProduct(
  businessId: string,
  data: Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>
): Promise<Product> {
  const productId = generateId('prod');
  const now = new Date().toISOString();

  const newProduct: Product = {
    ...data,
    id: productId,
    businessId,
    createdAt: now,
    updatedAt: now,
  };

  localStore.addProduct(newProduct);

  if (!isDemoMode && db) {
    try {
      const ref = doc(db, `businesses/${businessId}/products`, productId);
      await setDoc(ref, {
        ...newProduct,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore product write failed (cached in localStore):', err);
    }
  }

  return newProduct;
}

export async function updateProduct(
  businessId: string,
  product: Product
): Promise<void> {
  const updated: Product = {
    ...product,
    updatedAt: new Date().toISOString(),
  };

  localStore.updateProduct(updated);

  if (!isDemoMode && db) {
    try {
      const ref = doc(db, `businesses/${businessId}/products`, product.id);
      await updateDoc(ref, {
        ...updated,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore product update failed:', err);
    }
  }
}

export async function getWarehouses(businessId: string): Promise<Warehouse[]> {
  let list = localStore.getWarehouses(businessId);

  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, `businesses/${businessId}/warehouses`));
      if (!snap.empty) {
        const remoteWHs = snap.docs.map(d => d.data() as Warehouse);
        for (const rwh of remoteWHs) {
          if (!list.find(w => w.id === rwh.id)) {
            localStore.addWarehouse(rwh);
          }
        }
        list = localStore.getWarehouses(businessId);
      }
    } catch (err) {
      console.warn('Firestore warehouses fetch failed, using localStore:', err);
    }
  }

  return list;
}

export async function createWarehouse(
  businessId: string,
  data: Omit<Warehouse, 'id' | 'businessId' | 'createdAt'>
): Promise<Warehouse> {
  const warehouseId = generateId('wh');
  const now = new Date().toISOString();

  const newWarehouse: Warehouse = {
    ...data,
    id: warehouseId,
    businessId,
    createdAt: now,
  };

  localStore.addWarehouse(newWarehouse);

  if (!isDemoMode && db) {
    try {
      const ref = doc(db, `businesses/${businessId}/warehouses`, warehouseId);
      await setDoc(ref, {
        ...newWarehouse,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore warehouse write failed (cached in localStore):', err);
    }
  }

  return newWarehouse;
}
