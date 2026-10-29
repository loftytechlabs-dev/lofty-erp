import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localStore } from '../../services/store';
import { recordSupplierPayment, getPayments } from '../../services/paymentService';
import { getSupplierBillById, verifySupplierBill } from '../../services/billService';
import { getVendorById } from '../../services/vendorService';
import { SupplierBill, PaymentRecord, PaymentMethod, Vendor, PurchaseOrder, Delivery } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge, getStatusBadgeVariant } from '../../components/common/Badge';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Receipt,
  Building,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Clock,
  Check,
  XCircle,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';

export const BillDetailPage: React.FC = () => {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const { activeBusiness, permissions } = useBusiness();
  const { user } = useAuth();
  const { t, formatCurrency, formatDate } = useLanguage();

  const [bill, setBill] = useState<SupplierBill | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [vendor, setVendor] = useState<Vendor | null>(null);

  // Verification Decision Modal
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'ACCEPT' | 'REJECT' | 'REQUEST_CORRECTION'>('ACCEPT');
  const [decisionReason, setDecisionReason] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bank Transfer');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [recording, setRecording] = useState(false);

  const loadData = async () => {
    if (!activeBusiness || !billId) return;
    const b = await getSupplierBillById(activeBusiness.id, billId);
    if (b) {
      setBill(b);
      const remaining = Math.max(0, b.totalAmount - (b.paidAmount || 0));
      setPayAmount(remaining);

      const v = await getVendorById(activeBusiness.id, b.vendorId);
      setVendor(v || null);

      const poRec = localStore.getPurchaseOrderById(activeBusiness.id, b.purchaseOrderId);
      setPo(poRec || null);

      const delList = localStore
        .getDeliveries(activeBusiness.id)
        .filter(d => d.purchaseOrderId === b.purchaseOrderId);
      setDeliveries(delList);
    }
    const payList = await getPayments(activeBusiness.id);
    setPayments(payList.filter(p => p.billId === billId));
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, [activeBusiness, billId]);

  if (!bill) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Supplier bill not found. <button onClick={() => navigate('/bills')} className="text-brand-600 underline">Return to Bills</button>
      </div>
    );
  }

  const outstanding = Math.max(0, bill.totalAmount - (bill.paidAmount || 0));

  // Handle Bill Verification Decision (Approve / Reject / Correction)
  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !user || !bill) return;

    setVerifying(true);
    try {
      await verifySupplierBill(
        activeBusiness.id,
        activeBusiness.name,
        bill.id,
        user.uid,
        decisionAction,
        {
          rejectionReason: decisionAction === 'REJECT' ? decisionReason.trim() : undefined,
          correctionDetails: decisionAction === 'REQUEST_CORRECTION' ? decisionReason.trim() : undefined,
          vendorEmail: vendor?.email,
        }
      );

      setVerifyModalOpen(false);
      setDecisionReason('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to update bill verification status');
    } finally {
      setVerifying(false);
    }
  };

  // Record Payment Handler
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !user || payAmount <= 0) return;

    setRecording(true);
    try {
      await recordSupplierPayment(activeBusiness.id, activeBusiness.name, bill, {
        amount: Number(payAmount),
        paymentDate: payDate,
        paymentMethod: payMethod,
        referenceNumber: payRef.trim(),
        notes: payNotes.trim(),
        vendorEmail: vendor?.email,
        recordedBy: user.uid,
      });

      setPaymentModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to record payment');
    } finally {
      setRecording(false);
    }
  };

  // 3-Way Match Calculations per Line Item
  const threeWayMatchItems = bill.lineItems.map(item => {
    const poItem = po?.items.find(i => i.productId === item.productId);
    const orderedQty = poItem?.quantity || 0;
    const agreedRate = poItem?.unitPrice || 0;

    // Sum accepted quantity across deliveries
    const acceptedInDeliveries = deliveries.reduce((sum, del) => {
      const match = del.items.find(di => di.productId === item.productId);
      return sum + (match?.acceptedQuantity || 0);
    }, 0);

    const qtyDiscrepancy = item.billedQuantity - acceptedInDeliveries;
    const rateDiscrepancy = item.unitPrice - agreedRate;

    let matchStatus: 'MATCH' | 'QTY_MISMATCH' | 'PRICE_MISMATCH' | 'UNDERBILLED' = 'MATCH';
    if (rateDiscrepancy > 0.01) {
      matchStatus = 'PRICE_MISMATCH';
    } else if (qtyDiscrepancy > 0) {
      matchStatus = 'QTY_MISMATCH';
    } else if (qtyDiscrepancy < 0) {
      matchStatus = 'UNDERBILLED';
    }

    return {
      ...item,
      orderedQty,
      agreedRate,
      acceptedQty: acceptedInDeliveries,
      qtyDiscrepancy,
      rateDiscrepancy,
      matchStatus,
    };
  });

  const hasAnyDiscrepancy = threeWayMatchItems.some(
    it => it.matchStatus === 'QTY_MISMATCH' || it.matchStatus === 'PRICE_MISMATCH'
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <button
          onClick={() => navigate('/bills')}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common.back', 'Back to Supplier Bills')}</span>
        </button>

        <div className="flex items-center space-x-2">
          {permissions.canVerifyBill && bill.status !== 'VERIFIED' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileCheck2 className="w-4 h-4" />}
              onClick={() => {
                setDecisionAction('ACCEPT');
                setDecisionReason('');
                setVerifyModalOpen(true);
              }}
            >
              {t('common.confirm', 'Verify / Approve Bill')}
            </Button>
          )}

          {permissions.canRecordPayment && bill.status === 'VERIFIED' && outstanding > 0 && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CreditCard className="w-4 h-4" />}
              onClick={() => setPaymentModalOpen(true)}
            >
              {t('bills.recordPayment', 'Record Payment')}
            </Button>
          )}
        </div>
      </div>

      {/* Bill Overview Banner */}
      <Card noPadding className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Invoice #{bill.invoiceNumber}</h1>
              <Badge variant={getStatusBadgeVariant(bill.status)} size="sm">
                Verification: {bill.status}
              </Badge>
              <Badge variant={getStatusBadgeVariant(bill.paymentStatus)} size="sm">
                Payment: {bill.paymentStatus}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Vendor: <strong className="text-slate-800">{bill.vendorName}</strong> &bull; Purchase Order: <strong>{bill.poNumber}</strong>
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Total Invoiced</span>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(bill.totalAmount, activeBusiness?.currency.symbol)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Outstanding: <strong className="text-brand-600">{formatCurrency(outstanding, activeBusiness?.currency.symbol)}</strong>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Invoice Date:</span>
            <strong className="text-slate-800">{formatDate(bill.invoiceDate)}</strong>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Taxable Value:</span>
            <strong className="text-slate-800">{formatCurrency(bill.subtotal, activeBusiness?.currency.symbol)}</strong>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">CGST / SGST:</span>
            <strong className="text-slate-800">
              {formatCurrency(bill.cgstAmount, activeBusiness?.currency.symbol)} / {formatCurrency(bill.sgstAmount, activeBusiness?.currency.symbol)}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Vendor GSTIN:</span>
            <strong className="text-slate-800">{bill.vendorGstin || 'Unregistered'}</strong>
          </div>
        </div>

        {bill.rejectionReason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start space-x-2">
            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong>Rejection Reason:</strong> {bill.rejectionReason}
            </div>
          </div>
        )}

        {bill.correctionDetails && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Correction Requested from Supplier:</strong> {bill.correctionDetails}
            </div>
          </div>
        )}
      </Card>

      {/* THREE-WAY MATCHING AUDIT TABLE */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Three-Way Matching Audit (PO vs. GRN Accepted vs. Invoice)</span>
          </div>
        }
        subtitle="Verifies that invoiced quantities do not exceed warehouse-accepted counts, and rates match agreed purchase contracts."
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Product &amp; SKU</th>
                <th className="py-2.5 px-3 font-semibold text-center">PO Ordered</th>
                <th className="py-2.5 px-3 font-semibold text-center bg-emerald-50/60 text-emerald-800">GRN Accepted</th>
                <th className="py-2.5 px-3 font-semibold text-center bg-orange-50/60 text-brand-800">Invoiced Qty</th>
                <th className="py-2.5 px-3 font-semibold text-right">Agreed Rate</th>
                <th className="py-2.5 px-3 font-semibold text-right">Billed Rate</th>
                <th className="py-2.5 px-3 font-semibold text-right">Line Total</th>
                <th className="py-2.5 px-4 font-semibold text-center">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {threeWayMatchItems.map(item => (
                <tr key={item.productId} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {item.productName}
                    <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-600 font-medium">
                    {item.orderedQty}
                  </td>
                  <td className="py-3 px-3 text-center bg-emerald-50/30 font-bold text-emerald-700">
                    {item.acceptedQty}
                  </td>
                  <td className="py-3 px-3 text-center bg-orange-50/30 font-bold text-slate-900">
                    {item.billedQuantity}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {formatCurrency(item.agreedRate, activeBusiness?.currency.symbol)}
                  </td>
                  <td className={`py-3 px-3 text-right font-semibold ${item.rateDiscrepancy > 0.01 ? 'text-red-600' : 'text-slate-800'}`}>
                    {formatCurrency(item.unitPrice, activeBusiness?.currency.symbol)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(item.totalAmount, activeBusiness?.currency.symbol)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.matchStatus === 'MATCH' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3 mr-1" />
                        Exact Match
                      </span>
                    )}
                    {item.matchStatus === 'QTY_MISMATCH' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title={`Invoiced ${item.billedQuantity} but only ${item.acceptedQty} accepted at warehouse`}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Overbilled (+{item.qtyDiscrepancy})
                      </span>
                    )}
                    {item.matchStatus === 'PRICE_MISMATCH' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200" title={`Agreed ${formatCurrency(item.agreedRate)} vs Invoiced ${formatCurrency(item.unitPrice)}`}>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Rate Discrepancy
                      </span>
                    )}
                    {item.matchStatus === 'UNDERBILLED' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        Partial Billing
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3-Way Summary Alert Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            {hasAnyDiscrepancy ? (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-amber-800 font-medium">
                  Discrepancy detected: Billed numbers do not match physical GRN accepted records or agreed PO prices.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-800 font-medium">
                  Three-Way Verified: Invoiced counts match physical GRN receipts and agreed PO contract rates.
                </span>
              </>
            )}
          </div>

          {permissions.canVerifyBill && bill.status !== 'VERIFIED' && (
            <div className="flex items-center space-x-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDecisionAction('REQUEST_CORRECTION');
                  setDecisionReason('');
                  setVerifyModalOpen(true);
                }}
              >
                Request Correction
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setDecisionAction('REJECT');
                  setDecisionReason('');
                  setVerifyModalOpen(true);
                }}
              >
                Reject Bill
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setDecisionAction('ACCEPT');
                  setDecisionReason('');
                  setVerifyModalOpen(true);
                }}
              >
                Approve Invoice
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Payment Remittance History */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Payment Remittance History ({payments.length})</span>
          </div>
        }
        subtitle={bill.status !== 'VERIFIED' ? 'Payments can only be recorded once the invoice has been verified & approved.' : undefined}
        noPadding
      >
        {payments.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No payments recorded yet for this invoice.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map(pay => (
              <div key={pay.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">
                      {formatCurrency(pay.amount, activeBusiness?.currency.symbol)}
                    </span>
                    <Badge variant="success" size="sm">{pay.paymentMethod}</Badge>
                  </div>
                  <div className="text-slate-500 mt-1">
                    Date: {formatDate(pay.paymentDate)} &bull; Reference / UTR: <strong className="text-slate-700">{pay.referenceNumber || 'N/A'}</strong>
                  </div>
                  {pay.notes && <div className="text-slate-400 mt-0.5 italic">{pay.notes}</div>}
                </div>

                <div className="text-slate-400 text-[11px] flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Settled</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Bill Verification Decision Modal */}
      <Modal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        title={
          decisionAction === 'ACCEPT'
            ? 'Approve Supplier Invoice'
            : decisionAction === 'REJECT'
            ? 'Reject Supplier Invoice'
            : 'Request Correction from Supplier'
        }
        maxWidth="md"
      >
        <form onSubmit={handleDecisionSubmit} className="space-y-4">
          <p className="text-xs text-slate-600">
            {decisionAction === 'ACCEPT'
              ? 'Approving this invoice formally recognizes it as an approved business liability and authorizes accounts payable disbursements.'
              : decisionAction === 'REJECT'
              ? 'Rejecting this invoice marks it as invalid and disallows payment disbursements.'
              : 'Specify the discrepancies for the vendor so they can issue a credit note, debit note, or corrected tax invoice.'}
          </p>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice:</span>
              <strong className="text-slate-900">#{bill.invoiceNumber}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Claimed Amount:</span>
              <strong className="text-slate-900">{formatCurrency(bill.totalAmount, activeBusiness?.currency.symbol)}</strong>
            </div>
          </div>

          <Select
            label="Verification Action"
            value={decisionAction}
            onChange={e => setDecisionAction(e.target.value as any)}
            options={[
              { value: 'ACCEPT', label: 'Approve Invoice (Authorize for Payment)' },
              { value: 'REQUEST_CORRECTION', label: 'Request Correction from Vendor' },
              { value: 'REJECT', label: 'Reject Invoice' },
            ]}
          />

          {decisionAction !== 'ACCEPT' && (
            <Input
              label={decisionAction === 'REJECT' ? 'Rejection Reason' : 'Correction Instructions'}
              value={decisionReason}
              onChange={e => setDecisionReason(e.target.value)}
              placeholder={
                decisionAction === 'REJECT'
                  ? 'e.g. Duplicate invoice number or completely invalid PO rate.'
                  : 'e.g. Invoice billed for 60 units, but only 55 were accepted. Please send debit note for 5 units.'
              }
              required
            />
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setVerifyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={decisionAction === 'ACCEPT' ? 'primary' : decisionAction === 'REJECT' ? 'danger' : 'secondary'}
              type="submit"
              isLoading={verifying}
            >
              Confirm Decision
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Supplier Payment"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice:</span>
              <strong className="text-slate-800">#{bill.invoiceNumber} ({bill.vendorName})</strong>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Current Outstanding:</span>
              <strong className="text-brand-600">{formatCurrency(outstanding, activeBusiness?.currency.symbol)}</strong>
            </div>
          </div>

          <Input
            label="Payment Amount"
            type="number"
            step="0.01"
            min="0.01"
            max={outstanding}
            value={payAmount}
            onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
            leftAddon={activeBusiness?.currency.symbol}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Payment Date"
              type="date"
              value={payDate}
              onChange={e => setPayDate(e.target.value)}
              required
            />
            <Select
              label="Payment Method"
              value={payMethod}
              onChange={e => setPayMethod(e.target.value as PaymentMethod)}
              options={[
                { value: 'Bank Transfer', label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
                { value: 'UPI', label: 'UPI / QR' },
                { value: 'Cheque', label: 'Cheque' },
                { value: 'Cash', label: 'Cash' },
              ]}
            />
          </div>

          <Input
            label="Transaction Reference / UTR / Cheque Number"
            value={payRef}
            onChange={e => setPayRef(e.target.value)}
            placeholder="e.g. UTR-2026-HDFC-99120"
            required
          />

          <Input
            label="Payment Notes (Optional)"
            value={payNotes}
            onChange={e => setPayNotes(e.target.value)}
            placeholder="e.g. Part payment against 55 accepted planks batch."
          />

          {vendor?.email && (
            <p className="text-[11px] text-slate-500">
              An automated payment remittance advice will be emailed to <strong>{vendor.email}</strong> via Google Apps Script Mailer.
            </p>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={recording}>
              Confirm &amp; Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
