import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CanvasWidget,
  CanvasWidgetType,
  KpiMetricType,
  PurchaseOrder,
  Product,
  StockBalance,
  Vendor,
  Delivery,
  SupplierBill,
  Warehouse,
  VendorProduct,
} from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Badge, getStatusBadgeVariant } from '../common/Badge';
import {
  GripHorizontal,
  X,
  Maximize2,
  Sparkles,
  TrendingUp,
  Package,
  ShoppingBag,
  Receipt,
  Truck,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  PieChart,
  BarChart3,
} from 'lucide-react';

interface CanvasWidgetCardProps {
  widget: CanvasWidget;
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  stockBalances: StockBalance[];
  vendors: Vendor[];
  deliveries: Delivery[];
  bills: SupplierBill[];
  warehouses: Warehouse[];
  vendorProducts?: VendorProduct[];
  currencySymbol: string;
  onUpdateWidget: (updated: CanvasWidget) => void;
  onRemoveWidget: (id: string) => void;
  onDuplicateWidget: (widget: CanvasWidget) => void;
  onDragStart: (e: React.MouseEvent, widget: CanvasWidget) => void;
  onResizeStart: (e: React.MouseEvent, widget: CanvasWidget) => void;
  isDragging?: boolean;
}

const GRID_SNAP = 16;
export function snap(val: number): number {
  return Math.round(val / GRID_SNAP) * GRID_SNAP;
}

