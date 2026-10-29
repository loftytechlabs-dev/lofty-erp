import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { localStore } from '../../services/store';
import { getPurchaseOrders } from '../../services/purchaseOrderService';
import { getDeliveries } from '../../services/deliveryService';
import { getSupplierBills } from '../../services/billService';
import { getProducts, getWarehouses } from '../../services/productService';
import { getStockBalances, getStockMovements } from '../../services/stockService';
import { getVendors, getVendorProducts } from '../../services/vendorService';
import { getPayments } from '../../services/paymentService';
import {
  PurchaseOrder,
  Delivery,
  SupplierBill,
  Product,
  StockBalance,
  StockMovement,
  Vendor,
  VendorProduct,
  PaymentRecord,
  AuditLog,
  Warehouse,
} from '../../types';

// Dashboard Components
import { DashboardHeader, DateRangeState } from '../../components/dashboard/DashboardHeader';
import { KpiCardsRow } from '../../components/dashboard/KpiCardsRow';
import { DashboardSkeleton } from '../../components/dashboard/DashboardSkeleton';
import { SpendAnalyticsChart } from '../../components/dashboard/SpendAnalyticsChart';
import { StockAnalyticsChart } from '../../components/dashboard/StockAnalyticsChart';
import { AiChatbotDrawer } from '../../components/dashboard/AiChatbotDrawer';
import { PresentationStudioModal } from '../../components/dashboard/PresentationStudioModal';
import { BusinessAiContext } from '../../services/aiService';
import { PresentationContext } from '../../services/presentationService';

