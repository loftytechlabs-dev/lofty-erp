import { db, isDemoMode } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { StockBalance, StockMovement, MovementType, Product } from '../types';
import { localStore } from './store';
import { generateId } from '../lib/utils';

export async function getStockBalances(businessId: string): Promise<StockBalance[]> {
  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, `businesses/${businessId}/stockBalances`));
      return snap.docs.map(d => d.data() as StockBalance);
    } catch (err) {
      console.warn('Firestore stockBalances fetch failed, using localStore:', err);
    }
  }
  return localStore.getStockBalances(businessId);
}

export async function getStockMovements(businessId: string): Promise<StockMovement[]> {
  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, `businesses/${businessId}/stockMovements`));
      return snap.docs.map(d => d.data() as StockMovement);
    } catch (err) {
      console.warn('Firestore stockMovements fetch failed, using localStore:', err);
    }
  }
  return localStore.getStockMovements(businessId);
}

export async function recordStockAdjustment(
  businessId: string,
  product: Product,
  warehouseId: string,
  adjustmentType: 'ADJUSTMENT_ADD' | 'ADJUSTMENT_SUBTRACT',
  quantity: number,
  reason: string,
  actorUid: string
): Promise<{ success: boolean; movement: StockMovement }> {
  const now = new Date().toISOString();
  const movementId = generateId('mov');
  const delta = adjustmentType === 'ADJUSTMENT_ADD' ? Math.abs(quantity) : -Math.abs(quantity);

  const movement: StockMovement = {
    id: movementId,
    businessId,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    warehouseId,
    type: adjustmentType,
    quantity: delta,
    referenceType: 'MANUAL',
    actorUid,
    timestamp: now,
    notes: reason || 'Manual stock reconciliation adjustment',
  };

  localStore.addStockMovementAndBalance(movement);

  localStore.addAuditLog({
    id: generateId('audit'),
    businessId,
    entityType: 'STOCK_ADJUSTMENT',
    entityId: movementId,
    actorUid,
    details: {
      productId: product.id,
      productName: product.name,
      warehouseId,
      delta,
      reason,
    },
    timestamp: now,
  });

  return { success: true, movement };
}

/**
 * Inter-Godown Stock Transfer
 * Decreases stock at source godown and increases stock at destination godown.
 * Net change across entire business remains zero.
 * Validates sufficient balance at source and prevents self-transfers.
 */
export async function recordStockTransfer(
  businessId: string,
  product: Product,
  fromWarehouseId: string,
  toWarehouseId: string,
  quantity: number,
  notes: string,
  actorUid: string
): Promise<{ success: boolean; error?: string }> {
  if (fromWarehouseId === toWarehouseId) {
    return { success: false, error: 'Source and destination godowns must be different.' };
  }
  const qty = Math.max(0, quantity);
  if (qty <= 0) {
    return { success: false, error: 'Transfer quantity must be greater than zero.' };
  }

  // Check available stock at source
  const currentBalances = localStore.getStockBalances(businessId);
  const sourceBalance = currentBalances.find(
    b => b.productId === product.id && b.warehouseId === fromWarehouseId
  );
  if (!sourceBalance || sourceBalance.quantity < qty) {
    return {
      success: false,
      error: `Insufficient stock in source godown. Available: ${sourceBalance?.quantity || 0} ${product.unit}`,
    };
  }

  const now = new Date().toISOString();
  const transferId = generateId('transfer');

  const warehouses = localStore.getWarehouses(businessId);
  const fromWh = warehouses.find(w => w.id === fromWarehouseId);
  const toWh = warehouses.find(w => w.id === toWarehouseId);

  // Outbound movement from source
  const outMovement: StockMovement = {
    id: `${transferId}_out`,
    businessId,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    warehouseId: fromWarehouseId,
    type: 'STOCK_TRANSFER',
    quantity: -qty,
    referenceType: 'MANUAL',
    referenceId: transferId,
    actorUid,
    timestamp: now,
    notes: `Transfer to ${toWh?.name || 'Godown'}: ${notes || 'Inter-godown transfer'}`,
  };

  // Inbound movement to destination
  const inMovement: StockMovement = {
    id: `${transferId}_in`,
    businessId,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    warehouseId: toWarehouseId,
    type: 'STOCK_TRANSFER',
    quantity: qty,
    referenceType: 'MANUAL',
    referenceId: transferId,
    actorUid,
    timestamp: now,
    notes: `Transfer from ${fromWh?.name || 'Godown'}: ${notes || 'Inter-godown transfer'}`,
  };

  localStore.addStockMovementAndBalance(outMovement);
  localStore.addStockMovementAndBalance(inMovement);

  localStore.addAuditLog({
    id: generateId('audit'),
    businessId,
    entityType: 'STOCK_TRANSFER',
    entityId: transferId,
    actorUid,
    details: {
      productId: product.id,
      productName: product.name,
      fromWarehouseId,
      fromWarehouseName: fromWh?.name,
      toWarehouseId,
      toWarehouseName: toWh?.name,
      quantity: qty,
      notes,
    },
    timestamp: now,
  });

  return { success: true };
}
