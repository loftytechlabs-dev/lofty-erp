import {
  Business,
  Product,
  Vendor,
  VendorProduct,
  PurchaseOrder,
  Delivery,
  SupplierBill,
  StockBalance,
  Warehouse,
  CanvasWidget,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

// 0. User Accounts & Google Auth Sync
export async function syncMySQLUser(user: {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  providerId?: string;
}): Promise<any> {
  try {
    return await fetchJson(`${API_BASE}/users`, {
      method: 'POST',
      body: JSON.stringify(user),
    });
  } catch (err) {
    console.warn('MySQL syncUser error:', err);
    return null;
  }
}

export async function getMySQLUser(uid: string): Promise<any> {
  try {
    return await fetchJson(`${API_BASE}/users/${uid}`);
  } catch (err) {
    return null;
  }
}

// 1. Businesses
export async function getMySQLBusinesses(): Promise<Business[]> {
  try {
    return await fetchJson<Business[]>(`${API_BASE}/businesses`);
  } catch (err) {
    console.warn('MySQL getBusinesses fallback:', err);
    return [];
  }
}

export async function createMySQLBusiness(business: Partial<Business>): Promise<string> {
  const res = await fetchJson<{ success: boolean; id: string }>(`${API_BASE}/businesses`, {
    method: 'POST',
    body: JSON.stringify(business),
  });
  return res.id;
}

// 2. Warehouses
export async function getMySQLWarehouses(businessId: string): Promise<Warehouse[]> {
  try {
    return await fetchJson<Warehouse[]>(`${API_BASE}/businesses/${businessId}/warehouses`);
  } catch (err) {
    return [];
  }
}

// 3. Products
export async function getMySQLProducts(businessId: string): Promise<Product[]> {
  try {
    return await fetchJson<Product[]>(`${API_BASE}/businesses/${businessId}/products`);
  } catch (err) {
    return [];
  }
}

export async function createMySQLProduct(businessId: string, product: Partial<Product>): Promise<string> {
  const res = await fetchJson<{ success: boolean; id: string }>(`${API_BASE}/businesses/${businessId}/products`, {
    method: 'POST',
    body: JSON.stringify(product),
  });
  return res.id;
}

// 4. Vendors
export async function getMySQLVendors(businessId: string): Promise<Vendor[]> {
  try {
    return await fetchJson<Vendor[]>(`${API_BASE}/businesses/${businessId}/vendors`);
  } catch (err) {
    return [];
  }
}

export async function createMySQLVendor(businessId: string, vendor: Partial<Vendor>): Promise<string> {
  const res = await fetchJson<{ success: boolean; id: string }>(`${API_BASE}/businesses/${businessId}/vendors`, {
    method: 'POST',
    body: JSON.stringify(vendor),
  });
  return res.id;
}

// 5. Vendor Products
export async function getMySQLVendorProducts(businessId: string): Promise<VendorProduct[]> {
  try {
    return await fetchJson<VendorProduct[]>(`${API_BASE}/businesses/${businessId}/vendor-products`);
  } catch (err) {
    return [];
  }
}

// 6. Purchase Orders
export async function getMySQLPurchaseOrders(businessId: string): Promise<PurchaseOrder[]> {
  try {
    return await fetchJson<PurchaseOrder[]>(`${API_BASE}/businesses/${businessId}/purchase-orders`);
  } catch (err) {
    return [];
  }
}

export async function createMySQLPurchaseOrder(businessId: string, po: Partial<PurchaseOrder>): Promise<string> {
  const res = await fetchJson<{ success: boolean; id: string }>(`${API_BASE}/businesses/${businessId}/purchase-orders`, {
    method: 'POST',
    body: JSON.stringify(po),
  });
  return res.id;
}

// 7. Deliveries
export async function getMySQLDeliveries(businessId: string): Promise<Delivery[]> {
  try {
    return await fetchJson<Delivery[]>(`${API_BASE}/businesses/${businessId}/deliveries`);
  } catch (err) {
    return [];
  }
}

// 8. Stock Balances
export async function getMySQLStockBalances(businessId: string): Promise<StockBalance[]> {
  try {
    return await fetchJson<StockBalance[]>(`${API_BASE}/businesses/${businessId}/stock-balances`);
  } catch (err) {
    return [];
  }
}

// 9. Supplier Bills
export async function getMySQLBills(businessId: string): Promise<SupplierBill[]> {
  try {
    return await fetchJson<SupplierBill[]>(`${API_BASE}/businesses/${businessId}/bills`);
  } catch (err) {
    return [];
  }
}

// 10. Canvas Widgets Layout
export async function getMySQLCanvasWidgets(businessId: string): Promise<CanvasWidget[] | null> {
  try {
    const list = await fetchJson<CanvasWidget[]>(`${API_BASE}/businesses/${businessId}/canvas-widgets`);
    return list.length > 0 ? list : null;
  } catch (err) {
    return null;
  }
}

export async function saveMySQLCanvasWidgets(businessId: string, widgets: CanvasWidget[]): Promise<void> {
  try {
    await fetchJson(`${API_BASE}/businesses/${businessId}/canvas-widgets`, {
      method: 'POST',
      body: JSON.stringify({ widgets }),
    });
  } catch (err) {
    console.warn('saveMySQLCanvasWidgets fallback:', err);
  }
}
