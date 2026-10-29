import React, { useState, useMemo } from 'react';
import { PurchaseOrder, Delivery, StockMovement } from '../../types';
import { formatCurrency, formatDate, toIsoDate } from '../../lib/utils';
import { DateRangeState } from './DashboardHeader';
import { TrendingUp, ShoppingBag, Truck, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export type ChartMetricKey = 'poValue' | 'receivedValue' | 'inflow' | 'outflow';

interface TimeSeriesChartProps {
  purchaseOrders: PurchaseOrder[];
  deliveries: Delivery[];
  stockMovements: StockMovement[];
  dateRange: DateRangeState;
  currencySymbol?: string;
}

interface DataPoint {
  dateStr: string; // YYYY-MM-DD
  label: string;
  value: number;
  count: number;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  purchaseOrders,
  deliveries,
  stockMovements,
  dateRange,
  currencySymbol = '₹',
}) => {
  const [activeMetric, setActiveMetric] = useState<ChartMetricKey>('poValue');
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const metricConfigs = {
    poValue: {
      label: 'Purchase Order Value',
      shortLabel: 'PO Value',
      isCurrency: true,
      color: '#EA580C', // brand-600
      strokeColor: '#EA580C',
      fillGradientId: 'poGradient',
      icon: <ShoppingBag className="w-3.5 h-3.5" />,
      description: 'Monetary value of purchase orders committed',
    },
    receivedValue: {
      label: 'Goods Received Value',
      shortLabel: 'Received Value',
      isCurrency: true,
      color: '#059669', // emerald-600
      strokeColor: '#059669',
      fillGradientId: 'recGradient',
      icon: <Truck className="w-3.5 h-3.5" />,
      description: 'Monetary value of physically verified accepted items',
    },
    inflow: {
      label: 'Inventory Inflow',
      shortLabel: 'Stock Inflow',
      isCurrency: false,
      color: '#0284C7', // sky-600
      strokeColor: '#0284C7',
      fillGradientId: 'inflowGradient',
      icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
      description: 'Physical units accepted into godowns (deliveries & adds)',
    },
    outflow: {
      label: 'Inventory Outflow',
      shortLabel: 'Stock Outflow',
      isCurrency: false,
      color: '#D97706', // amber-600
      strokeColor: '#D97706',
      fillGradientId: 'outflowGradient',
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      description: 'Physical units reduced via manual adjustments / transfers',
    },
  };

  const currentConfig = metricConfigs[activeMetric];

  // Aggregate time series based on date range and selected metric
  const chartData = useMemo<DataPoint[]>(() => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    // If date range is invalid or start > end, fallback to 30 days
    let validStart = isNaN(start.getTime()) ? new Date(Date.now() - 30 * 86400000) : start;
    let validEnd = isNaN(end.getTime()) ? new Date() : end;
    if (validStart > validEnd) {
      validStart = new Date(validEnd.getTime() - 30 * 86400000);
    }

    // Determine interval days count
    const diffMs = validEnd.getTime() - validStart.getTime();
    const diffDays = Math.max(1, Math.round(diffMs / 86400000));

    // Map of YYYY-MM-DD -> { value, count }
    const pointsMap = new Map<string, { value: number; count: number }>();

    // If metric is Purchase Order Value
    if (activeMetric === 'poValue') {
      purchaseOrders.forEach(po => {
        const poDate = toIsoDate(po.createdAt);
        if (poDate) {
          const itemDate = new Date(poDate);
          if (itemDate >= validStart && itemDate <= validEnd && po.status !== 'Cancelled') {
            const cur = pointsMap.get(poDate) || { value: 0, count: 0 };
            pointsMap.set(poDate, {
              value: cur.value + po.grandTotal,
              count: cur.count + 1,
            });
          }
        }
      });
    } else if (activeMetric === 'receivedValue') {
      // Calculate monetary value of accepted delivery items
      deliveries.forEach(del => {
        const delDate = toIsoDate(del.productVerifiedAt) || toIsoDate(del.submittedAt);

        if (delDate) {
          const itemDate = new Date(delDate);
          if (itemDate >= validStart && itemDate <= validEnd) {
            // Find PO to retrieve unit prices
            const po = purchaseOrders.find(p => p.id === del.purchaseOrderId);
            let deliveryAcceptedTotal = 0;

            del.items.forEach(it => {
              const accepted = it.acceptedQuantity || 0;
              let unitPrice = 0;
              if (po) {
                const poItem = po.items.find(pi => pi.productId === it.productId);
                if (poItem) unitPrice = poItem.unitPrice;
              }
              deliveryAcceptedTotal += accepted * unitPrice;
            });

            if (deliveryAcceptedTotal > 0 || del.items.some(i => i.acceptedQuantity > 0)) {
              const cur = pointsMap.get(delDate) || { value: 0, count: 0 };
              pointsMap.set(delDate, {
                value: cur.value + deliveryAcceptedTotal,
                count: cur.count + 1,
              });
            }
          }
        }
      });
    } else if (activeMetric === 'inflow') {
      stockMovements.forEach(sm => {
        const smDate = toIsoDate(sm.timestamp);
        if (smDate && (sm.type === 'PURCHASE_RECEIPT' || sm.type === 'ADJUSTMENT_ADD')) {
          const itemDate = new Date(smDate);
          if (itemDate >= validStart && itemDate <= validEnd) {
            const cur = pointsMap.get(smDate) || { value: 0, count: 0 };
            pointsMap.set(smDate, {
              value: cur.value + Math.max(0, sm.quantity),
              count: cur.count + 1,
            });
          }
        }
      });
    } else if (activeMetric === 'outflow') {
      stockMovements.forEach(sm => {
        const smDate = toIsoDate(sm.timestamp);
        if (smDate && sm.type === 'ADJUSTMENT_SUBTRACT') {
          const itemDate = new Date(smDate);
          if (itemDate >= validStart && itemDate <= validEnd) {
            const cur = pointsMap.get(smDate) || { value: 0, count: 0 };
            pointsMap.set(smDate, {
              value: cur.value + Math.abs(sm.quantity),
              count: cur.count + 1,
            });
          }
        }
      });
    }

    // Build continuous date intervals if diffDays <= 45
    // If range is large (e.g. All Time), use actual populated points plus boundary padding
    const points: DataPoint[] = [];

    if (diffDays <= 45) {
      // Step day-by-day
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(validStart);
        d.setDate(d.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        const stat = pointsMap.get(dStr) || { value: 0, count: 0 };
        points.push({
          dateStr: dStr,
          label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          value: stat.value,
          count: stat.count,
        });
      }
    } else {
      // Sorted date keys from pointsMap
      const sortedKeys = Array.from(pointsMap.keys()).sort();
      if (sortedKeys.length === 0) {
        // Return 2 empty boundary points
        return [
          {
            dateStr: validStart.toISOString().split('T')[0],
            label: validStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            value: 0,
            count: 0,
          },
          {
            dateStr: validEnd.toISOString().split('T')[0],
            label: validEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            value: 0,
            count: 0,
          },
        ];
      }

      sortedKeys.forEach(k => {
        const d = new Date(k);
        const stat = pointsMap.get(k)!;
        points.push({
          dateStr: k,
          label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          value: stat.value,
          count: stat.count,
        });
      });
    }

    return points;
  }, [purchaseOrders, deliveries, stockMovements, dateRange, activeMetric]);

  // Overall metric stats
  const totalValue = chartData.reduce((sum, p) => sum + p.value, 0);
  const totalTransactions = chartData.reduce((sum, p) => sum + p.count, 0);
  const maxValue = Math.max(...chartData.map(p => p.value), 0);
  const hasData = totalValue > 0 || totalTransactions > 0;

  // Chart Dimensions & SVG Geometry
  const svgWidth = 800;
  const svgHeight = 240;
  const paddingLeft = 55;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Y-axis scale with nice round ceiling
  const yCeil = maxValue > 0 ? maxValue * 1.15 : 100;

  const getCoordinates = (index: number, val: number) => {
    const x = paddingLeft + (index / Math.max(1, chartData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (val / yCeil) * chartHeight;
    return { x, y };
  };

  // Build SVG path
  const pathD = useMemo(() => {
    if (chartData.length < 2) return '';
    const coords = chartData.map((p, i) => getCoordinates(i, p.value));

    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      // Catmull-Rom or cubic Bezier spline
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }, [chartData, yCeil]);

  const areaD = useMemo(() => {
    if (!pathD || chartData.length < 2) return '';
    const lastCoord = getCoordinates(chartData.length - 1, chartData[chartData.length - 1].value);
    const firstCoord = getCoordinates(0, chartData[0].value);
    const bottomY = paddingTop + chartHeight;
    return `${pathD} L ${lastCoord.x.toFixed(1)} ${bottomY} L ${firstCoord.x.toFixed(1)} ${bottomY} Z`;
  }, [pathD, chartData, yCeil]);

  // Y-axis grid ticks (4 intervals)
  const yTicks = [0, yCeil * 0.33, yCeil * 0.66, yCeil];

  // X-axis label indices (pick 5 to 7 labels)
  const xLabelIndices = useMemo(() => {
    if (chartData.length <= 6) {
      return chartData.map((_, i) => i);
    }
    const step = Math.floor(chartData.length / 5);
    const indices: number[] = [];
    for (let i = 0; i < chartData.length; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== chartData.length - 1) {
      indices.push(chartData.length - 1);
    }
    return indices;
  }, [chartData]);

  const formatYValue = (val: number) => {
    if (currentConfig.isCurrency) {
      if (val >= 100000) return `${currencySymbol}${(val / 100000).toFixed(1)}L`;
      if (val >= 1000) return `${currencySymbol}${(val / 1000).toFixed(0)}k`;
      return `${currencySymbol}${val.toFixed(0)}`;
    }
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toFixed(0);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-5 space-y-4">
      {/* Chart Title and Metric Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Inventory & Purchasing Activity
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
              {currentConfig.shortLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentConfig.description}
          </p>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center flex-wrap gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
          {(Object.keys(metricConfigs) as ChartMetricKey[]).map(key => {
            const cfg = metricConfigs[key];
            const isSelected = activeMetric === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveMetric(key);
                  setHoveredPoint(null);
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <span className={isSelected ? 'text-brand-600' : 'text-slate-400'}>
                  {cfg.icon}
                </span>
                <span>{cfg.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Badges above Chart */}
      <div className="flex items-center justify-between text-xs py-2 px-3 bg-slate-50/70 rounded-md border border-slate-100">
        <div className="flex items-center space-x-4">
          <div>
            <span className="text-slate-500 text-[11px]">Period Total: </span>
            <span className="font-bold text-slate-900">
              {currentConfig.isCurrency
                ? formatCurrency(totalValue, currencySymbol)
                : `${totalValue} units`}
            </span>
          </div>
          <div className="hidden sm:inline-block text-slate-300">&bull;</div>
          <div className="hidden sm:block">
            <span className="text-slate-500 text-[11px]">Recorded Events: </span>
            <span className="font-bold text-slate-900">{totalTransactions} transactions</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          Date range: <strong className="text-slate-700">{formatDate(dateRange.startDate)}</strong> &ndash;{' '}
          <strong className="text-slate-700">{formatDate(dateRange.endDate)}</strong>
        </div>
      </div>

      {/* SVG Interactive Time Series Chart Area */}
      <div className="relative w-full overflow-hidden select-none">
        {chartData.length >= 2 && hasData ? (
          <div className="relative">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto max-h-[280px]"
              onMouseLeave={() => {
                setHoveredPoint(null);
                setMousePos(null);
              }}
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseSvgX = ((e.clientX - rect.left) / rect.width) * svgWidth;
                const mouseSvgY = ((e.clientY - rect.top) / rect.height) * svgHeight;

                // Find closest point along X
                let closestIdx = 0;
                let minDist = Infinity;
                chartData.forEach((_, i) => {
                  const coord = getCoordinates(i, 0);
                  const dist = Math.abs(coord.x - mouseSvgX);
                  if (dist < minDist) {
                    minDist = dist;
                    closestIdx = i;
                  }
                });

                setHoveredPoint(chartData[closestIdx]);
                const coord = getCoordinates(closestIdx, chartData[closestIdx].value);
                setMousePos({ x: coord.x, y: coord.y });
              }}
            >
              <defs>
                {/* Metric Gradient Area Fills */}
                <linearGradient id="poGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EA580C" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="recGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284C7" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Y-Gridlines & Labels */}
              {yTicks.map((tick, i) => {
                const y = paddingTop + chartHeight - (tick / yCeil) * chartHeight;
                return (
                  <g key={i}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={svgWidth - paddingRight}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={i === 0 ? undefined : '3 3'}
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono"
                    >
                      {formatYValue(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Area under Curve */}
              {areaD && (
                <path
                  d={areaD}
                  fill={`url(#${currentConfig.fillGradientId})`}
                  className="transition-all duration-300"
                />
              )}

              {/* Primary Curve Line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={currentConfig.strokeColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
              )}

              {/* Hover Crosshair Guidelines & Points */}
              {mousePos && hoveredPoint && (
                <g>
                  {/* Vertical dashed guideline */}
                  <line
                    x1={mousePos.x}
                    y1={paddingTop}
                    x2={mousePos.x}
                    y2={paddingTop + chartHeight}
                    stroke="#94A3B8"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  {/* Outer Pulsing Glow */}
                  <circle
                    cx={mousePos.x}
                    cy={mousePos.y}
                    r="6"
                    fill={currentConfig.color}
                    fillOpacity="0.3"
                  />
                  {/* Inner Active Point */}
                  <circle
                    cx={mousePos.x}
                    cy={mousePos.y}
                    r="3.5"
                    fill="#FFFFFF"
                    stroke={currentConfig.color}
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* X-Axis Date Labels */}
              {xLabelIndices.map(idx => {
                const pt = chartData[idx];
                if (!pt) return null;
                const coord = getCoordinates(idx, 0);
                return (
                  <text
                    key={idx}
                    x={coord.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-sans"
                  >
                    {pt.label}
                  </text>
                );
              })}
            </svg>

            {/* Floating Tooltip Card */}
            {hoveredPoint && mousePos && (
              <div
                className="absolute pointer-events-none z-10 p-2.5 bg-slate-900 text-white rounded-md shadow-lg text-xs space-y-1 transform -translate-x-1/2 -translate-y-full mb-3"
                style={{
                  left: `${(mousePos.x / svgWidth) * 100}%`,
                  top: `${(mousePos.y / svgHeight) * 100}%`,
                }}
              >
                <div className="text-[10px] text-slate-300 border-b border-slate-700/80 pb-1">
                  {formatDate(hoveredPoint.dateStr)}
                </div>
                <div className="flex items-center space-x-1.5 pt-0.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: currentConfig.color }}
                  />
                  <span className="font-semibold text-white">
                    {currentConfig.isCurrency
                      ? formatCurrency(hoveredPoint.value, currencySymbol)
                      : `${hoveredPoint.value} units`}
                  </span>
                </div>
                {hoveredPoint.count > 0 && (
                  <div className="text-[10px] text-slate-400">
                    {hoveredPoint.count} recorded {hoveredPoint.count === 1 ? 'event' : 'events'}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Informative Empty State */
          <div className="py-14 px-4 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-xs font-semibold text-slate-700">
              No {currentConfig.label} Activity Recorded
            </h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
              There are no {currentConfig.label.toLowerCase()} transactions within the selected range (
              {formatDate(dateRange.startDate)} &ndash; {formatDate(dateRange.endDate)}).
            </p>
            <div className="mt-3">
              <span className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                Tip: Click &quot;All Time&quot; in the header above to inspect historical transactions.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
