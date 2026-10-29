import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
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
      loadData();
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Procure raw materials with vendor-negotiated catalog prices and track receipts.
          </p>
        </div>

        {permissions.canCreatePO && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/purchases/new')}
          >
            Create Purchase Order
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="max-w-md w-full">
          <Input
            placeholder="Search by PO #, vendor name, or godown..."
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
              {status}
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
                <th className="py-2.5 px-4 font-semibold">PO Number</th>
                <th className="py-2.5 px-4 font-semibold">Vendor / Supplier</th>
                <th className="py-2.5 px-4 font-semibold">Destination Godown</th>
                <th className="py-2.5 px-4 font-semibold">Due Date</th>
                <th className="py-2.5 px-4 font-semibold text-right">Grand Total</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                <th className="py-2.5 px-4 font-semibold text-center">Action</th>
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
                      View
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
          No purchase orders found matching current filters.
        </div>
      )}
    </div>
  );
};
