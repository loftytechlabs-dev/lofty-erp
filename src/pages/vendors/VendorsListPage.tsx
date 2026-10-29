import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localStore } from '../../services/store';
import { createVendor, getVendors, getVendorProducts } from '../../services/vendorService';
import { getProducts } from '../../services/productService';
import { Vendor, Product, VendorProduct, Warehouse } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { PAYMENT_TERMS } from '../../lib/constants';
import { VendorPriceComparison } from '../../components/vendors/VendorPriceComparison';
import { VendorNearbyMap } from '../../components/vendors/VendorNearbyMap';
import {
  validateVendorPayload,
  sanitizeNumericOnly,
  validatePhone,
  validateEmail,
  validateGSTIN,
  validateName,
} from '../../lib/validation';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Building,
  ArrowRight,
  TrendingDown,
  MapPin,
  Building2,
  Sparkles,
} from 'lucide-react';

export const VendorsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBusiness, permissions } = useBusiness();
  const { t } = useLanguage();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'directory' | 'comparison' | 'map'>(() => {
    if (tabParam === 'comparison' || tabParam === 'map') return tabParam;
    return 'directory';
  });

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Sync tab with URL search parameter
  const handleTabChange = (tab: 'directory' | 'comparison' | 'map') => {
    setActiveTab(tab);
    setSearchParams(tab === 'directory' ? {} : { tab });
  };

  // Form states
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(PAYMENT_TERMS[2]); // Net 30 Days
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    if (!activeBusiness) return;
    const [vList, pList, vpList] = await Promise.all([
      getVendors(activeBusiness.id),
      getProducts(activeBusiness.id),
      getVendorProducts(activeBusiness.id),
    ]);
    setVendors(vList);
    setProducts(pList);
    setVendorProducts(vpList);
    setWarehouses(localStore.getWarehouses(activeBusiness.id));
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      if (activeBusiness) {
        setVendors(localStore.getVendors(activeBusiness.id));
        setProducts(localStore.getProducts(activeBusiness.id));
        setVendorProducts(localStore.getVendorProducts(activeBusiness.id));
        setWarehouses(localStore.getWarehouses(activeBusiness.id));
      }
    });
    return () => unsub();
  }, [activeBusiness]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;

    // Comprehensive Constraint Verification
    const validation = validateVendorPayload({
      name,
      contactPerson,
      phone,
      email,
      gstin,
      address,
      paymentTerms,
    });

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setFormErrors({});
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const cleanGstin = gstin.trim().toUpperCase();

      const newV = await createVendor(activeBusiness.id, {
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: cleanPhone,
        email: email.trim().toLowerCase(),
        address: address.trim(),
        gstin: cleanGstin,
        paymentTerms,
        isActive: true,
      });

      await loadData();
      setIsAddModalOpen(false);
      resetForm();
      navigate(`/vendors/${newV.id}`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to create vendor');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setPaymentTerms(PAYMENT_TERMS[2]);
    setFormErrors({});
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.gstin && v.gstin.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('vendors.title', 'Vendor Management')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('vendors.subtitle', 'Suppliers, contact profiles, and vendor-specific purchase catalogs.')}
          </p>
        </div>

        {permissions.canManageVendors && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            {t('vendors.addVendor', 'Add New Vendor')}
          </Button>
        )}
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'directory'
              ? 'border-brand-500 text-brand-600 bg-orange-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>{t('vendors.directoryTab', 'Vendor Directory')}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/70 text-slate-700 font-bold">
            {vendors.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('comparison')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'comparison'
              ? 'border-brand-500 text-brand-600 bg-orange-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <TrendingDown className="w-4 h-4 text-emerald-600" />
          <span>{t('vendors.comparisonTab', 'Smart Price Comparison')}</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
            Best Deals
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('map')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'map'
              ? 'border-brand-500 text-brand-600 bg-orange-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <MapPin className="w-4 h-4 text-indigo-600" />
          <span>{t('vendors.mapTab', 'Nearby Vendors Map')}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold border border-indigo-200">
            Live Radar
          </span>
        </button>
      </div>

      {/* TAB 1: Vendor Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="max-w-md">
            <Input
              placeholder={t('vendors.searchPlaceholder', 'Search by vendor name, contact person, or GSTIN...')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              leftAddon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          {/* Vendor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVendors.map(vendor => {
              const vendorProductsCount = localStore
                .getVendorProducts(activeBusiness?.id || '', vendor.id)
                .length;

              return (
                <div
                  key={vendor.id}
                  onClick={() => navigate(`/vendors/${vendor.id}`)}
                  className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs hover:border-brand-300 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-bold text-slate-900">{vendor.name}</h3>
                      <Badge variant={vendor.isActive ? 'success' : 'neutral'} size="sm">
                        {vendor.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-600 font-medium mt-1">
                      Contact: {vendor.contactPerson || '—'}
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                      {vendor.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{vendor.phone}</span>
                        </div>
                      )}
                      {vendor.email && (
                        <div className="flex items-center space-x-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{vendor.email}</span>
                        </div>
                      )}
                      {vendor.gstin && (
                        <div className="flex items-center space-x-2">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>GST: {vendor.gstin}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      Supply Catalog: <strong className="text-brand-600">{vendorProductsCount} items</strong>
                    </span>
                    <div className="flex items-center space-x-2">
                      {permissions.canManageVendors && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/vendors/${vendor.id}?action=add`);
                          }}
                          className="px-2 py-1 rounded bg-orange-50 hover:bg-orange-100 text-brand-700 font-semibold text-[11px] border border-orange-200 transition-colors flex items-center space-x-1"
                          title="Add supply product to this vendor"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Product</span>
                        </button>
                      )}
                      <span className="text-slate-400 flex items-center space-x-0.5 hover:text-slate-700">
                        <span>Manage</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredVendors.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 p-8">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">
                {searchQuery ? `No vendors found matching "${searchQuery}"` : 'No vendors registered yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms or clearing the search query.'
                  : 'Add your suppliers to manage negotiated product catalog prices, issue purchase orders, and track deliveries.'}
              </p>
              {!searchQuery && permissions.canManageVendors && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsAddModalOpen(true)}
                >
                  Add First Vendor
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Smart Price Comparison */}
      {activeTab === 'comparison' && (
        <VendorPriceComparison
          vendors={vendors}
          products={products}
          vendorProducts={vendorProducts}
          currencySymbol={activeBusiness?.currency.symbol}
        />
      )}

      {/* TAB 3: Nearby Vendors Map */}
      {activeTab === 'map' && (
        <VendorNearbyMap
          vendors={vendors}
          warehouses={warehouses}
        />
      )}

      {/* Add Vendor Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('vendors.addVendor', 'Add New Vendor')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Vendor / Company Name"
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (formErrors.name) {
                const v = validateName(e.target.value, 'Vendor Name');
                setFormErrors(prev => ({ ...prev, name: v.isValid ? '' : (v.error || '') }));
              }
            }}
            placeholder="e.g. Western Timber & Forest Supplies"
            error={formErrors.name}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('vendors.contactPerson', 'Contact Person')}
              value={contactPerson}
              onChange={e => {
                setContactPerson(e.target.value);
                if (formErrors.contactPerson) {
                  const v = validateName(e.target.value, 'Contact Person');
                  setFormErrors(prev => ({ ...prev, contactPerson: v.isValid ? '' : (v.error || '') }));
                }
              }}
              placeholder="e.g. Mahesh Sawant"
              error={formErrors.contactPerson}
              required
            />
            <Input
              label={t('vendors.phone', 'Phone Number (Numbers Only)')}
              value={phone}
              onChange={e => {
                const sanitized = sanitizeNumericOnly(e.target.value);
                setPhone(sanitized);
                if (formErrors.phone) {
                  const v = validatePhone(sanitized, true);
                  setFormErrors(prev => ({ ...prev, phone: v.isValid ? '' : (v.error || '') }));
                }
              }}
              placeholder="9890122334"
              helperText={phone ? `${phone.length}/10 digits (numbers only)` : '10 digits (numbers only)'}
              error={formErrors.phone}
              maxLength={10}
              required
            />
            <Input
              label={t('vendors.email', 'Email Address')}
              type="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                if (formErrors.email) {
                  const v = validateEmail(e.target.value, false);
                  setFormErrors(prev => ({ ...prev, email: v.isValid ? '' : (v.error || '') }));
                }
              }}
              placeholder="sales@westerntimber.example"
              error={formErrors.email}
            />
            <Input
              label={t('vendors.gstin', 'GSTIN Number (15 Characters)')}
              value={gstin}
              onChange={e => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                setGstin(val);
                if (formErrors.gstin) {
                  const v = validateGSTIN(val, false);
                  setFormErrors(prev => ({ ...prev, gstin: v.isValid ? '' : (v.error || '') }));
                }
              }}
              placeholder="27AABCT9876C1Z3"
              helperText={gstin ? `${gstin.length}/15 characters (e.g. 27AABCT9876C1Z3)` : '15 characters (e.g. 27AABCT9876C1Z3)'}
              error={formErrors.gstin}
              maxLength={15}
            />
          </div>

          <Select
            label={t('vendors.paymentTerms', 'Payment Terms')}
            value={paymentTerms}
            onChange={e => setPaymentTerms(e.target.value)}
            options={PAYMENT_TERMS.map(term => ({ value: term, label: term }))}
          />

          <Input
            label="Physical / Office Address"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Sawmill Gate, Old Pune-Bangalore Road, Kolhapur 416004"
          />

          <div className="flex justify-end space-x-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsAddModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" type="submit" isLoading={loading}>
              {t('common.save', 'Save')} Vendor & Configure Catalog
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
