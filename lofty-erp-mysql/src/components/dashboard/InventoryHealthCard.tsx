import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Product, StockBalance, VendorProduct, Vendor } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { CheckCircle2, AlertTriangle, ArrowRight, Plus } from 'lucide-react';

interface InventoryHealthCardProps {
  products: Product[];
  stockBalances: StockBalance[];
  vendorProducts: VendorProduct[];
  vendors: Vendor[];
  canCreatePO: boolean;
}

interface StockProductStatus {
  product: Product;
  availableQty: number;
  threshold: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HEALTHY';
  preferredVendorName?: string;
  preferredVendorId?: string;
  ratio: number; // availableQty / threshold
}

export const InventoryHealthCard: React.FC<InventoryHealthCardProps> = ({
  products,
  stockBalances,
  vendorProducts,
  vendors,
  canCreatePO,
}) => {
  const navigate = useNavigate();

  // Compute available stock per product
  const stockMap = new Map<string, number>();
  stockBalances.forEach(sb => {
    const cur = stockMap.get(sb.productId) || 0;
    stockMap.set(sb.productId, cur + sb.quantity);
  });

  const activeProducts = products.filter(p => p.isActive);

  const productStatuses: StockProductStatus[] = activeProducts.map(p => {
    const qty = stockMap.get(p.id) || 0;
    const threshold = p.reorderThreshold || 1;

    let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HEALTHY' = 'HEALTHY';
    if (qty <= 0) {
      status = 'OUT_OF_STOCK';
    } else if (qty <= threshold) {
      status = 'LOW_STOCK';
    }

    // Preferred supplier
    const vp = vendorProducts.find(item => item.productId === p.id && item.isActive);
    let preferredVendorName: string | undefined;
    let preferredVendorId: string | undefined;

    if (vp) {
      preferredVendorId = vp.vendorId;
      const v = vendors.find(vend => vend.id === vp.vendorId);
      if (v) preferredVendorName = v.name;
    }

    return {
      product: p,
      availableQty: qty,
      threshold,
      status,
      preferredVendorName,
      preferredVendorId,
      ratio: qty / threshold,
    };
  });

  // Buckets
  const healthyCount = productStatuses.filter(s => s.status === 'HEALTHY').length;
  const lowStockCount = productStatuses.filter(s => s.status === 'LOW_STOCK').length;
  const outOfStockCount = productStatuses.filter(s => s.status === 'OUT_OF_STOCK').length;
  const totalCount = Math.max(1, activeProducts.length);

  const healthyPct = Math.round((healthyCount / totalCount) * 100);
  const lowStockPct = Math.round((lowStockCount / totalCount) * 100);
  const outOfStockPct = Math.round((outOfStockCount / totalCount) * 100);

  // Items requiring attention (out of stock first, then lowest ratio)
  const attentionItems = productStatuses
    .filter(s => s.status === 'OUT_OF_STOCK' || s.status === 'LOW_STOCK')
    .sort((a, b) => {
      if (a.status === 'OUT_OF_STOCK' && b.status !== 'OUT_OF_STOCK') return -1;
      if (b.status === 'OUT_OF_STOCK' && a.status !== 'OUT_OF_STOCK') return 1;
      return a.ratio - b.ratio;
    });

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Inventory Health
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Stock levels vs. configured reorder limits
            </p>
          </div>
          <Link
            to="/inventory"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {/* Stock Distribution Segmented Progress Bar */}
        <div className="mt-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Stock Distribution</span>
            <span className="text-slate-400 text-[11px]">{activeProducts.length} active SKUs</span>
          </div>

          {/* Segmented Horizontal Bar */}
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {healthyPct > 0 && (
              <div
                style={{ width: `${healthyPct}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Healthy: ${healthyCount} products (${healthyPct}%)`}
              />
            )}
            {lowStockPct > 0 && (
              <div
                style={{ width: `${lowStockPct}%` }}
                className="bg-amber-500 h-full transition-all"
                title={`Low Stock: ${lowStockCount} products (${lowStockPct}%)`}
              />
            )}
            {outOfStockPct > 0 && (
              <div
                style={{ width: `${outOfStockPct}%` }}
                className="bg-rose-500 h-full transition-all"
                title={`Out of Stock: ${outOfStockCount} products (${outOfStockPct}%)`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-1 pt-1 text-[11px]">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600 truncate">
                Healthy <strong className="text-slate-800">({healthyCount})</strong>
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600 truncate">
                Low <strong className="text-slate-800">({lowStockCount})</strong>
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-600 truncate">
                Out <strong className="text-slate-800">({outOfStockCount})</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Low-Stock and Out-of-Stock List */}
      <div className="flex-1 space-y-2 pt-1">
        <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>Replenishment Priority</span>
          {attentionItems.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              {attentionItems.length} require action
            </span>
          )}
        </div>

        {attentionItems.length === 0 ? (
          /* Positive Empty State */
          <div className="py-8 px-4 text-center bg-emerald-50/50 rounded-lg border border-emerald-100">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
            <h4 className="text-xs font-bold text-slate-800">
              All Inventory Levels Healthy
            </h4>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5">
              Every active product is currently above its configured minimum reorder threshold.
            </p>
          </div>
        ) : (
          <div className="space-y-2 divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
            {attentionItems.slice(0, 4).map(item => (
              <div
                key={item.product.id}
                className="pt-2 first:pt-0 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-semibold text-slate-800 truncate" title={item.product.name}>
                      {item.product.name}
                    </span>
                    <Badge
                      variant={item.status === 'OUT_OF_STOCK' ? 'danger' : 'warning'}
                      size="sm"
                    >
                      {item.status === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock'}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    SKU: {item.product.sku} &bull; {item.preferredVendorName || 'No default vendor'}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-800">
                    <span className={item.status === 'OUT_OF_STOCK' ? 'text-rose-600' : 'text-amber-600'}>
                      {item.availableQty}
                    </span>{' '}
                    <span className="text-slate-400 font-normal text-[10px]">/ {item.threshold} {item.product.unit}</span>
                  </div>
                  {canCreatePO && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 px-1.5 text-brand-600 hover:text-brand-700 mt-0.5"
                      onClick={() =>
                        navigate(
                          `/purchases/new?productId=${item.product.id}${
                            item.preferredVendorId ? `&vendorId=${item.preferredVendorId}` : ''
                          }`
                        )
                      }
                    >
                      <Plus className="w-3 h-3 mr-0.5" />
                      Reorder
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer link to view godown logs */}
      <div className="pt-2 border-t border-slate-100">
        <Link
          to="/inventory"
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center justify-between"
        >
          <span>Check godowns & stock movement log</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </Link>
      </div>
    </div>
  );
};
