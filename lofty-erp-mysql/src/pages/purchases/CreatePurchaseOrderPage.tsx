import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localStore } from '../../services/store';
import { createPurchaseOrder } from '../../services/purchaseOrderService';
import { Vendor, Product, VendorProduct, Warehouse, POLineItem } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { formatCurrency, calculateLineItem, round2 } from '../../lib/utils';
import { StateTaxAndItcLivePreview } from '../../components/purchases/StateTaxAndItcLivePreview';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Building,
  Package,
  Calendar,
  AlertTriangle,
  Receipt,
} from 'lucide-react';

export const CreatePurchaseOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusiness } = useBusiness();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Available data
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);

  // Step 1: Selected Vendor
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const selectedVendor = vendors.find(v => v.id === selectedVendorId);

  // Step 2: Selected Line Items
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [currentAddProductId, setCurrentAddProductId] = useState<string>('');
  const [currentAddQty, setCurrentAddQty] = useState<number>(1);

  // Step 3: Delivery Details
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBusiness) return;
    const rawVendors = localStore.getVendors(activeBusiness.id).filter(v => v.isActive);
    const seenVendorIds = new Set<string>();
    const vList = rawVendors.filter(v => {
      if (seenVendorIds.has(v.id)) return false;
      seenVendorIds.add(v.id);
      return true;
    });
    const wList = localStore.getWarehouses(activeBusiness.id).filter(w => w.isActive);
    const pList = localStore.getProducts(activeBusiness.id).filter(p => p.isActive);

    setVendors(vList);
    setWarehouses(wList);
    setAllProducts(pList);

    if (wList.length > 0) {
      setSelectedWarehouseId(wList[0].id);
    }
  }, [activeBusiness]);

  // When vendor changes: load catalog and reset incompatible selected line items
  useEffect(() => {
    if (!activeBusiness || !selectedVendorId) {
      setVendorProducts([]);
      setLineItems([]);
      return;
    }

    const vpList = localStore.getVendorProducts(activeBusiness.id, selectedVendorId).filter(vp => vp.isActive);
    setVendorProducts(vpList);
    setLineItems([]); // Reset line items so non-catalog items cannot bleed into this vendor's order
    setCurrentAddProductId('');
  }, [activeBusiness, selectedVendorId]);

  // Add line item from vendor catalog
  const handleAddLineItem = () => {
    if (!currentAddProductId || currentAddQty <= 0) return;

    const vp = vendorProducts.find(item => item.productId === currentAddProductId);
    const prod = allProducts.find(item => item.id === currentAddProductId);
    if (!vp || !prod) return;

    // Check if already added
    const existingIndex = lineItems.findIndex(i => i.productId === prod.id);
    const lineCalculations = calculateLineItem(currentAddQty, vp.vendorPrice, prod.taxRate);

    if (existingIndex !== -1) {
      const updated = [...lineItems];
      const newQty = updated[existingIndex].quantity + currentAddQty;
      const reCalc = calculateLineItem(newQty, vp.vendorPrice, prod.taxRate);
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        lineTotal: reCalc.lineTotal,
        taxAmount: reCalc.taxAmount,
        totalWithTax: reCalc.totalWithTax,
      };
      setLineItems(updated);
    } else {
      const newItem: POLineItem = {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        unit: prod.unit,
        quantity: currentAddQty,
        receivedQuantity: 0,
        unitPrice: vp.vendorPrice,
        lineTotal: lineCalculations.lineTotal,
        taxRate: prod.taxRate,
        taxAmount: lineCalculations.taxAmount,
        totalWithTax: lineCalculations.totalWithTax,
      };
      setLineItems([...lineItems, newItem]);
    }

    setCurrentAddProductId('');
    setCurrentAddQty(1);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleUpdateLineQty = (index: number, newQty: number) => {
    const updated = [...lineItems];
    const item = updated[index];
    const calc = calculateLineItem(newQty, item.unitPrice, item.taxRate);
    updated[index] = {
      ...item,
      quantity: Math.max(1, newQty),
      lineTotal: calc.lineTotal,
      taxAmount: calc.taxAmount,
      totalWithTax: calc.totalWithTax,
    };
    setLineItems(updated);
  };

  // Calculations for Step 4
  const subtotal = round2(lineItems.reduce((acc, i) => acc + i.lineTotal, 0));
  const taxTotal = round2(lineItems.reduce((acc, i) => acc + i.taxAmount, 0));
  const grandTotal = round2(subtotal + taxTotal);

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  const handleSubmit = async () => {
    if (!activeBusiness || !user || !selectedVendor || !selectedWarehouse) return;
    if (lineItems.length === 0) {
      setError('Please add at least one product item to the order.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await createPurchaseOrder(activeBusiness.id, activeBusiness.name, {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        vendorEmail: selectedVendor.email,
        vendorGstin: selectedVendor.gstin,
        warehouseId: selectedWarehouse.id,
        warehouseName: selectedWarehouse.name,
        items: lineItems,
        expectedDeliveryDate: expectedDate,
        notes,
        createdBy: user.uid,
      });

      navigate(`/purchases/${created.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to create purchase order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <button
          onClick={() => navigate('/purchases')}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Purchase Orders</span>
        </button>
        <div className="text-xs text-slate-500">
          Guided Purchase Order Wizard (Step {step} of 4)
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: 1, label: `1. ${t('purchases.step1', 'Select Supplier')}` },
          { num: 2, label: `2. ${t('purchases.step2', 'Add Materials')}` },
          { num: 3, label: `3. ${t('purchases.step3', 'Delivery')}` },
          { num: 4, label: `4. ${t('purchases.step4', 'Confirm PO')}` },
        ].map(s => (
          <div
            key={s.num}
            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center transition-colors ${
              step === s.num
                ? 'bg-orange-50 border-brand-500 text-brand-700 shadow-xs'
                : step > s.num
                ? 'bg-white border-slate-300 text-slate-700'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
          {error}
        </div>
      )}

      {/* STEP 1: Select Vendor */}
      {step === 1 && (
        <Card title="Step 1: Select Vendor / Supplier" subtitle="Choose the supplier for this order. Only products configured in their vendor catalog will be available.">
          <div className="space-y-4">
            <Select
              label="Choose Vendor"
              value={selectedVendorId}
              onChange={e => setSelectedVendorId(e.target.value)}
              placeholder="— Choose supplier from registered vendors —"
              options={vendors.map(v => ({
                value: v.id,
                label: `${v.name} (Contact: ${v.contactPerson}) — Terms: ${v.paymentTerms}`,
              }))}
              required
            />

            {selectedVendor && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="font-semibold text-slate-900">{selectedVendor.name}</div>
                <div className="text-slate-600">Contact: {selectedVendor.contactPerson} &bull; {selectedVendor.phone}</div>
                {selectedVendor.gstin && <div className="text-slate-500">GSTIN: {selectedVendor.gstin}</div>}
                <div className="text-slate-500">Payment Terms: <strong>{selectedVendor.paymentTerms}</strong></div>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <Button
                variant="primary"
                disabled={!selectedVendorId}
                onClick={() => setStep(2)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Add Products
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2: Add Products from Vendor Catalog */}
      {step === 2 && (
        <Card
          title="Step 2: Add Products from Vendor's Catalog"
          subtitle={`Showing only products supplied by ${selectedVendor?.name} at agreed catalog purchase prices.`}
          noPadding
        >
          <div className="p-5 space-y-4 border-b border-slate-100">
            {vendorProducts.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>No catalog products assigned to this vendor!</strong>
                  <p className="mt-0.5">
                    Before placing a purchase order, go to the Vendor Profile &rarr; Product Catalog and assign items with their purchase prices.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <Select
                    label="Select Material / Component"
                    value={currentAddProductId}
                    onChange={e => setCurrentAddProductId(e.target.value)}
                    placeholder="— Select product from vendor catalog —"
                    options={vendorProducts.map(vp => {
                      const prod = allProducts.find(p => p.id === vp.productId);
                      return {
                        value: vp.productId,
                        label: `${prod?.name || 'Item'} (${prod?.sku}) — ${formatCurrency(vp.vendorPrice, activeBusiness?.currency.symbol)} / ${vp.unit}`,
                      };
                    })}
                  />
                </div>

                <div className="sm:col-span-3">
                  <Input
                    label="Quantity"
                    type="number"
                    min="1"
                    value={currentAddQty}
                    onChange={e => setCurrentAddQty(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={!currentAddProductId || currentAddQty <= 0}
                    onClick={handleAddLineItem}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="p-5">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Order Line Items ({lineItems.length})
            </h4>

            {lineItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-md">
                No items added yet. Choose a product and quantity above.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-md">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Product & SKU</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Unit</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Agreed Price</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-24">Quantity</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Pre-Tax Total</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((item, idx) => (
                      <tr key={item.productId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.productName}
                          <div className="text-[10px] text-slate-400">SKU: {item.sku} &bull; {item.taxRate}% GST</div>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{item.unit}</td>
                        <td className="py-2.5 px-3 text-right text-slate-800 font-semibold">
                          {formatCurrency(item.unitPrice, activeBusiness?.currency.symbol)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleUpdateLineQty(idx, parseInt(e.target.value) || 1)}
                            className="w-16 text-center border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(item.lineTotal, activeBusiness?.currency.symbol)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleRemoveLineItem(idx)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center pt-5">
              <Button variant="secondary" onClick={() => setStep(1)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Vendor
              </Button>
              <Button
                variant="primary"
                disabled={lineItems.length === 0}
                onClick={() => setStep(3)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Delivery Details
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 3: Delivery Details */}
      {step === 3 && (
        <Card title="Step 3: Delivery Destination & Schedule" subtitle="Select receiving godown and expected delivery date.">
          <div className="space-y-4">
            <Select
              label="Receiving Warehouse / Godown"
              value={selectedWarehouseId}
              onChange={e => setSelectedWarehouseId(e.target.value)}
              options={warehouses.map(w => ({
                value: w.id,
                label: `${w.name} (${w.code}) — ${w.location}`,
              }))}
              required
            />

            <Input
              label="Expected Delivery Date"
              type="date"
              value={expectedDate}
              onChange={e => setExpectedDate(e.target.value)}
              required
            />

            <Input
              label="Special Instructions / Terms (Optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Kiln-dried moisture certificate required. Delivery between 9 AM and 4 PM."
            />

            <div className="flex justify-between pt-3">
              <Button variant="secondary" onClick={() => setStep(2)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Products
              </Button>
              <Button
                variant="primary"
                disabled={!selectedWarehouseId || !expectedDate}
                onClick={() => setStep(4)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Review Order Summary
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 4: Review and Save */}
      {step === 4 && (
        <Card
          title={t('purchases.step4Review', 'Step 4: Review & Issue Purchase Order')}
          subtitle={t('purchases.step4Subtitle', 'Inspect destination state tax breakdowns (CGST/SGST vs IGST) and AI-verified Input Tax Credit (ITC) before issuing.')}
        >
          <div className="space-y-5">
            {/* Summary info boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Vendor</span>
                <div className="font-bold text-slate-900 mt-0.5">{selectedVendor?.name}</div>
                <div className="text-slate-500 mt-0.5">GSTIN: {selectedVendor?.gstin || 'None specified'}</div>
                <div className="text-slate-500">Terms: {selectedVendor?.paymentTerms}</div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Destination & Schedule</span>
                <div className="font-bold text-slate-900 mt-0.5">{selectedWarehouse?.name}</div>
                <div className="text-slate-500 mt-0.5">Expected Delivery: {expectedDate}</div>
                {notes && <div className="text-slate-500 mt-1 italic">"{notes}"</div>}
              </div>
            </div>

            {/* Live State Tax Preview & AI ITC Claimability Component */}
            <StateTaxAndItcLivePreview
              items={lineItems}
              vendorGstin={selectedVendor?.gstin}
              vendorName={selectedVendor?.name}
              initialDestinationStateCode={activeBusiness?.taxSettings?.gstin ? activeBusiness.taxSettings.gstin.slice(0, 2) : '29'}
              currencySymbol={activeBusiness?.currency.symbol}
            />

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setStep(3)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Details
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                isLoading={loading}
                leftIcon={<Check className="w-4 h-4" />}
              >
                Save & Issue Purchase Order
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
