import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Delivery,
  SupplierBill,
  Product,
  StockBalance,
  PurchaseOrder,
} from '../../types';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Truck,
  Receipt,
  Package,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface NeedsAttentionCardProps {
  deliveries: Delivery[];
  bills: SupplierBill[];
  products: Product[];
  stockBalances: StockBalance[];
  purchaseOrders: PurchaseOrder[];
}

interface ActionItem {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  category: 'DELIVERY' | 'BILL' | 'INVENTORY' | 'PURCHASE';
  title: string;
  reference: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
  icon: React.ReactNode;
}

export const NeedsAttentionCard: React.FC<NeedsAttentionCardProps> = ({
  deliveries,
  bills,
  products,
  stockBalances,
  purchaseOrders,
}) => {
  const navigate = useNavigate();

  const items: ActionItem[] = [];

  // 1. Deliveries with physical count discrepancy or damaged goods (CRITICAL)
  const discrepancyDeliveries = deliveries.filter(
    d => d.productVerificationStatus === 'ACCEPTED_WITH_DISCREPANCY'
  );
  discrepancyDeliveries.forEach(d => {
    items.push({
      id: `discrepancy_${d.id}`,
      priority: 'CRITICAL',
      category: 'DELIVERY',
      title: 'Gate Discrepancy / Damaged Lot',
      reference: `${d.poNumber} (Challan: ${d.challanNumber || 'N/A'})`,
      description: `Physical count recorded damaged/rejected items from ${d.vendorName}. Carrier docket review required.`,
      actionLabel: 'Review Discrepancy',
      actionUrl: `/deliveries/${d.id}`,
      icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
    });
  });

  // 2. Deliveries awaiting physical check (HIGH)
  const pendingDeliveries = deliveries.filter(
    d => d.productVerificationStatus === 'PENDING'
  );
  pendingDeliveries.forEach(d => {
    items.push({
      id: `pending_del_${d.id}`,
      priority: 'HIGH',
      category: 'DELIVERY',
      title: 'Physical Goods Check Required',
      reference: `${d.poNumber} (Challan: ${d.challanNumber || 'N/A'})`,
      description: `Truck arrived from ${d.vendorName} into ${d.warehouseName}. Verify items before admitting to stock.`,
      actionLabel: 'Inspect Goods',
      actionUrl: `/deliveries/${d.id}`,
      icon: <Truck className="w-4 h-4 text-amber-600" />,
    });
  });

  // 3. Out of stock products (CRITICAL)
  const stockMap = new Map<string, number>();
  stockBalances.forEach(sb => {
    const cur = stockMap.get(sb.productId) || 0;
    stockMap.set(sb.productId, cur + sb.quantity);
  });

  products.filter(p => p.isActive).forEach(p => {
    const qty = stockMap.get(p.id) || 0;
    if (qty <= 0) {
      items.push({
        id: `out_of_stock_${p.id}`,
        priority: 'CRITICAL',
        category: 'INVENTORY',
        title: 'Zero Stock Outage',
        reference: `${p.name} (${p.sku})`,
        description: `Current available balance is 0 ${p.unit}. Reorder threshold is ${p.reorderThreshold} ${p.unit}.`,
        actionLabel: 'Reorder Now',
        actionUrl: `/purchases/new?productId=${p.id}`,
        icon: <Package className="w-4 h-4 text-rose-600" />,
      });
    } else if (qty <= p.reorderThreshold) {
      items.push({
        id: `low_stock_${p.id}`,
        priority: 'MEDIUM',
        category: 'INVENTORY',
        title: 'Low Stock Threshold Reached',
        reference: `${p.name} (${p.sku})`,
        description: `${qty} ${p.unit} remaining on hand (Threshold: ${p.reorderThreshold} ${p.unit}).`,
        actionLabel: 'Create PO',
        actionUrl: `/purchases/new?productId=${p.id}`,
        icon: <Package className="w-4 h-4 text-amber-500" />,
      });
    }
  });

  // 4. Supplier bills awaiting accounts verification (HIGH)
  const pendingBills = bills.filter(b => b.status === 'PENDING');
  pendingBills.forEach(b => {
    items.push({
      id: `pending_bill_${b.id}`,
      priority: 'HIGH',
      category: 'BILL',
      title: 'Invoice 3-Way Match Pending',
      reference: `Invoice #${b.invoiceNumber} (PO: ${b.poNumber})`,
      description: `${b.vendorName} billed ₹${b.totalAmount}. Verify billed vs. physically accepted quantities before approval.`,
      actionLabel: 'Verify Bill',
      actionUrl: `/bills/${b.id}`,
      icon: <Receipt className="w-4 h-4 text-indigo-600" />,
    });
  });

  // 5. Overdue Purchase Orders awaiting delivery (HIGH)
  const now = new Date();
  purchaseOrders
    .filter(po => (po.status === 'Ordered' || po.status === 'Partially Received') && po.expectedDeliveryDate)
    .forEach(po => {
      const expDate = new Date(po.expectedDeliveryDate);
      if (expDate < now) {
        items.push({
          id: `overdue_po_${po.id}`,
          priority: 'HIGH',
          category: 'PURCHASE',
          title: 'Delivery Overdue from Supplier',
          reference: `${po.orderNumber} &bull; ${po.vendorName}`,
          description: `Expected delivery date (${po.expectedDeliveryDate}) has passed. Contact supplier to track shipment.`,
          actionLabel: 'Track PO',
          actionUrl: `/purchases/${po.id}`,
          icon: <Clock className="w-4 h-4 text-rose-500" />,
        });
      }
    });

  // Sort: CRITICAL first, then HIGH, then MEDIUM
  const priorityOrder: Record<string, number> = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
  };

  const sortedItems = items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const getPriorityBadge = (p: 'CRITICAL' | 'HIGH' | 'MEDIUM') => {
    switch (p) {
      case 'CRITICAL':
        return <Badge variant="danger" size="sm">Critical</Badge>;
      case 'HIGH':
        return <Badge variant="warning" size="sm">Urgent</Badge>;
      case 'MEDIUM':
        return <Badge variant="neutral" size="sm">Attention</Badge>;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-5 space-y-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Needs Attention
            </h2>
            {sortedItems.length > 0 ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                {sortedItems.length} action {sortedItems.length === 1 ? 'item' : 'items'}
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                All Caught Up
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational bottlenecks, goods inspections, discrepancies &amp; reviews
          </p>
        </div>
      </div>

      {/* Action Items List */}
      <div className="flex-1">
        {sortedItems.length === 0 ? (
          /* Calm State */
          <div className="py-10 px-4 text-center bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              You&apos;re All Caught Up
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No deliveries awaiting inspection, no bill discrepancies, and no inventory stockouts currently require intervention.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 divide-y divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
            {sortedItems.slice(0, 5).map(item => (
              <div
                key={item.id}
                className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/80 p-2 rounded-md transition-colors"
              >
                <div className="flex items-start space-x-3 min-w-0 flex-1">
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-md bg-slate-100">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.title}
                      </span>
                      {getPriorityBadge(item.priority)}
                    </div>
                    <div
                      className="text-[11px] font-semibold text-slate-700 mt-0.5 truncate"
                      dangerouslySetInnerHTML={{ __html: item.reference }}
                    />
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      {item.description}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-center">
                  <Button
                    variant={item.priority === 'CRITICAL' ? 'primary' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => navigate(item.actionUrl)}
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {sortedItems.length > 5 && (
        <div className="pt-2 border-t border-slate-100 text-center">
          <span className="text-xs text-slate-500">
            + {sortedItems.length - 5} more items requiring review in relevant sections
          </span>
        </div>
      )}
    </div>
  );
};
