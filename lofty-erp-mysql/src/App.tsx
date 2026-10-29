import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BusinessProvider, useBusiness } from './contexts/BusinessContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Navigation Components
import { TopBar } from './components/navigation/TopBar';
import { MobileNav } from './components/navigation/MobileNav';
import { RadialMenu } from './components/navigation/RadialMenu';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { OmnipotentAiModal } from './components/ai/OmnipotentAiModal';

// Pages
import { SignInPage } from './pages/auth/SignInPage';
import { OnboardingPage } from './pages/auth/OnboardingPage';
import { CreateBusinessPage } from './pages/auth/CreateBusinessPage';
import { JoinBusinessPage } from './pages/auth/JoinBusinessPage';

import { DashboardPage } from './pages/dashboard/DashboardPage';
import { VendorsListPage } from './pages/vendors/VendorsListPage';
import { VendorDetailPage } from './pages/vendors/VendorDetailPage';
import { ProductsListPage } from './pages/products/ProductsListPage';
import { WarehousesListPage } from './pages/products/WarehousesListPage';
import { PurchaseOrdersListPage } from './pages/purchases/PurchaseOrdersListPage';
import { CreatePurchaseOrderPage } from './pages/purchases/CreatePurchaseOrderPage';
import { PurchaseOrderDetailPage } from './pages/purchases/PurchaseOrderDetailPage';
import { DeliveriesListPage } from './pages/deliveries/DeliveriesListPage';
import { DeliveryPortalPage } from './pages/deliveries/DeliveryPortalPage';
import { DeliveryReviewPage } from './pages/deliveries/DeliveryReviewPage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { SupplierBillsListPage } from './pages/bills/SupplierBillsListPage';
import { BillDetailPage } from './pages/bills/BillDetailPage';
import { MembersListPage } from './pages/members/MembersListPage';
import { AuditHistoryPage } from './pages/reports/AuditHistoryPage';
import { HelpPage } from './pages/help/HelpPage';
import { SettingsPage } from './pages/settings/SettingsPage';

// Protected App Layout
const AppLayout: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { loading: bizLoading } = useBusiness();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenAi = () => setIsAiModalOpen(true);
    window.addEventListener('lofty:open-ai', handleOpenAi);
    return () => window.removeEventListener('lofty:open-ai', handleOpenAi);
  }, []);

  if (authLoading || bizLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner message="Starting Lofty ERP..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-8 max-w-[1440px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
      <MobileNav />
      {/* Distinctive desktop radial right-click navigation menu */}
      <RadialMenu />

      {/* Global Omnipotent AI Window Modal */}
      <OmnipotentAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <BusinessProvider>
            <NotificationProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/create-business" element={<CreateBusinessPage />} />
              <Route path="/join" element={<JoinBusinessPage />} />

              {/* Public Standalone Mobile QR Delivery Portal */}
              <Route path="/delivery-portal" element={<DeliveryPortalPage />} />

              {/* Protected Workspace Routes */}
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="vendors" element={<VendorsListPage />} />
                <Route path="vendors/:vendorId" element={<VendorDetailPage />} />
                <Route path="products" element={<ProductsListPage />} />
                <Route path="warehouses" element={<WarehousesListPage />} />
                <Route path="purchases" element={<PurchaseOrdersListPage />} />
                <Route path="purchases/new" element={<CreatePurchaseOrderPage />} />
                <Route path="purchases/:poId" element={<PurchaseOrderDetailPage />} />
                <Route path="deliveries" element={<DeliveriesListPage />} />
                <Route path="deliveries/:deliveryId" element={<DeliveryReviewPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="bills" element={<SupplierBillsListPage />} />
                <Route path="bills/:billId" element={<BillDetailPage />} />
                <Route path="members" element={<MembersListPage />} />
                <Route path="audit" element={<AuditHistoryPage />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* 404 Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </NotificationProvider>
        </BusinessProvider>
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
  );
};

export default App;
