import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { localStore } from '../../services/store';
import {
  updateVendor,
  getVendorById,
  getVendorProducts,
  upsertVendorProduct,
  deleteVendorProduct,
} from '../../services/vendorService';
import { createProduct, getProducts } from '../../services/productService';
import { Vendor, Product, VendorProduct } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { STANDARD_UNITS, GST_RATES } from '../../lib/constants';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Building,
  Phone,
  Mail,
  Search,
  Package,
  Clock,
  Layers,
  AlertCircle,
  Tag,
  ShoppingBag,
} from 'lucide-react';

export const VendorDetailPage: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeBusiness, permissions } = useBusiness();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');

  // Edit Vendor modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editTerms, setEditTerms] = useState('');
  const [editActive, setEditActive] = useState(true);

  // Add / Assign Product Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('new');

  // Form states for adding from existing product
  const [selectedProductId, setSelectedProductId] = useState('');
  const [vendorPrice, setVendorPrice] = useState<number>(0);
  const [vendorUnit, setVendorUnit] = useState<string>('Pcs');
  const [leadTimeDays, setLeadTimeDays] = useState<number>(3);
  const [minOrderQty, setMinOrderQty] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for creating a new product inline
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Raw Materials');
  const [newProdUnit, setNewProdUnit] = useState(STANDARD_UNITS[0]);
  const [newProdReorder, setNewProdReorder] = useState(10);
  const [newProdTaxRate, setNewProdTaxRate] = useState(18);

  // Modify / Edit existing Vendor Product modal
  const [editingVp, setEditingVp] = useState<VendorProduct | null>(null);
  const [editVpPrice, setEditVpPrice] = useState<number>(0);
  const [editVpUnit, setEditVpUnit] = useState<string>('Pcs');
  const [editVpLeadTime, setEditVpLeadTime] = useState<number>(3);
  const [editVpMinQty, setEditVpMinQty] = useState<number>(1);
  const [editVpIsActive, setEditVpIsActive] = useState<boolean>(true);

  const loadData = async () => {
    if (!activeBusiness || !vendorId) return;
    try {
      const v = await getVendorById(activeBusiness.id, vendorId);
      if (v) {
        setVendor(v);
        setEditName(v.name);
        setEditContact(v.contactPerson);
        setEditPhone(v.phone);
        setEditEmail(v.email);
        setEditAddress(v.address);
        setEditGstin(v.gstin || '');
        setEditTerms(v.paymentTerms);
        setEditActive(v.isActive);
      }
      const vps = await getVendorProducts(activeBusiness.id, vendorId);
      setVendorProducts(vps);
      const prods = await getProducts(activeBusiness.id);
      setAllProducts(prods);
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
  }, [activeBusiness, vendorId]);

  // Open add modal if ?action=add is in URL
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  // When selectedProductId changes, set default unit from product
  useEffect(() => {
    if (selectedProductId) {
      const prod = allProducts.find(p => p.id === selectedProductId);
      if (prod) {
        setVendorUnit(prod.unit);
      }
    }
  }, [selectedProductId, allProducts]);

  // Filter products by search query - MUST be defined before any early returns to respect Rules of Hooks
  const filteredCatalog = useMemo(() => {
    return vendorProducts.filter(vp => {
      const prod = allProducts.find(p => p.id === vp.productId);
      const q = searchCatalogQuery.toLowerCase();
      if (!q) return true;
      return (
        prod?.name.toLowerCase().includes(q) ||
        prod?.sku.toLowerCase().includes(q) ||
        prod?.category.toLowerCase().includes(q)
      );
    });
  }, [vendorProducts, allProducts, searchCatalogQuery]);

  // Catalog Summary Stats
  const activeCatalogCount = vendorProducts.filter(vp => vp.isActive).length;
  const avgLeadTime = vendorProducts.length > 0
    ? Math.round(vendorProducts.reduce((sum, vp) => sum + (vp.leadTimeDays || 0), 0) / vendorProducts.length)
    : 0;

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <LoadingSpinner message="Loading Vendor profile and catalog..." />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Vendor not found.{' '}
        <button onClick={() => navigate('/vendors')} className="text-brand-600 underline">
          Return to Vendors
        </button>
      </div>
    );
  }

  // --- Vendor Profile Update ---
  const handleUpdateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;

    await updateVendor(activeBusiness.id, {
      ...vendor,
      name: editName.trim(),
      contactPerson: editContact.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
      address: editAddress.trim(),
      gstin: editGstin.trim(),
      paymentTerms: editTerms,
      isActive: editActive,
    });

    setIsEditModalOpen(false);
  };

  // --- Add Product to Vendor Catalog ---
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !vendor) return;

    setIsSubmitting(true);
    try {
      let targetProductId = selectedProductId;
      let targetUnit = vendorUnit;

      // If creating a brand new product inline
      if (addMode === 'new') {
        if (!newProdName.trim() || !newProdSku.trim()) {
          alert('Please enter a product name and SKU');
          setIsSubmitting(false);
          return;
        }

        const createdProd = await createProduct(activeBusiness.id, {
          name: newProdName.trim(),
          sku: newProdSku.trim().toUpperCase(),
          category: newProdCategory.trim(),
          unit: newProdUnit,
          reorderThreshold: Number(newProdReorder) || 0,
          taxRate: Number(newProdTaxRate) || 18,
          isActive: true,
        });

        targetProductId = createdProd.id;
        targetUnit = createdProd.unit;
      }

      if (!targetProductId) {
        alert('Please select or specify a product');
        setIsSubmitting(false);
        return;
      }

      await upsertVendorProduct(activeBusiness.id, vendor.id, {
        productId: targetProductId,
        vendorPrice: Number(vendorPrice),
        unit: targetUnit,
        leadTimeDays: Number(leadTimeDays) || 0,
        minOrderQuantity: Number(minOrderQty) || 1,
        isActive: true,
      });

      await loadData();
      setIsAddModalOpen(false);

      // Reset forms
      setSelectedProductId('');
      setVendorPrice(0);
      setLeadTimeDays(3);
      setMinOrderQty(1);
      setNewProdName('');
      setNewProdSku('');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to add product to vendor catalog');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Open Modify Modal for a Vendor Product ---
  const handleOpenModifyModal = (vp: VendorProduct) => {
    setEditingVp(vp);
    setEditVpPrice(vp.vendorPrice);
    setEditVpUnit(vp.unit);
    setEditVpLeadTime(vp.leadTimeDays);
    setEditVpMinQty(vp.minOrderQuantity);
    setEditVpIsActive(vp.isActive);
  };

  // --- Save Modified Vendor Product ---
  const handleSaveModifiedProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !vendor || !editingVp) return;

    setIsSubmitting(true);
    try {
      await upsertVendorProduct(activeBusiness.id, vendor.id, {
        id: editingVp.id,
        productId: editingVp.productId,
        vendorPrice: Number(editVpPrice),
        unit: editVpUnit,
        leadTimeDays: Number(editVpLeadTime) || 0,
        minOrderQuantity: Number(editVpMinQty) || 1,
        isActive: editVpIsActive,
        createdAt: editingVp.createdAt,
      });

      await loadData();
      setEditingVp(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to update vendor product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Remove Product from Catalog ---
  const handleRemoveProduct = async (vpId: string) => {
    if (!activeBusiness || !vendor) return;
    if (window.confirm('Remove this product from this vendor’s supply catalog?')) {
      await deleteVendorProduct(activeBusiness.id, vendor.id, vpId);
      await loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <button
          onClick={() => navigate('/vendors')}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Vendors</span>
        </button>

        <div className="flex items-center space-x-2">
          {permissions.canCreatePO && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ShoppingBag className="w-3.5 h-3.5" />}
              onClick={() => navigate(`/purchases/new?vendorId=${vendor.id}`)}
            >
              Order from this Vendor
            </Button>
          )}

          {permissions.canManageVendors && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Vendor Profile Card */}
      <Card noPadding className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">{vendor.name}</h1>
              <Badge variant={vendor.isActive ? 'success' : 'neutral'} size="sm">
                {vendor.isActive ? 'Active Supplier' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Primary Representative: <strong className="text-slate-700">{vendor.contactPerson}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-lg border border-slate-100">
            {vendor.phone && (
              <div className="flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{vendor.phone}</span>
              </div>
            )}
            {vendor.email && (
              <div className="flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{vendor.email}</span>
              </div>
            )}
            {vendor.gstin && (
              <div className="flex items-center space-x-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>GSTIN: <strong>{vendor.gstin}</strong></span>
              </div>
            )}
            <div>
              Payment Terms: <strong className="text-brand-600 font-semibold">{vendor.paymentTerms}</strong>
            </div>
          </div>
        </div>

        {vendor.address && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <strong>Registered Dispatch Address:</strong> {vendor.address}
          </div>
        )}
      </Card>

      {/* Vendor-Specific Supply Catalog Section */}
      <div className="space-y-4">
        {/* Catalog Header Bar with Stats & Actions */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Vendor Supply Catalog
                </h2>
                <Badge variant="orange" size="sm">
                  {vendorProducts.length} Items Configured
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Products this vendor is authorized to supply. You can modify negotiated prices, lead times, and MOQs anytime.
              </p>
            </div>

            {permissions.canManageVendors && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setAddMode(allProducts.length > 0 ? 'existing' : 'new');
                  setIsAddModalOpen(true);
                }}
              >
                Add Product to Vendor
              </Button>
            )}
          </div>

          {/* Quick Metrics & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="flex items-center space-x-4 text-xs text-slate-600">
              <div className="flex items-center space-x-1.5">
                <Package className="w-4 h-4 text-slate-400" />
                <span>
                  Active items: <strong className="text-slate-900">{activeCatalogCount}</strong>
                </span>
              </div>
              <div className="text-slate-300">&bull;</div>
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>
                  Avg lead time: <strong className="text-slate-900">{avgLeadTime} days</strong>
                </span>
              </div>
            </div>

            {/* Search within catalog */}
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search catalog by name, SKU..."
                value={searchCatalogQuery}
                onChange={e => setSearchCatalogQuery(e.target.value)}
                leftAddon={<Search className="w-3.5 h-3.5 text-slate-400" />}
              />
            </div>
          </div>
        </div>

        {/* Vendor Products Table */}
        <Card noPadding>
          {filteredCatalog.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-semibold text-slate-700">
                {vendorProducts.length === 0
                  ? 'No Products Configured for this Vendor'
                  : 'No Products Match Your Search'}
              </div>
              <p className="text-slate-400 max-w-sm mx-auto mt-1">
                {vendorProducts.length === 0
                  ? 'Click "Add Product to Vendor" above to specify raw materials and components this vendor can supply with agreed rates.'
                  : 'Try searching with a different SKU or product name.'}
              </p>
              {vendorProducts.length === 0 && permissions.canManageVendors && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setAddMode('new');
                      setIsAddModalOpen(true);
                    }}
                  >
                    Add First Product
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Product Name &amp; SKU</th>
                    <th className="py-2.5 px-4 font-semibold">Category</th>
                    <th className="py-2.5 px-4 font-semibold">Unit</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Negotiated Price (Excl. Tax)</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Lead Time</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Min Order (MOQ)</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Supply Status</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.map(vp => {
                    const productInfo = allProducts.find(p => p.id === vp.productId);
                    return (
                      <tr key={vp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {productInfo ? productInfo.name : 'Unknown Product'}
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {productInfo?.sku || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {productInfo?.category || 'General'}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{vp.unit}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(vp.vendorPrice, activeBusiness?.currency.symbol)}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600">
                          {vp.leadTimeDays} days
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600">
                          {vp.minOrderQuantity} {vp.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={vp.isActive ? 'success' : 'neutral'} size="sm">
                            {vp.isActive ? 'Available' : 'Paused'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            {permissions.canManageVendors && (
                              <button
                                onClick={() => handleOpenModifyModal(vp)}
                                className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600 hover:text-brand-600 transition-colors font-medium text-[11px]"
                                title="Modify vendor price, MOQ & lead time"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Modify</span>
                              </button>
                            )}

                            {permissions.canManageVendors && (
                              <button
                                onClick={() => handleRemoveProduct(vp.id)}
                                className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                                title="Remove from vendor's catalog"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* --- ADD PRODUCT TO VENDOR MODAL --- */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Product to Vendor Supply Catalog"
        maxWidth="lg"
      >
        <form onSubmit={handleAddProduct} className="space-y-4">
          {/* Toggle Tab: Existing Master Product vs Brand New Product */}
          <div className="flex border-b border-slate-200 mb-2">
            <button
              type="button"
              onClick={() => setAddMode('existing')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                addMode === 'existing'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Select Existing Product from Catalog
            </button>
            <button
              type="button"
              onClick={() => setAddMode('new')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                addMode === 'new'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              + Create Brand New Product &amp; Link
            </button>
          </div>

          {addMode === 'existing' ? (
            <div className="space-y-3">
              <Select
                label="Choose Existing Product"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                placeholder="— Select product from business catalog —"
                options={allProducts.map(p => ({
                  value: p.id,
                  label: `${p.name} (${p.sku}) — Standard Unit: ${p.unit}`,
                }))}
                required
              />
              {selectedProductId && (
                <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-600">
                  {(() => {
                    const chosen = allProducts.find(p => p.id === selectedProductId);
                    return chosen ? (
                      <div>
                        Selected SKU: <strong>{chosen.sku}</strong> &bull; Category: {chosen.category} &bull; Standard Unit: {chosen.unit}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-3 bg-orange-50/30 rounded-lg border border-orange-100">
              <div className="text-xs font-semibold text-slate-800 flex items-center">
                <Tag className="w-3.5 h-3.5 mr-1 text-brand-600" />
                New Product Master Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Product Name"
                  placeholder="e.g. Kiln-Dried Teak Planks"
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  required
                />
                <Input
                  label="SKU Code"
                  placeholder="e.g. WD-TEAK-002"
                  value={newProdSku}
                  onChange={e => setNewProdSku(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Category"
                  placeholder="e.g. Timber & Lumber"
                  value={newProdCategory}
                  onChange={e => setNewProdCategory(e.target.value)}
                  required
                />
                <Select
                  label="Base Unit"
                  value={newProdUnit}
                  onChange={e => {
                    setNewProdUnit(e.target.value);
                    setVendorUnit(e.target.value);
                  }}
                  options={STANDARD_UNITS.map(u => ({ value: u, label: u }))}
                  required
                />
                <Select
                  label="GST Rate (%)"
                  value={newProdTaxRate}
                  onChange={e => setNewProdTaxRate(Number(e.target.value))}
                  options={GST_RATES.map(r => ({ value: r.value, label: r.label }))}
                  required
                />
              </div>
            </div>
          )}

          {/* Negotiated Terms (Price, MOQ, Lead Time) */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="text-xs font-semibold text-slate-800">
              Negotiated Supplier Commercial Terms
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Agreed Vendor Price (Excl. GST)"
                type="number"
                step="0.01"
                min="0"
                value={vendorPrice}
                onChange={e => setVendorPrice(parseFloat(e.target.value) || 0)}
                leftAddon={activeBusiness?.currency.symbol}
                required
                helperText="Purchase price applied on purchase orders for this vendor."
              />
              <Select
                label="Supply Unit"
                value={vendorUnit}
                onChange={e => setVendorUnit(e.target.value)}
                options={STANDARD_UNITS.map(u => ({ value: u, label: u }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Lead Time (Days)"
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={e => setLeadTimeDays(parseInt(e.target.value) || 0)}
                required
              />
              <Input
                label="Minimum Order Qty (MOQ)"
                type="number"
                min="1"
                value={minOrderQty}
                onChange={e => setMinOrderQty(parseInt(e.target.value) || 1)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving to Catalog...' : 'Add to Vendor Catalog'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODIFY / EDIT VENDOR PRODUCT MODAL --- */}
      <Modal
        isOpen={!!editingVp}
        onClose={() => setEditingVp(null)}
        title="Modify Vendor Supply Terms"
        maxWidth="md"
      >
        {editingVp && (
          <form onSubmit={handleSaveModifiedProduct} className="space-y-4">
            {/* Read-only Product Identity */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Product Details
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {allProducts.find(p => p.id === editingVp.productId)?.name || 'Product'}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                SKU: {allProducts.find(p => p.id === editingVp.productId)?.sku || '—'}
              </div>
            </div>

            {/* Editable Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Negotiated Purchase Price (Excl. Tax)"
                type="number"
                step="0.01"
                min="0"
                value={editVpPrice}
                onChange={e => setEditVpPrice(parseFloat(e.target.value) || 0)}
                leftAddon={activeBusiness?.currency.symbol}
                required
              />
              <Select
                label="Unit of Measure"
                value={editVpUnit}
                onChange={e => setEditVpUnit(e.target.value)}
                options={STANDARD_UNITS.map(u => ({ value: u, label: u }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Lead Time (Days)"
                type="number"
                min="0"
                value={editVpLeadTime}
                onChange={e => setEditVpLeadTime(parseInt(e.target.value) || 0)}
                required
              />
              <Input
                label="Minimum Order Qty (MOQ)"
                type="number"
                min="1"
                value={editVpMinQty}
                onChange={e => setEditVpMinQty(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editVpIsActive}
                  onChange={e => setEditVpIsActive(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="font-semibold">Active &amp; Available for Purchase Orders</span>
              </label>
              <p className="text-[11px] text-slate-400 pl-6 mt-0.5">
                Uncheck to temporarily pause ordering this product from this vendor without deleting its pricing history.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                type="button"
                disabled={isSubmitting}
                onClick={() => setEditingVp(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Save Modifications'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- EDIT VENDOR PROFILE MODAL --- */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Vendor Details"
        maxWidth="md"
      >
        <form onSubmit={handleUpdateVendor} className="space-y-4">
          <Input
            label="Vendor Name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Person"
              value={editContact}
              onChange={e => setEditContact(e.target.value)}
              required
            />
            <Input
              label="Phone"
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={editEmail}
            onChange={e => setEditEmail(e.target.value)}
          />
          <Input
            label="GSTIN"
            value={editGstin}
            onChange={e => setEditGstin(e.target.value)}
          />
          <Input
            label="Address"
            value={editAddress}
            onChange={e => setEditAddress(e.target.value)}
          />

          <div className="pt-2">
            <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editActive}
                onChange={e => setEditActive(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
              />
              <span className="font-semibold">Active Vendor Relationship</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
