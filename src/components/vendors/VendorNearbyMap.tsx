import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vendor, Warehouse } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  MapPin,
  Navigation,
  Phone,
  Mail,
  Building,
  ExternalLink,
  Search,
  Filter,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  Building2,
  Maximize2,
} from 'lucide-react';

interface VendorNearbyMapProps {
  vendors: Vendor[];
  warehouses?: Warehouse[];
}

interface GeoPoint {
  lat: number;
  lng: number;
}

// Haversine formula to compute distance in km
function calculateDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371; // Earth radius in km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Known industrial zones and coordinates around Bangalore/Karnataka & major hubs
const INDUSTRIAL_ZONES: Record<string, GeoPoint> = {
  peenya: { lat: 13.0285, lng: 77.5197 },
  bommasandra: { lat: 12.8166, lng: 77.6922 },
  whitefield: { lat: 12.9698, lng: 77.7499 },
  rajajinagar: { lat: 12.9982, lng: 77.553 },
  yeshwanthpur: { lat: 13.0238, lng: 77.551 },
  electronic: { lat: 12.8399, lng: 77.677 },
  jigani: { lat: 12.7844, lng: 77.6401 },
  hebbal: { lat: 13.0358, lng: 77.597 },
  hosur: { lat: 12.7409, lng: 77.8253 },
  koramangala: { lat: 12.9352, lng: 77.6245 },
  indiranagar: { lat: 12.9784, lng: 77.6408 },
  bhiwandi: { lat: 19.3002, lng: 73.0634 },
  ambattur: { lat: 13.0983, lng: 80.1614 },
  okhla: { lat: 28.5355, lng: 77.2732 },
};

// Deterministically derive coordinates from vendor address or name
function getVendorCoordinates(vendor: Vendor, index: number, center: GeoPoint): GeoPoint {
  const addr = `${vendor.address} ${vendor.name}`.toLowerCase();

  for (const [key, coords] of Object.entries(INDUSTRIAL_ZONES)) {
    if (addr.includes(key)) {
      // Add slight jitter so multiple vendors in same zone do not perfectly overlap
      return {
        lat: coords.lat + (index % 5 - 2) * 0.005,
        lng: coords.lng + (index % 4 - 1.5) * 0.005,
      };
    }
  }

  // Fallback: place vendors deterministically in surrounding ring (4km to 32km from center)
  const angle = (index * 67.5 * Math.PI) / 180;
  const radiusKm = 5 + (index % 6) * 4.5;
  const latOffset = (radiusKm / 111) * Math.cos(angle);
  const lngOffset = (radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);

  return {
    lat: center.lat + latOffset,
    lng: center.lng + lngOffset,
  };
}

