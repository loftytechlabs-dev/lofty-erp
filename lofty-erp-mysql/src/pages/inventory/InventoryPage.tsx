import React, { useState, useEffect } from 'react';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localStore } from '../../services/store';
import { recordStockAdjustment, recordStockTransfer, getStockBalances, getStockMovements } from '../../services/stockService';
import { getProducts, getWarehouses } from '../../services/productService';
import { StockBalance, StockMovement, Product, Warehouse } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { formatDate, formatDateTime } from '../../lib/utils';
import {
  Package,
  Layers,
  SlidersHorizontal,
  ArrowRightLeft,
  Plus,
  Minus,
  Search,
  Warehouse as WarehouseIcon,
  Clock,
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { activeBusiness, permissions } = useBusiness();
  const { user } = useAuth();
  const { t, formatDateTime } = useLanguage();

  const [activeTab, setActiveTab] = useState<'balances' | 'movements'>('balances');
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');

  // Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustWarehouseId, setAdjustWarehouseId] = useState('');
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT_ADD' | 'ADJUSTMENT_SUBTRACT'>('ADJUSTMENT_ADD');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferProductId, setTransferProductId] = useState('');
  const [transferFromWhId, setTransferFromWhId] = useState('');
  const [transferToWhId, setTransferToWhId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const loadData = async () => {
    if (!activeBusiness) return;
    const bId = activeBusiness.id;
    try {
      const [bals, movs, prods, whs] = await Promise.all([
        getStockBalances(bId),
        getStockMovements(bId),
        getProducts(bId),
        getWarehouses(bId),
      ]);
      setStockBalances(bals);
      setStockMovements(movs);
      setProducts(prods);
      setWarehouses(whs);
    } catch {
      setStockBalances(localStore.getStockBalances(bId));
      setStockMovements(localStore.getStockMovements(bId));
      setProducts(localStore.getProducts(bId));
      setWarehouses(localStore.getWarehouses(bId));
    }
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      if (activeBusiness) {
        const bId = activeBusiness.id;
        setStockBalances(localStore.getStockBalances(bId));
        setStockMovements(localStore.getStockMovements(bId));
        setProducts(localStore.getProducts(bId));
        setWarehouses(localStore.getWarehouses(bId));
      }
    });
    return () => unsub();
  }, [activeBusiness]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !user || !adjustProductId || !adjustWarehouseId || adjustQty <= 0) return;

    const prod = products.find(p => p.id === adjustProductId);
    if (!prod) return;

    setAdjusting(true);
    try {
      await recordStockAdjustment(
        activeBusiness.id,
        prod,
        adjustWarehouseId,
        adjustType,
        adjustQty,
        adjustReason.trim(),
        user.uid
      );
      setAdjustModalOpen(false);
      setAdjustQty(1);
      setAdjustReason('');
    } catch (err) {
      console.error(err);
    } finally {
      setAdjusting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    if (!activeBusiness || !user || !transferProductId || !transferFromWhId || !transferToWhId || transferQty <= 0) return;

    const prod = products.find(p => p.id === transferProductId);
    if (!prod) return;

    setTransferring(true);
    try {
      const res = await recordStockTransfer(
        activeBusiness.id,
        prod,
        transferFromWhId,
        transferToWhId,
        transferQty,
        transferNotes.trim(),
        user.uid
      );
      if (!res.success) {
        setTransferError(res.error || 'Failed to complete stock transfer');
        return;
      }
      setTransferModalOpen(false);
      setTransferQty(1);
      setTransferNotes('');
      loadData();
    } catch (err: any) {
      setTransferError(err?.message || 'Stock transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  // Group balances by product or filter
  const filteredBalances = stockBalances.filter(b => {
    const matchQ =
      b.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchW = selectedWarehouseFilter === 'ALL' || b.warehouseId === selectedWarehouseFilter;
    return matchQ && matchW;
  });

  const filteredMovements = stockMovements.filter(m =>
    m.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('inventory.title', 'Inventory & Stock Tracking')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('inventory.subtitle', 'Real-time physical stock counts by godown and atomic ledger movement history.')}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {permissions.canVerifyDelivery && (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ArrowRightLeft className="w-4 h-4" />}
                onClick={() => {
                  if (products.length > 0) setTransferProductId(products[0].id);
                  if (warehouses.length > 0) setTransferFromWhId(warehouses[0].id);
                  if (warehouses.length > 1) setTransferToWhId(warehouses[1].id);
                  setTransferError(null);
                  setTransferModalOpen(true);
                }}
              >
                {t('inventory.transferStock', 'Transfer Stock')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<SlidersHorizontal className="w-4 h-4" />}
                onClick={() => {
                  if (products.length > 0) setAdjustProductId(products[0].id);
                  if (warehouses.length > 0) setAdjustWarehouseId(warehouses[0].id);
                  setAdjustModalOpen(true);
                }}
              >
                {t('inventory.adjustStock', 'Manual Adjustment')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('balances')}
          className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'balances'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t('inventory.balances', 'Current Stock Balances')}</span>
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'movements'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('inventory.movements', 'Movement Audit Log')}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="max-w-md w-full">
          <Input
            placeholder="Search material by name or SKU..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftAddon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        {activeTab === 'balances' && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Filter Godown:</span>
            <select
              value={selectedWarehouseFilter}
              onChange={e => setSelectedWarehouseFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-md bg-white px-2 py-1.5 text-slate-800"
            >
              <option value="ALL">All Warehouses / Godowns</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: Stock Balances Table */}
      {activeTab === 'balances' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Product Name & Category</th>
                  <th className="py-2.5 px-4 font-semibold">SKU Code</th>
                  <th className="py-2.5 px-4 font-semibold">Storage Godown</th>
                  <th className="py-2.5 px-4 font-semibold text-center">In Stock Count</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBalances.map(b => {
                  const prod = products.find(p => p.id === b.productId);
                  const wh = warehouses.find(w => w.id === b.warehouseId);
                  const isLow = prod ? b.quantity <= prod.reorderThreshold : false;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {b.productName}
                        <div className="text-[10px] text-slate-400">{prod?.category || 'General'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">{b.sku}</td>
                      <td className="py-3 px-4 text-slate-600">{wh?.name || 'Godown'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold text-sm ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                          {b.quantity} {prod?.unit || 'Units'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isLow ? (
                          <Badge variant="warning" size="sm">Low Stock Limit</Badge>
                        ) : (
                          <Badge variant="success" size="sm">Adequate</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDateTime(b.lastUpdated)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredBalances.length === 0 && (
            <div className="text-center py-12 text-xs text-slate-400">
              No stock balances recorded yet. Complete physical delivery verification to add received goods into warehouse inventory.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Stock Movements Audit Table */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Product & SKU</th>
                  <th className="py-2.5 px-4 font-semibold">Godown</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Type</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Quantity Delta</th>
                  <th className="py-2.5 px-4 font-semibold">Audit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map(m => {
                  const wh = warehouses.find(w => w.id === m.warehouseId);
                  const isPositive = m.quantity > 0;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDateTime(m.timestamp)}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {m.productName}
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {m.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{wh?.name || 'Godown'}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="neutral" size="sm">{m.type.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 italic">{m.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredMovements.length === 0 && (
            <div className="text-center py-12 text-xs text-slate-400">
              No stock movements logged.
            </div>
          )}
        </div>
      )}

      {/* Manual Stock Reconciliation Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Manual Stock Reconciliation"
        maxWidth="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Record a physical stock adjustment for count reconciliation or write-offs. This will append a permanent entry to the movement audit log.
          </p>

          <Select
            label="Product to Adjust"
            value={adjustProductId}
            onChange={e => setAdjustProductId(e.target.value)}
            options={products.map(p => ({
              value: p.id,
              label: `${p.name} (${p.sku})`,
            }))}
            required
          />

          <Select
            label="Godown Location"
            value={adjustWarehouseId}
            onChange={e => setAdjustWarehouseId(e.target.value)}
            options={warehouses.map(w => ({
              value: w.id,
              label: w.name,
            }))}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Adjustment Action"
              value={adjustType}
              onChange={e => setAdjustType(e.target.value as any)}
              options={[
                { value: 'ADJUSTMENT_ADD', label: 'Add Stock (+)' },
                { value: 'ADJUSTMENT_SUBTRACT', label: 'Subtract / Write-off (-)' },
              ]}
            />
            <Input
              label="Quantity"
              type="number"
              min="1"
              value={adjustQty}
              onChange={e => setAdjustQty(parseInt(e.target.value) || 1)}
              required
            />
          </div>

          <Input
            label="Audit Justification / Reason"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            placeholder="e.g. Annual physical inventory audit reconciliation."
            required
          />

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={adjusting}>
              Save Stock Adjustment
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Inter-Godown Stock Transfer */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Inter-Godown Stock Transfer"
        maxWidth="md"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Transfer verified physical stock between godowns. Stock will decrease at the source location and increase at the destination. Total enterprise balance remains unchanged.
          </p>

          {transferError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {transferError}
            </div>
          )}

          <Select
            label="Product Material to Transfer"
            value={transferProductId}
            onChange={e => setTransferProductId(e.target.value)}
            options={products.map(p => ({
              value: p.id,
              label: `${p.name} (${p.sku})`,
            }))}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Source Godown (From)"
              value={transferFromWhId}
              onChange={e => setTransferFromWhId(e.target.value)}
              options={warehouses.map(w => ({
                value: w.id,
                label: w.name,
              }))}
              required
            />

            <Select
              label="Destination Godown (To)"
              value={transferToWhId}
              onChange={e => setTransferToWhId(e.target.value)}
              options={warehouses.map(w => ({
                value: w.id,
                label: w.name,
              }))}
              required
            />
          </div>

          {/* Current Source Balance Info */}
          {(() => {
            const sourceBal = stockBalances.find(
              b => b.productId === transferProductId && b.warehouseId === transferFromWhId
            );
            const selProd = products.find(p => p.id === transferProductId);
            return (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between">
                <span className="text-slate-500">Available at Source Godown:</span>
                <strong className={sourceBal && sourceBal.quantity > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {sourceBal ? `${sourceBal.quantity} ${selProd?.unit || ''}` : '0 units'}
                </strong>
              </div>
            );
          })()}

          <Input
            label="Transfer Quantity"
            type="number"
            min="1"
            value={transferQty}
            onChange={e => setTransferQty(parseInt(e.target.value) || 1)}
            required
          />

          <Input
            label="Transfer Reference / Remarks"
            value={transferNotes}
            onChange={e => setTransferNotes(e.target.value)}
            placeholder="e.g. Dispatched to Plant 2 Assembly via Internal Transit Slip #441"
            required
          />

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={transferring}>
              Execute Stock Transfer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
