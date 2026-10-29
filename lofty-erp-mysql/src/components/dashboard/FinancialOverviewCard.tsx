import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SupplierBill, PaymentRecord, Vendor } from '../../types';
import { formatCurrency, formatDate, toIsoDate } from '../../lib/utils';
import { DateRangeState } from './DashboardHeader';
import { Receipt, CheckCircle, Clock, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';

interface FinancialOverviewCardProps {
  supplierBills: SupplierBill[];
  payments: PaymentRecord[];
  vendors: Vendor[];
  dateRange: DateRangeState;
  currencySymbol?: string;
}

export const FinancialOverviewCard: React.FC<FinancialOverviewCardProps> = ({
  supplierBills,
  payments,
  vendors,
  dateRange,
  currencySymbol = '₹',
}) => {
  const navigate = useNavigate();

  // 1. Approved Outstanding Supplier Bills (Verified liabilities minus paidAmount)
  const approvedBills = supplierBills.filter(b => b.status === 'VERIFIED');
  const approvedOutstandingAmount = approvedBills.reduce(
    (sum, b) => sum + Math.max(0, b.totalAmount - (b.paidAmount || 0)),
    0
  );
  const approvedUnpaidCount = approvedBills.filter(b => b.paymentStatus !== 'PAID').length;

  // 2. Amount Paid in Selected Period
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);

  const paymentsInPeriod = payments.filter(p => {
    if (!p.paymentDate) return false;
    const dateStr = toIsoDate(p.paymentDate);
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= start && d <= end;
  });
  const totalPaidInPeriod = paymentsInPeriod.reduce((sum, p) => sum + p.amount, 0);

  // Total all-time payments recorded
  const totalAllTimePaid = payments.reduce((sum, p) => sum + p.amount, 0);

  // 3. Bills Awaiting Accounts Verification
  const pendingReviewBills = supplierBills.filter(b => b.status === 'PENDING');
  const pendingReviewAmount = pendingReviewBills.reduce((sum, b) => sum + b.totalAmount, 0);

  // 4. Bills Approaching Due Dates or Overdue
  const now = new Date();
  const billsWithDueInfo = approvedBills
    .filter(b => b.paymentStatus !== 'PAID')
    .map(b => {
      // Parse vendor terms or default to 30 days
      const vendor = vendors.find(v => v.id === b.vendorId);
      let days = 30;
      if (vendor?.paymentTerms) {
        const match = vendor.paymentTerms.match(/\d+/);
        if (match) days = parseInt(match[0], 10);
      }

      const invDate = new Date(b.invoiceDate || b.createdAt);
      const dueDate = new Date(invDate);
      dueDate.setDate(dueDate.getDate() + days);

      const diffDays = Math.round((dueDate.getTime() - now.getTime()) / 86400000);
      const isOverdue = diffDays < 0;
      const isDueSoon = diffDays >= 0 && diffDays <= 7;

      return {
        bill: b,
        dueDate,
        diffDays,
        isOverdue,
        isDueSoon,
        vendorName: b.vendorName,
        outstanding: Math.max(0, b.totalAmount - (b.paidAmount || 0)),
      };
    });

  const overdueCount = billsWithDueInfo.filter(item => item.isOverdue).length;
  const dueSoonCount = billsWithDueInfo.filter(item => item.isDueSoon).length;

  // Stacked progress comparison
  const totalFinancialVolume = approvedOutstandingAmount + totalAllTimePaid + pendingReviewAmount;
  const safeTotal = Math.max(1, totalFinancialVolume);

  const approvedPct = Math.round((approvedOutstandingAmount / safeTotal) * 100);
  const paidPct = Math.round((totalAllTimePaid / safeTotal) * 100);
  const pendingPct = Math.round((pendingReviewAmount / safeTotal) * 100);

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Financial Overview
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              Payables &amp; Disbursements
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified supplier liabilities and recorded payment obligations
          </p>
        </div>
        <Link
          to="/bills"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center transition-colors"
        >
          <span>Bills &amp; GST</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </div>

      {/* 4 Compact Financial Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Approved Outstanding */}
        <div
          onClick={() => navigate('/bills')}
          className="p-3 bg-slate-50/70 hover:bg-slate-100/70 rounded-lg border border-slate-200/80 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-600">
              Approved Liabilities
            </span>
            <Receipt className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            {formatCurrency(approvedOutstandingAmount, currencySymbol)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {approvedUnpaidCount} approved unpaid bills
          </div>
        </div>

        {/* Metric 2: Amount Paid in Period */}
        <div
          onClick={() => navigate('/bills')}
          className="p-3 bg-slate-50/70 hover:bg-slate-100/70 rounded-lg border border-slate-200/80 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-600">
              Disbursed in Period
            </span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            {formatCurrency(totalPaidInPeriod, currencySymbol)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {paymentsInPeriod.length} payment records
          </div>
        </div>

        {/* Metric 3: Pending Verification */}
        <div
          onClick={() => navigate('/bills')}
          className="p-3 bg-slate-50/70 hover:bg-slate-100/70 rounded-lg border border-slate-200/80 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-600">
              Pending Review
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-700">
            {formatCurrency(pendingReviewAmount, currencySymbol)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {pendingReviewBills.length} bills awaiting 3-way check
          </div>
        </div>

        {/* Metric 4: Due Soon / Overdue */}
        <div
          onClick={() => navigate('/bills')}
          className="p-3 bg-slate-50/70 hover:bg-slate-100/70 rounded-lg border border-slate-200/80 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-600">
              Due Watch
            </span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            <span className={overdueCount > 0 ? 'text-rose-600' : 'text-slate-800'}>
              {overdueCount} Overdue
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {dueSoonCount} approaching in next 7 days
          </div>
        </div>
      </div>

      {/* Comparative Progress Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-700">
            Obligations Breakdown (Payable vs Disbursed vs Unverified)
          </span>
          <span className="text-slate-400 font-mono">
            {formatCurrency(totalFinancialVolume, currencySymbol)} total
          </span>
        </div>

        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {approvedPct > 0 && (
            <div
              style={{ width: `${approvedPct}%` }}
              className="bg-indigo-500 h-full"
              title={`Approved Due: ${formatCurrency(approvedOutstandingAmount, currencySymbol)} (${approvedPct}%)`}
            />
          )}
          {paidPct > 0 && (
            <div
              style={{ width: `${paidPct}%` }}
              className="bg-emerald-500 h-full"
              title={`Disbursed: ${formatCurrency(totalAllTimePaid, currencySymbol)} (${paidPct}%)`}
            />
          )}
          {pendingPct > 0 && (
            <div
              style={{ width: `${pendingPct}%` }}
              className="bg-amber-400 h-full"
              title={`Pending Review: ${formatCurrency(pendingReviewAmount, currencySymbol)} (${pendingPct}%)`}
            />
          )}
        </div>

        {/* Breakdown Legend */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
            <span className="text-slate-600">
              Approved Due: <strong className="text-slate-800">{formatCurrency(approvedOutstandingAmount, currencySymbol)}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-slate-600">
              Paid Out: <strong className="text-slate-800">{formatCurrency(totalAllTimePaid, currencySymbol)}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-slate-600">
              Awaiting Verification: <strong className="text-slate-800">{formatCurrency(pendingReviewAmount, currencySymbol)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimers & Integrity Note */}
      <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/60 text-[11px] text-slate-500 flex items-start space-x-2">
        <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-tight">
          <strong>Operational Note:</strong> This overview reflects operational supplier bill approvals and recorded payments.
          Unverified bills are strictly excluded from approved liabilities until verified against gate delivery receipts. Not statutory P&amp;L accounting.
        </p>
      </div>
    </div>
  );
};
