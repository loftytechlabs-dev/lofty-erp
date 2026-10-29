import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Business, BusinessRole } from '../../types';
import { RolePermissions, ROLE_DEFINITIONS } from '../../lib/constants';
import { Button } from '../common/Button';
import { Plus, Truck, RefreshCw, Calendar, Clock, Check, Sparkles, LayoutGrid, LayoutDashboard } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export type DateRangePreset = 'today' | '7days' | '30days' | 'all' | 'custom';

export interface DateRangeState {
  preset: DateRangePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

interface DashboardHeaderProps {
  business: Business;
  role: BusinessRole;
  permissions: RolePermissions;
  dateRange: DateRangeState;
  onDateRangeChange: (range: DateRangeState) => void;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  lastUpdated: Date;
  activeView?: 'overview' | 'canvas';
  onViewChange?: (view: 'overview' | 'canvas') => void;
  onOpenAiCopilot?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  business,
  role,
  permissions,
  dateRange,
  onDateRangeChange,
  onRefresh,
  isRefreshing,
  lastUpdated,
  activeView = 'overview',
  onViewChange,
  onOpenAiCopilot,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showCustomInputs, setShowCustomInputs] = useState(dateRange.preset === 'custom');
  const [customStart, setCustomStart] = useState(dateRange.startDate);
  const [customEnd, setCustomEnd] = useState(dateRange.endDate);

  const roleDef = ROLE_DEFINITIONS[role] || { name: role, color: 'bg-slate-100 text-slate-700 border-slate-200' };

  // Calculate preset ranges
  const handlePresetClick = (preset: DateRangePreset) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setShowCustomInputs(false);
      onDateRangeChange({ preset: 'today', startDate: todayStr, endDate: todayStr });
    } else if (preset === '7days') {
      setShowCustomInputs(false);
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      onDateRangeChange({ preset: '7days', startDate: d.toISOString().split('T')[0], endDate: todayStr });
    } else if (preset === '30days') {
      setShowCustomInputs(false);
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      onDateRangeChange({ preset: '30days', startDate: d.toISOString().split('T')[0], endDate: todayStr });
    } else if (preset === 'all') {
      setShowCustomInputs(false);
      onDateRangeChange({ preset: 'all', startDate: '2020-01-01', endDate: '2030-12-31' });
    } else if (preset === 'custom') {
      setShowCustomInputs(true);
    }
  };

  const applyCustomRange = () => {
    if (customStart && customEnd) {
      onDateRangeChange({
        preset: 'custom',
        startDate: customStart,
        endDate: customEnd,
      });
    }
  };

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
      {/* Title & Context */}
      <div>
        <div className="flex items-center space-x-2.5">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {t('dashboard.title', 'Operations Overview')}
          </h1>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleDef.color}`}
            title={roleDef.description}
          >
            {roleDef.name}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
          <span className="font-semibold text-slate-700">{business.name}</span>
          <span className="text-slate-300">&bull;</span>
          <span>{t('dashboard.subtitle', 'Unified operational status and supply chain health.')}</span>
        </p>
      </div>

      {/* Right Controls: Quick Range + Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Period Switcher */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => handlePresetClick('7days')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              dateRange.preset === '7days'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => handlePresetClick('30days')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              dateRange.preset === '30days'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => handlePresetClick('all')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              dateRange.preset === 'all'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Time
          </button>
        </div>

        {/* Refresh Icon */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          title={`Refresh data (Updated ${formatLastUpdated(lastUpdated)})`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-600' : ''}`} />
        </button>

        {onOpenAiCopilot && (
          <Button
            variant="outline"
            size="sm"
            className="border-orange-300 text-orange-700 bg-orange-50/50 hover:bg-orange-100/70 font-semibold shadow-xs"
            leftIcon={<Sparkles className="w-4 h-4 text-orange-600 animate-pulse" />}
            onClick={onOpenAiCopilot}
          >
            Ask AI
          </Button>
        )}

        {permissions.canVerifyDelivery && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Truck className="w-4 h-4 text-slate-600" />}
            onClick={() => navigate('/deliveries')}
          >
            Receive Delivery
          </Button>
        )}

        {permissions.canCreatePO && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/purchases/new')}
          >
            New PO
          </Button>
        )}
      </div>
    </div>
  );
};
