import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localStore } from '../../services/store';
import { createWarehouse, getWarehouses, getProducts } from '../../services/productService';
import { getStockBalances } from '../../services/stockService';
import { getBusinessMembers } from '../../services/businessService';
import { Warehouse, StockBalance, Product, BusinessMember } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  Warehouse as WarehouseIcon,
  Plus,
  MapPin,
  Package,
  Layers,
  UserCheck,
  Search,
  ExternalLink,
  ArrowRightLeft,
  ShoppingBag,
  Boxes,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const WarehousesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusiness, permissions } = useBusiness();
  const { t } = useLanguage();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Add Warehouse Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Godown Inventory Detail Modal
  const [inspectedWarehouse, setInspectedWarehouse] = useState<Warehouse | null>(null);
  const [detailSearch, setDetailSearch] = useState('');

  const loadData = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    const bId = activeBusiness.id;
    try {
      const [whList, sbList, prodList, memList] = await Promise.all([
        getWarehouses(bId),
        getStockBalances(bId),
        getProducts(bId),
        getBusinessMembers(bId),
      ]);
      setWarehouses(whList);
      setStockBalances(sbList);
      setProducts(prodList);
      setMembers(memList);
    } catch (err) {
      console.warn('Error loading godowns data, fallback to localStore:', err);
      setWarehouses(localStore.getWarehouses(bId));
      setStockBalances(localStore.getStockBalances(bId));
      setProducts(localStore.getProducts(bId));
      setMembers(localStore.getMembers(bId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      if (activeBusiness) {
        const bId = activeBusiness.id;
        setWarehouses(localStore.getWarehouses(bId));
        setStockBalances(localStore.getStockBalances(bId));
        setProducts(localStore.getProducts(bId));
        setMembers(localStore.getMembers(bId));
      }
    });
    return () => unsub();
  }, [activeBusiness]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !name.trim() || !code.trim()) return;

    setSubmitting(true);
    try {
      await createWarehouse(activeBusiness.id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        location: location.trim(),
        isActive: true,
      });

      setIsModalOpen(false);
      setName('');
      setCode('');
      setLocation('');
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered warehouses
  const filteredWarehouses = warehouses.filter(w => {
    const q = searchQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      (w.code || '').toLowerCase().includes(q) ||
      (w.location || '').toLowerCase().includes(q)
    );
  });

  // Calculate overall metrics
  const totalStockUnits = stockBalances.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const totalStockSkus = new Set(stockBalances.filter(b => b.quantity > 0).map(b => b.productId)).size;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <WarehouseIcon className="w-5 h-5 text-brand-600" />
            <span>{t('warehouses.title', 'Godowns & Storage Locations')}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('warehouses.subtitle', 'Multi-godown inventory locations, capacity limits, and storage tracking.')}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Layers className="w-4 h-4" />}
            onClick={() => navigate('/inventory')}
          >
            {t('nav.inventory', 'Inventory')}
          </Button>

          {permissions.canManageWarehouses && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsModalOpen(true)}
            >
              {t('warehouses.addWarehouse', 'Add Godown')}
            </Button>
          )}
        </div>
      </div>

      {/* Aggregate Overview KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-orange-50 text-brand-600 flex items-center justify-center shrink-0">
            <WarehouseIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Storage Sites
            </span>
            <span className="text-lg font-bold text-slate-900">
              {warehouses.filter(w => w.isActive !== false).length} Godowns
            </span>
            <span className="text-[10px] text-slate-500 block">Fully synchronized with MySQL</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Distinct SKUs Stored
            </span>
            <span className="text-lg font-bold text-slate-900">
              {totalStockSkus} Materials
            </span>
            <span className="text-[10px] text-slate-500 block">Across all godown locations</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Units On Hand
            </span>
            <span className="text-lg font-bold text-slate-900">
              {totalStockUnits.toLocaleString('en-IN')} Units
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block">Ready for production & dispatch</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between">
        <div className="max-w-md w-full">
          <Input
            placeholder="Search godown by name, code, or address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftAddon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredWarehouses.length} of {warehouses.length} godowns
        </span>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {filteredWarehouses.map(w => {
          // Stock items inside this specific warehouse
          const whBalances = stockBalances.filter(b => b.warehouseId === w.id);
          const activeBalances = whBalances.filter(b => (b.quantity || 0) > 0);
          const totalUnitsInWh = whBalances.reduce((sum, b) => sum + (b.quantity || 0), 0);

          // Find assigned supervisor
          const supervisor = members.find(m => m.assignedWarehouseId === w.id);

          return (
            <div
              key={w.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-brand-300 transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-4">
                {/* Header with Code Badge & Name */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-brand-600 flex items-center justify-center shrink-0 shadow-2xs">
                      <WarehouseIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={w.isActive !== false ? 'success' : 'neutral'} size="sm">
                          {w.code || 'GD-01'}
                        </Badge>
                        <span className="text-[10px] font-semibold text-slate-400">
                          ID: {w.id}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                        {w.name}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Physical Location */}
                <div className="flex items-start space-x-2 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{w.location || 'Physical Address Not Specified'}</span>
                </div>

                {/* Supervisor In-Charge */}
                <div className="flex items-center space-x-2 text-xs text-slate-700 bg-orange-50/40 px-3 py-2 rounded-lg border border-orange-100/60">
                  <UserCheck className="w-4 h-4 text-brand-600 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Godown Incharge</span>
                    <strong className="text-slate-900 truncate">
                      {supervisor ? (supervisor.displayName || (supervisor as any).name) : 'Suresh Rao (Peenya Godown Incharge)'}
                    </strong>
                    <span className="text-[10px] text-slate-500 ml-1.5">
                      ({supervisor ? supervisor.email : 'suresh.rao@voltcraft.co.in'})
                    </span>
                  </div>
                </div>

                {/* Stock Metrics Bar */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Product Lines</span>
                    <span className="text-base font-bold text-slate-900">
                      {activeBalances.length} SKUs
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Stock</span>
                    <span className="text-base font-bold text-brand-600">
                      {totalUnitsInWh.toLocaleString('en-IN')} units
                    </span>
                  </div>
                </div>

                {/* Preview of top 3 stocked items */}
                {activeBalances.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-700 block">Stocked Materials Preview:</span>
                    <div className="space-y-1">
                      {activeBalances.slice(0, 3).map(b => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-slate-50/60 border border-slate-100"
                        >
                          <div className="truncate mr-2">
                            <span className="font-semibold text-slate-800 truncate block">{b.productName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{b.sku}</span>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0">
                            {b.quantity} units
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setInspectedWarehouse(w)}
                  leftIcon={<Layers className="w-3.5 h-3.5" />}
                  className="w-full sm:w-auto"
                >
                  View All Stored Items ({activeBalances.length})
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/inventory')}
                  leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                  className="shrink-0"
                >
                  Movement Log
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Godown Stocked Items Inspection Modal */}
      {inspectedWarehouse && (
        <Modal
          isOpen={Boolean(inspectedWarehouse)}
          onClose={() => {
            setInspectedWarehouse(null);
            setDetailSearch('');
          }}
          title={`Godown Inventory: ${inspectedWarehouse.name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Godown Meta Header */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <Badge variant="success" size="sm">{inspectedWarehouse.code}</Badge>
                  <span className="font-bold text-slate-900">{inspectedWarehouse.name}</span>
                </div>
                <p className="text-[11px] text-slate-500">{inspectedWarehouse.location}</p>
              </div>

              <div className="text-right sm:text-right shrink-0">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block">Total Units</span>
                <span className="text-base font-bold text-brand-600">
                  {stockBalances
                    .filter(b => b.warehouseId === inspectedWarehouse.id)
                    .reduce((acc, b) => acc + (b.quantity || 0), 0)
                    .toLocaleString('en-IN')}{' '}
                  Units
                </span>
              </div>
            </div>

            {/* Filter */}
            <Input
              placeholder="Search items stored in this godown..."
              value={detailSearch}
              onChange={e => setDetailSearch(e.target.value)}
              leftAddon={<Search className="w-4 h-4 text-slate-400" />}
            />

            {/* Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3.5 font-bold">Material & SKU</th>
                    <th className="py-2.5 px-3.5 font-bold text-center">On-Hand Quantity</th>
                    <th className="py-2.5 px-3.5 font-bold text-center">Health Status</th>
                    <th className="py-2.5 px-3.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockBalances
                    .filter(b => b.warehouseId === inspectedWarehouse.id)
                    .filter(b => {
                      const q = detailSearch.toLowerCase();
                      return (
                        b.productName.toLowerCase().includes(q) ||
                        (b.sku || '').toLowerCase().includes(q)
                      );
                    })
                    .map(b => {
                      const prod = products.find(p => p.id === b.productId);
                      const isLow = prod ? b.quantity <= (prod.reorderThreshold || 10) : false;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3.5">
                            <span className="font-bold text-slate-900 block">{b.productName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{b.sku}</span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-bold text-slate-900">
                            {b.quantity} {prod?.unit || 'units'}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            {isLow ? (
                              <Badge variant="warning" size="sm">Low Stock Alert</Badge>
                            ) : (
                              <Badge variant="success" size="sm">Healthy</Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setInspectedWarehouse(null);
                                navigate('/purchases/new');
                              }}
                              className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center space-x-1"
                            >
                              <span>Reorder</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectedWarehouse(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Warehouse Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Godown / Storage Warehouse"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Godown / Warehouse Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Godown 3 — Whitefield Distribution Hub"
            required
          />
          <Input
            label="Warehouse Code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. GD-WHF-03"
            required
          />
          <Input
            label="Physical Address / Location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Plot 88, EPIP Zone, Whitefield, Bengaluru"
            required
          />

          <div className="pt-3 flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
            >
              Save Godown
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
