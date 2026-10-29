import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-72 bg-slate-100 rounded" />
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-9 w-28 bg-slate-200 rounded-md" />
          <div className="h-9 w-32 bg-slate-200 rounded-md" />
        </div>
      </div>

      {/* Row 1: 5 KPI Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="w-7 h-7 bg-slate-100 rounded-md" />
            </div>
            <div className="h-6 w-24 bg-slate-200 rounded" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Row 2: Main Chart + Inventory Health Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 bg-white rounded-lg border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-44 bg-slate-200 rounded" />
            <div className="h-8 w-60 bg-slate-100 rounded-md" />
          </div>
          <div className="h-64 bg-slate-50 rounded-lg" />
        </div>
        <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-xs space-y-4">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-100 rounded-md" />
          <div className="space-y-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 bg-slate-50 rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Recent POs + Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-xs space-y-4">
          <div className="h-5 w-36 bg-slate-200 rounded" />
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-50 rounded" />
            ))}
          </div>
        </div>
        <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-xs space-y-4">
          <div className="h-5 w-36 bg-slate-200 rounded" />
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-50 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
