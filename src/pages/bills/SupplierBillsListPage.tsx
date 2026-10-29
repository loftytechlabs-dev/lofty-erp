import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { localStore } from '../../services/store';
import { getSupplierBills, createSupplierBill } from '../../services/billService';
import { SupplierBill, PurchaseOrder } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge, getStatusBadgeVariant } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Receipt, Search, Eye, Plus, CreditCard, CheckCircle2, FileText } from 'lucide-react';

export const SupplierBillsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusiness, permissions } = useBusiness();
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Record Bill Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [billItems, setBillItems] = useState<{ productId: string; productName: string; sku: string; billedQuantity: number; unitPrice: number; taxRate: number }[]>([]);
  const [billNotes, setBillNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!activeBusiness) return;
    const list = await getSupplierBills(activeBusiness.id);
    setBills(list);
    const pos = localStore.getPurchaseOrders(activeBusiness.id).filter(p => p.status !== 'Draft' && p.status !== 'Cancelled');
    setPurchaseOrders(pos);
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, [activeBusiness]);

  // When selected PO changes, prefill line items
  useEffect(() => {
    if (!selectedPoId) {
      setBillItems([]);
      return;
    }
    const po = purchaseOrders.find(p => p.id === selectedPoId);
    if (po) {
      setBillItems(
        po.items.map(it => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          billedQuantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate || 18,
        }))
      );
    }
  }, [selectedPoId, purchaseOrders]);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !selectedPoId || !invoiceNumber.trim() || billItems.length === 0) return;

    const po = purchaseOrders.find(p => p.id === selectedPoId);
    if (!po) return;

    setSubmitting(true);
    try {
      const newBill = await createSupplierBill(activeBusiness.id, po, {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        lineItems: billItems,
        notes: billNotes.trim(),
      });

      setCreateModalOpen(false);
      setInvoiceNumber('');
      setSelectedPoId('');
      setBillNotes('');
      await loadData();
      navigate(`/bills/${newBill.id}`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to record supplier bill');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = bills.filter(b => {
    const matchQ =
      b.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchS = statusFilter === 'ALL' || b.paymentStatus === statusFilter || b.status === statusFilter;
    return matchQ && matchS;
  });

  // Calculate totals
  const totalBilled = bills.reduce((acc, b) => acc + b.totalAmount, 0);
  const totalPaid = bills.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const totalOutstanding = totalBilled - totalPaid;
  const totalGst = bills.reduce((acc, b) => acc + b.totalTax, 0);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Supplier Bills & GST Records</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review invoices against purchase orders, track input tax credit, and manage payments.
          </p>
        </div>

        {permissions.canVerifyBill && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Record Supplier Invoice
          </Button>
        )}
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Invoiced</span>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {formatCurrency(totalBilled, activeBusiness?.currency.symbol)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{bills.length} supplier invoices</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Paid</span>
          <div className="text-lg font-bold text-emerald-600 mt-1">
            {formatCurrency(totalPaid, activeBusiness?.currency.symbol)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Settled to suppliers</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Outstanding Balance</span>
          <div className="text-lg font-bold text-brand-600 mt-1">
            {formatCurrency(totalOutstanding, activeBusiness?.currency.symbol)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pending payment</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Recorded GST Tax</span>
          <div className="text-lg font-bold text-indigo-600 mt-1">
            {formatCurrency(totalGst, activeBusiness?.currency.symbol)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Input tax credit eligible</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="max-w-md w-full">
          <Input
            placeholder="Search by invoice #, PO #, or vendor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftAddon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'VERIFIED'].map(s => (
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
                <th className="py-2.5 px-4 font-semibold">Invoice #</th>
                <th className="py-2.5 px-4 font-semibold">Vendor</th>
                <th className="py-2.5 px-4 font-semibold">Order #</th>
                <th className="py-2.5 px-4 font-semibold">Invoice Date</th>
                <th className="py-2.5 px-4 font-semibold text-right">Taxable Value</th>
                <th className="py-2.5 px-4 font-semibold text-right">GST Tax</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Amount</th>
                <th className="py-2.5 px-4 font-semibold text-center">Verification</th>
                <th className="py-2.5 px-4 font-semibold text-center">Payment</th>
                <th className="py-2.5 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(b => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/bills/${b.id}`)}
                  className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-slate-900">{b.invoiceNumber}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{b.vendorName}</td>
                  <td className="py-3 px-4 font-semibold text-brand-700">{b.poNumber}</td>
                  <td className="py-3 px-4 text-slate-600">{formatDate(b.invoiceDate)}</td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {formatCurrency(b.subtotal, activeBusiness?.currency.symbol)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500">
                    {formatCurrency(b.totalTax, activeBusiness?.currency.symbol)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(b.totalAmount, activeBusiness?.currency.symbol)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={getStatusBadgeVariant(b.status)} size="sm">
                      {b.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={getStatusBadgeVariant(b.paymentStatus)} size="sm">
                      {b.paymentStatus}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                      Details
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
          No supplier bills found matching criteria.
        </div>
      )}

      {/* Record Supplier Bill Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Record Supplier Invoice / Bill"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateBill} className="space-y-4">
          <p className="text-xs text-slate-500">
            Link a paper or electronic tax invoice received from a vendor to its purchase order for three-way matching.
          </p>

          <Select
            label="Associated Purchase Order"
            value={selectedPoId}
            onChange={e => setSelectedPoId(e.target.value)}
            options={purchaseOrders.map(p => ({
              value: p.id,
              label: `${p.orderNumber} — ${p.vendorName} (${formatCurrency(p.grandTotal, activeBusiness?.currency.symbol)})`,
            }))}
            placeholder="— Select Purchase Order —"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Supplier Invoice #"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2026-9041"
              required
            />
            <Input
              label="Invoice Date"
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              required
            />
          </div>

          {/* Line Items claimed on the bill */}
          {billItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700 block">
                Billed Items &amp; Rates (as stated on supplier invoice):
              </span>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {billItems.map((item, idx) => (
                  <div key={item.productId} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                    <div className="font-semibold text-slate-800">{item.productName} ({item.sku})</div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        label="Billed Qty"
                        type="number"
                        min="0"
                        value={item.billedQuantity}
                        onChange={e => {
                          const updated = [...billItems];
                          updated[idx].billedQuantity = parseFloat(e.target.value) || 0;
                          setBillItems(updated);
                        }}
                        required
                      />
                      <Input
                        label="Billed Rate (₹)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={e => {
                          const updated = [...billItems];
                          updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                          setBillItems(updated);
                        }}
                        required
                      />
                      <Input
                        label="GST Rate (%)"
                        type="number"
                        value={item.taxRate}
                        onChange={e => {
                          const updated = [...billItems];
                          updated[idx].taxRate = parseFloat(e.target.value) || 0;
                          setBillItems(updated);
                        }}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Remarks / Notes (Optional)"
            value={billNotes}
            onChange={e => setBillNotes(e.target.value)}
            placeholder="e.g. Original physical challan and invoice verified at security gate."
          />

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} disabled={!selectedPoId || !invoiceNumber.trim()}>
              Save Supplier Invoice
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
