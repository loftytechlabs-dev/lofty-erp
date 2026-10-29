import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { localStore } from '../../services/store';
import {
  verifyProductDelivery,
  getDeliveryById,
  confirmDeliveryDiscrepancy,
  attachBillPhotoToDelivery,
} from '../../services/deliveryService';
import { getPurchaseOrderById } from '../../services/purchaseOrderService';
import { verifySupplierBill } from '../../services/billService';
import { Delivery, PurchaseOrder, SupplierBill } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge, getStatusBadgeVariant } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PackageCheck,
  Receipt,
  Truck,
  ShieldCheck,
  Check,
  AlertCircle,
  Clock,
  Eye,
  Upload,
  Camera,
  FileText,
} from 'lucide-react';

export const DeliveryReviewPage: React.FC = () => {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const { activeBusiness, permissions, role } = useBusiness();
  const { user } = useAuth();

  const isOwner = role === 'Owner' || permissions.canManageSettings;

  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [bill, setBill] = useState<SupplierBill | null>(null);

  // Owner Discrepancy Confirmation
  const [confirmingDiscrepancy, setConfirmingDiscrepancy] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Bill Document Lightbox & Upload
  const [viewingBillModal, setViewingBillModal] = useState(false);
  const [uploadingOwnerBill, setUploadingOwnerBill] = useState(false);
  const billUploadInputRef = useRef<HTMLInputElement>(null);

  const compressAndEncodeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.72);
          resolve(base64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleOwnerUploadBill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeBusiness || !delivery) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG)');
      return;
    }

    setUploadingOwnerBill(true);
    try {
      const base64 = await compressAndEncodeImage(file);
      const res = await attachBillPhotoToDelivery(activeBusiness.id, delivery.id, base64);
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || 'Failed to attach bill image');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error uploading bill image: ' + err.message);
    } finally {
      setUploadingOwnerBill(false);
    }
  };

  // Product Physical Verification Modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [verifiedCounts, setVerifiedCounts] = useState<Record<string, { accepted: number; rejected: number; notes: string }>>({});
  const [overallProductNotes, setOverallProductNotes] = useState('');
  const [verifyingProduct, setVerifyingProduct] = useState(false);

  // Bill Verification Modal
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billAction, setBillAction] = useState<'ACCEPT' | 'REJECT' | 'REQUEST_CORRECTION'>('ACCEPT');
  const [rejectionReason, setRejectionReason] = useState('');
  const [correctionDetails, setCorrectionDetails] = useState('');
  const [verifyingBill, setVerifyingBill] = useState(false);

  const loadData = async () => {
    if (!deliveryId) return;
    const bizId = activeBusiness?.id || '';
    const d = await getDeliveryById(bizId, deliveryId);
    if (d) {
      setDelivery(d);

      const poRec = await getPurchaseOrderById(d.businessId, d.purchaseOrderId);
      setPo(poRec || null);

      const bRec = localStore
        .getSupplierBills(d.businessId)
        .find(b => b.purchaseOrderId === d.purchaseOrderId);
      setBill(bRec || null);

      // Initialize verification counts
      const counts: Record<string, { accepted: number; rejected: number; notes: string }> = {};
      d.items.forEach(it => {
        counts[it.productId] = {
          accepted: it.acceptedQuantity > 0 ? it.acceptedQuantity : it.deliveredQuantity,
          rejected: it.rejectedQuantity || 0,
          notes: it.inspectionNotes || '',
        };
      });
      setVerifiedCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(loadData);
    return () => unsub();
  }, [activeBusiness, deliveryId]);

  const handleConfirmDiscrepancy = async (action: 'APPROVED' | 'REJECTED') => {
    if (!activeBusiness || !delivery || !user) return;
    setConfirmingDiscrepancy(true);
    try {
      const res = await confirmDeliveryDiscrepancy(
        activeBusiness.id,
        delivery.id,
        user.displayName || user.email || user.uid,
        action,
        action === 'REJECTED' ? rejectionNotes : 'Owner approved quantity discrepancy'
      );
      if (!res.success) {
        alert(res.error || 'Failed to update discrepancy status');
      } else {
        setRejectModalOpen(false);
        setRejectionNotes('');
        await loadData();
      }
    } catch (err: any) {
      console.error(err);
      alert('Error updating discrepancy: ' + err.message);
    } finally {
      setConfirmingDiscrepancy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <Truck className="w-8 h-8 text-brand-600 animate-bounce mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading delivery record...</p>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 space-y-3">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <div>Delivery record not found. It may still be transferring from gate check-in.</div>
        <button onClick={() => navigate('/deliveries')} className="text-brand-600 underline font-medium">Return to Deliveries</button>
      </div>
    );
  }

  // Handle Physical Product Verification
  const handleVerifyProducts = async () => {
    if (!activeBusiness || !user) return;
    setVerifyingProduct(true);
    try {
      const itemsPayload = delivery.items.map(it => ({
        productId: it.productId,
        acceptedQuantity: verifiedCounts[it.productId]?.accepted ?? it.deliveredQuantity,
        rejectedQuantity: verifiedCounts[it.productId]?.rejected ?? 0,
        inspectionNotes: verifiedCounts[it.productId]?.notes || '',
      }));

      await verifyProductDelivery(
        activeBusiness.id,
        delivery.id,
        user.uid,
        itemsPayload,
        overallProductNotes
      );

      setProductModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to verify physical products');
    } finally {
      setVerifyingProduct(false);
    }
  };

  // Handle Bill Verification
  const handleVerifyBill = async () => {
    if (!activeBusiness || !user || !bill) return;
    setVerifyingBill(true);
    try {
      await verifySupplierBill(
        activeBusiness.id,
        activeBusiness.name,
        bill.id,
        user.uid,
        billAction,
        {
          rejectionReason,
          correctionDetails,
        }
      );

      setBillModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to verify bill');
    } finally {
      setVerifyingBill(false);
    }
  };

  const isPhysicalVerified = delivery.productVerificationStatus === 'ACCEPTED' || delivery.productVerificationStatus === 'ACCEPTED_WITH_DISCREPANCY';
  const isBillVerified = bill?.status === 'VERIFIED';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <button
          onClick={() => navigate('/deliveries')}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Deliveries</span>
        </button>

        <div className="flex items-center space-x-2">
          <Badge variant={getStatusBadgeVariant(delivery.status)} size="md">
            {delivery.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      {/* Delivery Summary Banner */}
      <Card noPadding className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Challan #{delivery.challanNumber || 'N/A'}
              </h1>
              <span className="text-xs text-slate-400 font-medium">&bull; Order: {delivery.poNumber}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Vendor: <strong className="text-slate-800">{delivery.vendorName}</strong> &bull; Receiving Godown: <strong>{delivery.warehouseName}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <div>Arrival Date: <strong>{formatDate(delivery.challanDate)}</strong></div>
            <div>Vehicle: <strong>{delivery.vehicleNumber || '—'}</strong></div>
            <div>Driver: <strong>{delivery.driverName || 'Driver'} ({delivery.driverPhone || '—'})</strong></div>
          </div>
        </div>

        {delivery.notes && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <strong>Check-in Remarks:</strong> {delivery.notes}
          </div>
        )}
      </Card>

      {/* Supplier Bill / Challan Document Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 text-brand-600 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Physical Bill / Challan Document</h3>
                {delivery.billPhotoBase64 ? (
                  <Badge variant="success" size="sm">Image Attached</Badge>
                ) : (
                  <Badge variant="neutral" size="sm">No Image Attached</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {delivery.billPhotoBase64
                  ? 'Uploaded by carrier/gate during delivery check-in. Stored as Base64 in Firestore for audit & 3-way matching.'
                  : 'Driver did not attach a bill photo during check-in. You can upload one here.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {delivery.billPhotoBase64 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setViewingBillModal(true)}
                leftIcon={<Eye className="w-4 h-4" />}
              >
                View Full Bill
              </Button>
            )}
            <input
              type="file"
              ref={billUploadInputRef}
              onChange={handleOwnerUploadBill}
              accept="image/*"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => billUploadInputRef.current?.click()}
              isLoading={uploadingOwnerBill}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              {delivery.billPhotoBase64 ? 'Replace Photo' : 'Upload Bill Photo'}
            </Button>
          </div>
        </div>

        {delivery.billPhotoBase64 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-4">
            <div
              className="relative group cursor-pointer border border-slate-300 rounded-lg overflow-hidden shadow-2xs w-24 h-24 sm:w-28 sm:h-28 bg-slate-100 flex items-center justify-center shrink-0"
              onClick={() => setViewingBillModal(true)}
            >
              <img
                src={delivery.billPhotoBase64}
                alt="Supplier Bill Thumbnail"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                <Eye className="w-4 h-4 mr-1" /> Zoom
              </div>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Carrier Document Preview</div>
              <div className="text-[11px] text-slate-500">
                Challan #{delivery.challanNumber || 'N/A'} &bull; PO #{delivery.poNumber} &bull; Vendor: {delivery.vendorName}
              </div>
              <button
                type="button"
                onClick={() => setViewingBillModal(true)}
                className="text-xs text-brand-600 hover:text-brand-700 underline font-medium block pt-1"
              >
                Click to inspect full document (zoom / open in new tab) &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quantity Discrepancy Alert & Owner Confirmation Station */}
      {delivery.hasQuantityDiscrepancy && (
        <div className="space-y-3">
          {delivery.ownerConfirmationStatus === 'PENDING' && (
            <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-xl space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">
                      Quantity Discrepancy Detected — Waiting for Owner Confirmation
                    </h3>
                    <p className="text-xs text-amber-700 mt-0.5">
                      The carrier delivered item quantities that do not match the Purchase Order. An urgent email alert has been dispatched to the business owner.
                    </p>
                  </div>
                </div>
                <Badge variant="warning" size="sm">
                  Waiting Confirmation
                </Badge>
              </div>

              {/* Mismatched Items Table */}
              <div className="bg-white p-3 rounded-lg border border-amber-200 text-xs divide-y divide-slate-100">
                {delivery.items
                  .filter(it => it.deliveredQuantity !== it.orderedQuantity)
                  .map(it => {
                    const diff = it.deliveredQuantity - it.orderedQuantity;
                    return (
                      <div key={it.productId} className="py-1.5 flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{it.productName}</span>
                        <span className="text-slate-600">
                          Ordered: <strong>{it.orderedQuantity} {it.unit}</strong> &rarr; Driver Delivered: <strong>{it.deliveredQuantity} {it.unit}</strong>{' '}
                          <span className={`font-bold ml-1 ${diff > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            ({diff > 0 ? `+${diff}` : diff} {it.unit})
                          </span>
                        </span>
                      </div>
                    );
                  })}
              </div>

              {/* Owner Decision Controls */}
              {isOwner ? (
                <div className="pt-2 border-t border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-amber-900 font-medium">
                    As the <strong>Business Owner</strong>, you must decide whether to accept this shipment variance:
                  </span>
                  <div className="flex items-center space-x-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConfirmDiscrepancy('APPROVED')}
                      isLoading={confirmingDiscrepancy}
                      leftIcon={<CheckCircle2 className="w-4 h-4 text-white" />}
                    >
                      Approve Discrepancy (OK Fine)
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRejectModalOpen(true)}
                      leftIcon={<XCircle className="w-4 h-4" />}
                    >
                      Reject Delivery &amp; Return Truck
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-amber-200 text-xs text-amber-800 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Action on hold:</strong> Waiting for the Business Owner to review and confirm this quantity discrepancy. Warehouse staff cannot proceed with unloading until the owner confirms.
                  </span>
                </div>
              )}
            </div>
          )}

          {delivery.ownerConfirmationStatus === 'APPROVED' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-emerald-900">
                  Quantity Discrepancy Approved by Owner (OK Fine)
                </div>
                <p className="text-emerald-700">
                  Confirmed on {formatDate(delivery.ownerConfirmedAt)}. Note:{' '}
                  <strong>{delivery.ownerConfirmationNotes || 'Owner accepted shipment variance.'}</strong> Warehouse staff may now verify physical goods and generate the GRN.
                </p>
              </div>
            </div>
          )}

          {delivery.ownerConfirmationStatus === 'REJECTED' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-xs">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-red-900">Delivery Rejected by Owner</div>
                <p className="text-red-700">
                  Shipment rejected due to count mismatch. Reason:{' '}
                  <strong>{delivery.ownerConfirmationNotes || 'Count mismatch.'}</strong> Do not unload. Carrier must return shipment to supplier.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two Independent Verification Stations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============================================================ */}
        {/* SECTION A: PRODUCT PHYSICAL VERIFICATION */}
        {/* ============================================================ */}
        <Card
          title={
            <div className="flex items-center space-x-2">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>1. Physical Goods Inspection</span>
            </div>
          }
          subtitle="Count usable delivered items vs damaged/rejected items. ONLY accepted quantities update inventory balances."
          action={
            permissions.canVerifyDelivery && !isPhysicalVerified && (
              delivery.hasQuantityDiscrepancy && delivery.ownerConfirmationStatus !== 'APPROVED' ? (
                <div className="text-[11px] text-amber-700 font-semibold flex items-center space-x-1.5 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Waiting for Owner Approval</span>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setProductModalOpen(true)}
                >
                  Inspect & Count Physical Goods
                </Button>
              )
            )
          }
          noPadding
        >
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
            <span>Physical Status:</span>
            <Badge variant={getStatusBadgeVariant(delivery.productVerificationStatus)}>
              {delivery.productVerificationStatus.replace(/_/g, ' ')}
            </Badge>
          </div>

          <div className="p-4 space-y-3">
            {delivery.items.map(item => (
              <div key={item.productId} className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.productName}</h4>
                    <span className="text-[10px] text-slate-400">SKU: {item.sku}</span>
                  </div>
                  <span className="font-semibold text-slate-700">Delivered: {item.deliveredQuantity} {item.unit}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ordered</span>
                    <strong className="text-slate-800">{item.orderedQuantity}</strong>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-800 rounded">
                    <span className="text-[10px] uppercase font-semibold block">Accepted</span>
                    <strong className="text-emerald-700">{item.acceptedQuantity}</strong>
                  </div>
                  <div className="p-2 bg-red-50 text-red-800 rounded">
                    <span className="text-[10px] uppercase font-semibold block">Rejected</span>
                    <strong className="text-red-700">{item.rejectedQuantity}</strong>
                  </div>
                </div>

                {item.inspectionNotes && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded">
                    <strong>Inspection Note:</strong> {item.inspectionNotes}
                  </div>
                )}
              </div>
            ))}

            {delivery.productVerificationNotes && (
              <div className="p-3 bg-slate-50 rounded text-xs text-slate-600">
                <strong>Gate Inspector Log:</strong> {delivery.productVerificationNotes}
              </div>
            )}
          </div>
        </Card>

        {/* ============================================================ */}
        {/* SECTION B: BILL FINANCIAL VERIFICATION */}
        {/* ============================================================ */}
        <Card
          title={
            <div className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              <span>2. Supplier Bill Verification</span>
            </div>
          }
          subtitle="Compare supplier invoice numbers, rates, and billed quantities against purchase order terms. Does not alter stock."
          action={
            permissions.canVerifyBill && bill && bill.status !== 'VERIFIED' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBillModalOpen(true)}
              >
                Review Bill
              </Button>
            )
          }
          noPadding
        >
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
            <span>Bill Verification Status:</span>
            <Badge variant={getStatusBadgeVariant(bill?.status || delivery.billVerificationStatus)}>
              {(bill?.status || delivery.billVerificationStatus).replace(/_/g, ' ')}
            </Badge>
          </div>

          <div className="p-4 space-y-3">
            {delivery.billPhotoBase64 && (
              <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <img
                    src={delivery.billPhotoBase64}
                    alt="Bill Document"
                    className="w-10 h-10 object-cover rounded border border-orange-300 cursor-pointer hover:opacity-80"
                    onClick={() => setViewingBillModal(true)}
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Gate Bill Photo Attached</span>
                    <span className="text-[10px] text-slate-500">Cross-reference numbers with paper scan</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewingBillModal(true)} leftIcon={<Eye className="w-3.5 h-3.5" />}>
                  Inspect Bill
                </Button>
              </div>
            )}

            {!bill ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No invoice bill has been recorded for PO #{delivery.poNumber} yet.
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/bills`)}
                  >
                    Go to Supplier Bills
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Number:</span>
                    <strong className="text-slate-800">{bill.invoiceNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Date:</span>
                    <span>{formatDate(bill.invoiceDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal:</span>
                    <span>{formatCurrency(bill.subtotal, activeBusiness?.currency.symbol)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">GST Tax Breakdown:</span>
                    <span>CGST: {formatCurrency(bill.cgstAmount, activeBusiness?.currency.symbol)} | SGST: {formatCurrency(bill.sgstAmount, activeBusiness?.currency.symbol)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-100">
                    <span>Total Amount Billed:</span>
                    <span className="text-brand-600">{formatCurrency(bill.totalAmount, activeBusiness?.currency.symbol)}</span>
                  </div>
                </div>

                {bill.rejectionReason && (
                  <div className="p-3 bg-red-50 text-red-800 rounded text-xs">
                    <strong>Rejection Reason:</strong> {bill.rejectionReason}
                  </div>
                )}

                {bill.correctionDetails && (
                  <div className="p-3 bg-amber-50 text-amber-800 rounded text-xs">
                    <strong>Correction Requested:</strong> {bill.correctionDetails}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* MODAL 1: Physical Product Verification */}
      <Modal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title="Physical Product Count Verification"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Enter the exact physical quantity accepted into warehouse stock. If any goods were damaged in transit, enter the rejected quantity and reason below.
          </p>

          <div className="space-y-3">
            {delivery.items.map(item => {
              const current = verifiedCounts[item.productId] || {
                accepted: item.deliveredQuantity,
                rejected: 0,
                notes: '',
              };

              return (
                <div key={item.productId} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>{item.productName} ({item.unit})</span>
                    <span className="text-slate-500">Delivered: {item.deliveredQuantity}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Accepted Quantity (Good)"
                      type="number"
                      min="0"
                      value={current.accepted}
                      onChange={e => setVerifiedCounts({
                        ...verifiedCounts,
                        [item.productId]: { ...current, accepted: parseInt(e.target.value) || 0 },
                      })}
                      required
                    />
                    <Input
                      label="Rejected / Damaged Qty"
                      type="number"
                      min="0"
                      value={current.rejected}
                      onChange={e => setVerifiedCounts({
                        ...verifiedCounts,
                        [item.productId]: { ...current, rejected: parseInt(e.target.value) || 0 },
                      })}
                    />
                  </div>

                  {current.rejected > 0 && (
                    <Input
                      label="Discrepancy / Damage Inspection Notes"
                      value={current.notes}
                      onChange={e => setVerifiedCounts({
                        ...verifiedCounts,
                        [item.productId]: { ...current, notes: e.target.value },
                      })}
                      placeholder="e.g. 5 planks had longitudinal knots and moisture splits."
                      required
                    />
                  )}
                </div>
              );
            })}
          </div>

          <Input
            label="Overall Gate Verification Remarks"
            value={overallProductNotes}
            onChange={e => setOverallProductNotes(e.target.value)}
            placeholder="e.g. Verified count and moisture reading. 55 sound planks accepted into Godown 1."
          />

          <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Confirming physical count will atomically increment warehouse inventory stock balances for <strong>accepted quantities only</strong>.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" onClick={() => setProductModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleVerifyProducts} isLoading={verifyingProduct}>
              Confirm Physical Counts & Update Inventory
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Bill Verification Modal */}
      <Modal
        isOpen={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title="Supplier Bill Financial Verification"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Compare invoice pricing and quantities against Purchase Order #{delivery.poNumber} and physical gate receipts.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Verification Decision
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBillAction('ACCEPT')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1 transition-colors ${
                  billAction === 'ACCEPT'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Accept Bill</span>
              </button>

              <button
                type="button"
                onClick={() => setBillAction('REQUEST_CORRECTION')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1 transition-colors ${
                  billAction === 'REQUEST_CORRECTION'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Request Fix</span>
              </button>

              <button
                type="button"
                onClick={() => setBillAction('REJECT')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1 transition-colors ${
                  billAction === 'REJECT'
                    ? 'bg-red-50 border-red-500 text-red-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-red-600" />
                <span>Reject Bill</span>
              </button>
            </div>
          </div>

          {billAction === 'REJECT' && (
            <Input
              label="Rejection Reason"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Unit rates exceed agreed catalog price by ₹15 per plank."
              required
            />
          )}

          {billAction === 'REQUEST_CORRECTION' && (
            <Input
              label="Correction Details for Supplier"
              value={correctionDetails}
              onChange={e => setCorrectionDetails(e.target.value)}
              placeholder="e.g. Invoiced for 60 planks, but physical delivery accepted 55 due to 5 transit defects."
              required
            />
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" onClick={() => setBillModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleVerifyBill} isLoading={verifyingBill}>
              Save Verification Decision
            </Button>
          </div>
        </div>
      </Modal>

      {/* Owner Rejection Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Delivery & Return Truck"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            <strong>Warning:</strong> Rejecting this delivery marks the shipment as rejected and cancels unloading. The carrier must return the goods to the supplier.
          </div>

          <Input
            label="Rejection Reason / Notes"
            value={rejectionNotes}
            onChange={e => setRejectionNotes(e.target.value)}
            placeholder="e.g. Quantity discrepancy too high; not acceptable per purchase agreement."
            required
          />

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => handleConfirmDiscrepancy('REJECTED')}
              isLoading={confirmingDiscrepancy}
              disabled={!rejectionNotes.trim()}
            >
              Confirm Rejection &amp; Return Truck
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bill Document Full View Lightbox Modal */}
      <Modal
        isOpen={viewingBillModal}
        onClose={() => setViewingBillModal(false)}
        title={`Supplier Bill / Challan Document — Challan #${delivery.challanNumber || 'N/A'}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-slate-950 flex items-center justify-center p-2">
            {delivery.billPhotoBase64 ? (
              <img
                src={delivery.billPhotoBase64}
                alt="Supplier Bill Full Scan"
                className="max-w-full max-h-[68vh] object-contain rounded shadow"
              />
            ) : (
              <div className="py-12 text-slate-400 text-xs text-center">No image data attached to this delivery.</div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div>
              Vendor: <strong className="text-slate-800">{delivery.vendorName}</strong> &bull; PO: <strong>{delivery.poNumber}</strong>
            </div>
            <div className="flex items-center space-x-2">
              {delivery.billPhotoBase64 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const w = window.open('');
                    w?.document.write(`<html><head><title>Bill Document - ${delivery.challanNumber}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#111;min-height:100vh;"><img src="${delivery.billPhotoBase64}" style="max-width:100%;max-height:100vh;margin:auto;" /></body></html>`);
                  }}
                >
                  Open in New Tab
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => setViewingBillModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
