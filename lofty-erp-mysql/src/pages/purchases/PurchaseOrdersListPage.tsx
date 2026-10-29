import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localStore } from '../../services/store';
import { getPurchaseOrders } from '../../services/purchaseOrderService';
import { PurchaseOrder, POStatus } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge, getStatusBadgeVariant } from '../../components/common/Badge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { ShoppingBag, Plus, Search, ArrowRight, Eye, Calendar, Building } from 'lucide-react';

export const PurchaseOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusiness, permissions } = useBusiness();
  const { t, formatDate, formatCurrency } = useLanguage();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadData = async () => {
    if (!activeBusiness) return;
    const list = await getPurchaseOrders(activeBusiness.id);
    setOrders(list);
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      if (activeBusiness) {
        setOrders(localStore.getPurchaseOrders(activeBusiness.id));
      }
    });
    return () => unsub();
  }, [activeBusiness]);

  const filtered = orders.filter(po => {
    const matchesQuery =
      po.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.warehouseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('purchases.title', 'Purchase Orders')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('purchases.subtitle', 'Vendor purchase orders, line items, and delivery tracking.')}
          </p>
        </div>

        {permissions.canCreatePO && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/purchases/new')}
          >
            {t('purchases.newPO', 'Create Purchase Order')}
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="max-w-md w-full">
          <Input
            placeholder={t('common.searchPlaceholder', 'Search by PO #, vendor name, or godown...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftAddon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['ALL', 'Ordered', 'Partially Received', 'Received', 'Draft', 'Closed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-slate-900 text-white font-medium shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {status === 'ALL' ? t('common.all', 'All') : t(status, status)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{t('purchases.orderNumber', 'PO Number')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('purchases.vendor', 'Vendor / Supplier')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('purchases.godown', 'Destination Godown')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('purchases.expectedDate', 'Due Date')}</th>
                <th className="py-2.5 px-4 font-semibold text-right">{t('purchases.grandTotal', 'Grand Total')}</th>
                <th className="py-2.5 px-4 font-semibold text-center">{t('common.status', 'Status')}</th>
                <th className="py-2.5 px-4 font-semibold text-center">{t('common.actions', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(po => (
                <tr
                  key={po.id}
                  onClick={() => navigate(`/purchases/${po.id}`)}
                  className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-brand-700">{po.orderNumber}</td>
                  <td className="py-3 px-4 text-slate-900 font-medium">{po.vendorName}</td>
                  <td className="py-3 px-4 text-slate-600">{po.warehouseName}</td>
                  <td className="py-3 px-4 text-slate-600">{formatDate(po.expectedDeliveryDate)}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(po.grandTotal, activeBusiness?.currency.symbol)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={getStatusBadgeVariant(po.status)} size="sm">
                      {po.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button variant="ghost" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                      {t('common.details', 'View')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
          {t('common.noData', 'No purchase orders found matching current filters.')}
        </div>
      )}
    </div>
  );
};
