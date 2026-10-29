import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBusiness } from '../../contexts/BusinessContext';
import {
  Settings,
  Languages,
  Building,
  Receipt,
  Calendar,
  IndianRupee,
  Sliders,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const {
    currentLanguage,
    setLanguage,
    t,
    languages,
    currentLanguageMeta,
    formatDate,
    formatCurrency,
    formatNumber,
  } = useLanguage();

  const { activeBusiness } = useBusiness();

  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');
  const [numberFormat, setNumberFormat] = useState<'indian' | 'western'>('indian');
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(18);
  const [defaultReorderLevel, setDefaultReorderLevel] = useState<number>(10);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Focus on the 5 core regional languages first, followed by others
  const coreCodes = ['en', 'hi', 'kn', 'te', 'ta'];
  const coreLanguages = languages.filter((l) => coreCodes.includes(l.code));
  const additionalLanguages = languages.filter((l) => !coreCodes.includes(l.code));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 4000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl shadow-sm">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t('settings.title', 'Settings & Configuration')}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {t(
                'settings.subtitle',
                'Manage language preferences, organization profile, GSTIN tax rules, and system defaults.'
              )}
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{t('settings.saveSuccess', 'Settings saved successfully!')}</span>
          </div>
        )}
      </div>

      {/* Language Selector Grid */}
      <Card className="p-6 border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t('settings.languageTitle', 'Application Language')}
              </h2>
              <p className="text-xs text-slate-500">
                {t(
                  'settings.languageSubtitle',
                  'Choose your preferred operational language across Lofty ERP.'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-medium text-amber-900">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{t('settings.instantSwitch', 'Instant switch without page reload')}</span>
          </div>
        </div>

        {/* Primary 5 Supported Languages */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
            {t('common.language', 'Language')} — India Regional & English
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {coreLanguages.map((lang) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`relative flex flex-col p-4 rounded-xl border text-left transition-all duration-150 ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/50 shadow-sm ring-2 ring-orange-400/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-2xl">{lang.flag}</span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-100/80 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3 stroke-[3]" />
                        {t('settings.active', 'Active')}
                      </span>
                    )}
                  </div>
                  <div className="text-base font-bold text-slate-900 leading-snug">
                    {lang.nativeName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{lang.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Additional Languages Accordion / List */}
        {additionalLanguages.length > 0 && (
          <div className="pt-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
              Additional Regional & Global Languages
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {additionalLanguages.map((lang) => {
                const isSelected = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 text-orange-900 font-semibold ring-1 ring-orange-500'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span className="truncate">{lang.nativeName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Locale Preview Card */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t('settings.preview', 'Language Preview')} ({currentLanguageMeta.name} / {currentLanguageMeta.nativeName})
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Locale: {currentLanguage}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-slate-400 font-medium mb-1">
                {t('settings.dateFormat', 'Date Display Format')}
              </div>
              <div className="font-semibold text-slate-800 text-sm">
                {formatDate(new Date())}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-slate-400 font-medium mb-1">
                {t('settings.currencySymbol', 'Currency Symbol')} & Spend
              </div>
              <div className="font-semibold text-slate-800 text-sm">
                {formatCurrency(1450000)}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-slate-400 font-medium mb-1">
                {t('settings.numberFormat', 'Number Numbering Format')}
              </div>
              <div className="font-semibold text-slate-800 text-sm">
                {formatNumber(987654)} {t('common.units', 'Units')}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business & GSTIN Profile */}
        <Card className="p-6 border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t('settings.businessProfile', 'Business Profile')}
              </h2>
              <p className="text-xs text-slate-500">
                Operational company identity and statutory GST registration details.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.businessName', 'Business Name')}
              </label>
              <input
                type="text"
                readOnly
                value={activeBusiness?.name || 'Lofty Manufacturing Corp'}
                className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.businessType', 'Business Type')}
              </label>
              <input
                type="text"
                readOnly
                value={activeBusiness?.type || 'Manufacturing & Fabrication'}
                className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.gstinNumber', 'GSTIN Number')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={activeBusiness?.taxSettings?.gstin || '29ABCDE1234F1Z5'}
                  className="w-full text-sm font-mono font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-not-allowed"
                />
                <span className="absolute right-3 top-2.5 text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.ownerEmail', 'Owner Email')}
              </label>
              <input
                type="email"
                readOnly
                value={activeBusiness?.contact?.email || 'admin@loftyerp.internal'}
                className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.phone', 'Business Phone')}
              </label>
              <input
                type="text"
                readOnly
                value={activeBusiness?.contact?.phone || '+91 98765 43210'}
                className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.address', 'Registered Address')}
              </label>
              <input
                type="text"
                readOnly
                value={activeBusiness?.contact?.address || 'Plot 42, Peenya Industrial Area, Bangalore, Karnataka - 560058'}
                className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* Regional & Number Formatting */}
        <Card className="p-6 border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t('settings.regionalPreferences', 'Regional & Number Formatting')}
              </h2>
              <p className="text-xs text-slate-500">
                Configure currency display, date conventions, and numeric grouping.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                {t('settings.currencySymbol', 'Currency Symbol')}
              </label>
              <select
                disabled
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-not-allowed font-medium"
              >
                <option value="INR">₹ (INR - Indian Rupee)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {t('settings.dateFormat', 'Date Display Format')}
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 29/10/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/29/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-29)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.numberFormat', 'Number Numbering Format')}
              </label>
              <select
                value={numberFormat}
                onChange={(e) => setNumberFormat(e.target.value as 'indian' | 'western')}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="indian">
                  {t('settings.indianLakhs', 'Indian Numbering (Lakhs & Crores - ₹1,00,000)')}
                </option>
                <option value="western">
                  {t('settings.westernThousands', 'International Format (Thousands - ₹100,000)')}
                </option>
              </select>
            </div>
          </div>
        </Card>

        {/* Operational Defaults */}
        <Card className="p-6 border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t('settings.defaultsTitle', 'Operational Defaults')}
              </h2>
              <p className="text-xs text-slate-500">
                Default GST tax rates and inventory reorder alert thresholds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.defaultTaxRate', 'Default GST Rate (%)')}
              </label>
              <input
                type="number"
                min="0"
                max="28"
                step="1"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Standard GST slab rate applied to newly created purchase order line items.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('settings.defaultReorderLevel', 'Default Reorder Level (Units)')}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={defaultReorderLevel}
                onChange={(e) => setDefaultReorderLevel(Number(e.target.value))}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Threshold below which raw materials trigger low-stock alerts.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <Button type="submit" variant="primary" className="px-6 py-2.5">
              {t('settings.saveChanges', 'Save Changes')}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
};
