import React, { useState, useEffect, useMemo } from 'react';
import {
  INDIAN_STATES,
  IndianState,
  getStateByCode,
  detectStateFromGstin,
  calculateStateTaxBreakdown,
  evaluateProductItcWithGemini,
  ProductItcEvaluation,
  GstSupplyType,
} from '../../services/aiService';
import { POLineItem } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  MapPin,
  RefreshCw,
  Info,
  CheckCircle2,
  Receipt,
  FileCheck2,
  HelpCircle,
} from 'lucide-react';

interface StateTaxAndItcLivePreviewProps {
  items: POLineItem[];
  vendorGstin?: string;
  vendorName?: string;
  initialDestinationStateCode?: string;
  currencySymbol?: string;
  onStateChange?: (state: IndianState, supplyType: GstSupplyType) => void;
}

export const StateTaxAndItcLivePreview: React.FC<StateTaxAndItcLivePreviewProps> = ({
  items,
  vendorGstin,
  vendorName,
  initialDestinationStateCode = '29', // Default Karnataka (29)
  currencySymbol = '₹',
  onStateChange,
}) => {
  const { t } = useLanguage();

  // Selected destination state for live tax preview
  const [selectedStateCode, setSelectedStateCode] = useState<string>(() => {
    return initialDestinationStateCode || '29';
  });

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itcEvaluations, setItcEvaluations] = useState<Record<string, ProductItcEvaluation>>({});
  const [isEvaluatingAi, setIsEvaluatingAi] = useState<boolean>(false);

  // Detect Vendor's registered State from their 15-char GSTIN
  const vendorState = useMemo(() => detectStateFromGstin(vendorGstin), [vendorGstin]);

  // Selected destination state object
  const destinationState = useMemo(() => {
    return getStateByCode(selectedStateCode) || { code: selectedStateCode, name: 'Target State' };
  }, [selectedStateCode]);

  // Determine supply type: Intra-State (same state) vs Inter-State (cross border)
  const isIntraState = useMemo(() => {
    if (vendorState) {
      return vendorState.code === destinationState.code;
    }
    // If no vendor GSTIN provided, default to Intra-state if code matches default or inter-state
    return selectedStateCode === '29';
  }, [vendorState, destinationState, selectedStateCode]);

  const supplyType: GstSupplyType = isIntraState ? 'INTRA_STATE' : 'INTER_STATE';

  // Notify parent component if callback provided
  useEffect(() => {
    if (onStateChange) {
      onStateChange(destinationState, supplyType);
    }
  }, [destinationState, supplyType, onStateChange]);

  // Run AI ITC Evaluation whenever items or selected state change
  const runAiItcAnalysis = async () => {
    if (items.length === 0) return;
    setIsEvaluatingAi(true);

    try {
      const results: Record<string, ProductItcEvaluation> = {};
      for (const item of items) {
        const evalResult = await evaluateProductItcWithGemini(
          {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
          },
          {
            destinationStateCode: destinationState.code,
            destinationStateName: destinationState.name,
          }
        );
        results[item.productId] = evalResult;
      }
      setItcEvaluations(results);
    } catch (err) {
      console.warn('Failed evaluating AI ITC:', err);
    } finally {
      setIsEvaluatingAi(false);
    }
  };

  useEffect(() => {
    runAiItcAnalysis();
  }, [items, selectedStateCode]);

  // Calculate live state tax numbers across all items
  const summaryCalculations = useMemo(() => {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalTax = 0;
    let totalClaimableItc = 0;
    let totalBlockedItc = 0;

    items.forEach(item => {
      subtotal += item.lineTotal;
      const breakdown = calculateStateTaxBreakdown(
        item.lineTotal,
        item.taxRate,
        destinationState.code,
        vendorGstin
      );
      totalCgst += breakdown.cgstAmount;
      totalSgst += breakdown.sgstAmount;
      totalIgst += breakdown.igstAmount;
      totalTax += breakdown.totalTax;

      const itc = itcEvaluations[item.productId];
      if (itc) {
        totalClaimableItc += itc.claimableAmount;
        totalBlockedItc += (breakdown.totalTax - itc.claimableAmount);
      } else {
        totalClaimableItc += breakdown.totalTax;
      }
    });

    const grandTotal = subtotal + totalTax;
    const netEffectiveSpend = subtotal + totalBlockedItc;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalIgst: Math.round(totalIgst * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      totalClaimableItc: Math.round(totalClaimableItc * 100) / 100,
      totalBlockedItc: Math.round(totalBlockedItc * 100) / 100,
      netEffectiveSpend: Math.round(netEffectiveSpend * 100) / 100,
    };
  }, [items, destinationState, vendorGstin, itcEvaluations]);

  const toggleItemExpand = (id: string) => {
    setExpandedItemId(prev => (prev === id ? null : id));
  };

  const quickStates = [
    { code: '29', label: 'Karnataka (29)' },
    { code: '27', label: 'Maharashtra (27)' },
    { code: '33', label: 'Tamil Nadu (33)' },
    { code: '36', label: 'Telangana (36)' },
    { code: '07', label: 'Delhi (07)' },
    { code: '24', label: 'Gujarat (24)' },
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs space-y-0">
      {/* Header & State Selector Toolbar */}
      <div className="p-4 bg-gradient-to-r from-slate-50 via-white to-amber-50/30 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-100/80 text-brand-600">
                <Receipt className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Live State Tax Preview & AI ITC Eligibility
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200/60">
                <Sparkles className="w-3 h-3 text-brand-500 animate-pulse" />
                Gemini AI GST Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select destination state to inspect live GST tax rate splits (CGST+SGST vs IGST) and AI-verified Input Tax Credit under CGST Act Sec 16 & Sec 17(5).
            </p>
          </div>

          <button
            type="button"
            onClick={runAiItcAnalysis}
            disabled={isEvaluatingAi}
            className="self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand-600 ${isEvaluatingAi ? 'animate-spin' : ''}`} />
            {isEvaluatingAi ? 'Analyzing ITC...' : 'Refresh AI Assessment'}
          </button>
        </div>

        {/* State Input & Supply Status Bar */}
        <div className="mt-4 pt-3 border-t border-slate-200/70 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Main State Selector Input */}
          <div className="lg:col-span-5 flex items-center gap-2">
            <label htmlFor="destination-state-select" className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-600" />
              Destination State:
            </label>
            <div className="relative flex-1">
              <select
                id="destination-state-select"
                value={selectedStateCode}
                onChange={e => setSelectedStateCode(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 shadow-2xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {INDIAN_STATES.map(st => (
                  <option key={st.code} value={st.code}>
                    {st.code} — {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Click Badges */}
          <div className="lg:col-span-7 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-medium">Quick switch:</span>
            {quickStates.map(qs => (
              <button
                key={qs.code}
                type="button"
                onClick={() => setSelectedStateCode(qs.code)}
                className={`px-2 py-0.5 rounded-md border font-medium transition-all ${
                  selectedStateCode === qs.code
                    ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {qs.label}
              </button>
            ))}
          </div>
        </div>

        {/* Supply Classification Banner */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-100/90 border border-slate-200/80 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              Vendor Origin:{' '}
              <strong className="text-slate-800">
                {vendorState ? `${vendorState.name} (${vendorState.code})` : 'Vendor State (Default 29)'}
              </strong>
            </span>
            <span className="text-slate-300 font-bold">&bull;</span>
            <span className="text-slate-500">
              Destination Warehouse:{' '}
              <strong className="text-slate-800">
                {destinationState.name} ({destinationState.code})
              </strong>
            </span>
          </div>

          {/* Classification Pill */}
          {supplyType === 'INTRA_STATE' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              📍 Intra-State Supply &bull; CGST (50%) + SGST (50%)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              ✈️ Inter-State Cross-Border &bull; 100% IGST Applicable
            </span>
          )}
        </div>
      </div>

      {/* Live Item Tax Table with AI ITC Assessment */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
            <tr>
              <th className="py-2.5 px-3">Item & SKU</th>
              <th className="py-2.5 px-3 text-center">Qty</th>
              <th className="py-2.5 px-3 text-right">Taxable Value</th>
              <th className="py-2.5 px-3 text-center">State GST Split</th>
              <th className="py-2.5 px-3 text-right">GST Total</th>
              <th className="py-2.5 px-3 text-center">AI ITC Claimability</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => {
              const breakdown = calculateStateTaxBreakdown(
                item.lineTotal,
                item.taxRate,
                destinationState.code,
                vendorGstin
              );
              const itc = itcEvaluations[item.productId];
              const isExpanded = expandedItemId === item.productId;

              return (
                <React.Fragment key={item.productId}>
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    {/* Item Name & SKU */}
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div className="font-semibold text-slate-800">{item.productName}</div>
                      <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>
                    </td>

                    {/* Qty */}
                    <td className="py-2.5 px-3 text-center text-slate-600 whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>

                    {/* Taxable */}
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                      {formatCurrency(item.lineTotal, currencySymbol)}
                    </td>

                    {/* State GST Split */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {supplyType === 'INTRA_STATE' ? (
                        <div className="inline-flex flex-col items-center leading-tight">
                          <span className="font-bold text-slate-800">
                            CGST {breakdown.cgstRate}% + SGST {breakdown.sgstRate}%
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({formatCurrency(breakdown.cgstAmount, currencySymbol)} + {formatCurrency(breakdown.sgstAmount, currencySymbol)})
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center leading-tight">
                          <span className="font-bold text-indigo-700">IGST {breakdown.igstRate}%</span>
                          <span className="text-[10px] text-indigo-500 font-mono">
                            {formatCurrency(breakdown.igstAmount, currencySymbol)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Total GST */}
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(breakdown.totalTax, currencySymbol)}
                    </td>

                    {/* AI ITC Claimability Status */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {itc ? (
                        itc.status === 'ELIGIBLE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            100% ITC Eligible
                          </span>
                        ) : itc.status === 'BLOCKED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Blocked (Sec 17(5))
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Conditional ITC
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Sparkles className="w-3 h-3 animate-spin text-brand-500" />
                          Evaluating...
                        </span>
                      )}
                    </td>

                    {/* Action Button to Expand Details */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleItemExpand(item.productId)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100/70 px-2 py-1 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            Hide AI <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            CA Insights <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expandable Forensic Legal Analysis Row */}
                  {isExpanded && itc && (
                    <tr className="bg-gradient-to-r from-amber-50/40 via-orange-50/20 to-slate-50 border-y border-amber-100">
                      <td colSpan={7} className="p-3 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-8 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                                Forensic Rationale:
                              </span>
                              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-700">
                                {itc.statutorySection}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                (Source: {itc.source === 'gemini' ? 'Gemini 3.5 AI' : 'Lofty Statutory Engine'})
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed text-[11px]">
                              {itc.legalReasoning}
                            </p>

                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Statutory Compliance Checklist:
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                                {itc.complianceNotes.map((note, idx) => (
                                  <li key={idx}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Net Effective Cost Calculation */}
                          <div className="md:col-span-4 p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5 self-start">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Financial Net Impact
                            </span>
                            <div className="flex justify-between text-slate-600">
                              <span>Pre-Tax Cost:</span>
                              <span className="font-medium">{formatCurrency(item.lineTotal, currencySymbol)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Tax Incurred:</span>
                              <span className="font-medium text-amber-700">+{formatCurrency(breakdown.totalTax, currencySymbol)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-emerald-700 border-t border-slate-100 pt-1">
                              <span>ITC Claimable:</span>
                              <span>-{formatCurrency(itc.claimableAmount, currencySymbol)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 text-[11px]">
                              <span>Net Effective Spend:</span>
                              <span className="text-brand-600">{formatCurrency(itc.netEffectiveCost, currencySymbol)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer: Live State Tax & ITC Benefit Breakdown */}
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* AI Optimization Callout */}
          <div className="md:col-span-7 flex items-start gap-2.5 p-3 rounded-lg bg-white border border-emerald-200 shadow-2xs">
            <span className="p-1 rounded-full bg-emerald-100 text-emerald-700 mt-0.5 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <div className="text-xs">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span>AI Tax Optimization Recommendation</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                  GSTR-3B Ready
                </span>
              </div>
              <p className="text-slate-600 mt-0.5 leading-snug">
                Your business can claim up to{' '}
                <strong className="text-emerald-700 font-bold">
                  {formatCurrency(summaryCalculations.totalClaimableItc, currencySymbol)}
                </strong>{' '}
                as Input Tax Credit against outward tax liabilities in {destinationState.name}, bringing your true net expenditure down to{' '}
                <strong className="text-slate-900 font-bold">
                  {formatCurrency(summaryCalculations.netEffectiveSpend, currencySymbol)}
                </strong>.
              </p>
            </div>
          </div>

          {/* Quick Summary Totals */}
          <div className="md:col-span-5 space-y-1.5 text-xs text-right bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Value:</span>
              <span className="font-medium text-slate-800">
                {formatCurrency(summaryCalculations.subtotal, currencySymbol)}
              </span>
            </div>

            {supplyType === 'INTRA_STATE' ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST ({destinationState.name}):</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(summaryCalculations.totalCgst, currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST ({destinationState.name}):</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(summaryCalculations.totalSgst, currencySymbol)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-indigo-700 font-medium">
                <span>Integrated GST (IGST):</span>
                <span>{formatCurrency(summaryCalculations.totalIgst, currencySymbol)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-100 pt-1">
              <span>Total GST Invoiced:</span>
              <span>{formatCurrency(summaryCalculations.totalTax, currencySymbol)}</span>
            </div>

            <div className="flex justify-between text-emerald-700 font-bold">
              <span>Recoverable ITC:</span>
              <span>-{formatCurrency(summaryCalculations.totalClaimableItc, currencySymbol)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
              <span>Net Business Spend:</span>
              <span className="text-brand-600">
                {formatCurrency(summaryCalculations.netEffectiveSpend, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
