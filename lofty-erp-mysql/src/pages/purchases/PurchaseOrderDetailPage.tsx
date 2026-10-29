import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useBusiness } from '../../contexts/BusinessContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localStore } from '../../services/store';
import { generateDeliveryToken, getDeliveries } from '../../services/deliveryService';
import { getPurchaseOrderById } from '../../services/purchaseOrderService';
import { PurchaseOrder, Delivery } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge, getStatusBadgeVariant } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { StateTaxAndItcLivePreview } from '../../components/purchases/StateTaxAndItcLivePreview';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  ArrowLeft,
  QrCode,
  Truck,
  ExternalLink,
  Copy,
  Check,
  Building,
  Calendar,
  Receipt,
  MessageSquare,
  Share2,
  Link2,
  Smartphone,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export const PurchaseOrderDetailPage: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const { activeBusiness, switchBusiness, permissions } = useBusiness();
  const { t, formatDate, formatCurrency } = useLanguage();

  const [loading, setLoading] = useState<boolean>(() => {
    if (!poId) return false;
    return !localStore.getPurchaseOrderById(activeBusiness?.id || '', poId);
  });

  const [order, setOrder] = useState<PurchaseOrder | null>(() => {
    if (!poId) return null;
    return localStore.getPurchaseOrderById(activeBusiness?.id || '', poId) || null;
  });

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [deliveryToken, setDeliveryToken] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [cloudQrUrl, setCloudQrUrl] = useState<string>('');
  const [localQrUrl, setLocalQrUrl] = useState<string>('');
  const [qrHostMode, setQrHostMode] = useState<'firebase' | 'local'>('firebase');
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadData = async () => {
    if (!poId) {
      setLoading(false);
      return;
    }
    try {
      const bId = activeBusiness ? activeBusiness.id : '';
      const po = await getPurchaseOrderById(bId, poId);
      if (po) {
        setOrder(po);
        if (activeBusiness && po.businessId && po.businessId !== activeBusiness.id) {
          switchBusiness(po.businessId);
        }
      }
      const targetBizId = po?.businessId || activeBusiness?.id;
      if (targetBizId) {
        const delList = await getDeliveries(targetBizId);
        setDeliveries(delList.filter(d => d.purchaseOrderId === poId));
      }
    } catch (err) {
      console.error('Error loading purchase order:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, [activeBusiness?.id, poId]);

  if (loading && !order) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">{t('common.loading', 'Loading purchase order details...')}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 m-6 shadow-xs">
        <p className="font-bold text-slate-800 text-sm mb-1">{t('purchases.notFound', 'Purchase Order Not Found')}</p>
        <p className="text-slate-500 mb-4">{t('purchases.notFoundDesc', 'We could not locate this purchase order in the system.')}</p>
        <button
          onClick={() => navigate('/purchases')}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 transition shadow-xs cursor-pointer"
        >
          {t('purchases.returnToList', 'Return to Purchase Orders')}
        </button>
      </div>
    );
  }

  const handleGenerateQR = async () => {
    if (!activeBusiness) return;
    setGenerating(true);
    try {
      const res = await generateDeliveryToken(activeBusiness.id, order, 'user_current');
      setDeliveryToken(res.token);
      setCloudQrUrl(res.cloudUrl);
      setLocalQrUrl(res.localUrl);
      const targetUrl = qrHostMode === 'firebase' ? res.cloudUrl : res.localUrl;
      setQrUrl(targetUrl);
      setQrModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSwitchHostMode = (mode: 'firebase' | 'local') => {
    setQrHostMode(mode);
    setQrUrl(mode === 'firebase' ? cloudQrUrl : localQrUrl);
  };

  const handleCopyLink = () => {
    const activeUrl = qrHostMode === 'firebase' ? (cloudQrUrl || qrUrl) : (localQrUrl || qrUrl);
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyVendorMessage = () => {
    const activeUrl = qrHostMode === 'firebase' ? (cloudQrUrl || qrUrl) : (localQrUrl || qrUrl);
    const text = `Hi ${order?.vendorName || 'Vendor'},\nHere is your Official Gate Check-in Pass for ${order?.orderNumber} (Destination: ${order?.warehouseName}):\n${activeUrl}\n\nPlease forward this link to your delivery truck driver to register upon arrival at the godown.`;
    navigator.clipboard.writeText(text);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <button
          onClick={() => navigate('/purchases')}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common.back', 'Back to Purchase Orders')}</span>
        </button>

        <div className="flex items-center space-x-2">
          {permissions.canVerifyDelivery && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<QrCode className="w-4 h-4" />}
              onClick={handleGenerateQR}
              isLoading={generating}
            >
              {t('purchases.generateQR', 'Generate Delivery QR Code')}
            </Button>
          )}
        </div>
      </div>

      {/* PO Overview Header Card */}
      <Card noPadding className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{order.orderNumber}</h1>
              <Badge variant={getStatusBadgeVariant(order.status)} size="sm">
                {order.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Issued on {formatDate(order.createdAt)} &bull; Destination: <strong>{order.warehouseName}</strong>
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">{t('purchases.grandTotal', 'Grand Total')}</span>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(order.grandTotal, activeBusiness?.currency.symbol)}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Vendor:</span>
            <div className="font-semibold text-slate-800 mt-0.5">{order.vendorName}</div>
            {order.vendorGstin && <div className="text-slate-500">GST: {order.vendorGstin}</div>}
          </div>
          <div>
            <span className="text-slate-400 font-medium">Expected Date:</span>
            <div className="font-semibold text-slate-800 mt-0.5">{formatDate(order.expectedDeliveryDate)}</div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Notes & Terms:</span>
            <div className="text-slate-600 mt-0.5 italic">{order.notes || 'Standard purchase terms apply.'}</div>
          </div>
        </div>
      </Card>

      {/* Ordered Products Table */}
      <Card title="Ordered Line Items" subtitle="Track ordered versus physically accepted goods count." noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Product Name & SKU</th>
                <th className="py-2.5 px-4 font-semibold text-center">Unit</th>
                <th className="py-2.5 px-4 font-semibold text-center">Ordered Qty</th>
                <th className="py-2.5 px-4 font-semibold text-center">Received Qty</th>
                <th className="py-2.5 px-4 font-semibold text-right">Unit Price</th>
                <th className="py-2.5 px-4 font-semibold text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items.map(item => (
                <tr key={item.productId} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {item.productName}
                    <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600">{item.unit}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`font-bold ${
                        item.receivedQuantity >= item.quantity
                          ? 'text-emerald-600'
                          : item.receivedQuantity > 0
                          ? 'text-orange-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.receivedQuantity || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {formatCurrency(item.unitPrice, activeBusiness?.currency.symbol)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(item.lineTotal, activeBusiness?.currency.symbol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Footer */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <div className="w-64 space-y-1 text-xs text-right">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span>{formatCurrency(order.subtotal, activeBusiness?.currency.symbol)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Total GST:</span>
              <span>{formatCurrency(order.taxTotal, activeBusiness?.currency.symbol)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
              <span>Grand Total:</span>
              <span className="text-brand-600">{formatCurrency(order.grandTotal, activeBusiness?.currency.symbol)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Live State Tax & AI ITC Intelligence Card */}
      <StateTaxAndItcLivePreview
        items={order.items}
        vendorGstin={order.vendorGstin}
        vendorName={order.vendorName}
        initialDestinationStateCode={activeBusiness?.taxSettings?.gstin ? activeBusiness.taxSettings.gstin.slice(0, 2) : '29'}
        currencySymbol={activeBusiness?.currency.symbol}
      />

      {/* Associated Deliveries Card */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <Truck className="w-4 h-4 text-brand-600" />
            <span>Associated Physical Deliveries ({deliveries.length})</span>
          </div>
        }
        noPadding
      >
        {deliveries.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No deliveries registered yet. Generate a QR code to let the delivery carrier check in upon arrival.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {deliveries.map(del => (
              <div
                key={del.id}
                onClick={() => navigate(`/deliveries/${del.id}`)}
                className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-900">
                      Challan #{del.challanNumber || 'N/A'}
                    </span>
                    {del.hasQuantityDiscrepancy && del.ownerConfirmationStatus === 'PENDING' ? (
                      <Badge variant="warning" size="sm">
                        Waiting Owner Confirmation
                      </Badge>
                    ) : del.ownerConfirmationStatus === 'REJECTED' ? (
                      <Badge variant="danger" size="sm">
                        Rejected by Owner
                      </Badge>
                    ) : (
                      <Badge variant={getStatusBadgeVariant(del.productVerificationStatus)} size="sm">
                        Goods: {del.productVerificationStatus.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Arrived: {formatDate(del.challanDate)} &bull; Vehicle: {del.vehicleNumber || '—'} ({del.driverName || 'Driver'})
                  </div>
                </div>

                <Button variant="outline" size="sm">
                  View Inspection
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* QR Code Modal for Mobile Delivery Check-in */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Supplier Gate Pass & Driver Check-in"
        maxWidth="lg"
      >
        <div className="space-y-6 py-1">
          {/* Header Description & Badge */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center space-x-2 bg-brand-50 border border-brand-200 px-3.5 py-1 rounded-full text-brand-800 text-xs font-semibold shadow-2xs">
              <QrCode className="w-4 h-4 text-brand-600" />
              <span>Instant Driver Gate Pass</span>
              <span className="text-brand-300">&bull;</span>
              <span className="font-mono text-brand-900 font-bold">{order.orderNumber}</span>
            </div>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Drivers or warehouse gate staff can scan this dynamic pass using any phone camera to check in inbound shipments with zero app downloads or passwords.
            </p>

            {/* Hosting Mode Badge & Direct Phone Camera Access */}
            <div className="flex items-center justify-center space-x-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-500">Scan Destination:</span>
              <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleSwitchHostMode('firebase')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    qrHostMode === 'firebase'
                      ? 'bg-white text-orange-600 shadow-xs border border-orange-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🔥 Firebase Cloud (Direct Mobile Access)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchHostMode('local')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    qrHostMode === 'local'
                      ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>💻 Local Browser</span>
                </button>
              </div>
            </div>
          </div>

          {/* Central High-Contrast QR Code Card */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative p-6 bg-white border-2 border-slate-200 rounded-2xl shadow-sm inline-block">
              {/* Corner scan viewfinder brackets */}
              <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-brand-500 rounded-tl" />
              <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-brand-500 rounded-tr" />
              <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-brand-500 rounded-bl" />
              <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-brand-500 rounded-br" />

              <QRCodeSVG value={qrUrl} size={190} level="M" className="mx-auto" />
            </div>

            {/* Quick Context Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5 text-xs text-slate-600">
              <span className="inline-flex items-center space-x-1.5 bg-slate-100/80 px-3 py-1 rounded-lg border border-slate-200">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>Godown: <strong className="text-slate-800">{order.warehouseName}</strong></span>
              </span>
              <span className="inline-flex items-center space-x-1.5 bg-slate-100/80 px-3 py-1 rounded-lg border border-slate-200">
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                <span>Vendor: <strong className="text-slate-800">{order.vendorName}</strong></span>
              </span>
            </div>

            {/* Live Hosting Status Pill */}
            <div className="mt-2.5 text-center text-[11px]">
              {qrHostMode === 'firebase' ? (
                <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-medium shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Connected to Firebase (lofty-erp.web.app) &bull; Users scan &amp; access directly on phone
                </span>
              ) : (
                <span className="inline-flex items-center text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 font-medium">
                  Local Dev mode active ({window.location.origin})
                </span>
              )}
            </div>
          </div>

          {/* REDESIGNED THREE ACTION BUTTONS */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Dispatch & Sharing Actions
              </span>
              <span className="text-[10px] text-slate-400 font-medium">3 streamlined ways to share or test</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Button 1: WhatsApp Vendor Dispatch (WhatsApp Emerald) */}
              <button
                type="button"
                onClick={handleCopyVendorMessage}
                className={`group relative p-4 rounded-xl border text-left flex flex-col justify-between cursor-pointer transition-all ${
                  copiedMsg
                    ? 'bg-emerald-100/80 border-emerald-500 shadow-sm ring-2 ring-emerald-200'
                    : 'bg-gradient-to-br from-emerald-50/90 to-teal-50/40 border-emerald-200 hover:border-emerald-400 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      {copiedMsg ? <Check className="w-4 h-4 text-white" /> : <MessageSquare className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {copiedMsg ? 'COPIED!' : 'WHATSAPP'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                    {copiedMsg ? 'Message Copied!' : 'WhatsApp Dispatch'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Copies complete formatted message with PO #, destination godown & driver link.
                  </p>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                  <span>{copiedMsg ? '✓ Ready to Paste' : 'Copy Message'}</span>
                  <Copy className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Button 2: Copy Direct Check-in URL (Brand Citrus/Orange) */}
              <button
                type="button"
                onClick={handleCopyLink}
                className={`group relative p-4 rounded-xl border text-left flex flex-col justify-between cursor-pointer transition-all ${
                  copied
                    ? 'bg-orange-100/80 border-brand-500 shadow-sm ring-2 ring-brand-200'
                    : 'bg-gradient-to-br from-orange-50/90 to-amber-50/40 border-orange-200 hover:border-brand-400 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      {copied ? <Check className="w-4 h-4 text-white" /> : <Link2 className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-brand-800 border border-orange-200">
                      {copied ? 'COPIED!' : 'DIRECT LINK'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-brand-800 transition-colors">
                    {copied ? 'Link Copied!' : 'Copy Gate Link'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Copies direct mobile URL to send via SMS, email or internal dispatch log.
                  </p>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-orange-200/60 flex items-center justify-between text-[11px] font-semibold text-brand-700">
                  <span>{copied ? '✓ URL Copied' : 'Copy Link'}</span>
                  <Copy className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Button 3: Launch Gate Mobile Portal (Slate / Kiosk) */}
              <button
                type="button"
                onClick={() => window.open(qrUrl, '_blank')}
                className="group relative p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/70 hover:border-slate-400 hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <Smartphone className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                      LIVE PORTAL
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-slate-800 transition-colors">
                    Open Driver Portal
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Launches responsive gate view in a new browser tab for testing or kiosk check-in.
                  </p>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-700 group-hover:text-slate-900">
                  <span>Open in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
