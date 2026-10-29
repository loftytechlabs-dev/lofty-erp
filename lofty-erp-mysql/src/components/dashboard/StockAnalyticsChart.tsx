import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, StockBalance, VendorProduct, Warehouse } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../common/Button';
import {
  Package,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ArrowRight,
} from 'lucide-react';

interface StockAnalyticsChartProps {
  products: Product[];
  stockBalances: StockBalance[];
  vendorProducts: VendorProduct[];
  warehouses?: Warehouse[];
  currencySymbol?: string;
}

type StockViewMode = 'STOCK_VS_REORDER' | 'STOCK_VALUE' | 'GODOWN_SPLIT';

export const StockAnalyticsChart: React.FC<StockAnalyticsChartProps> = ({
  products,
  stockBalances,
  vendorProducts,
  warehouses = [],
  currencySymbol = '₹',
}) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<StockViewMode>('STOCK_VS_REORDER');

  // Compute stock per product across all godowns
  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stockBalances.forEach(sb => {
      const cur = map.get(sb.productId) || 0;
      map.set(sb.productId, cur + sb.quantity);
    });
    return map;
  }, [stockBalances]);

  // Compute total units in stock
  const totalStockUnits = useMemo(() => {
    return stockBalances.reduce((acc, sb) => acc + sb.quantity, 0);
  }, [stockBalances]);

  // Product stock items with status and estimated unit prices
  const productStockList = useMemo(() => {
    return products.map(prod => {
      const quantity = stockMap.get(prod.id) || 0;
      const threshold = prod.reorderThreshold || 1;

      // Find unit price from catalog
      const vp = vendorProducts.find(v => v.productId === prod.id && v.isActive);
      const unitPrice = vp ? vp.vendorPrice : 0;
      const stockValue = quantity * unitPrice;

      let status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'HEALTHY';
      if (quantity <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (quantity <= threshold) {
        status = 'LOW_STOCK';
      }

      return {
        product: prod,
        quantity,
        threshold,
        unitPrice,
        stockValue,
        status,
      };
    });
  }, [products, stockMap, vendorProducts]);

  // Total valuation
  const totalStockValuation = useMemo(() => {
    return productStockList.reduce((acc, item) => acc + item.stockValue, 0);
  }, [productStockList]);

  // Breakdown by Warehouse
  const warehouseBreakdown = useMemo(() => {
    const map = new Map<string, { warehouseName: string; totalUnits: number; productCount: number }>();

    stockBalances.forEach(sb => {
      const whId = sb.warehouseId || 'unassigned';
      const wh = warehouses.find(w => w.id === whId);
      const whName = wh ? wh.name : sb.warehouseId ? `Godown (${sb.warehouseId.substring(0, 6)})` : 'Primary Godown';

      const existing = map.get(whId) || { warehouseName: whName, totalUnits: 0, productCount: 0 };
      map.set(whId, {
        warehouseName: whName,
        totalUnits: existing.totalUnits + sb.quantity,
        productCount: existing.productCount + (sb.quantity > 0 ? 1 : 0),
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalUnits - a.totalUnits);
  }, [stockBalances, warehouses]);

  // Out of stock & low stock counts
  const outOfStockCount = productStockList.filter(p => p.status === 'OUT_OF_STOCK').length;
  const lowStockCount = productStockList.filter(p => p.status === 'LOW_STOCK').length;
  const healthyCount = productStockList.filter(p => p.status === 'HEALTHY').length;

  // Empty State: zero products registered
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-orange-100 text-brand-600 flex items-center justify-center mx-auto">
          <Package className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Inventory Stock &amp; Health</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No products have been added yet. Add raw materials or goods to visualize stock levels against safety reorder limits.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/products')}>
          + Add First Product
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-brand-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Inventory Stock &amp; Health</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Live godown counts vs minimum safety thresholds
          </p>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('STOCK_VS_REORDER')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'STOCK_VS_REORDER'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stock vs Limit
          </button>
          <button
            type="button"
            onClick={() => setViewMode('STOCK_VALUE')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'STOCK_VALUE'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Valuation
          </button>
          <button
            type="button"
            onClick={() => setViewMode('GODOWN_SPLIT')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'GODOWN_SPLIT'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Godown Split
          </button>
        </div>
      </div>

      {/* Summary Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total In-Stock</span>
          <strong className="text-sm font-bold text-slate-900">{totalStockUnits} Units</strong>
        </div>
        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Stock Valuation</span>
          <strong className="text-sm font-bold text-slate-900">
            {formatCurrency(totalStockValuation, currencySymbol)}
          </strong>
        </div>
        <div className="col-span-2 sm:col-span-1 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Health Status</span>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="text-xs font-bold text-emerald-700">{healthyCount} OK</span>
            {lowStockCount > 0 && <span className="text-xs font-bold text-amber-600">&bull; {lowStockCount} Low</span>}
            {outOfStockCount > 0 && <span className="text-xs font-bold text-rose-600">&bull; {outOfStockCount} Out</span>}
          </div>
        </div>
      </div>

      {/* VIEW 1: STOCK VS REORDER LIMIT */}
      {viewMode === 'STOCK_VS_REORDER' && (
        <div className="space-y-3 pt-1">
          {productStockList.slice(0, 6).map(item => {
            const maxRef = Math.max(item.threshold * 2, item.quantity, 10);
            const qtyPct = Math.min(100, (item.quantity / maxRef) * 100);
            const threshPct = Math.min(100, (item.threshold / maxRef) * 100);

            const isOut = item.status === 'OUT_OF_STOCK';
            const isLow = item.status === 'LOW_STOCK';

            return (
              <div
                key={item.product.id}
                className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50/70 transition-colors text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-slate-800">{item.product.name}</strong>
                    <span className="text-[10px] text-slate-400 ml-1.5">SKU: {item.product.sku}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-bold ${
                        isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-emerald-700'
                      }`}
                    >
                      {item.quantity} {item.product.unit}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                        isOut
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isLow
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isOut ? 'Stockout' : isLow ? 'Low' : 'Healthy'}
                    </span>
                  </div>
                </div>

                {/* Dual bar showing available stock and threshold marker */}
                <div className="relative w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(isOut ? 0 : 6, qtyPct)}%` }}
                  />
                  {/* Reorder Threshold vertical line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-700 z-10"
                    style={{ left: `${threshPct}%` }}
                    title={`Reorder Level: ${item.threshold} ${item.product.unit}`}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Reorder limit: {item.threshold} {item.product.unit}</span>
                  {item.unitPrice > 0 && (
                    <span>Valuation: {formatCurrency(item.stockValue, currencySymbol)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: VALUATION DISTRIBUTION */}
      {viewMode === 'STOCK_VALUE' && (
        <div className="space-y-3 pt-1">
          {productStockList.map(item => {
            const pct = totalStockValuation > 0 ? (item.stockValue / totalStockValuation) * 100 : 0;

            return (
              <div
                key={item.product.id}
                className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50/70 transition-colors text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-slate-800">{item.product.name}</strong>
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      ({item.quantity} {item.product.unit} @ ₹{item.unitPrice || '—'})
                    </span>
                  </div>
                  <div className="text-right">
                    <strong className="text-slate-900">
                      {formatCurrency(item.stockValue, currencySymbol)}
                    </strong>
                    <span className="text-[10px] text-slate-400 ml-1">({pct.toFixed(0)}%)</span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(item.stockValue > 0 ? 5 : 0, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: GODOWN ALLOCATION */}
      {viewMode === 'GODOWN_SPLIT' && (
        <div className="space-y-2.5 pt-1">
          {warehouseBreakdown.length === 0 || totalStockUnits === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No stock currently recorded in warehouses. As deliveries are physically received and accepted, godown allocation will populate here.
            </div>
          ) : (
            warehouseBreakdown.map(item => {
              const pct = totalStockUnits > 0 ? (item.totalUnits / totalStockUnits) * 100 : 0;

              return (
                <div
                  key={item.warehouseName}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-brand-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="text-slate-900 block">{item.warehouseName}</strong>
                      <span className="text-[10px] text-slate-500">
                        {item.productCount} active item types stored
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <strong className="text-sm font-bold text-slate-900 block">
                      {item.totalUnits} Units
                    </strong>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {pct.toFixed(1)}% of total stock
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
