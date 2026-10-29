import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  Bell,
  HelpCircle,
  LogOut,
  User,
  Plus,
  Shield,
  Check,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { ROLE_DEFINITIONS } from '../../lib/constants';

export const TopBar: React.FC<{ onOpenMobileMenu?: () => void }> = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { activeBusiness, businesses, switchBusiness, role } = useBusiness();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useLanguage();

  const [bizDropdownOpen, setBizDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between">
      {/* Left: Branding & Business Switcher */}
      <div className="flex items-center space-x-4">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center space-x-2 text-slate-900 group">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-xs group-hover:bg-brand-700 transition-colors">
            <span className="font-bold text-sm tracking-tight">L</span>
          </div>
          <span className="font-bold text-base tracking-tight hidden sm:inline-block">
            Lofty <span className="text-brand-600 font-semibold">ERP</span>
          </span>
        </Link>

        {/* Business Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setBizDropdownOpen(!bizDropdownOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 transition-colors max-w-[200px] md:max-w-[260px] truncate"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{activeBusiness ? activeBusiness.name : t('topbar.selectBusiness', 'Select Business')}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
          </button>

          {bizDropdownOpen && (
            <div
              className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-40"
              onMouseLeave={() => setBizDropdownOpen(false)}
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t('topbar.yourBusinesses', 'Your Businesses')}
              </div>
              {businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    switchBusiness(b.id);
                    setBizDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    activeBusiness?.id === b.id ? 'font-semibold text-brand-600 bg-orange-50/50' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  {activeBusiness?.id === b.id && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
                </button>
              ))}

              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setBizDropdownOpen(false);
                    navigate('/create-business');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-brand-600 font-medium hover:bg-orange-50 flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('topbar.createNew', 'Create New Business')}</span>
                </button>
                <button
                  onClick={() => {
                    setBizDropdownOpen(false);
                    navigate('/join');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center space-x-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{t('topbar.joinBusiness', 'Join with Invitation Code')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Role, Language Toggle, Notifications, Help, Profile */}
      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Language Selector Dropdown */}
        <LanguageSelector variant="compact" />

        {/* Authoritative Role Badge (Permanent, locked once assigned) */}
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center space-x-1.5 shadow-2xs ${ROLE_DEFINITIONS[role].color}`}
          title={`Assigned Operational Role: ${ROLE_DEFINITIONS[role].name}`}
        >
          <Shield className="w-3 h-3 opacity-70" />
          <span>{role}</span>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors"
            title="In-app Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-600 ring-2 ring-white" />
            )}
          </button>

          {notifDropdownOpen && (
            <div
              className="absolute right-0 mt-1.5 w-80 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-40"
              onMouseLeave={() => setNotifDropdownOpen(false)}
            >
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-800">Notifications ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-brand-600 hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No new notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-3 text-left hover:bg-slate-50 cursor-pointer transition-colors ${
                        !n.isRead ? 'bg-orange-50/30' : ''
                      }`}
                    >
                      <div className="text-xs font-medium text-slate-800">{n.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Help & User Guide Button */}
        <Link
          to="/help"
          className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-orange-50 transition-colors"
          title="Complete Help & User Guide"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>

        {/* User Profile / Logout */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center space-x-1.5 p-1 rounded-full hover:ring-2 hover:ring-slate-200 transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-medium border border-slate-300">
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
          </button>

          {userDropdownOpen && (
            <div
              className="absolute right-0 mt-1.5 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-40 text-left"
              onMouseLeave={() => setUserDropdownOpen(false)}
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-900 truncate">{user?.displayName}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              </div>

              <Link
                to="/members"
                onClick={() => setUserDropdownOpen(false)}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('nav.members', 'Team & Members')}</span>
              </Link>

              <Link
                to="/settings"
                onClick={() => setUserDropdownOpen(false)}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('nav.settings', 'Settings')}</span>
              </Link>

              <button
                onClick={() => {
                  setUserDropdownOpen(false);
                  signOut();
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2 border-t border-slate-100"
              >
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                <span>{t('topbar.signOut', 'Sign Out')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
