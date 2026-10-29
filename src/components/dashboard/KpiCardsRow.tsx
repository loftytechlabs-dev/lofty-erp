import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Product,
  StockBalance,
  PurchaseOrder,
  Delivery,
  SupplierBill,
  VendorProduct,
} from '../../types';
import { formatCurrency } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  DollarSign,
  Package,
  ShoppingBag,
  Truck,
  Receipt,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Info,
} from 'lucide-react';

interface KpiCardsRowProps {
  products: Product[];
  stockBalances: StockBalance[];
  purchaseOrders: PurchaseOrder[];
  deliveries: Delivery[];
  bills: SupplierBill[];
  vendorProducts: VendorProduct[];
  currencySymbol?: string;
}

export const KpiCardsRow: React.FC<KpiCardsRowProps> = ({
  products,
  stockBalances,
  purchaseOrders,
  deliveries,
  bills,
  vendorProducts,
  currencySymbol = '₹',
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // --- KPI 1: Inventory Value ---
  // Calculate total inventory value using product unit costs from vendorProducts or POs
  let totalInventoryValue = 0;
  let activeProductsInStockCount = 0;

  const productStockMap = new Map<string, number>();
  stockBalances.forEach(sb => {
    const current = productStockMap.get(sb.productId) || 0;
    productStockMap.set(sb.productId, current + sb.quantity);
  });

  products.forEach(p => {
    const qty = productStockMap.get(p.id) || 0;
    if (qty > 0) {
      activeProductsInStockCount++;
      // Find agreed purchase price from vendorProducts or fallback to PO line items
      const vp = vendorProducts.find(item => item.productId === p.id && item.isActive);
      let unitCost = vp ? vp.vendorPrice : 0;

      if (!unitCost) {
        // Search in purchase order items
        for (const po of purchaseOrders) {
          const matchedItem = po.items.find(it => it.productId === p.id);
          if (matchedItem) {
            unitCost = matchedItem.unitPrice;
            break;
          }
        }
      }

      totalInventoryValue += qty * unitCost;
    }
  });

  // --- KPI 2: Available Stock ---
  const activeProducts = products.filter(p => p.isActive);
  let inStockProductsCount = 0;
  let outOfStockProductsCount = 0;
  const unitBreakdownMap = new Map<string, number>();

  activeProducts.forEach(p => {
    const qty = productStockMap.get(p.id) || 0;
    if (qty > 0) {
      inStockProductsCount++;
      const currentUnitSum = unitBreakdownMap.get(p.unit) || 0;
      unitBreakdownMap.set(p.unit, currentUnitSum + qty);
    } else {
      outOfStockProductsCount++;
    }
  });

  // Format units breakdown without mixing incompatible units
  const unitsSummary = Array.from(unitBreakdownMap.entries())
    .map(([unit, qty]) => `${qty} ${unit}`)
    .slice(0, 3)
    .join(' • ');

  // --- KPI 3: Active Purchase Orders ---
  const activePOs = purchaseOrders.filter(
    po => po.status === 'Ordered' || po.status === 'Partially Received'
  );
  const totalActivePOValue = activePOs.reduce((sum, po) => sum + po.grandTotal, 0);
  const awaitingDeliveryCount = activePOs.filter(po => po.status === 'Ordered').length;

  // --- KPI 4: Pending Deliveries ---
  const pendingProductVerifications = deliveries.filter(
    d => d.productVerificationStatus === 'PENDING'
  );
  const discrepancyDeliveries = deliveries.filter(
    d => d.productVerificationStatus === 'ACCEPTED_WITH_DISCREPANCY'
  );

  // --- KPI 5: Supplier Bills Outstanding ---
  // Only APPROVED/VERIFIED bills count as liabilities
  const approvedBills = bills.filter(b => b.status === 'VERIFIED');
  const approvedOutstandingAmount = approvedBills.reduce(
    (sum, b) => sum + (b.totalAmount - (b.paidAmount || 0)),
    0
  );
  const approvedUnpaidCount = approvedBills.filter(b => b.paymentStatus !== 'PAID').length;

  // Bills awaiting verification are strictly separated
  const pendingBills = bills.filter(b => b.status === 'PENDING');
  const pendingBillsAmount = pendingBills.reduce((sum, b) => sum + b.totalAmount, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Inventory Value */}
      <div
        onClick={() => navigate('/inventory')}
        className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('kpi.inventoryValue', 'Total Inventory Value')}
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Package className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(totalInventoryValue, currencySymbol)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t('kpi.acrossMaterials', 'Across {{count}} catalog materials', { count: activeProducts.length })}
          </p>
        </div>
      </div>

      {/* KPI 2: Active Purchase Orders */}
      <div
        onClick={() => navigate('/purchases')}
        className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('dashboard.activeOrders', 'Active Orders')}
          </span>
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {activePOs.length}{' '}
            <span className="text-sm font-normal text-slate-500">orders</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {formatCurrency(totalActivePOValue, currencySymbol)} {t('kpi.committedSpend', 'Committed Spend')}
          </p>
        </div>
      </div>

      {/* KPI 3: Pending Deliveries */}
      <div
        onClick={() => navigate('/deliveries')}
        className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('kpi.deliveriesDock', 'Dock Deliveries')}
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {pendingProductVerifications.length}{' '}
            <span className="text-sm font-normal text-slate-500">to inspect</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {pendingProductVerifications.length > 0
              ? t('kpi.itemsAwaitingCount', '{{count}} items awaiting count', { count: pendingProductVerifications.length })
              : t('kpi.inTransit', '{{count}} in transit', { count: awaitingDeliveryCount })}
          </p>
        </div>
      </div>

      {/* KPI 4: Supplier Bills Outstanding */}
      <div
        onClick={() => navigate('/bills')}
        className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('kpi.unpaidBills', 'Unpaid Invoices')}
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(approvedOutstandingAmount, currencySymbol)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t('kpi.awaiting3Way', '{{count}} awaiting 3-way match', { count: approvedUnpaidCount })}
          </p>
        </div>
      </div>
    </div>
  );
};
