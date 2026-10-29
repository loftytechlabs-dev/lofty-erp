import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  MoreHorizontal,
  Truck,
  Receipt,
  Warehouse,
  UserCheck,
  BookOpen,
  X,
  History,
  Settings,
} from 'lucide-react';
import { useBusiness } from '../../contexts/BusinessContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { cn } from '../../lib/utils';

export const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useBusiness();
  const { t } = useLanguage();
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  const mainTabs = role === 'Warehouse' ? [
    { to: '/dashboard', label: t('nav.home', 'Home'), icon: LayoutDashboard },
    { to: '/deliveries', label: t('nav.deliveries', 'Deliveries'), icon: Truck },
    { to: '/inventory', label: t('nav.inventory', 'Inventory'), icon: Package },
    { to: '/warehouses', label: t('nav.godowns', 'Godowns'), icon: Warehouse },
  ] : role === 'Accountant' ? [
    { to: '/dashboard', label: t('nav.home', 'Home'), icon: LayoutDashboard },
    { to: '/bills', label: t('nav.bills', 'Bills & GST'), icon: Receipt },
    { to: '/inventory', label: t('nav.inventory', 'Inventory'), icon: Package },
    { to: '/purchases', label: t('nav.purchases', 'Purchases'), icon: ShoppingBag },
  ] : [
    { to: '/dashboard', label: t('nav.home', 'Home'), icon: LayoutDashboard },
    { to: '/purchases', label: t('nav.purchases', 'Purchases'), icon: ShoppingBag },
    { to: '/inventory', label: t('nav.inventory', 'Inventory'), icon: Package },
    { to: '/vendors', label: t('nav.vendors', 'Vendors'), icon: Users },
  ];

  const secondaryLinks = [
    { to: '/deliveries', label: t('nav.deliveries', 'Deliveries & QR Portal'), icon: Truck, show: role === 'Owner' || role === 'Manager' || role === 'Warehouse' },
    { to: '/bills', label: t('nav.bills', 'Supplier Bills & GST'), icon: Receipt, show: role === 'Owner' || role === 'Manager' || role === 'Accountant' },
    { to: '/warehouses', label: t('nav.godowns', 'Godowns & Warehouses'), icon: Warehouse, show: true },
    { to: '/members', label: t('nav.members', 'Team & Invitations'), icon: UserCheck, show: role === 'Owner' },
    { to: '/audit', label: t('nav.audit', 'Audit Trail'), icon: History, show: role === 'Owner' || role === 'Manager' },
    { to: '/help', label: t('nav.help', 'Help & User Guide'), icon: BookOpen, show: true },
    { to: '/settings', label: t('nav.settings', 'Settings'), icon: Settings, show: true },
  ].filter(l => l.show !== false);

  return (
    <>
      {/* Fixed Bottom Bar on Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 h-16 flex items-center justify-around px-2 pb-safe shadow-lg">
        {mainTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors min-h-[44px]',
                  isActive ? 'text-brand-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                )
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </NavLink>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setMoreDrawerOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full py-1 text-center text-slate-500 hover:text-slate-800 transition-colors min-h-[44px]',
            moreDrawerOpen && 'text-brand-600 font-semibold'
          )}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">More</span>
        </button>
      </nav>

      {/* More Bottom Sheet Drawer */}
      {moreDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMoreDrawerOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-2xl shadow-2xl p-5 border-t border-slate-200 z-10 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-900">All Modules & Tools</span>
              <button
                onClick={() => setMoreDrawerOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4">
              {secondaryLinks
                .filter(item => item.show !== false)
                .map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      onClick={() => {
                        setMoreDrawerOpen(false);
                        navigate(item.to);
                      }}
                      className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-brand-200 text-slate-700 hover:text-brand-700 transition-colors"
                    >
                      <Icon className="w-6 h-6 text-slate-600 mb-1.5" />
                      <span className="text-xs font-medium text-center">{item.label}</span>
                    </button>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {t('common.language', 'Language')}
              </div>
              <LanguageSelector variant="full" className="w-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
