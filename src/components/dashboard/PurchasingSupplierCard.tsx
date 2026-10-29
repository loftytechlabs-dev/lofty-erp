import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PurchaseOrder, Vendor, SupplierBill, Delivery } from '../../types';
import { Badge, getStatusBadgeVariant } from '../common/Badge';
import { Button } from '../common/Button';
import { formatCurrency, formatDate, toIsoDate } from '../../lib/utils';
import { DateRangeState } from './DashboardHeader';
import { ShoppingBag, Users, ArrowRight, ExternalLink } from 'lucide-react';

interface PurchasingSupplierCardProps {
  purchaseOrders: PurchaseOrder[];
  vendors: Vendor[];
  supplierBills: SupplierBill[];
  deliveries: Delivery[];
  dateRange: DateRangeState;
  currencySymbol?: string;
}

export const PurchasingSupplierCard: React.FC<PurchasingSupplierCardProps> = ({
  purchaseOrders,
  vendors,
  supplierBills,
  deliveries,
  dateRange,
  currencySymbol = '₹',
}) => {
  const navigate = useNavigate();

  // Filter purchase orders within date range (or recent 5)
  const sortedPOs = [...purchaseOrders].sort((a, b) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const recentPOs = sortedPOs.slice(0, 5);

  // Supplier activity in period
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);

  const poInPeriod = purchaseOrders.filter(po => {
    if (!po.createdAt) return false;
    const poDateStr = toIsoDate(po.createdAt);
    if (!poDateStr) return false;
    const d = new Date(poDateStr);
    return d >= start && d <= end && po.status !== 'Cancelled';
  });

  const totalPeriodSpend = poInPeriod.reduce((sum, po) => sum + po.grandTotal, 0);

  // Group spend by vendor in period
  const vendorSpendMap = new Map<string, { spend: number; poCount: number; name: string }>();
  poInPeriod.forEach(po => {
    const cur = vendorSpendMap.get(po.vendorId) || { spend: 0, poCount: 0, name: po.vendorName };
    vendorSpendMap.set(po.vendorId, {
      spend: cur.spend + po.grandTotal,
      poCount: cur.poCount + 1,
      name: po.vendorName,
    });
  });

  const activeVendors = vendors.filter(v => v.isActive);
  const pendingBills = supplierBills.filter(b => b.status === 'PENDING');

  // Compute received items progress for a PO
  const getPOProgress = (po: PurchaseOrder) => {
    const totalOrdered = po.items.reduce((sum, item) => sum + item.quantity, 0);
    // Find all accepted quantities from deliveries
    const poDeliveries = deliveries.filter(d => d.purchaseOrderId === po.id);
    let totalAccepted = 0;

    poDeliveries.forEach(del => {
      del.items.forEach(it => {
        totalAccepted += it.acceptedQuantity || 0;
      });
    });

    // Fallback to po.items.receivedQuantity if no deliveries recorded yet
    if (totalAccepted === 0) {
      totalAccepted = po.items.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0);
    }

    const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalAccepted / totalOrdered) * 100)) : 0;
    return { totalOrdered, totalAccepted, pct };
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-5 space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Purchasing &amp; Supplier Activity
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Procurement workflow, supplier orders, and fulfillment rates
          </p>
        </div>
        <Link
          to="/purchases"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center transition-colors"
        >
          <span>All Purchases</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </div>

      {/* Two Complementary Panels: Left (Recent Orders) & Right (Supplier Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Recent Purchase Orders (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center">
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5 text-brand-600" />
              Recent Purchase Orders
            </span>
            <span className="text-[11px] text-slate-400">
              Showing {recentPOs.length} of {purchaseOrders.length}
            </span>
          </div>

          {recentPOs.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
              No purchase orders created yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {recentPOs.map(po => {
                const prog = getPOProgress(po);
                return (
                  <div
                    key={po.id}
                    onClick={() => navigate(`/purchases/${po.id}`)}
                    className="p-3 bg-white hover:bg-slate-50/80 cursor-pointer transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 hover:text-brand-600">
                          {po.orderNumber}
                        </span>
                        <Badge variant={getStatusBadgeVariant(po.status)} size="sm">
                          {po.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {po.vendorName} &bull; {formatDate(po.createdAt)}
                      </div>

                      {/* Delivery progress bar */}
                      <div className="mt-1.5 flex items-center space-x-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${prog.pct}%` }}
                            className={`h-full rounded-full ${
                              prog.pct === 100
                                ? 'bg-emerald-500'
                                : prog.pct > 0
                                ? 'bg-brand-500'
                                : 'bg-slate-200'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {prog.totalAccepted} / {prog.totalOrdered} received ({prog.pct}%)
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900">
                        {formatCurrency(po.grandTotal, currencySymbol)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-end">
                        <span>Inspect PO</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-1 text-slate-400" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel: Supplier Summary (5 cols) */}
        <div className="lg:col-span-5 bg-slate-50/80 rounded-lg p-4 border border-slate-200/80 space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
              <span className="font-bold text-slate-800 flex items-center">
                <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Supplier Summary
              </span>
              <Link to="/vendors" className="text-[11px] text-brand-600 hover:underline font-semibold">
                Vendors ({activeVendors.length}) &rarr;
              </Link>
            </div>

            {/* Quick Metrics in Period */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="bg-white p-2.5 rounded-md border border-slate-200/70 shadow-xs">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Period Orders</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">{poInPeriod.length} POs</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{formatCurrency(totalPeriodSpend, currencySymbol)}</div>
              </div>
              <div className="bg-white p-2.5 rounded-md border border-slate-200/70 shadow-xs">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Pending Review</div>
                <div className="text-sm font-bold text-amber-600 mt-0.5">{pendingBills.length} Bills</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Awaiting 3-way match</div>
              </div>
            </div>

            {/* Recently Used Suppliers List */}
            <div className="mt-3 space-y-2">
              <div className="text-[11px] font-semibold text-slate-600">Recently Active Vendors:</div>
              {vendorSpendMap.size === 0 ? (
                <div className="text-xs text-slate-400 italic">No supplier orders in selected period.</div>
              ) : (
                <div className="space-y-1.5">
                  {Array.from(vendorSpendMap.entries()).slice(0, 3).map(([vId, vData]) => (
                    <div
                      key={vId}
                      onClick={() => navigate(`/vendors/${vId}`)}
                      className="p-2 bg-white rounded border border-slate-200/70 hover:border-slate-300 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-slate-800 truncate">{vData.name}</div>
                        <div className="text-[10px] text-slate-400">{vData.poCount} POs in period</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-800">
                          {formatCurrency(vData.spend, currencySymbol)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick link button to Vendors */}
          <div className="pt-2 border-t border-slate-200/60">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs text-slate-700 bg-white"
              onClick={() => navigate('/vendors')}
            >
              Manage Supplier Catalogs &amp; Rates
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
