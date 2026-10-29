import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PurchaseOrder, SupplierBill } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Badge, getStatusBadgeVariant } from '../common/Badge';
import { Button } from '../common/Button';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  ShoppingBag,
  ExternalLink,
  Building2,
  Calendar,
} from 'lucide-react';

interface SpendAnalyticsChartProps {
  purchaseOrders: PurchaseOrder[];
  supplierBills: SupplierBill[];
  currencySymbol?: string;
}

type SpendViewMode = 'BY_SUPPLIER' | 'BY_ORDER' | 'BY_STATUS';

export const SpendAnalyticsChart: React.FC<SpendAnalyticsChartProps> = ({
  purchaseOrders,
  supplierBills,
  currencySymbol = '₹',
}) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<SpendViewMode>('BY_SUPPLIER');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter valid non-cancelled POs
  const activePOs = useMemo(() => {
    return purchaseOrders.filter(po => po.status !== 'Cancelled');
  }, [purchaseOrders]);

  // Total committed spend
  const totalSpend = useMemo(() => {
    return activePOs.reduce((acc, po) => acc + po.grandTotal, 0);
  }, [activePOs]);

  // 1. Group Spend by Supplier / Vendor
  const vendorSpendList = useMemo(() => {
    const map = new Map<string, { vendorName: string; totalSpend: number; orderCount: number }>();
    activePOs.forEach(po => {
      const vName = po.vendorName || 'Unknown Supplier';
      const existing = map.get(vName) || { vendorName: vName, totalSpend: 0, orderCount: 0 };
      map.set(vName, {
        vendorName: vName,
        totalSpend: existing.totalSpend + po.grandTotal,
        orderCount: existing.orderCount + 1,
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [activePOs]);

  // 2. Orders sorted by date for Timeline view
  const chronologicalPOs = useMemo(() => {
    return [...activePOs].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
  }, [activePOs]);

  // 3. Group by PO Status
  const statusDistribution = useMemo(() => {
    const map = new Map<string, { status: string; count: number; totalAmount: number }>();
    activePOs.forEach(po => {
      const s = po.status;
      const existing = map.get(s) || { status: s, count: 0, totalAmount: 0 };
      map.set(s, {
        status: s,
        count: existing.count + 1,
        totalAmount: existing.totalAmount + po.grandTotal,
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [activePOs]);

  // Palette for chart items
  const colors = ['#EA580C', '#0284C7', '#059669', '#7C3AED', '#D97706', '#DB2777', '#4B5563'];

  // Empty State: zero purchase orders
  if (activePOs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-orange-100 text-brand-600 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Procurement Spend Analytics</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No purchase orders have been created yet. As you issue orders to suppliers, real-time spend analytics and supplier distribution will appear here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/purchases/new')}>
          + Create First Purchase Order
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 space-y-4">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-brand-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Procurement Spend Analytics</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Real order expenditure from active purchase orders
          </p>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('BY_SUPPLIER')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'BY_SUPPLIER'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            By Supplier
          </button>
          <button
            type="button"
            onClick={() => setViewMode('BY_ORDER')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'BY_ORDER'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Order Timeline
          </button>
          <button
            type="button"
            onClick={() => setViewMode('BY_STATUS')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'BY_STATUS'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            By Status
          </button>
        </div>
      </div>

      {/* Summary Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total PO Spend</span>
          <strong className="text-sm font-bold text-slate-900">
            {formatCurrency(totalSpend, currencySymbol)}
          </strong>
        </div>
        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Active Orders</span>
          <strong className="text-sm font-bold text-brand-600">{activePOs.length} POs</strong>
        </div>
        <div className="col-span-2 sm:col-span-1 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Active Suppliers</span>
          <strong className="text-sm font-bold text-slate-800">{vendorSpendList.length} Vendors</strong>
        </div>
      </div>

      {/* VIEW 1: BY SUPPLIER */}
      {viewMode === 'BY_SUPPLIER' && (
        <div className="space-y-3 pt-1">
          {vendorSpendList.map((item, index) => {
            const percentage = totalSpend > 0 ? (item.totalSpend / totalSpend) * 100 : 0;
            const color = colors[index % colors.length];

            return (
              <div
                key={item.vendorName}
                className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <strong className="text-slate-800">{item.vendorName}</strong>
                    <span className="text-[11px] text-slate-400">
                      ({item.orderCount} {item.orderCount === 1 ? 'order' : 'orders'})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">
                      {formatCurrency(item.totalSpend, currencySymbol)}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1.5 font-medium">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(4, percentage)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: ORDER TIMELINE (SVG BAR CHART) */}
      {viewMode === 'BY_ORDER' && (
        <div className="space-y-3 pt-1">
          <div className="h-44 flex items-end space-x-2 pt-4 px-2 border-b border-slate-100">
            {(() => {
              const maxOrderTotal = Math.max(...chronologicalPOs.map(p => p.grandTotal), 1);

              return chronologicalPOs.map((po, idx) => {
                const heightPct = Math.max(12, (po.grandTotal / maxOrderTotal) * 100);
                const isHovered = hoveredIndex === idx;

                return (
                  <div
                    key={po.id}
                    className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => navigate(`/purchases/${po.id}`)}
                  >
                    {/* Hover Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-12 z-20 bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-md whitespace-nowrap pointer-events-none">
                        <div className="font-bold">{po.orderNumber}</div>
                        <div>
                          {formatCurrency(po.grandTotal, currencySymbol)} &bull; {po.vendorName}
                        </div>
                      </div>
                    )}

                    {/* Value label on top of bar */}
                    <span className="text-[9px] font-bold text-slate-600 mb-1 truncate max-w-full">
                      {po.grandTotal >= 1000 ? `₹${Math.round(po.grandTotal / 1000)}k` : `₹${po.grandTotal}`}
                    </span>

                    {/* Bar */}
                    <div
                      className={`w-full max-w-[48px] rounded-t-md transition-all duration-300 ${
                        isHovered ? 'bg-brand-500 scale-y-105' : 'bg-brand-600/85 hover:bg-brand-600'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />

                    {/* PO Label */}
                    <span className="text-[9px] text-slate-500 mt-1 truncate max-w-full">
                      {po.orderNumber.replace('PO-', '')}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
          <p className="text-[10px] text-center text-slate-400">
            Click on any purchase order bar to open details and view tracking
          </p>
        </div>
      )}

      {/* VIEW 3: BY STATUS */}
      {viewMode === 'BY_STATUS' && (
        <div className="space-y-2.5 pt-1">
          {statusDistribution.map(item => {
            const pct = totalSpend > 0 ? (item.totalAmount / totalSpend) * 100 : 0;

            return (
              <div
                key={item.status}
                className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusBadgeVariant(item.status)} size="sm">
                    {item.status}
                  </Badge>
                  <span className="text-slate-500">
                    {item.count} {item.count === 1 ? 'order' : 'orders'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="font-bold text-slate-900">
                    {formatCurrency(item.totalAmount, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1.5">({pct.toFixed(0)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
