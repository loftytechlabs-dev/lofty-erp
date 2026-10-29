import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDeliveryToken, submitDeliveryViaToken, getDeliveryById } from '../../services/deliveryService';
import { getPurchaseOrderById } from '../../services/purchaseOrderService';
import { localStore } from '../../services/store';
import { DeliveryToken, PurchaseOrder, Delivery } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Truck, CheckCircle2, AlertTriangle, ShieldCheck, Clock, XCircle, Camera, Upload, Image as ImageIcon } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export const DeliveryPortalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<DeliveryToken | null>(null);
  const [existingDelivery, setExistingDelivery] = useState<Delivery | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [deliveredQuantities, setDeliveredQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [billPhotoBase64, setBillPhotoBase64] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress & encode image as Base64 (max dimension 1280px, jpeg 0.72)
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
        img.onerror = () => reject(new Error('Failed to parse bill image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    setUploadingPhoto(true);
    try {
      const base64 = await compressAndEncodeImage(file);
      setBillPhotoBase64(base64);
    } catch (err: any) {
      console.error(err);
      alert('Failed to process invoice photo: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    async function loadToken() {
      if (!token) {
        setError('No delivery check-in token provided in link.');
        setLoading(false);
        return;
      }

      const rec = await getDeliveryToken(token);
      if (!rec) {
        setError('Invalid or unrecognized delivery check-in link.');
        setLoading(false);
        return;
      }

      if (rec.isUsed) {
        setTokenData(rec);
        const delId = (rec as any).deliveryId || '';
        if (delId) {
          const d = await getDeliveryById(rec.businessId, delId);
          if (d) {
            setExistingDelivery(d);
            setLoading(false);
            return;
          }
        }
        setError('This delivery check-in QR code has already been registered and accepted.');
        setLoading(false);
        return;
      }

      setTokenData(rec);

      // Load PO items: from token directly or from database lookup
      let poRecord = await getPurchaseOrderById(rec.businessId, rec.purchaseOrderId);
      if (poRecord) {
        setPo(poRecord);
      } else if (rec.items && rec.items.length > 0) {
        // Construct minimal PO view from token data
        setPo({
          id: rec.purchaseOrderId,
          businessId: rec.businessId,
          orderNumber: rec.poNumber,
          vendorId: '',
          vendorName: rec.vendorName,
          warehouseId: rec.warehouseId,
          warehouseName: rec.warehouseName,
          items: rec.items,
          subtotal: 0,
          taxTotal: 0,
          grandTotal: 0,
          status: 'Ordered',
          expectedDeliveryDate: '',
          createdBy: rec.createdBy,
          createdAt: rec.createdAt,
          updatedAt: rec.createdAt,
        });
      }

      const activeItems = (poRecord?.items && poRecord.items.length > 0) ? poRecord.items : (rec.items || []);
      const initialQtys: Record<string, number> = {};
      activeItems.forEach(it => {
        const outstanding = Math.max(0, it.quantity - (it.receivedQuantity || 0));
        initialQtys[it.productId] = outstanding > 0 ? outstanding : it.quantity;
      });
      setDeliveredQuantities(initialQtys);

      setLoading(false);
    }

    loadToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !po || !tokenData) return;
    if (!challanNumber.trim()) {
      alert('Please enter Delivery Challan / Invoice number');
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = po.items.map(it => ({
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        unit: it.unit,
        orderedQuantity: it.quantity,
        deliveredQuantity: deliveredQuantities[it.productId] ?? it.quantity,
      }));

      const res = await submitDeliveryViaToken(token, {
        challanNumber: challanNumber.trim(),
        challanDate,
        vehicleNumber: vehicleNumber.trim(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        items: itemsPayload,
        notes,
        billPhotoBase64: billPhotoBase64 || undefined,
      });

      if (res.success) {
        setSubmittedSuccess(true);
      } else {
        alert(res.error || 'Failed to submit delivery');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error submitting delivery: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <Truck className="w-8 h-8 text-brand-600 animate-bounce mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Validating Delivery Check-in...</p>
        </div>
      </div>
    );
  }

  if (existingDelivery) {
    if (existingDelivery.ownerConfirmationStatus === 'PENDING') {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl border border-amber-300 p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Waiting for Owner Confirmation</h2>
            <p className="text-xs text-amber-800 mt-2 font-medium">
              Delivered count for <strong>{tokenData?.poNumber}</strong> (Challan #{existingDelivery.challanNumber}) does not match the purchase order.
            </p>
            <div className="my-5 p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-left space-y-1.5">
              <div className="font-semibold text-amber-900">Items Delivered vs Ordered:</div>
              {existingDelivery.items.map(it => {
                const diff = it.deliveredQuantity - it.orderedQuantity;
                return (
                  <div key={it.productId} className="flex justify-between text-[11px] text-slate-700">
                    <span>{it.productName}</span>
                    <span>
                      Ordered: {it.orderedQuantity} &bull; Delivered: {it.deliveredQuantity}{' '}
                      {diff !== 0 && (
                        <span className={diff > 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                          ({diff > 0 ? `+${diff}` : diff})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 text-left space-y-1">
              <div>Truck: <strong>{existingDelivery.vehicleNumber || 'N/A'}</strong></div>
              <div>Driver: <strong>{existingDelivery.driverName || 'Driver'}</strong></div>
              <div>Current Status: <strong className="text-amber-700">On Hold (Pending Owner Approval)</strong></div>
            </div>
            <p className="text-[11px] text-amber-800 mt-6 font-medium">
              Please wait at the gate dock. Unloading will proceed once the business owner reviews and confirms.
            </p>
          </div>
        </div>
      );
    }

    if (existingDelivery.ownerConfirmationStatus === 'REJECTED') {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl border border-red-300 p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Delivery Rejected by Owner</h2>
            <p className="text-xs text-red-700 mt-2 font-medium">
              The business owner has rejected this shipment.
            </p>
            <div className="my-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-left text-red-800">
              <strong>Reason:</strong> {existingDelivery.ownerConfirmationNotes || 'Quantity discrepancy not acceptable.'}
            </div>
            <p className="text-[11px] text-slate-500">
              Please do not unload materials. Goods must be returned to the supplier.
            </p>
          </div>
        </div>
      );
    }

    if (existingDelivery.ownerConfirmationStatus === 'APPROVED') {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl border border-emerald-300 p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Owner Approved (OK Fine)</h2>
            <p className="text-xs text-emerald-700 mt-2 font-medium">
              The business owner approved this shipment variance on {formatDate(existingDelivery.ownerConfirmedAt)}.
            </p>
            <div className="my-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-left text-emerald-800">
              Note: {existingDelivery.ownerConfirmationNotes || 'Approved to proceed with gate counting.'}
            </div>
            <p className="text-[11px] text-slate-500">
              You may now proceed with unloading. Warehouse staff will perform physical count verification.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Delivery Already Registered</h2>
          <p className="text-xs text-slate-600 mt-2">
            This delivery for <strong>{tokenData?.poNumber}</strong> (Challan #{existingDelivery.challanNumber}) has already been registered at the gate dock.
          </p>
        </div>
      </div>
    );
  }

  if (error || !tokenData || !po) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6 text-center shadow-xs">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Delivery Link Inactive</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
          <p className="text-[11px] text-slate-400">
            Please ask the warehouse gate supervisor to generate a fresh delivery QR code.
          </p>
        </div>
      </div>
    );
  }

  if (submittedSuccess) {
    const hasDiscrepancy = po.items.some(
      it => (deliveredQuantities[it.productId] ?? it.quantity) !== it.quantity
    );

    if (hasDiscrepancy) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl border border-amber-300 p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Waiting for Owner Confirmation</h2>
            <p className="text-xs text-amber-800 mt-2 font-medium">
              Your delivered item count for <strong>{tokenData.poNumber}</strong> (Challan #{challanNumber}) does not match the purchase order.
            </p>

            <div className="my-5 p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-left space-y-2">
              <div className="font-semibold text-amber-900 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1 text-amber-600" />
                Mismatched Quantities Logged:
              </div>
              {po.items
                .filter(it => (deliveredQuantities[it.productId] ?? it.quantity) !== it.quantity)
                .map(it => {
                  const delQ = deliveredQuantities[it.productId] ?? it.quantity;
                  const diff = delQ - it.quantity;
                  return (
                    <div key={it.productId} className="flex justify-between text-slate-700 text-[11px]">
                      <span>{it.productName}</span>
                      <span>
                        Ordered: <strong>{it.quantity} {it.unit}</strong> &bull; Delivered: <strong>{delQ} {it.unit}</strong>{' '}
                        <span className={diff > 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                          ({diff > 0 ? `+${diff}` : diff})
                        </span>
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 text-left space-y-1">
              <div>Destination: <strong>{tokenData.warehouseName}</strong></div>
              <div>Driver / Truck: <strong>{driverName || 'Driver'} ({vehicleNumber || 'N/A'})</strong></div>
              <div>Status: <strong className="text-amber-700">Waiting for Owner Review</strong></div>
            </div>

            {billPhotoBase64 && (
              <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-3 text-left">
                <img src={billPhotoBase64} alt="Bill" className="w-12 h-12 object-cover rounded border border-slate-300" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Bill Image Uploaded</span>
                  <span className="text-[10px] text-slate-500">Stored in Firestore as Base64 for Owner Review</span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-amber-800 mt-6 font-medium">
              An urgent email alert has been dispatched to the business owner. Please hold at the gate dock until the owner approves this shipment variance.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Delivery Registered Successfully!</h2>
          <p className="text-xs text-slate-600 mt-2">
            Your delivery for <strong>{tokenData.poNumber}</strong> (Challan #{challanNumber}) has been submitted for physical unloading and inspection.
          </p>
          <div className="mt-6 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 text-left space-y-1">
            <div>Destination: <strong>{tokenData.warehouseName}</strong></div>
            <div>Vendor: <strong>{tokenData.vendorName}</strong></div>
            <div>Driver / Vehicle: <strong>{driverName || 'Driver'} ({vehicleNumber || 'N/A'})</strong></div>
          </div>
          {billPhotoBase64 && (
            <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-3 text-left">
              <img src={billPhotoBase64} alt="Bill" className="w-12 h-12 object-cover rounded border border-slate-300" />
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Bill Image Uploaded</span>
                <span className="text-[10px] text-slate-500">Stored in Firestore as Base64 for Owner Review</span>
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-6">
            You may now unload materials. Gate staff will perform physical count verification.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Mobile Header Banner */}
        <div className="bg-brand-600 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-orange-200">
              Delivery Registration
            </span>
            <div className="flex items-center space-x-1 text-xs text-orange-100">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Session</span>
            </div>
          </div>
          <h1 className="text-xl font-bold mt-1 tracking-tight">PO #{tokenData.poNumber}</h1>
          <p className="text-xs text-orange-100 mt-0.5">
            Destination: <strong>{tokenData.warehouseName}</strong>
          </p>
          <div className="text-xs text-orange-200 mt-1">Vendor: {tokenData.vendorName}</div>
        </div>

        {/* Mobile Input Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Challan & Carrier Information
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Challan / DC Number"
              value={challanNumber}
              onChange={e => setChallanNumber(e.target.value)}
              placeholder="e.g. DC/WT/8892"
              required
            />
            <Input
              label="Challan Date"
              type="date"
              value={challanDate}
              onChange={e => setChallanDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Vehicle Number"
              value={vehicleNumber}
              onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="MH-12-QE-4590"
            />
            <Input
              label="Driver Name"
              value={driverName}
              onChange={e => setDriverName(e.target.value)}
              placeholder="Ramesh Jadhav"
            />
          </div>

          <Input
            label="Driver Phone Number"
            type="tel"
            value={driverPhone}
            onChange={e => setDriverPhone(e.target.value)}
            placeholder="+91 99223 34455"
          />

          {/* Supplier Bill / Delivery Challan Photo Upload */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div>
              <label className="text-xs font-bold text-slate-900 flex items-center">
                <Camera className="w-4 h-4 mr-1.5 text-brand-600" />
                Upload Supplier Bill / Challan Photo
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Take a photo or upload an image of the physical invoice/challan for the business owner and accounts review.
              </p>
            </div>

            {!billPhotoBase64 ? (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="w-full py-4 px-3 border-2 border-dashed border-orange-200 hover:border-brand-500 rounded-xl bg-orange-50/40 hover:bg-orange-50 transition-colors flex flex-col items-center justify-center space-y-1.5 cursor-pointer text-slate-700"
                >
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-brand-600 flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-brand-700">
                    {uploadingPhoto ? 'Encoding Bill Image...' : '📷 Take Photo or Upload Bill Image'}
                  </span>
                  <span className="text-[10px] text-slate-400">Stores as Base64 in Firestore for Owner Review</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={billPhotoBase64}
                    alt="Bill Preview"
                    className="w-14 h-14 object-cover rounded-lg border border-slate-300 shadow-2xs"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Bill Image Attached</span>
                    <span className="text-[10px] text-emerald-600 font-medium">Ready to submit with delivery</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setBillPhotoBase64(null)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>

          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 pt-2">
            Delivered Quantities
          </h2>

          <div className="space-y-3">
            {po.items.map(it => (
              <div key={it.productId} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">{it.productName}</div>
                  <div className="text-[10px] text-slate-500">Ordered: {it.quantity} {it.unit}</div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    min="0"
                    value={deliveredQuantities[it.productId] ?? it.quantity}
                    onChange={e => setDeliveredQuantities({
                      ...deliveredQuantities,
                      [it.productId]: Math.max(0, parseInt(e.target.value) || 0),
                    })}
                    className="w-20 text-center font-bold text-sm bg-white border border-slate-300 rounded px-2 py-1.5 text-slate-900"
                  />
                  <span className="text-xs text-slate-500">{it.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <Input
            label="Delivery Remarks / Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Arrived 11:30 AM, moisture report attached."
          />

          <Button
            variant="primary"
            type="submit"
            className="w-full h-11 text-base mt-2"
            isLoading={submitting}
          >
            Submit Delivery for Inspection
          </Button>

          <p className="text-[11px] text-center text-slate-400">
            Submission does not automatically accept inventory. Physical counting is performed by warehouse staff.
          </p>
        </form>
      </div>
    </div>
  );
};
