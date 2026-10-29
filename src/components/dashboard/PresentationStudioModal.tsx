import React, { useState, useEffect, useRef } from 'react';
import {
  PresentationContext,
  PresentationThemeId,
  PRESENTATION_THEMES,
  SlideData,
  buildPresentationSlides,
  exportSlidesToPptx,
} from '../../services/presentationService';
import { Button } from '../common/Button';
import {
  X,
  Download,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Palette,
  CheckCircle2,
  TrendingUp,
  Package,
  ShoppingBag,
  Receipt,
  Truck,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';

interface PresentationStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: PresentationContext;
}

export const PresentationStudioModal: React.FC<PresentationStudioModalProps> = ({
  isOpen,
  onClose,
  context,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [themeId, setThemeId] = useState<PresentationThemeId>('lofty_warm');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const slides: SlideData[] = buildPresentationSlides(context);
  const theme = PRESENTATION_THEMES[themeId];
  const activeSlide = slides[currentSlideIndex] || slides[0];

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentSlideIndex(prev => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, slides.length, onClose]);

  // PPTX Export Handler
  const handleExportPptx = async () => {
    try {
      setIsExporting(true);
      await exportSlidesToPptx(slides, context, themeId);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('PPTX export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  // Render Slide Content based on Slide Type
  const renderSlideContent = () => {
    switch (activeSlide.type) {
      // 1. Executive Title
      case 'title':
        return (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-orange-100 text-orange-800">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Operations Briefing</span>
            </div>

            <div className="space-y-3 max-w-3xl">
              <h1
                className="text-4xl md:text-5xl font-extrabold tracking-tight"
                style={{ color: `#${theme.titleColorHex}` }}
              >
                {activeSlide.title}
              </h1>
              <p
                className="text-lg md:text-xl font-medium"
                style={{ color: `#${theme.subtextColorHex}` }}
              >
                {activeSlide.subtitle}
              </p>
            </div>

            <div
              className="mt-8 pt-6 border-t flex flex-wrap items-center justify-center gap-6 text-xs font-semibold"
              style={{
                borderColor: `#${theme.borderColorHex}`,
                color: `#${theme.subtextColorHex}`,
              }}
            >
              <div>{activeSlide.content.date}</div>
              <span>&bull;</span>
              <div>
                Total Spend:{' '}
                <strong style={{ color: `#${theme.textColorHex}` }}>
                  {activeSlide.content.totalSpendFormatted}
                </strong>
              </div>
              <span>&bull;</span>
              <div>
                Active Orders:{' '}
                <strong style={{ color: `#${theme.textColorHex}` }}>
                  {activeSlide.content.activeOrdersCount}
                </strong>
              </div>
            </div>
          </div>
        );

      // 2. Executive KPIs
      case 'kpis':
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="mb-4">
              <h2
                className="text-2xl font-bold"
                style={{ color: `#${theme.titleColorHex}` }}
              >
                {activeSlide.title}
              </h2>
              <p
                className="text-xs font-medium mt-1"
                style={{ color: `#${theme.subtextColorHex}` }}
              >
                {activeSlide.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-auto">
              {activeSlide.content.kpis.map((kpi: any, idx: number) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl flex flex-col justify-between shadow-xs border transition-all"
                  style={{
                    backgroundColor: `#${theme.cardBgHex}`,
                    borderColor: `#${theme.borderColorHex}`,
                  }}
                >
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-wider mb-2"
                    style={{ color: `#${theme.accentColorHex}` }}
                  >
                    {kpi.badge}
                  </span>
                  <div
                    className="text-2xl lg:text-3xl font-extrabold my-2 truncate"
                    style={{ color: `#${theme.textColorHex}` }}
                  >
                    {kpi.value}
                  </div>
                  <div>
                    <div
                      className="text-xs font-bold"
                      style={{ color: `#${theme.subtextColorHex}` }}
                    >
                      {kpi.label}
                    </div>
                    <div
                      className="text-[11px] mt-0.5"
                      style={{ color: `#${theme.subtextColorHex}` }}
                    >
                      {kpi.subtext}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      // 3. Procurement & Spend
      case 'spend':
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="mb-4">
              <h2
                className="text-2xl font-bold"
                style={{ color: `#${theme.titleColorHex}` }}
              >
                {activeSlide.title}
              </h2>
              <p
                className="text-xs font-medium mt-1"
                style={{ color: `#${theme.subtextColorHex}` }}
              >
                {activeSlide.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch my-auto">
              {/* Left Key Metric Card */}
              <div
                className="md:col-span-5 p-6 rounded-2xl flex flex-col justify-between shadow-xs border"
                style={{
                  backgroundColor: `#${theme.cardBgHex}`,
                  borderColor: `#${theme.borderColorHex}`,
                }}
              >
                <div>
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-wider"
                    style={{ color: `#${theme.accentColorHex}` }}
                  >
                    Total Committed Spend
                  </span>
                  <div
                    className="text-3xl font-extrabold mt-1"
                    style={{ color: `#${theme.textColorHex}` }}
                  >
                    {activeSlide.content.totalSpendFormatted}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t" style={{ borderColor: `#${theme.borderColorHex}` }}>
                  <div
                    className="text-xs font-bold mb-1"
                    style={{ color: `#${theme.textColorHex}` }}
                  >
                    Key Procurement Insight
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: `#${theme.subtextColorHex}` }}
                  >
                    {activeSlide.content.keyInsight}
                  </p>
                </div>
              </div>

              {/* Right Spend Table */}
              <div
                className="md:col-span-7 p-4 rounded-2xl border overflow-hidden shadow-xs"
                style={{
                  backgroundColor: `#${theme.cardBgHex}`,
                  borderColor: `#${theme.borderColorHex}`,
                }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr
                        className="border-b"
                        style={{
                          borderColor: `#${theme.borderColorHex}`,
                          color: `#${theme.titleColorHex}`,
                        }}
                      >
                        <th className="pb-2 font-bold">Supplier Partner</th>
                        <th className="pb-2 font-bold">Committed Amount</th>
                        <th className="pb-2 font-bold">Share</th>
                        <th className="pb-2 font-bold">Orders</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: `#${theme.borderColorHex}` }}>
                      {activeSlide.content.vendorSpendList.map((v: any, idx: number) => (
                        <tr key={idx} className="py-2">
                          <td
                            className="py-2.5 font-semibold"
                            style={{ color: `#${theme.textColorHex}` }}
                          >
                            {v.name}
                          </td>
                          <td
                            className="py-2.5 font-bold"
                            style={{ color: `#${theme.textColorHex}` }}
                          >
                            {v.amountFormatted}
                          </td>
                          <td
                            className="py-2.5 font-bold"
                            style={{ color: `#${theme.accentColorHex}` }}
                          >
                            {v.percentage}%
                          </td>
                          <td
                            className="py-2.5"
                            style={{ color: `#${theme.subtextColorHex}` }}
                          >
                            {v.orderCount} POs
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );

      // 4. Stock Levels & Health
      case 'stock':
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="mb-4">
              <h2
                className="text-2xl font-bold"
                style={{ color: `#${theme.titleColorHex}` }}
              >
                {activeSlide.title}
              </h2>
              <p
                className="text-xs font-medium mt-1"
                style={{ color: `#${theme.subtextColorHex}` }}
              >
                {activeSlide.subtitle}
              </p>
            </div>

            <div
              className="p-5 rounded-2xl border shadow-xs overflow-hidden my-auto"
              style={{
                backgroundColor: `#${theme.cardBgHex}`,
                borderColor: `#${theme.borderColorHex}`,
              }}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      borderColor: `#${theme.borderColorHex}`,
                      color: `#${theme.titleColorHex}`,
                    }}
                  >
                    <th className="pb-2 font-bold">Item Name</th>
                    <th className="pb-2 font-bold">SKU</th>
                    <th className="pb-2 font-bold">On-Hand Stock</th>
                    <th className="pb-2 font-bold">Reorder Threshold</th>
                    <th className="pb-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: `#${theme.borderColorHex}` }}>
                  {activeSlide.content.products.map((p: any, idx: number) => {
                    const isOut = p.status === 'Out of Stock';
                    const isLow = p.status === 'Low Stock';
                    return (
                      <tr key={idx}>
                        <td
                          className="py-2.5 font-semibold"
                          style={{ color: `#${theme.textColorHex}` }}
                        >
                          {p.name}
                        </td>
                        <td className="py-2.5" style={{ color: `#${theme.subtextColorHex}` }}>
                          {p.sku}
                        </td>
                        <td
                          className={`py-2.5 font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : ''}`}
                          style={{
                            color: !isOut && !isLow ? `#${theme.textColorHex}` : undefined,
                          }}
                        >
                          {p.quantity} {p.unit}
                        </td>
                        <td className="py-2.5" style={{ color: `#${theme.subtextColorHex}` }}>
                          {p.threshold} {p.unit}
                        </td>
                        <td className="py-2.5 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] ${
                              isOut
                                ? 'bg-red-100 text-red-800'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      // 5. Active Pipeline
      case 'pipeline':
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="mb-4">
              <h2
                className="text-2xl font-bold"
                style={{ color: `#${theme.titleColorHex}` }}
              >
                {activeSlide.title}
              </h2>
              <p
                className="text-xs font-medium mt-1"
                style={{ color: `#${theme.subtextColorHex}` }}
              >
                {activeSlide.subtitle}
              </p>
            </div>

            <div
              className="p-5 rounded-2xl border shadow-xs overflow-hidden my-auto"
              style={{
                backgroundColor: `#${theme.cardBgHex}`,
                borderColor: `#${theme.borderColorHex}`,
              }}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      borderColor: `#${theme.borderColorHex}`,
                      color: `#${theme.titleColorHex}`,
                    }}
                  >
                    <th className="pb-2 font-bold">Order #</th>
                    <th className="pb-2 font-bold">Supplier Partner</th>
                    <th className="pb-2 font-bold">Committed Amount</th>
                    <th className="pb-2 font-bold">Expected Date</th>
                    <th className="pb-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: `#${theme.borderColorHex}` }}>
                  {activeSlide.content.orders.map((o: any, idx: number) => (
                    <tr key={idx}>
                      <td
                        className="py-2.5 font-bold"
                        style={{ color: `#${theme.textColorHex}` }}
                      >
                        {o.orderNumber}
                      </td>
                      <td
                        className="py-2.5 font-semibold"
                        style={{ color: `#${theme.textColorHex}` }}
                      >
                        {o.vendorName}
                      </td>
                      <td
                        className="py-2.5 font-bold"
                        style={{ color: `#${theme.textColorHex}` }}
                      >
                        {o.totalFormatted}
                      </td>
                      <td className="py-2.5" style={{ color: `#${theme.subtextColorHex}` }}>
                        {o.expectedDeliveryDate}
                      </td>
                      <td
                        className="py-2.5 font-bold"
                        style={{ color: `#${theme.accentColorHex}` }}
                      >
                        {o.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      // 6. Action Items & Recommendations
      case 'recommendations':
      default:
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="mb-4">
              <h2
                className="text-2xl font-bold"
                style={{ color: `#${theme.titleColorHex}` }}
              >
                {activeSlide.title}
              </h2>
              <p
                className="text-xs font-medium mt-1"
                style={{ color: `#${theme.subtextColorHex}` }}
              >
                {activeSlide.subtitle}
              </p>
            </div>

            <div className="space-y-3.5 my-auto">
              {activeSlide.content.recommendations.map((recText: string, idx: number) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border flex items-center space-x-4 shadow-xs"
                  style={{
                    backgroundColor: `#${theme.cardBgHex}`,
                    borderColor: `#${theme.borderColorHex}`,
                  }}
                >
                  <span
                    className="text-lg font-extrabold w-8 text-center shrink-0"
                    style={{ color: `#${theme.accentColorHex}` }}
                  >
                    0{idx + 1}
                  </span>
                  <p
                    className="text-xs md:text-sm font-medium leading-relaxed"
                    style={{ color: `#${theme.textColorHex}` }}
                  >
                    {recText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-sm animate-fade-in ${
        isFullscreen ? 'p-0' : 'p-3 md:p-6'
      }`}
    >
      <div
        className={`bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700/80 w-full h-full max-w-7xl mx-auto ${
          isFullscreen ? 'rounded-none border-none' : ''
        }`}
      >
        {/* 1. Header Toolbar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-sm shadow-xs">
              PPT
            </div>
            <div>
              <div className="text-sm font-bold flex items-center space-x-2">
                <span>Operations Deck Studio</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                  Slide {currentSlideIndex + 1} of {slides.length}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Generated from real workspace charts &amp; inventory
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme Picker */}
            <div className="flex items-center space-x-1.5 p-1 bg-slate-800 rounded-xl border border-slate-700 text-xs">
              <Palette className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              {(['lofty_warm', 'slate_dark', 'corporate_clean'] as PresentationThemeId[]).map(
                tId => (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => setThemeId(tId)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      themeId === tId
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tId === 'lofty_warm' ? 'Warm' : tId === 'slate_dark' ? 'Dark' : 'White'}
                  </button>
                )
              )}
            </div>

            {/* Present Fullscreen */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Present Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Download PPTX */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPptx}
              disabled={isExporting}
              className="bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold flex items-center space-x-1.5"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : exportSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{exportSuccess ? 'Downloaded!' : 'Export PPTX'}</span>
            </Button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Main Studio Area: Left Thumbnails + Right 16:9 Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Thumbnails */}
          {!isFullscreen && (
            <div className="w-64 bg-slate-950/80 border-r border-slate-800 p-3 overflow-y-auto space-y-2.5 shrink-0 hidden sm:block">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                Slide Navigator
              </div>
              {slides.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all text-left flex items-start space-x-2.5 ${
                    currentSlideIndex === idx
                      ? 'bg-orange-500/15 border-orange-500 text-white'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`text-xs font-extrabold w-4 ${
                      currentSlideIndex === idx ? 'text-orange-400' : 'text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{s.title}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
                      {s.type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Center 16:9 Slide Canvas */}
          <div className="flex-1 bg-slate-950 p-4 md:p-8 flex flex-col items-center justify-center overflow-auto">
            {/* 16:9 Slide Stage */}
            <div
              className="w-full max-w-4xl aspect-[16/9] rounded-2xl shadow-2xl border overflow-hidden flex flex-col relative transition-all duration-300"
              style={{
                backgroundColor: `#${theme.bgHex}`,
                borderColor: `#${theme.borderColorHex}`,
                color: `#${theme.textColorHex}`,
              }}
            >
              {renderSlideContent()}
            </div>

            {/* Bottom Slide Controller */}
            <div className="mt-4 flex items-center space-x-4 text-white text-xs">
              <button
                type="button"
                onClick={() => setCurrentSlideIndex(prev => Math.max(prev - 1, 0))}
                disabled={currentSlideIndex === 0}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous Slide (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-semibold text-slate-300">
                Slide {currentSlideIndex + 1} of {slides.length}
              </span>

              <button
                type="button"
                onClick={() => setCurrentSlideIndex(prev => Math.min(prev + 1, slides.length - 1))}
                disabled={currentSlideIndex === slides.length - 1}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next Slide (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
