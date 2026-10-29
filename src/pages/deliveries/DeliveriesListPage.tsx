import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { localStore } from '../../services/store';
import { getDeliveries } from '../../services/deliveryService';
import { Delivery } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge, getStatusBadgeVariant } from '../../components/common/Badge';
import { formatDate } from '../../lib/utils';
import { Truck, Search, Eye, CheckCircle2, AlertCircle } from 'lucide-react';

export const DeliveriesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusiness } = useBusiness();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadData = async () => {
    if (!activeBusiness) return;
    const list = await getDeliveries(activeBusiness.id);
    setDeliveries(list);
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, [activeBusiness]);

  const filtered = deliveries.filter(d => {
    const matchQ =
      d.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.challanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.warehouseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchS = statusFilter === 'ALL' || d.status === statusFilter;
    return matchQ && matchS;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivery Registrations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Truck arrivals, QR check-ins, independent physical counting and bill reviews.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="max-w-md w-full">
          <Input
            placeholder="Search by challan #, PO #, vendor, or godown..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftAddon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['ALL', 'AWAITING_OWNER_CONFIRMATION', 'AWAITING_REVIEW', 'PARTIALLY_VERIFIED', 'VERIFIED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 text-white font-medium shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s.replace(/_/g, ' ')}
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
                <th className="py-2.5 px-4 font-semibold">Challan / DC #</th>
                <th className="py-2.5 px-4 font-semibold">Purchase Order</th>
                <th className="py-2.5 px-4 font-semibold">Vendor</th>
                <th className="py-2.5 px-4 font-semibold">Godown</th>
                <th className="py-2.5 px-4 font-semibold">Arrival Date</th>
                <th className="py-2.5 px-4 font-semibold text-center">Physical Goods</th>
                <th className="py-2.5 px-4 font-semibold text-center">Supplier Bill</th>
                <th className="py-2.5 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(d => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/deliveries/${d.id}`)}
                  className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div className="flex items-center space-x-1.5">
                      <span>{d.challanNumber || 'N/A'}</span>
                      {d.billPhotoBase64 && (
                        <span className="text-[10px] bg-orange-100 text-brand-700 px-1.5 py-0.5 rounded font-semibold" title="Bill Photo Attached">
                          📷 Bill
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-brand-700">{d.poNumber}</td>
                  <td className="py-3 px-4 text-slate-800">{d.vendorName}</td>
                  <td className="py-3 px-4 text-slate-600">{d.warehouseName}</td>
                  <td className="py-3 px-4 text-slate-600">{formatDate(d.challanDate)}</td>
                  <td className="py-3 px-4 text-center">
                    {d.hasQuantityDiscrepancy && d.ownerConfirmationStatus === 'PENDING' ? (
                      <Badge variant="warning" size="sm">
                        Waiting Owner OK
                      </Badge>
                    ) : d.ownerConfirmationStatus === 'REJECTED' ? (
                      <Badge variant="danger" size="sm">
                        Rejected
                      </Badge>
                    ) : (
                      <Badge variant={getStatusBadgeVariant(d.productVerificationStatus)} size="sm">
                        {d.productVerificationStatus.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={getStatusBadgeVariant(d.billVerificationStatus)} size="sm">
                      {d.billVerificationStatus.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                      Inspect
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
          No delivery records found matching current criteria.
        </div>
      )}
    </div>
  );
};
