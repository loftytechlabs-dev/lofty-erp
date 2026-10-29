import React, { useState, useMemo } from 'react';
import { Product, StockBalance, Warehouse, VendorProduct } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { BarChart3, Boxes, Warehouse as WarehouseIcon, Layers } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface InventoryBarChartProps {
  products: Product[];
  stockBalances: StockBalance[];
  warehouses?: Warehouse[];
  vendorProducts?: VendorProduct[];
  currencySymbol?: string;
}

export const InventoryBarChart: React.FC<InventoryBarChartProps> = ({
  products,
  stockBalances,
  warehouses = [],
  vendorProducts = [],
  currencySymbol = '₹',
}) => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'MATERIALS' | 'GODOWNS'>('MATERIALS');
  const [hoveredBar, setHoveredBar] = useState<any | null>(null);

  // Group balances by product
  const productBars = useMemo(() => {
    const map = new Map<string, { product: Product; quantity: number; valuation: number }>();

    products.forEach(p => {
      map.set(p.id, { product: p, quantity: 0, valuation: 0 });
    });

    stockBalances.forEach(sb => {
      const entry = map.get(sb.productId);
      if (entry) {
        entry.quantity += sb.quantity;
      }
    });

    // Compute valuation with vendor rate
    const items = Array.from(map.values()).map(e => {
      const vp = vendorProducts.find(v => v.productId === e.product.id && v.isActive);
      const unitPrice = vp ? vp.vendorPrice : 250;
      return {
        id: e.product.id,
        name: e.product.name,
        sku: e.product.sku,
        unit: e.product.unit || 'Units',
        quantity: e.quantity,
        valuation: e.quantity * unitPrice,
        reorderThreshold: e.product.reorderThreshold || 10,
        isLow: e.quantity <= (e.product.reorderThreshold || 10),
      };
    });

    return items.sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  }, [products, stockBalances, vendorProducts]);

  // Group balances by Godown
  const godownBars = useMemo(() => {
    const list = warehouses.map(wh => {
      const whBalances = stockBalances.filter(sb => sb.warehouseId === wh.id);
      const totalUnits = whBalances.reduce((sum, b) => sum + b.quantity, 0);
      const skuCount = whBalances.filter(b => b.quantity > 0).length;

      return {
        id: wh.id,
        name: wh.name,
        code: wh.code || 'GD',
        quantity: totalUnits,
        skuCount,
        capacity: 1000,
        percent: Math.min(100, Math.round((totalUnits / 1000) * 100)),
      };
    });

    return list;
  }, [warehouses, stockBalances]);

  // Max value for bar scaling
  const maxMatQty = Math.max(...productBars.map(b => b.quantity), 10);
  const totalUnits = stockBalances.reduce((sum, b) => sum + b.quantity, 0);

  const barColors = [
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-orange-500 to-amber-600',
    'from-purple-500 to-violet-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600',
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {t('dashboard.stockDistribution', 'Stock Distribution Chart')}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {t('dashboard.stockDistributionSubtitle', 'Inventory levels & godown storage capacity')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setViewMode('MATERIALS')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'MATERIALS'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('dashboard.byMaterial', 'By Material')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GODOWNS')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'GODOWNS'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('dashboard.byGodown', 'By Godown')}
            </button>
          </div>
        </div>

        {/* Top KPI Stat Line */}
        <div className="flex items-baseline space-x-3 mt-3">
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            {totalUnits.toLocaleString('en-IN')} Units
          </span>
          <span className="text-xs font-semibold text-emerald-600">
            Across {products.length} catalog materials
          </span>
          <span className="text-xs text-slate-400">
            {warehouses.length || 2} active receiving sites
          </span>
        </div>
      </div>

      {/* Dedicated Stable Tooltip / Info Banner Slot (Prevents layout shift and hover shaking) */}
      <div className="h-7 mt-2 flex items-center justify-center pointer-events-none select-none">
        {hoveredBar && viewMode === 'MATERIALS' ? (
          <div className="bg-slate-900 text-white text-[11px] py-0.5 px-3 rounded-md shadow-md border border-slate-700/60 flex items-center space-x-2 animate-in fade-in duration-100 whitespace-nowrap">
            <span className="font-bold text-blue-300">{hoveredBar.name}:</span>
            <span className="text-slate-200">{hoveredBar.quantity} {hoveredBar.unit}</span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-emerald-400 font-semibold">{formatCurrency(hoveredBar.valuation, currencySymbol)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 font-medium">Hover over any material bar for inventory &amp; valuation breakdown</span>
        )}
      </div>

      {/* Main Bar Chart Rendering Canvas */}
      <div className="mb-3 flex-1 flex items-end justify-center min-h-[155px] relative">
        {viewMode === 'MATERIALS' ? (
          <div className="w-full flex items-end justify-between gap-3 px-2 pt-2 pb-1">
            {productBars.map((bar, idx) => {
              const heightPct = Math.max(12, Math.round((bar.quantity / maxMatQty) * 100));
              const colorClass = barColors[idx % barColors.length];

              return (
                <div
                  key={bar.id}
                  className="flex-1 flex flex-col items-center group relative cursor-pointer select-none"
                  onMouseEnter={() => setHoveredBar(bar)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Quantity label above bar */}
                  <span className="text-[10px] font-bold text-slate-700 mb-1 opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {bar.quantity}
                  </span>

                  {/* Vertical Bar (Shake-free, opacity-only transition) */}
                  <div className="w-full max-w-[42px] bg-slate-100 rounded-t-lg overflow-hidden h-32 flex items-end pointer-events-none">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full bg-gradient-to-t ${colorClass} rounded-t-lg transition-opacity duration-150 group-hover:opacity-85 shadow-xs`}
                    />
                  </div>

                  {/* SKU / Label below bar */}
                  <span className="text-[10px] font-mono text-slate-500 mt-1.5 truncate max-w-[54px] text-center pointer-events-none" title={bar.name}>
                    {bar.sku.replace('EL-', '')}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full space-y-3.5 px-2 py-2">
            {godownBars.map(g => (
              <div key={g.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <WarehouseIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-bold text-slate-800">{g.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">{g.quantity} units</span>
                    <span className="text-[10px] text-slate-400">({g.skuCount} SKUs)</span>
                  </div>
                </div>

                {/* Horizontal Capacity Bar */}
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    style={{ width: `${g.percent}%` }}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Capacity utilization: {g.percent}%</span>
                  <span>Cap limit: {g.capacity} units</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Snapshot */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>{t('dashboard.stockValuation', 'Stock Valuation:')} <strong className="text-slate-800">{formatCurrency(productBars.reduce((s, b) => s + b.valuation, 0), currencySymbol)}</strong></span>
        <span>{t('dashboard.reorderAlerts', 'Reorder alerts:')} <strong className="text-amber-600 font-semibold">{t('dashboard.itemsLow', '{{count}} items low', { count: productBars.filter(b => b.isLow).length })}</strong></span>
      </div>
    </div>
  );
};
