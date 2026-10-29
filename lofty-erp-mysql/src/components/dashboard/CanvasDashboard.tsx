import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CanvasWidget,
  CanvasWidgetType,
  KpiMetricType,
  PurchaseOrder,
  Product,
  StockBalance,
  Vendor,
  Delivery,
  SupplierBill,
  Warehouse,
  VendorProduct,
} from '../../types';
import { localStore } from '../../services/store';
import { getMySQLCanvasWidgets, saveMySQLCanvasWidgets } from '../../services/mysqlService';
import { CanvasWidgetCard, snap } from './CanvasWidgetCard';
import { Button } from '../common/Button';
import {
  Plus,
  LayoutGrid,
  RotateCcw,
  Save,
  Trash2,
  Sparkles,
  BarChart3,
  PieChart,
  Package,
  Layers,
  Receipt,
  Truck,
  TrendingUp,
  FileSpreadsheet,
  Check,
  Presentation,
} from 'lucide-react';

interface CanvasDashboardProps {
  businessId: string;
  currencySymbol: string;
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  stockBalances: StockBalance[];
  vendors: Vendor[];
  deliveries: Delivery[];
  bills: SupplierBill[];
  warehouses: Warehouse[];
  vendorProducts?: VendorProduct[];
  onOpenAiCopilot?: () => void;
  // External ref or action handler for AI commands
  registerAiActionHandler?: (handler: (action: any) => void) => void;
}