export const VendorNearbyMap: React.FC<VendorNearbyMapProps> = ({
  vendors,
  warehouses = [],
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Central company hub (Warehouse or Bangalore city center)
  const hubWarehouse = warehouses[0] || {
    name: 'Central Receiving Godown',
    location: 'Bangalore Central, Karnataka',
  };

  const centerCoords: GeoPoint = useMemo(() => ({ lat: 12.9716, lng: 77.5946 }), []);

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(
    vendors[0]?.id || null
  );
  const [maxDistanceFilter, setMaxDistanceFilter] = useState<number>(50); // km
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Compute vendor locations and distances
  const mappedVendors = useMemo(() => {
    return vendors.map((vendor, idx) => {
      const coords = getVendorCoordinates(vendor, idx, centerCoords);
      const distanceKm = calculateDistanceKm(centerCoords, coords);

      // Estimate transit time based on distance (average urban transit ~25 km/h + 15 min buffer)
      const transitMins = Math.round(distanceKm * 2.4 + 15);
      const transitTime =
        transitMins > 60
          ? `${Math.floor(transitMins / 60)}h ${transitMins % 60}m`
          : `${transitMins} mins`;

      return {
        ...vendor,
        coords,
        distanceKm,
        transitTime,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm); // Closest first
  }, [vendors, centerCoords]);

  // Filtered by distance and search
  const filteredVendors = useMemo(() => {
    return mappedVendors.filter(v => {
      const matchDist = maxDistanceFilter === 0 || v.distanceKm <= maxDistanceFilter;
      const matchSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDist && matchSearch;
    });
  }, [mappedVendors, maxDistanceFilter, searchQuery]);

  const selectedVendor = useMemo(() => {
    return mappedVendors.find(v => v.id === selectedVendorId) || mappedVendors[0];
  }, [mappedVendors, selectedVendorId]);

  // Map boundaries for SVG canvas
  const mapExtent = 35; // +/- 35 km from center
  const svgSize = 600;
  const centerSvg = svgSize / 2;

  // Convert distance & bearing to SVG x,y
  const getSvgCoordinates = (coords: GeoPoint) => {
    const latDiff = (coords.lat - centerCoords.lat) * 111; // ~111 km per deg lat
    const lngDiff = (coords.lng - centerCoords.lng) * (111 * Math.cos((centerCoords.lat * Math.PI) / 180));

    const x = centerSvg + (lngDiff / mapExtent) * (centerSvg - 40);
    const y = centerSvg - (latDiff / mapExtent) * (centerSvg - 40);

    return { x: Math.max(30, Math.min(svgSize - 30, x)), y: Math.max(30, Math.min(svgSize - 30, y)) };
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Central Hub & Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100/80 text-brand-600 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {hubWarehouse.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Central Receiving Hub
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {hubWarehouse.location} &bull; Measuring radial distances to all registered vendor facilities
            </p>
          </div>
        </div>

        {/* Distance Filter Buttons */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 md:pb-0">
          <span className="text-slate-400 font-medium whitespace-nowrap">Radius:</span>
          {[
            { label: 'All (< 50 km)', val: 50 },
            { label: '< 25 km (Metro)', val: 25 },
            { label: '< 10 km (Hyper-Local)', val: 10 },
          ].map(f => (
            <button
              key={f.val}
              type="button"
              onClick={() => setMaxDistanceFilter(f.val)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
                maxDistanceFilter === f.val
                  ? 'bg-brand-500 text-white shadow-2xs font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Interactive Map Canvas + Nearby Vendors List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Visual Map Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 rounded-xl border border-slate-800 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[480px]">
          {/* Map Header Overlay */}
          <div className="flex items-center justify-between text-xs text-slate-300 relative z-10 pb-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-brand-400 animate-spin" style={{ animationDuration: '20s' }} />
              <span className="font-bold tracking-wide">Interactive Vendor Radar & Location Canvas</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> &lt; 10 km
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> 10-25 km
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> &gt; 25 km
              </span>
            </div>
          </div>

          {/* SVG Geo Canvas */}
          <div className="relative w-full aspect-square max-w-[480px] mx-auto my-auto flex items-center justify-center">
            <svg
              viewBox={`0 0 ${svgSize} ${svgSize}`}
              className="w-full h-full filter drop-shadow"
            >
              <defs>
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background Glow */}
              <circle cx={centerSvg} cy={centerSvg} r={centerSvg - 30} fill="url(#radarGlow)" />

              {/* Distance Rings */}
              {[10, 20, 30].map(dist => {
                const r = (dist / mapExtent) * (centerSvg - 40);
                return (
                  <g key={dist}>
                    <circle
                      cx={centerSvg}
                      cy={centerSvg}
                      r={r}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={centerSvg + 4}
                      y={centerSvg - r + 12}
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {dist} km
                    </text>
                  </g>
                );
              })}

              {/* Grid Crosshairs */}
              <line
                x1="30"
                y1={centerSvg}
                x2={svgSize - 30}
                y2={centerSvg}
                stroke="#1e293b"
                strokeWidth="1"
              />
              <line
                x1={centerSvg}
                y1="30"
                x2={centerSvg}
                y2={svgSize - 30}
                stroke="#1e293b"
                strokeWidth="1"
              />

              {/* Central Warehouse Hub Pin */}
              <g className="cursor-pointer">
                <circle cx={centerSvg} cy={centerSvg} r="16" fill="#ea580c" opacity="0.2" className="animate-ping" />
                <circle cx={centerSvg} cy={centerSvg} r="10" fill="#f97316" stroke="#ffffff" strokeWidth="2" />
                <text
                  x={centerSvg}
                  y={centerSvg + 22}
                  textAnchor="middle"
                  fill="#fdba74"
                  fontSize="11"
                  fontWeight="bold"
                >
                  Central Godown (Hub)
                </text>
              </g>

              {/* Vendor Pins */}
              {filteredVendors.map(v => {
                const { x, y } = getSvgCoordinates(v.coords);
                const isSelected = selectedVendor?.id === v.id;
                const pinColor =
                  v.distanceKm <= 10 ? '#10b981' : v.distanceKm <= 25 ? '#6366f1' : '#f59e0b';

                return (
                  <g
                    key={v.id}
                    onClick={() => setSelectedVendorId(v.id)}
                    className="cursor-pointer transition-transform hover:scale-125"
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  >
                    {/* Connecting line to hub */}
                    <line
                      x1={centerSvg}
                      y1={centerSvg}
                      x2={x}
                      y2={y}
                      stroke={isSelected ? '#f97316' : '#334155'}
                      strokeWidth={isSelected ? '2' : '0.75'}
                      strokeOpacity={isSelected ? '0.8' : '0.3'}
                      strokeDasharray={isSelected ? undefined : '2 2'}
                    />

                    {/* Outer ring on selected */}
                    {isSelected && (
                      <circle cx={x} cy={y} r="14" fill={pinColor} opacity="0.3" className="animate-pulse" />
                    )}

                    {/* Main Pin Dot */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? '9' : '6'}
                      fill={pinColor}
                      stroke="#ffffff"
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                    />

                    {/* Pin Label */}
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fill={isSelected ? '#ffffff' : '#cbd5e1'}
                      fontSize={isSelected ? '11' : '9'}
                      fontWeight={isSelected ? 'bold' : 'normal'}
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))"
                    >
                      {v.name.slice(0, 16)} ({v.distanceKm}km)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Card for Selected Vendor */}
          {selectedVendor && (
            <div className="relative z-10 p-3 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700 text-xs text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <strong className="text-sm font-bold text-white">{selectedVendor.name}</strong>
                  <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-brand-500/30 text-brand-300 border border-brand-500/40">
                    {selectedVendor.distanceKm} km from Hub
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {selectedVendor.address} &bull; Transit: <strong>~{selectedVendor.transitTime}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedVendor.name + ' ' + selectedVendor.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-600 transition-colors"
                >
                  <Navigation className="w-3 h-3 text-brand-400" /> Directions
                </a>
                <button
                  type="button"
                  onClick={() => navigate(`/vendors/${selectedVendor.id}`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-2xs transition-colors"
                >
                  View Catalog <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Nearby Vendors List (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Nearby Vendors Directory</h3>
              <p className="text-xs text-slate-500">
                Sorted by proximity ({filteredVendors.length} reachable suppliers)
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="my-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by vendor name or area..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Scrollable Vendor Cards */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredVendors.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No vendors found within {maxDistanceFilter} km matching your filter.
              </div>
            ) : (
              filteredVendors.map(vendor => {
                const isSelected = selectedVendor?.id === vendor.id;

                return (
                  <div
                    key={vendor.id}
                    onClick={() => setSelectedVendorId(vendor.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-orange-50/70 border-brand-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{vendor.name}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {vendor.address}
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <span className="font-extrabold text-brand-600 block text-xs">
                          {vendor.distanceKm} km
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end">
                          <Clock className="w-2.5 h-2.5" /> ~{vendor.transitTime}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                      <div>
                        Contact: <strong className="text-slate-800">{vendor.contactPerson}</strong>
                      </div>

                      {/* Quick Communication Actions */}
                      <div className="flex items-center gap-2">
                        {vendor.phone && (
                          <a
                            href={`tel:${vendor.phone}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1 rounded text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Call Vendor"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {vendor.email && (
                          <a
                            href={`mailto:${vendor.email}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1 rounded text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Email Vendor"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.name + ' ' + vendor.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1 rounded text-slate-600 hover:text-brand-600 hover:bg-orange-50 transition-colors"
                          title="Open Google Maps Directions"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
