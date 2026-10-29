import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AuditLog,
  PurchaseOrder,
  Delivery,
  SupplierBill,
  PaymentRecord,
  StockMovement,
} from '../../types';
import { formatDateTime, toIsoDateTime } from '../../lib/utils';
import {
  ShoppingBag,
  Truck,
  Receipt,
  Package,
  CheckCircle2,
  DollarSign,
  History,
  ArrowRight,
} from 'lucide-react';

interface RecentActivityCardProps {
  auditLogs: AuditLog[];
  purchaseOrders: PurchaseOrder[];
  deliveries: Delivery[];
  bills: SupplierBill[];
  payments: PaymentRecord[];
  stockMovements: StockMovement[];
}

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  reference: string;
  timestamp: string;
  linkUrl?: string;
  icon: React.ReactNode;
}

export const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  auditLogs,
  purchaseOrders,
  deliveries,
  bills,
  payments,
  stockMovements,
}) => {
  const navigate = useNavigate();

  const events: TimelineEvent[] = [];

  // 1. Ingest Audit Logs if present
  auditLogs.forEach(log => {
    let icon = <History className="w-3.5 h-3.5 text-slate-500" />;
    let title = log.entityType.replace(/_/g, ' ');
    let description = '';
    let linkUrl: string | undefined;

    if (log.entityType === 'DELIVERY_PRODUCT_VERIFIED') {
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      title = 'Physical Goods Verified';
      description = `Gate inspection accepted ${log.details?.accepted || 0} units, rejected ${log.details?.rejected || 0}`;
      linkUrl = `/deliveries/${log.entityId}`;
    } else if (log.entityType === 'PURCHASE_ORDER_CREATED') {
      icon = <ShoppingBag className="w-3.5 h-3.5 text-brand-600" />;
      title = 'Purchase Order Created';
      description = `Order placed with ${log.details?.vendor || 'supplier'} for ${log.details?.orderNumber || ''}`;
      linkUrl = `/purchases/${log.entityId}`;
    } else if (log.entityType === 'STOCK_ADJUSTMENT') {
      icon = <Package className="w-3.5 h-3.5 text-sky-600" />;
      title = 'Stock Reconciliation Adjustment';
      description = `${log.details?.productName || 'Item'}: delta ${log.details?.delta > 0 ? '+' : ''}${log.details?.delta}`;
      linkUrl = '/inventory';
    } else {
      description = JSON.stringify(log.details || {}).slice(0, 80);
    }

    events.push({
      id: `audit_${log.id}`,
      type: log.entityType,
      title,
      description,
      reference: log.entityId,
      timestamp: log.timestamp,
      linkUrl,
      icon,
    });
  });

  // 2. If audit logs are few, derive timeline from recent transactions
  deliveries.forEach(d => {
    if (d.productVerifiedAt) {
      events.push({
        id: `del_ver_${d.id}`,
        type: 'DELIVERY_VERIFIED',
        title: 'Goods Received & Inspected',
        description: `Physical count completed for PO #${d.poNumber} (${d.vendorName})`,
        reference: `Challan #${d.challanNumber || 'N/A'}`,
        timestamp: d.productVerifiedAt,
        linkUrl: `/deliveries/${d.id}`,
        icon: <Truck className="w-3.5 h-3.5 text-emerald-600" />,
      });
    }
  });

  purchaseOrders.forEach(po => {
    if (po.createdAt) {
      events.push({
        id: `po_create_${po.id}`,
        type: 'PO_CREATED',
        title: 'Purchase Order Issued',
        description: `Order ${po.orderNumber} sent to ${po.vendorName}`,
        reference: po.orderNumber,
        timestamp: po.createdAt,
        linkUrl: `/purchases/${po.id}`,
        icon: <ShoppingBag className="w-3.5 h-3.5 text-brand-600" />,
      });
    }
  });

  bills.forEach(b => {
    if (b.createdAt) {
      events.push({
        id: `bill_submit_${b.id}`,
        type: 'BILL_SUBMITTED',
        title: 'Supplier Bill Received',
        description: `Invoice #${b.invoiceNumber} from ${b.vendorName} submitted for verification`,
        reference: b.invoiceNumber,
        timestamp: b.createdAt,
        linkUrl: `/bills/${b.id}`,
        icon: <Receipt className="w-3.5 h-3.5 text-indigo-600" />,
      });
    }
  });

  payments.forEach(p => {
    if (p.createdAt || p.paymentDate) {
      events.push({
        id: `pay_rec_${p.id}`,
        type: 'PAYMENT_RECORDED',
        title: 'Supplier Payment Recorded',
        description: `Disbursed ₹${p.amount} to ${p.vendorName} via ${p.paymentMethod}`,
        reference: p.referenceNumber,
        timestamp: p.paymentDate || p.createdAt,
        linkUrl: `/bills/${p.billId}`,
        icon: <DollarSign className="w-3.5 h-3.5 text-emerald-600" />,
      });
    }
  });

  stockMovements.forEach(sm => {
    if (sm.timestamp && sm.type !== 'PURCHASE_RECEIPT') {
      events.push({
        id: `stock_mov_${sm.id}`,
        type: sm.type,
        title: 'Inventory Movement',
        description: `${sm.quantity > 0 ? '+' : ''}${sm.quantity} units for ${sm.productName}`,
        reference: sm.sku,
        timestamp: sm.timestamp,
        linkUrl: '/inventory',
        icon: <Package className="w-3.5 h-3.5 text-sky-600" />,
      });
    }
  });

  // Deduplicate and sort descending by timestamp
  const seenIds = new Set<string>();
  const uniqueEvents: TimelineEvent[] = [];
  events.forEach(e => {
    const tsStr = toIsoDateTime(e.timestamp);
    const key = `${e.title}_${e.reference}_${tsStr ? tsStr.slice(0, 16) : ''}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      uniqueEvents.push(e);
    }
  });

  uniqueEvents.sort(
    (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );

  const displayEvents = uniqueEvents.slice(0, 6);

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Recent Business Activity
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              Audit Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational event log across purchasing, receiving, stock reconciliation, and accounts
          </p>
        </div>
        <Link
          to="/audit"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center transition-colors"
        >
          <span>View Audit Trail</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </div>

      {/* Activity Timeline */}
      {displayEvents.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
          No business activity recorded yet. Create orders or receive deliveries to generate audit events.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {displayEvents.map(evt => (
            <div
              key={evt.id}
              onClick={() => evt.linkUrl && navigate(evt.linkUrl)}
              className={`relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-2 rounded-md transition-colors ${
                evt.linkUrl ? 'hover:bg-slate-50/80 cursor-pointer' : ''
              }`}
            >
              {/* Timeline Bullet Icon */}
              <div className="absolute -left-6 top-2.5 w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center shadow-xs">
                {evt.icon}
              </div>

              <div className="min-w-0 pr-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800">{evt.title}</span>
                  {evt.reference && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                      {evt.reference}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mt-0.5 truncate">
                  {evt.description}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-mono whitespace-nowrap self-start sm:self-center shrink-0">
                {formatDateTime(evt.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
