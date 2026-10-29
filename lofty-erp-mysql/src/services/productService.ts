import { Product, Warehouse } from '../types';
import { localStore } from './store';
import { generateId } from '../lib/utils';

const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
const API_BASE = isTestEnv ? 'http://localhost:5001/api' : '/api';

export async function getProducts(businessId: string): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE}/businesses/${businessId}/products`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        localStore.setProducts(businessId, json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('MySQL products fetch failed, using localStore fallback:', err);
  }

  return localStore.getProducts(businessId);
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

  try {
    await fetch(`${API_BASE}/businesses/${businessId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    });
  } catch (err) {
    console.warn('MySQL product write failed (retained in local cache):', err);
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

  try {
    await fetch(`${API_BASE}/businesses/${businessId}/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch (err) {
    console.warn('MySQL product update failed:', err);
  }
}

export async function getWarehouses(businessId: string): Promise<Warehouse[]> {
  try {
    const res = await fetch(`${API_BASE}/businesses/${businessId}/warehouses`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        localStore.setWarehouses(businessId, json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('MySQL warehouses fetch failed, using localStore fallback:', err);
  }

  return localStore.getWarehouses(businessId);
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

  try {
    await fetch(`${API_BASE}/businesses/${businessId}/warehouses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWarehouse),
    });
  } catch (err) {
    console.warn('MySQL warehouse write failed (retained in local cache):', err);
  }

  return newWarehouse;
}
