import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vendor, Product, VendorProduct } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Sparkles,
  TrendingDown,
  Award,
  Clock,
  Package,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Tag,
  DollarSign,
  Plus,
} from 'lucide-react';

interface VendorPriceComparisonProps {
  vendors: Vendor[];
  products: Product[];
  vendorProducts: VendorProduct[];
  currencySymbol?: string;
  onAddQuote?: (productId?: string) => void;
}

export const VendorPriceComparison: React.FC<VendorPriceComparisonProps> = ({
  vendors,
  products,
  vendorProducts,
  currencySymbol = '₹',
  onAddQuote,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Map of vendorId -> Vendor
  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach(v => map.set(v.id, v));
    return map;
  }, [vendors]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Aggregate product comparison items
  const comparisonData = useMemo(() => {
    return products.map(product => {
      // Find all vendor quotes for this product
      const quotes = vendorProducts
        .filter(vp => vp.productId === product.id && vp.isActive)
        .map(vp => {
          const v = vendorMap.get(vp.vendorId);
          return {
            vendorProduct: vp,
            vendor: v,
            vendorName: v?.name || 'Unknown Supplier',
            price: vp.vendorPrice,
            leadTimeDays: vp.leadTimeDays || 3,
            minOrderQty: vp.minOrderQuantity || 1,
            paymentTerms: v?.paymentTerms || 'Net 30',
          };
        })
        .sort((a, b) => a.price - b.price); // Lowest price first

      const lowestPrice = quotes.length > 0 ? quotes[0].price : 0;
      const highestPrice = quotes.length > 0 ? quotes[quotes.length - 1].price : 0;
      const priceDiff = highestPrice - lowestPrice;
      const maxSavingsPct = highestPrice > 0 ? Math.round((priceDiff / highestPrice) * 100) : 0;
      const hasCompetition = quotes.length > 1;

      return {
        product,
        quotes,
        lowestQuote: quotes[0] || null,
        highestQuote: quotes[quotes.length - 1] || null,
        lowestPrice,
        highestPrice,
        priceDiff,
        maxSavingsPct,
        hasCompetition,
      };
    });
  }, [products, vendorProducts, vendorMap]);

  // Filter comparison items
  const filteredData = useMemo(() => {
    return comparisonData.filter(item => {
      const matchSearch =
        item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.quotes.some(q => q.vendorName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCat =
        selectedCategory === 'ALL' || item.product.category === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [comparisonData, searchQuery, selectedCategory]);

  // Top KPI metrics
  const kpiStats = useMemo(() => {
    const totalProducts = comparisonData.length;
    const multiVendorProducts = comparisonData.filter(c => c.hasCompetition).length;

    let totalPotentialBatchSavings = 0;
    let maxPct = 0;

    comparisonData.forEach(c => {
      if (c.hasCompetition && c.priceDiff > 0) {
        // Standard batch of 50 units or product's MOQ
        const batchQty = Math.max(c.lowestQuote?.minOrderQty || 1, 25);
        totalPotentialBatchSavings += c.priceDiff * batchQty;
        if (c.maxSavingsPct > maxPct) {
          maxPct = c.maxSavingsPct;
        }
      }
    });

    return {
      totalProducts,
      multiVendorProducts,
      maxPct,
      totalPotentialBatchSavings,
    };
  }, [comparisonData]);

  const handleCreatePoWithVendor = (vendorId: string) => {
    navigate(`/purchases/new?vendorId=${vendorId}`);
  };

  return (
    <div className="space-y-5">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Analyzed Products
            </span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {kpiStats.totalProducts}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">In enterprise catalog</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Multi-Sourced Items
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-700 tracking-tight">
            {kpiStats.multiVendorProducts}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">With active price competition</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Top Price Spread
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 tracking-tight">
            {kpiStats.maxPct > 0 ? `${kpiStats.maxPct}% cheaper` : 'Standard'}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Maximum unit price difference</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Potential Batch Savings
            </span>
            <span className="p-1.5 rounded-lg bg-orange-50 text-brand-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-brand-600 tracking-tight">
            {formatCurrency(kpiStats.totalPotentialBatchSavings, currencySymbol)}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Across competing orders</p>
        </div>
      </div>

      {/* Toolbar: Search & Category Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name, SKU, or supplier..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Price Comparison Cards */}
      {filteredData.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No products match your search</h3>
          <p className="text-xs text-slate-400 mt-1">Try modifying your query or category filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map(item => {
            const hasMultiple = item.quotes.length > 1;

            return (
              <div
                key={item.product.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden hover:border-slate-300 transition-all"
              >
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-slate-50 via-white to-orange-50/20 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{item.product.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                        SKU: {item.product.sku}
                      </span>
                      {item.product.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-orange-50 text-brand-700 font-semibold border border-orange-200/60">
                          {item.product.category}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Standard Unit: <strong>{item.product.unit}</strong> &bull; GST Rate: <strong>{item.product.taxRate || 18}%</strong>
                    </div>
                  </div>

                  {/* Lowest Price Banner */}
                  {item.lowestQuote && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                          Best Offer Rate
                        </span>
                        <div className="text-base font-extrabold text-emerald-700">
                          {formatCurrency(item.lowestPrice, currencySymbol)}
                          <span className="text-xs font-normal text-slate-500"> / {item.product.unit}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCreatePoWithVendor(item.lowestQuote!.vendorProduct.vendorId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-500 hover:bg-brand-600 text-white shadow-2xs transition-all"
                      >
                        Order with Best Vendor <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Vendor Quotes Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Supplier / Vendor</th>
                        <th className="py-2.5 px-4 text-right">Offered Price</th>
                        <th className="py-2.5 px-4 text-center">Price Position</th>
                        <th className="py-2.5 px-4 text-center">Lead Time</th>
                        <th className="py-2.5 px-4 text-center">Min Order (MOQ)</th>
                        <th className="py-2.5 px-4 text-center">Payment Terms</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {item.quotes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400">
                            No supplier prices registered for this product yet.
                          </td>
                        </tr>
                      ) : (
                        item.quotes.map((quote, idx) => {
                          const isLowest = idx === 0;
                          const diff = quote.price - item.lowestPrice;
                          const diffPct = item.lowestPrice > 0 ? Math.round((diff / item.lowestPrice) * 100) : 0;

                          return (
                            <tr
                              key={quote.vendorProduct.id}
                              className={`transition-colors ${isLowest ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50/60'}`}
                            >
                              {/* Vendor Name */}
                              <td className="py-2.5 px-4 font-medium text-slate-900">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{quote.vendorName}</span>
                                  {isLowest && hasMultiple && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <Award className="w-3 h-3 text-emerald-600" />
                                      Lowest Price
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {quote.vendor?.address ? quote.vendor.address.slice(0, 45) + '...' : 'Location registered'}
                                </div>
                              </td>

                              {/* Price */}
                              <td className="py-2.5 px-4 text-right font-bold whitespace-nowrap">
                                <span className={isLowest ? 'text-emerald-700 text-sm' : 'text-slate-800'}>
                                  {formatCurrency(quote.price, currencySymbol)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal"> / {item.product.unit}</span>
                              </td>

                              {/* Price Position */}
                              <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                {isLowest ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Best Deal
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                                    +{formatCurrency(diff, currencySymbol)} (+{diffPct}%)
                                  </span>
                                )}
                              </td>

                              {/* Lead Time */}
                              <td className="py-2.5 px-4 text-center text-slate-600 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {quote.leadTimeDays} days
                                </span>
                              </td>

                              {/* MOQ */}
                              <td className="py-2.5 px-4 text-center text-slate-600 whitespace-nowrap">
                                {quote.minOrderQty} {item.product.unit}
                              </td>

                              {/* Payment Terms */}
                              <td className="py-2.5 px-4 text-center text-slate-600 whitespace-nowrap">
                                {quote.paymentTerms}
                              </td>

                              {/* Action */}
                              <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleCreatePoWithVendor(quote.vendorProduct.vendorId)}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                                    isLowest
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  Select & Order
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* AI Savings / Single Supplier Recommendation Box */}
                <div className="p-3 bg-slate-50 border-t border-slate-200/80 text-xs">
                  {hasMultiple ? (
                    <div className="flex items-start gap-2 text-slate-700">
                      <Sparkles className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-900">AI Deal Recommendation: </strong>
                        Ordering through <strong className="text-emerald-700">{item.lowestQuote?.vendorName}</strong> saves{' '}
                        <strong className="text-emerald-700">{formatCurrency(item.priceDiff, currencySymbol)} per unit</strong> ({item.maxSavingsPct}% cheaper) compared to {item.highestQuote?.vendorName}. On an order of 50 units, your business will save{' '}
                        <strong className="text-slate-900 font-bold">{formatCurrency(item.priceDiff * 50, currencySymbol)}</strong> directly from procurement expenses.
                      </div>
                    </div>
                  ) : item.quotes.length === 1 ? (
                    <div className="flex items-start gap-2 text-slate-600">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-800">Single-Supplier Item: </strong>
                        Currently only <strong>{item.quotes[0].vendorName}</strong> supplies this item at {formatCurrency(item.lowestPrice, currencySymbol)}/{item.product.unit}. Adding an alternative vendor quote can help negotiate better rates and avoid supply disruption.
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">
                      No supplier quotes registered for this product. You can link vendors to this product from the Vendor Detail page.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