// Common Components
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge, getStatusBadgeVariant } from '../../components/common/Badge';
import { withTimeout, formatCurrency, formatDate } from '../../lib/utils';
import {
  Users,
  Package,
  ShoppingBag,
  Receipt,
  Check,
  AlertOctagon,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusiness, role, permissions } = useBusiness();
  const businessId = activeBusiness?.id;

  // Primary Data Collections initialized immediately from localStore (instant render without flicker!)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() =>
    businessId ? localStore.getPurchaseOrders(businessId) : []
  );
  const [deliveries, setDeliveries] = useState<Delivery[]>(() =>
    businessId ? localStore.getDeliveries(businessId) : []
  );
  const [bills, setBills] = useState<SupplierBill[]>(() =>
    businessId ? localStore.getSupplierBills(businessId) : []
  );
  const [products, setProducts] = useState<Product[]>(() =>
    businessId ? localStore.getProducts(businessId) : []
  );
  const [stockBalances, setStockBalances] = useState<StockBalance[]>(() =>
    businessId ? localStore.getStockBalances(businessId) : []
  );
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() =>
    businessId ? localStore.getStockMovements(businessId) : []
  );
  const [vendors, setVendors] = useState<Vendor[]>(() =>
    businessId ? localStore.getVendors(businessId) : []
  );
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>(() =>
    businessId ? localStore.getVendorProducts(businessId) : []
  );
  const [payments, setPayments] = useState<PaymentRecord[]>(() =>
    businessId ? localStore.getPayments(businessId) : []
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    businessId ? localStore.getAuditLogs(businessId) : []
  );
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() =>
    businessId ? localStore.getWarehouses(businessId) : []
  );

  // Page States: Only show skeleton if we truly have NO cached or stored data yet
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!businessId) return false;
    return localStore.getPurchaseOrders(businessId).length === 0 && localStore.getProducts(businessId).length === 0;
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Date Range Filter (Defaults to 'all' so historical sample data displays immediately, but user can pick Today / 7D / 30D / Custom)
  const [dateRange, setDateRange] = useState<DateRangeState>(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const past30 = new Date(today);
    past30.setDate(past30.getDate() - 30);
    return {
      preset: 'all',
      startDate: '2020-01-01',
      endDate: todayStr,
    };
  });

  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState<boolean>(false);
  const aiActionHandlerRef = useRef<((action: any) => void) | null>(null);

  // Business AI Context for Copilot
  const aiContext: BusinessAiContext = useMemo(() => {
    const currentWidgets = businessId ? localStore.getCanvasWidgets(businessId) || [] : [];
    return {
      businessName: activeBusiness?.name || 'My Business',
      currencySymbol: activeBusiness?.currency.symbol || '₹',
      purchaseOrders,
      products,
      stockBalances,
      vendors,
      deliveries,
      bills,
      warehouses,
      currentWidgets: currentWidgets.map(w => ({ id: w.id, type: w.type, title: w.title })),
    };
  }, [activeBusiness, businessId, purchaseOrders, products, stockBalances, vendors, deliveries, bills, warehouses]);

  // Presentation Deck Context for PPT Generation
  const presentationContext: PresentationContext = useMemo(() => ({
    businessName: activeBusiness?.name || 'My Business',
    currencySymbol: activeBusiness?.currency.symbol || '₹',
    purchaseOrders,
    products,
    stockBalances,
    vendors,
    deliveries,
    bills,
    warehouses,
  }), [activeBusiness, purchaseOrders, products, stockBalances, vendors, deliveries, bills, warehouses]);

  // Load Dashboard Data with strict timeout and fallback so UI never gets stuck
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (!businessId) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (isManualRefresh) {
      setIsRefreshing(true);
    }

    // Safety timeout to guarantee unblocking UI even if Firestore or browser network freezes
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      setIsRefreshing(false);
    }, 2000);

    try {
      setError(null);
      // Fetch concurrently via services with 1800ms max timeout per query
      const [
        posRes,
        delRes,
        billsRes,
        prodRes,
        stockBalRes,
        stockMovRes,
        vendRes,
        vpRes,
        payRes,
        whRes,
      ] = await Promise.allSettled([
        withTimeout(getPurchaseOrders(businessId), 1800, localStore.getPurchaseOrders(businessId)),
        withTimeout(getDeliveries(businessId), 1800, localStore.getDeliveries(businessId)),
        withTimeout(getSupplierBills(businessId), 1800, localStore.getSupplierBills(businessId)),
        withTimeout(getProducts(businessId), 1800, localStore.getProducts(businessId)),
        withTimeout(getStockBalances(businessId), 1800, localStore.getStockBalances(businessId)),
        withTimeout(getStockMovements(businessId), 1800, localStore.getStockMovements(businessId)),
        withTimeout(getVendors(businessId), 1800, localStore.getVendors(businessId)),
        withTimeout(getVendorProducts(businessId), 1800, localStore.getVendorProducts(businessId)),
        withTimeout(getPayments(businessId), 1800, localStore.getPayments(businessId)),
        withTimeout(getWarehouses(businessId), 1800, localStore.getWarehouses(businessId)),
      ]);

      if (posRes.status === 'fulfilled' && posRes.value) setPurchaseOrders(posRes.value);
      if (delRes.status === 'fulfilled' && delRes.value) setDeliveries(delRes.value);
      if (billsRes.status === 'fulfilled' && billsRes.value) setBills(billsRes.value);
      if (prodRes.status === 'fulfilled' && prodRes.value) setProducts(prodRes.value);
      if (stockBalRes.status === 'fulfilled' && stockBalRes.value) setStockBalances(stockBalRes.value);
      if (stockMovRes.status === 'fulfilled' && stockMovRes.value) setStockMovements(stockMovRes.value);
      if (vendRes.status === 'fulfilled' && vendRes.value) setVendors(vendRes.value);
      if (vpRes.status === 'fulfilled' && vpRes.value) setVendorProducts(vpRes.value);
      if (payRes.status === 'fulfilled' && payRes.value) setPayments(payRes.value);
      if (whRes.status === 'fulfilled' && whRes.value) setWarehouses(whRes.value);

      setAuditLogs(localStore.getAuditLogs(businessId));
      setLastUpdated(new Date());
    } catch (err: any) {
      console.warn('Dashboard sync fallback notice:', err);
    } finally {
      clearTimeout(safetyTimer);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [businessId]);

  // Initial fetch and subscription to local store updates
  useEffect(() => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }

    loadDashboardData();

    // Subscribe to store mutations without triggering full network re-fetches
    const unsub = localStore.subscribe(() => {
      setPurchaseOrders(localStore.getPurchaseOrders(businessId));
      setDeliveries(localStore.getDeliveries(businessId));
      setBills(localStore.getSupplierBills(businessId));
      setProducts(localStore.getProducts(businessId));
      setStockBalances(localStore.getStockBalances(businessId));
      setStockMovements(localStore.getStockMovements(businessId));
      setVendors(localStore.getVendors(businessId));
      setVendorProducts(localStore.getVendorProducts(businessId));
      setPayments(localStore.getPayments(businessId));
      setAuditLogs(localStore.getAuditLogs(businessId));
      setWarehouses(localStore.getWarehouses(businessId));
    });

    return () => unsub();
  }, [businessId, loadDashboardData]);

  // If no business selected
  if (!activeBusiness) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-white rounded-lg border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">No Business Workspace Selected</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Create or join a business to start managing purchasing, inventory, and deliveries.
        </p>
        <Button variant="primary" onClick={() => navigate('/create-business')}>
          Create Business
        </Button>
      </div>
    );
  }

  // Loading skeleton during cold start
  if (isLoading && purchaseOrders.length === 0 && products.length === 0) {
    return <DashboardSkeleton />;
  }

  // Brand-new empty business check
  const isBrandNewBusiness =
    vendors.length === 0 && products.length === 0 && purchaseOrders.length === 0;

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header: Context, Role, Date Filter, Refresh & Primary Actions */}
      <DashboardHeader
        business={activeBusiness}
        role={role}
        permissions={permissions}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={() => loadDashboardData(true)}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        onOpenAiCopilot={() => setIsAiDrawerOpen(true)}
      />

      {/* Error Alert Banner if sync failed */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            className="font-semibold underline hover:text-red-900"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Onboarding Checklist for Brand New Businesses */}
      {isBrandNewBusiness && (
        <Card className="border-orange-200 bg-orange-50/40">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Welcome to Lofty ERP! Getting Started Checklist
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Complete these 4 simple steps to set up your business operations:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div
                onClick={() => navigate('/vendors')}
                className="p-3 bg-white rounded-lg border border-slate-200 hover:border-brand-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-brand-600">Step 1</span>
                  {vendors.length > 0 ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Users className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-800">Add First Vendor</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Contact info, terms &amp; GSTIN</div>
              </div>

              <div
                onClick={() => navigate('/products')}
                className="p-3 bg-white rounded-lg border border-slate-200 hover:border-brand-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-brand-600">Step 2</span>
                  {products.length > 0 ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Package className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-800">Add Raw Materials</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Units, SKU &amp; reorder limits</div>
              </div>

              <div
                onClick={() => navigate('/vendors')}
                className="p-3 bg-white rounded-lg border border-slate-200 hover:border-brand-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-brand-600">Step 3</span>
                  <ShoppingBag className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-xs font-semibold text-slate-800">Assign to Catalog</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Link vendor purchase prices</div>
              </div>

              <div
                onClick={() => navigate('/purchases/new')}
                className="p-3 bg-white rounded-lg border border-slate-200 hover:border-brand-300 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-brand-600">Step 4</span>
                  <Receipt className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-xs font-semibold text-slate-800">Create First Order</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Guided 4-step PO wizard</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 2. Row 1: Key Performance Indicators (5 compact cards) */}
      <KpiCardsRow
        products={products}
        stockBalances={stockBalances}
        purchaseOrders={purchaseOrders}
        deliveries={deliveries}
        bills={bills}
        vendorProducts={vendorProducts}
        currencySymbol={activeBusiness.currency.symbol}
      />

      {/* 3. Action Alert Banner (if pending deliveries or unpaid bills exist) */}
      {(() => {
        const pendingDels = deliveries.filter(d => d.productVerificationStatus === 'PENDING');
        const pendingBills = bills.filter(b => b.status === 'PENDING');
        if (pendingDels.length === 0 && pendingBills.length === 0) return null;

        return (
          <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-brand-600 shrink-0" />
              <div className="text-slate-800">
                <span className="font-bold">Attention Needed:</span>{' '}
                {pendingDels.length > 0 && (
                  <span>
                    <strong>{pendingDels.length}</strong> {pendingDels.length === 1 ? 'delivery is' : 'deliveries are'} awaiting dock inspection.
                  </span>
                )}{' '}
                {pendingBills.length > 0 && (
                  <span>
                    <strong>{pendingBills.length}</strong> supplier {pendingBills.length === 1 ? 'bill is' : 'bills are'} awaiting 3-way verification.
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {pendingDels.length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => navigate('/deliveries')}>
                  Review Deliveries
                </Button>
              )}
              {pendingBills.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigate('/bills')}>
                  Review Bills
                </Button>
              )}
            </div>
          </div>
        );
      })()}

      {/* 4. Real-time Analytics Charts (Accurate Data Derived Strictly from Active Workspace) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <SpendAnalyticsChart
          purchaseOrders={purchaseOrders}
          supplierBills={bills}
          currencySymbol={activeBusiness.currency.symbol}
        />
        <StockAnalyticsChart
          products={products}
          stockBalances={stockBalances}
          vendorProducts={vendorProducts}
          warehouses={warehouses}
          currencySymbol={activeBusiness.currency.symbol}
        />
      </div>

      {/* 5. Balanced 2-Column Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): In-flight Orders & Deliveries */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Active Orders Pipeline</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Orders in progress, transit, and receipt verification</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/purchases')}
            >
              View All Orders &rarr;
            </Button>
          </div>

          <div className="divide-y divide-slate-100">
            {purchaseOrders.filter(p => p.status !== 'Draft' && p.status !== 'Cancelled').length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No purchase orders in progress.
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/purchases/new')}>
                    + Create First Purchase Order
                  </Button>
                </div>
              </div>
            ) : (
              purchaseOrders
                .filter(p => p.status !== 'Draft' && p.status !== 'Cancelled')
                .slice(0, 5)
                .map(po => (
                  <div
                    key={po.id}
                    onClick={() => navigate(`/purchases/${po.id}`)}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/70 cursor-pointer transition-colors text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{po.orderNumber}</span>
                        <Badge variant={getStatusBadgeVariant(po.status)} size="sm">
                          {po.status}
                        </Badge>
                      </div>
                      <div className="text-slate-500 mt-1">
                        Supplier: <strong className="text-slate-700">{po.vendorName}</strong> &bull; Destination: {po.warehouseName}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-slate-900">
                        {formatCurrency(po.grandTotal, activeBusiness?.currency.symbol)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Due: {formatDate(po.expectedDeliveryDate)}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Inventory & Reorder Watchlist */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inventory Watchlist</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Current stock levels vs reorder limits</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/inventory')}
            >
              Inventory &rarr;
            </Button>
          </div>

          <div className="divide-y divide-slate-100">
            {products.slice(0, 6).map(prod => {
              const totalStock = stockBalances
                .filter(sb => sb.productId === prod.id)
                .reduce((acc, sb) => acc + sb.quantity, 0);

              const isOut = totalStock <= 0;
              const isLow = totalStock > 0 && totalStock <= prod.reorderThreshold;

              return (
                <div key={prod.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{prod.name}</div>
                    <div className="text-[11px] text-slate-400">
                      SKU: {prod.sku} &bull; Reorder at: {prod.reorderThreshold} {prod.unit}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`font-bold ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                        {totalStock} {prod.unit}
                      </div>
                      <span className={`text-[10px] font-semibold uppercase ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </div>

                    {(isOut || isLow) && permissions.canCreatePO && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/purchases/new`)}
                      >
                        Order
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating AI Copilot Action Button */}
      {!isAiDrawerOpen && (
        <button
          type="button"
          onClick={() => setIsAiDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-xs shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center space-x-2 border border-orange-300/40 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span>Ask Lofty AI</span>
        </button>
      )}

      {/* AI Chatbot Drawer Copilot */}
      <AiChatbotDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        context={aiContext}
        onExecuteAction={action => {
          if (action.type === 'OPEN_PPT') {
            setIsPresentationOpen(true);
            return;
          }
          if (aiActionHandlerRef.current) {
            aiActionHandlerRef.current(action);
          }
        }}
      />

      {/* Presentation Deck Studio Modal */}
      <PresentationStudioModal
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        context={presentationContext}
      />
    </div>
  );
};