export const CanvasDashboard: React.FC<CanvasDashboardProps> = ({
  businessId,
  currencySymbol,
  purchaseOrders,
  products,
  stockBalances,
  vendors,
  deliveries,
  bills,
  warehouses,
  vendorProducts = [],
  onOpenAiCopilot,
  registerAiActionHandler,
}) => {
  // Generate default widgets layout
  const getDefaultWidgets = useCallback((): CanvasWidget[] => {
    return [
      {
        id: 'widget-spend-supplier',
        type: 'spend_by_supplier',
        title: 'Spend by Supplier',
        x: 24,
        y: 24,
        w: 520,
        h: 320,
      },
      {
        id: 'widget-stock-reorder',
        type: 'stock_vs_reorder',
        title: 'Stock vs Reorder Health',
        x: 568,
        y: 24,
        w: 520,
        h: 320,
      },
      {
        id: 'widget-kpi-spend',
        type: 'kpi_metric',
        title: 'Total Committed Spend',
        x: 24,
        y: 368,
        w: 250,
        h: 160,
        config: { metricKey: 'total_spend' },
      },
      {
        id: 'widget-kpi-stock',
        type: 'kpi_metric',
        title: 'Low Stock Alerts',
        x: 294,
        y: 368,
        w: 250,
        h: 160,
        config: { metricKey: 'low_stock' },
      },
      {
        id: 'widget-live-orders',
        type: 'live_orders',
        title: 'Active Orders Pipeline',
        x: 568,
        y: 368,
        w: 520,
        h: 300,
      },
      {
        id: 'widget-ai-summary',
        type: 'ai_summary',
        title: 'AI Operations Digest',
        x: 24,
        y: 552,
        w: 520,
        h: 220,
      },
    ];
  }, []);

  // Widgets state initialized from local store or defaults
  const [widgets, setWidgets] = useState<CanvasWidget[]>(() => {
    const saved = localStore.getCanvasWidgets(businessId);
    return saved && saved.length > 0 ? saved : getDefaultWidgets();
  });

  const [hasSavedNotice, setHasSavedNotice] = useState(false);
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);

  // Dragging & Resizing Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    widgetId: string | null;
    offsetX: number;
    offsetY: number;
  }>({ isDragging: false, widgetId: null, offsetX: 0, offsetY: 0 });

  const resizeStateRef = useRef<{
    isResizing: boolean;
    widgetId: string | null;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  }>({ isResizing: false, widgetId: null, startX: 0, startY: 0, startW: 0, startH: 0 });

  // Update canvas bounds to ensure minimum height
  const canvasMinHeight = Math.max(
    800,
    ...widgets.map(w => w.y + w.h + 80)
  );

  // Load saved layout from MySQL on mount
  useEffect(() => {
    getMySQLCanvasWidgets(businessId).then(remote => {
      if (remote && remote.length > 0) {
        setWidgets(remote);
      }
    });
  }, [businessId]);

  // Save changes to MySQL & localStore
  const saveLayout = useCallback((itemsToSave?: CanvasWidget[]) => {
    const data = itemsToSave || widgets;
    localStore.saveCanvasWidgets(businessId, data);
    saveMySQLCanvasWidgets(businessId, data);
    setHasSavedNotice(true);
    setTimeout(() => setHasSavedNotice(false), 2200);
  }, [businessId, widgets]);

  // Add Widget
  const addWidget = useCallback(
    (type: CanvasWidgetType, metricKey?: KpiMetricType, customTitle?: string, dropX?: number, dropY?: number) => {
      let title = customTitle;
      let w = 480;
      let h = 280;

      if (!title) {
        if (type === 'spend_by_supplier') title = 'Spend by Supplier';
        else if (type === 'stock_vs_reorder') title = 'Stock vs Reorder Health';
        else if (type === 'spend_timeline') title = 'Orders Spend Timeline';
        else if (type === 'godown_split') title = 'Warehouse Distribution';
        else if (type === 'live_orders') title = 'Active Purchase Orders';
        else if (type === 'ai_summary') title = 'AI Operations Digest';
        else if (type === 'kpi_metric') {
          title = metricKey === 'low_stock' ? 'Low Stock Items' : 'Total Committed Spend';
          w = 260;
          h = 160;
        } else {
          title = 'Custom Chart';
        }
      }

      // Determine placement
      let x = dropX !== undefined ? snap(dropX) : snap(24 + ((widgets.length * 32) % 360));
      let y = dropY !== undefined ? snap(dropY) : snap(24 + ((widgets.length * 48) % 400));

      const newWidget: CanvasWidget = {
        id: `widget-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type,
        title,
        x,
        y,
        w,
        h,
        config: metricKey ? { metricKey } : undefined,
      };

      setWidgets(prev => {
        const next = [...prev, newWidget];
        localStore.saveCanvasWidgets(businessId, next);
        return next;
      });
      setShowPaletteMenu(false);
    },
    [businessId, widgets.length]
  );

  // Auto-arrange layout into N columns
  const arrangeColumns = useCallback(
    (cols: number = 2) => {
      if (!canvasRef.current || widgets.length === 0) return;
      const totalWidth = Math.max(900, canvasRef.current.clientWidth - 48);
      const colWidth = snap(Math.floor(totalWidth / cols) - 16);

      const next = widgets.map((w, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const height = w.type === 'kpi_metric' ? 160 : 300;
        return {
          ...w,
          x: snap(24 + col * (colWidth + 16)),
          y: snap(24 + row * 320),
          w: colWidth,
          h: height,
        };
      });

      setWidgets(next);
      saveLayout(next);
    },
    [widgets, saveLayout]
  );

  // Reset to default layout
  const resetDefaults = useCallback(() => {
    const defaults = getDefaultWidgets();
    setWidgets(defaults);
    saveLayout(defaults);
  }, [getDefaultWidgets, saveLayout]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    setWidgets([]);
    localStore.saveCanvasWidgets(businessId, []);
  }, [businessId]);

  // Register AI action handler
  useEffect(() => {
    if (!registerAiActionHandler) return;
    registerAiActionHandler((action: any) => {
      if (!action) return;
      if (action.type === 'ADD_WIDGET' && action.widgetType) {
        addWidget(action.widgetType, action.metricKey, action.title);
      } else if (action.type === 'ARRANGE_COLUMNS') {
        arrangeColumns(action.columns || 2);
      } else if (action.type === 'RESET_LAYOUT') {
        resetDefaults();
      } else if (action.type === 'CLEAR_CANVAS') {
        clearCanvas();
      }
    });
  }, [registerAiActionHandler, addWidget, arrangeColumns, resetDefaults, clearCanvas]);

  // Drag Start
  const handleDragStart = (e: React.MouseEvent, widget: CanvasWidget) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault();

    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const offsetX = e.clientX - canvasRect.left + canvasRef.current.scrollLeft - widget.x;
    const offsetY = e.clientY - canvasRect.top + canvasRef.current.scrollTop - widget.y;

    dragStateRef.current = {
      isDragging: true,
      widgetId: widget.id,
      offsetX,
      offsetY,
    };

    // Bring dragged widget to front
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === widget.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.push(item);
      return copy;
    });
  };

  // Resize Start
  const handleResizeStart = (e: React.MouseEvent, widget: CanvasWidget) => {
    e.preventDefault();
    e.stopPropagation();

    resizeStateRef.current = {
      isResizing: true,
      widgetId: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: widget.w,
      startH: widget.h,
    };
  };

  // Global Mouse Move & Up Listeners for smooth tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 1. Dragging
      if (dragStateRef.current.isDragging && dragStateRef.current.widgetId && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const rawX = e.clientX - canvasRect.left + canvasRef.current.scrollLeft - dragStateRef.current.offsetX;
        const rawY = e.clientY - canvasRect.top + canvasRef.current.scrollTop - dragStateRef.current.offsetY;

        const newX = snap(Math.max(16, rawX));
        const newY = snap(Math.max(16, rawY));

        setWidgets(prev =>
          prev.map(w => (w.id === dragStateRef.current.widgetId ? { ...w, x: newX, y: newY } : w))
        );
      }

      // 2. Resizing
      if (resizeStateRef.current.isResizing && resizeStateRef.current.widgetId) {
        const dx = e.clientX - resizeStateRef.current.startX;
        const dy = e.clientY - resizeStateRef.current.startY;

        const newW = snap(Math.max(220, resizeStateRef.current.startW + dx));
        const newH = snap(Math.max(140, resizeStateRef.current.startH + dy));

        setWidgets(prev =>
          prev.map(w => (w.id === resizeStateRef.current.widgetId ? { ...w, w: newW, h: newH } : w))
        );
      }
    };

    const handleMouseUp = () => {
      if (dragStateRef.current.isDragging || resizeStateRef.current.isResizing) {
        dragStateRef.current.isDragging = false;
        dragStateRef.current.widgetId = null;
        resizeStateRef.current.isResizing = false;
        resizeStateRef.current.widgetId = null;

        // Persist final position
        setWidgets(current => {
          localStore.saveCanvasWidgets(businessId, current);
          return current;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [businessId]);

  // Drag and Drop from toolbar to canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('lofty/widget-type') as CanvasWidgetType;
    const metricKey = e.dataTransfer.getData('lofty/metric-key') as KpiMetricType | undefined;
    if (!type || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const dropX = e.clientX - rect.left + canvasRef.current.scrollLeft - 80;
    const dropY = e.clientY - rect.top + canvasRef.current.scrollTop - 40;

    addWidget(type, metricKey, undefined, Math.max(16, dropX), Math.max(16, dropY));
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[750px]">
      {/* 1. Canvas Toolbar */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3 z-30">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Palette Dropdown */}
          <div className="relative">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowPaletteMenu(!showPaletteMenu)}
              className="flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Widget</span>
            </Button>

            {showPaletteMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-xs">
                <div className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider text-slate-400">
                  Analytics &amp; Charts
                </div>
                <button
                  type="button"
                  onClick={() => addWidget('spend_by_supplier')}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 flex items-center space-x-2"
                >
                  <BarChart3 className="w-4 h-4 text-orange-600" />
                  <span>Spend by Supplier Bar</span>
                </button>
                <button
                  type="button"
                  onClick={() => addWidget('stock_vs_reorder')}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 flex items-center space-x-2"
                >
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>Stock vs Reorder Health</span>
                </button>
                <button
                  type="button"
                  onClick={() => addWidget('spend_timeline')}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 flex items-center space-x-2"
                >
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Order Value Timeline</span>
                </button>
                <button
                  type="button"
                  onClick={() => addWidget('godown_split')}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 flex items-center space-x-2"
                >
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Warehouse Inventory Split</span>
                </button>

                <div className="border-t border-slate-100 my-1" />
                <div className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider text-slate-400">
                  KPI Cards &amp; Pipeline
                </div>
                <button
                  type="button"
                  onClick={() => addWidget('kpi_metric', 'total_spend', 'Total Committed Spend')}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 flex items-center space-x-2"
                >
                  <Receipt className="w-4 h-4 text-orange-600" />
                  <span>KPI: Total Spend</span>
                </button>
                <button
                  type="button"
                  onClick={() => addWidget('kpi_metric', 'low_stock', 'Low Stock Items')}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 flex items-center space-x-2"
                >
                  <Package className="w-4 h-4 text-amber-600" />
                  <span>KPI: Low Stock Alert</span>
                </button>
                <button
                  type="button"
                  onClick={() => addWidget('live_orders')}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 flex items-center space-x-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-700" />
                  <span>Live Orders Pipeline Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => addWidget('ai_summary')}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  <span>AI Operations Summary</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick draggable chips */}
          <div className="hidden sm:flex items-center space-x-1.5 border-l border-slate-200 pl-3">
            <div
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('lofty/widget-type', 'spend_by_supplier');
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-900 border border-slate-200/80 rounded-md text-[11px] font-medium cursor-grab active:cursor-grabbing flex items-center space-x-1 transition-colors"
              title="Drag onto canvas or click to add"
              onClick={() => addWidget('spend_by_supplier')}
            >
              <BarChart3 className="w-3.5 h-3.5 text-orange-600" />
              <span>+ Spend Bar</span>
            </div>

            <div
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('lofty/widget-type', 'stock_vs_reorder');
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-900 border border-slate-200/80 rounded-md text-[11px] font-medium cursor-grab active:cursor-grabbing flex items-center space-x-1 transition-colors"
              title="Drag onto canvas or click to add"
              onClick={() => addWidget('stock_vs_reorder')}
            >
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ Stock Health</span>
            </div>

            <div
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('lofty/widget-type', 'kpi_metric');
                e.dataTransfer.setData('lofty/metric-key', 'total_spend');
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-900 border border-slate-200/80 rounded-md text-[11px] font-medium cursor-grab active:cursor-grabbing flex items-center space-x-1 transition-colors"
              title="Drag onto canvas or click to add"
              onClick={() => addWidget('kpi_metric', 'total_spend')}
            >
              <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
              <span>+ KPI Stat</span>
            </div>

            <div
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('lofty/widget-type', 'live_orders');
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-900 border border-slate-200/80 rounded-md text-[11px] font-medium cursor-grab active:cursor-grabbing flex items-center space-x-1 transition-colors"
              title="Drag onto canvas or click to add"
              onClick={() => addWidget('live_orders')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>+ Orders Table</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Auto Arrange, AI Copilot, Save, Reset */}
        <div className="flex items-center space-x-2">
          {hasSavedNotice && (
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-fade-in">
              <Check className="w-3 h-3" />
              <span>Layout Saved</span>
            </span>
          )}

          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => arrangeColumns(2)}
              className="px-2 py-1 rounded hover:bg-white text-slate-700 hover:shadow-xs transition-all font-medium"
              title="Auto-arrange in 2 columns"
            >
              2-Col
            </button>
            <button
              type="button"
              onClick={() => arrangeColumns(3)}
              className="px-2 py-1 rounded hover:bg-white text-slate-700 hover:shadow-xs transition-all font-medium"
              title="Auto-arrange in 3 columns"
            >
              3-Col
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={resetDefaults}
            title="Reset to recommended default layout"
            className="flex items-center space-x-1 text-slate-600"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => saveLayout()}
            className="flex items-center space-x-1"
          >
            <Save className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Save</span>
          </Button>

        </div>
      </div>

      {/* 2. Interactive Infinite Dot-Grid Canvas Area */}
      <div
        ref={canvasRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="flex-1 relative overflow-auto bg-slate-50/80 [background-image:radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:20px_20px] p-4 min-w-[700px]"
        style={{ minHeight: `${canvasMinHeight}px` }}
      >
        {widgets.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 mb-3 shadow-xs">
              <LayoutGrid className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Your Canvas is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              Drag and drop charts from the top toolbar, or click below to restore the recommended operations overview layout.
            </p>
            <div className="flex items-center space-x-3">
              <Button variant="primary" size="sm" onClick={resetDefaults}>
                Restore Default Layout
              </Button>
            </div>
          </div>
        ) : (
          widgets.map(w => (
            <CanvasWidgetCard
              key={w.id}
              widget={w}
              purchaseOrders={purchaseOrders}
              products={products}
              stockBalances={stockBalances}
              vendors={vendors}
              deliveries={deliveries}
              bills={bills}
              warehouses={warehouses}
              vendorProducts={vendorProducts}
              currencySymbol={currencySymbol}
              onUpdateWidget={updated => {
                setWidgets(prev => {
                  const next = prev.map(item => (item.id === updated.id ? updated : item));
                  localStore.saveCanvasWidgets(businessId, next);
                  return next;
                });
              }}
              onRemoveWidget={id => {
                setWidgets(prev => {
                  const next = prev.filter(item => item.id !== id);
                  localStore.saveCanvasWidgets(businessId, next);
                  return next;
                });
              }}
              onDuplicateWidget={original => {
                const dup: CanvasWidget = {
                  ...original,
                  id: `widget-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  title: `${original.title} (Copy)`,
                  x: snap(original.x + 32),
                  y: snap(original.y + 32),
                };
                setWidgets(prev => {
                  const next = [...prev, dup];
                  localStore.saveCanvasWidgets(businessId, next);
                  return next;
                });
              }}
              onDragStart={handleDragStart}
              onResizeStart={handleResizeStart}
              isDragging={dragStateRef.current.widgetId === w.id}
            />
          ))
        )}
      </div>
    </div>
  );
};
