import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { createBusiness } from '../../services/businessService';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Building2, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';

export const CreateBusinessPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshBusinesses, switchBusiness } = useBusiness();

  const [name, setName] = useState('');
  const [type, setType] = useState('Small Manufacturing & Fabrication');
  const [country, setCountry] = useState('India');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [gstin, setGstin] = useState('');
  const [defaultTaxRate, setDefaultTaxRate] = useState(18);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const businessTypes = [
    { value: 'Small Manufacturing & Fabrication', label: 'Small Manufacturing & Fabrication' },
    { value: 'Component Assembly & Engineering', label: 'Component Assembly & Engineering' },
    { value: 'Wholesale & Industrial Supplies', label: 'Wholesale & Industrial Supplies' },
    { value: 'Furniture & Woodcraft', label: 'Furniture & Woodcraft' },
    { value: 'Packaging & Chemical Processing', label: 'Packaging & Chemical Processing' },
  ];

  const currencyOptions = [
    { value: 'INR_₹', label: 'Indian Rupee (₹ - INR)' },
    { value: 'USD_$', label: 'US Dollar ($ - USD)' },
    { value: 'EUR_€', label: 'Euro (€ - EUR)' },
    { value: 'GBP_£', label: 'British Pound (£ - GBP)' },
  ];

  const taxRates = [
    { value: 0, label: '0% (Exempt)' },
    { value: 5, label: '5% GST' },
    { value: 12, label: '12% GST' },
    { value: 18, label: '18% Standard GST' },
    { value: 28, label: '28% Higher GST' },
  ];

  const handleCurrencyChange = (val: string) => {
    const [code, sym] = val.split('_');
    setCurrencyCode(code);
    setCurrencySymbol(sym);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Business name is required.');
      return;
    }
    if (!user) {
      setError('You must be signed in.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createBusiness(user.uid, user.email, user.displayName, {
        name: name.trim(),
        type,
        country,
        currency: { code: currencyCode, symbol: currencySymbol },
        taxSettings: {
          gstin: gstin.trim(),
          defaultTaxRate: Number(defaultTaxRate),
        },
        contact: {
          phone: phone.trim(),
          email: email.trim() || user.email,
          address: address.trim(),
        },
      });

      await refreshBusinesses();
      switchBusiness(res.business.id);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to create business.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Navigation bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/onboarding')}
            className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Onboarding</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center space-x-3 pb-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-orange-100 text-brand-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Set Up Your Business</h1>
              <p className="text-xs text-slate-500">
                You will be assigned as the primary Owner with full administrative authority.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Business / Enterprise Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Acme Precision Manufacturing Ltd."
                  required
                />
              </div>

              <Select
                label="Industry / Business Type"
                value={type}
                onChange={e => setType(e.target.value)}
                options={businessTypes}
              />

              <Select
                label="Currency"
                value={`${currencyCode}_${currencySymbol}`}
                onChange={e => handleCurrencyChange(e.target.value)}
                options={currencyOptions}
              />

              <Input
                label="GSTIN / Tax Identification"
                value={gstin}
                onChange={e => setGstin(e.target.value)}
                placeholder="27AABCA1234F1Z8"
                helperText="Required for GST-compliant purchase orders and supplier bills"
              />

              <Select
                label="Default Tax Rate"
                value={defaultTaxRate}
                onChange={e => setDefaultTaxRate(Number(e.target.value))}
                options={taxRates}
              />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Operating Contact (Optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98200 12345"
                />
                <Input
                  label="Operations Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="operations@example.com"
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Factory / Main Godown Address"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Plot 42, MIDC Industrial Area, Pune 411018"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Isolated tenant workspace</span>
              </div>
              <Button
                variant="primary"
                type="submit"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Business & Launch
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