export const CanvasWidgetCard: React.FC<CanvasWidgetCardProps> = ({
  widget,
  purchaseOrders,
  products,
  stockBalances,
  vendors,
  deliveries,
  bills,
  warehouses,
  vendorProducts = [],
  currencySymbol,
  onUpdateWidget,
  onRemoveWidget,
  onDuplicateWidget,
  onDragStart,
  onResizeStart,
  isDragging = false,
}) => {
  const navigate = useNavigate();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(widget.title);

  // Sync title
  useEffect(() => {
    setTitleInput(widget.title);
  }, [widget.title]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== widget.title) {
      onUpdateWidget({ ...widget, title: titleInput.trim() });
    }
  };

  // Calculations for real data
  const activePOs = useMemo(() => {
    return purchaseOrders.filter(p => p.status !== 'Cancelled');
  }, [purchaseOrders]);

  const totalSpend = useMemo(() => {
    return activePOs.reduce((acc, p) => acc + (p.grandTotal || 0), 0);
  }, [activePOs]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stockBalances.forEach(sb => {
      map.set(sb.productId, (map.get(sb.productId) || 0) + sb.quantity);
    });
    return map;
  }, [stockBalances]);

  const lowStockItems = useMemo(() => {
    return products.filter(p => (stockMap.get(p.id) || 0) <= (p.reorderThreshold || 1));
  }, [products, stockMap]);

  // Spend grouped by vendor
  const vendorSpendList = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number }>();
    activePOs.forEach(po => {
      const v = po.vendorName || 'Other Supplier';
      const cur = map.get(v) || { name: v, amount: 0, count: 0 };
      map.set(v, {
        name: v,
        amount: cur.amount + (po.grandTotal || 0),
        count: cur.count + 1,
      });
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [activePOs]);

  // Render Widget Body based on Type
  const renderContent = () => {
    switch (widget.type) {
      // 1. Spend by Supplier (Interactive SVG Bar/Donut Chart)
      case 'spend_by_supplier': {
        if (vendorSpendList.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-slate-400">
              <ShoppingBag className="w-8 h-8 text-slate-300 mb-1" />
              <span>No purchase orders yet.</span>
            </div>
          );
        }

        const maxSpend = Math.max(...vendorSpendList.map(v => v.amount), 1);
        const palette = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#c2410c', '#9a3412'];

        return (
          <div className="h-full flex flex-col justify-between p-3 overflow-hidden text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Supplier Distribution
              </span>
              <span className="font-bold text-slate-900">
                {currencySymbol}{totalSpend.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-2.5 my-auto overflow-y-auto pr-1 max-h-[85%]">
              {vendorSpendList.slice(0, 6).map((item, idx) => {
                const pct = Math.round((item.amount / (totalSpend || 1)) * 100);
                const barWidth = Math.max(8, Math.round((item.amount / maxSpend) * 100));
                const color = palette[idx % palette.length];

                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                        {item.name}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {currencySymbol}{item.amount.toLocaleString('en-IN')}
                        </span>
                        <span className="text-slate-400 ml-1.5 text-[10px]">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // 2. Stock vs Reorder Health
      case 'stock_vs_reorder': {
        if (products.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-slate-400">
              <Package className="w-8 h-8 text-slate-300 mb-1" />
              <span>No inventory products found.</span>
            </div>
          );
        }

        return (
          <div className="h-full flex flex-col justify-between p-3 overflow-hidden text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Stock vs Threshold
              </span>
              <span className={`text-[11px] font-bold ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {lowStockItems.length > 0 ? `${lowStockItems.length} Low Stock` : 'All Stock Healthy'}
              </span>
            </div>

            <div className="space-y-2 my-auto overflow-y-auto pr-1 max-h-[85%]">
              {products.slice(0, 6).map(prod => {
                const qty = stockMap.get(prod.id) || 0;
                const thresh = prod.reorderThreshold || 1;
                const isLow = qty <= thresh;
                const isZero = qty <= 0;
                const maxUnit = Math.max(qty, thresh * 1.5, 10);
                const stockBarWidth = Math.min(100, Math.max(5, Math.round((qty / maxUnit) * 100)));

                return (
                  <div key={prod.id} className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                        {prod.name}
                      </span>
                      <span className={`font-bold text-[11px] ${isZero ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                        {qty} {prod.unit}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isZero ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${stockBarWidth}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Threshold: {thresh} {prod.unit}</span>
                      <span>{isZero ? 'Out of Stock' : isLow ? 'Reorder Soon' : 'Healthy'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // 3. Purchase Orders Timeline
      case 'spend_timeline': {
        const sortedPOs = [...activePOs].sort(
          (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );

        if (sortedPOs.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-slate-400">
              <ShoppingBag className="w-8 h-8 text-slate-300 mb-1" />
              <span>No orders to plot on timeline.</span>
            </div>
          );
        }

        const maxAmt = Math.max(...sortedPOs.map(p => p.grandTotal || 0), 1);

        return (
          <div className="h-full flex flex-col justify-between p-3 overflow-hidden text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Order Value Timeline
              </span>
              <span className="text-[11px] text-slate-400">{sortedPOs.length} Total Orders</span>
            </div>

            <div className="flex items-end space-x-2 h-[80%] pt-4 pb-2 px-1 overflow-x-auto">
              {sortedPOs.map((po, idx) => {
                const heightPct = Math.max(15, Math.round(((po.grandTotal || 0) / maxAmt) * 100));
                return (
                  <div
                    key={po.id || idx}
                    className="flex-1 min-w-[36px] flex flex-col items-center justify-end group cursor-pointer"
                    onClick={() => navigate(`/purchases/${po.id}`)}
                    title={`${po.orderNumber} - ${currencySymbol}${(po.grandTotal || 0).toLocaleString('en-IN')}`}
                  >
                    <span className="text-[9px] font-bold text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {currencySymbol}{(po.grandTotal || 0).toLocaleString('en-IN')}
                    </span>
                    <div
                      className="w-full bg-orange-500 hover:bg-orange-600 rounded-t transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] text-slate-400 mt-1 truncate max-w-full">
                      {po.orderNumber.replace('PO-2026-', '#')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // 4. Godown / Warehouse Stock Distribution
      case 'godown_split': {
        const whMap = new Map<string, { name: string; count: number; units: number }>();
        warehouses.forEach(w => {
          whMap.set(w.id, { name: w.name, count: 0, units: 0 });
        });
        if (!whMap.has('main')) {
          whMap.set('main', { name: 'Main Godown', count: 0, units: 0 });
        }

        stockBalances.forEach(sb => {
          const wId = sb.warehouseId || 'main';
          const cur = whMap.get(wId) || { name: 'Central Godown', count: 0, units: 0 };
          whMap.set(wId, {
            name: cur.name,
            count: cur.count + 1,
            units: cur.units + sb.quantity,
          });
        });

        const list = Array.from(whMap.values());

        return (
          <div className="h-full flex flex-col justify-between p-3 overflow-hidden text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Warehouse Distribution
              </span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-2.5 my-auto overflow-y-auto max-h-[85%] pr-1">
              {list.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span className="text-brand-600 font-extrabold">{item.units} units</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {item.count} distinct item balances recorded
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // 5. KPI Metric Card
      case 'kpi_metric': {
        const metricKey = widget.config?.metricKey || 'total_spend';
        let mainVal = '';
        let subText = '';
        let badgeText = '';
        let badgeColor = 'bg-slate-100 text-slate-700';
        let Icon = TrendingUp;

        if (metricKey === 'total_spend') {
          mainVal = `${currencySymbol}${totalSpend.toLocaleString('en-IN')}`;
          subText = `Across ${activePOs.length} active purchase orders`;
          badgeText = 'Committed';
          badgeColor = 'bg-orange-100 text-orange-800';
          Icon = ShoppingBag;
        } else if (metricKey === 'active_orders') {
          mainVal = `${activePOs.length}`;
          subText = `${purchaseOrders.length} total orders recorded`;
          badgeText = 'Pipeline';
          badgeColor = 'bg-blue-100 text-blue-800';
          Icon = Receipt;
        } else if (metricKey === 'low_stock') {
          mainVal = `${lowStockItems.length}`;
          subText = `${products.length} products tracked in inventory`;
          badgeText = lowStockItems.length > 0 ? 'Requires Action' : 'Healthy';
          badgeColor = lowStockItems.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
          Icon = Package;
        } else if (metricKey === 'unpaid_bills') {
          const unpaid = bills.filter(b => b.status === 'PENDING');
          const unpaidSum = unpaid.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
          mainVal = `${currencySymbol}${unpaidSum.toLocaleString('en-IN')}`;
          subText = `${unpaid.length} supplier bills pending review`;
          badgeText = 'Pending Review';
          badgeColor = 'bg-purple-100 text-purple-800';
          Icon = Receipt;
        } else if (metricKey === 'pending_deliveries') {
          const pend = deliveries.filter(d => d.productVerificationStatus === 'PENDING' || d.status === 'AWAITING_REVIEW' || d.status === 'AWAITING_OWNER_CONFIRMATION');
          mainVal = `${pend.length}`;
          subText = 'Awaiting dock arrival and item count check';
          badgeText = 'Inbound';
          badgeColor = 'bg-cyan-100 text-cyan-800';
          Icon = Truck;
        }

        return (
          <div className="h-full flex flex-col justify-between p-4 bg-gradient-to-br from-white to-orange-50/20">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-orange-100/70 text-orange-700">
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                {badgeText}
              </span>
            </div>

            <div className="my-auto py-2">
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                {mainVal}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                {subText}
              </div>
            </div>
          </div>
        );
      }

      // 6. Live Active Orders Pipeline Table
      case 'live_orders': {
        const displayed = activePOs.slice(0, 5);
        return (
          <div className="h-full flex flex-col justify-between p-3 overflow-hidden text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Active Orders
              </span>
              <button
                type="button"
                onClick={() => navigate('/purchases')}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center space-x-0.5"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="my-auto overflow-y-auto max-h-[85%] divide-y divide-slate-100 pr-1">
              {displayed.length === 0 ? (
                <div className="text-center py-6 text-slate-400">No active orders</div>
              ) : (
                displayed.map(po => (
                  <div
                    key={po.id}
                    onClick={() => navigate(`/purchases/${po.id}`)}
                    className="py-2 flex items-center justify-between hover:bg-slate-50/70 px-1 rounded cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{po.orderNumber}</div>
                      <div className="text-[10px] text-slate-400">{po.vendorName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-800">
                        {currencySymbol}{(po.grandTotal || 0).toLocaleString('en-IN')}
                      </div>
                      <Badge variant={getStatusBadgeVariant(po.status)} size="sm">
                        {po.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      }

      // 7. Dynamic AI Operations Summary
      case 'ai_summary':
      default: {
        return (
          <div className="h-full flex flex-col justify-between p-3.5 bg-gradient-to-br from-white to-slate-50 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-1.5 text-brand-700 font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Executive Operations Digest</span>
              </div>
              <span className="text-[10px] text-slate-400">Live Workspace</span>
            </div>

            <div className="my-auto space-y-2 py-2 text-slate-700 leading-relaxed overflow-y-auto max-h-[85%]">
              <p>
                Committed PO spend sits at <strong className="text-slate-900">{currencySymbol}{totalSpend.toLocaleString('en-IN')}</strong> across <strong className="text-slate-900">{activePOs.length}</strong> active orders.
              </p>
              {lowStockItems.length > 0 ? (
                <div className="p-2 rounded bg-amber-50 border border-amber-200/60 text-amber-900 text-[11px] flex items-start space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>{lowStockItems.length} items</strong> below reorder threshold ({lowStockItems.map(p => p.name).join(', ')}).
                  </span>
                </div>
              ) : (
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200/60 text-emerald-900 text-[11px] flex items-start space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>All tracked inventory items maintain safe stock margins.</span>
                </div>
              )}
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div
      data-widget-id={widget.id}
      className={`absolute select-none bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col overflow-hidden group ${
        isDragging ? 'opacity-70 shadow-xl ring-2 ring-brand-500 z-50' : ''
      }`}
      style={{
        left: `${widget.x}px`,
        top: `${widget.y}px`,
        width: `${widget.w}px`,
        height: `${widget.h}px`,
      }}
    >
      {/* 1. Drag Header */}
      <div
        onMouseDown={e => onDragStart(e, widget)}
        className="px-3 py-2 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between cursor-move handle"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={e => e.key === 'Enter' && handleTitleSubmit()}
              autoFocus
              className="text-xs font-bold text-slate-800 bg-white px-1.5 py-0.5 border border-brand-400 rounded outline-none w-36"
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingTitle(true)}
              className="text-xs font-bold text-slate-800 truncate cursor-text"
              title="Double click to rename"
            >
              {widget.title}
            </span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onDuplicateWidget(widget);
            }}
            title="Duplicate card"
            className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 text-[11px]"
          >
            📋
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onRemoveWidget(widget.id);
            }}
            title="Remove widget"
            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Body Content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {renderContent()}
      </div>

      {/* 3. Bottom-Right Corner Resize Handle */}
      <div
        onMouseDown={e => onResizeStart(e, widget)}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center text-slate-300 hover:text-brand-600 transition-colors z-20"
        title="Drag to resize"
      >
        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current">
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="4" cy="8" r="1.2" />
          <circle cx="8" cy="4" r="1.2" />
        </svg>
      </div>
    </div>
  );
};
