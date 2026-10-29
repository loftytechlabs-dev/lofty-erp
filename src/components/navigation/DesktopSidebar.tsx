import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Truck,
  Receipt,
  Warehouse,
  UserCheck,
  History,
  BookOpen,
} from 'lucide-react';
import { useBusiness } from '../../contexts/BusinessContext';
import { cn } from '../../lib/utils';

export const DesktopSidebar: React.FC = () => {
  const { permissions, role } = useBusiness();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Home',
      icon: LayoutDashboard,
      show: true,
    },
    {
      to: '/purchases',
      label: 'Purchases',
      icon: ShoppingBag,
      show: role === 'Owner' || role === 'Manager' || role === 'Purchasing' || role === 'Accountant',
    },
    {
      to: '/inventory',
      label: 'Inventory',
      icon: Package,
      show: true,
    },
    {
      to: '/vendors',
      label: 'Vendors',
      icon: Users,
      show: role === 'Owner' || role === 'Manager' || role === 'Purchasing',
    },
    {
      to: '/deliveries',
      label: 'Deliveries & QR',
      icon: Truck,
      show: role === 'Owner' || role === 'Manager' || role === 'Warehouse',
    },
    {
      to: '/bills',
      label: 'Bills & GST',
      icon: Receipt,
      show: role === 'Owner' || role === 'Manager' || role === 'Accountant',
    },
    {
      to: '/warehouses',
      label: 'Godowns',
      icon: Warehouse,
      show: true,
    },
    {
      to: '/members',
      label: 'Team Members',
      icon: UserCheck,
      show: role === 'Owner',
    },
    {
      to: '/audit',
      label: 'Audit Trail',
      icon: History,
      show: role === 'Owner' || role === 'Manager',
    },
    {
      to: '/help',
      label: 'User Guide',
      icon: BookOpen,
      show: true,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-56 bg-white border-r border-slate-200 shrink-0 min-h-[calc(100vh-3.5rem)] select-none">
      <div className="p-3 space-y-1">
        {navItems
          .filter(item => item.show)
          .map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-orange-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
                      )}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
      </div>
    </aside>
  );
};
