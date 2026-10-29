import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Truck,
  Receipt,
  Warehouse,
  BookOpen,
  X,
  Compass,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface RadialSlice {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  path: string;
  description: string;
}

export const RadialMenu: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hoveredSlice, setHoveredSlice] = useState<RadialSlice | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const slices: RadialSlice[] = [
    {
      id: 'dashboard',
      label: t('nav.home', 'Home Dashboard'),
      shortLabel: t('nav.home', 'Home'),
      icon: <LayoutDashboard className="w-5 h-5" />,
      path: '/dashboard',
      description: 'Operations overview & alerts',
    },
    {
      id: 'purchases',
      label: t('nav.purchases', 'Purchase Orders'),
      shortLabel: t('nav.purchases', 'Orders'),
      icon: <ShoppingBag className="w-5 h-5" />,
      path: '/purchases',
      description: 'Guided 4-step procurement',
    },
    {
      id: 'inventory',
      label: t('nav.inventory', 'Inventory & Stock'),
      shortLabel: t('nav.inventory', 'Stock'),
      icon: <Package className="w-5 h-5" />,
      path: '/inventory',
      description: 'Godown counts & movement log',
    },
    {
      id: 'vendors',
      label: t('nav.vendors', 'Vendors & Catalogs'),
      shortLabel: t('nav.vendors', 'Vendors'),
      icon: <Users className="w-5 h-5" />,
      path: '/vendors',
      description: 'Agreed supplier purchase rates',
    },
    {
      id: 'deliveries',
      label: t('nav.deliveries', 'Deliveries & QR'),
      shortLabel: t('nav.deliveries', 'Deliveries'),
      icon: <Truck className="w-5 h-5" />,
      path: '/deliveries',
      description: 'Carrier check-in & gate inspect',
    },
    {
      id: 'bills',
      label: t('nav.bills', 'Bills & GST'),
      shortLabel: t('nav.bills', 'Bills'),
      icon: <Receipt className="w-5 h-5" />,
      path: '/bills',
      description: 'Invoice verification & payments',
    },
    {
      id: 'warehouses',
      label: t('nav.godowns', 'Godowns & Sites'),
      shortLabel: t('nav.godowns', 'Godowns'),
      icon: <Warehouse className="w-5 h-5" />,
      path: '/warehouses',
      description: 'Receiving sheds & assembly depots',
    },
    {
      id: 'help',
      label: t('nav.help', 'Help & User Guide'),
      shortLabel: t('nav.help', 'Guide'),
      icon: <BookOpen className="w-5 h-5" />,
      path: '/help',
      description: 'Plain-language operating manual',
    },
  ];

  // Global listeners for right-click, keyboard shortcut, and custom open event
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('a')
      ) {
        return;
      }

      e.preventDefault();

      // Screen edge adjustment: radius is 195px, diameter 390px
      const radius = 195;
      const margin = 20;
      const maxX = window.innerWidth - radius - margin;
      const minX = radius + margin;
      const maxY = window.innerHeight - radius - margin;
      const minY = radius + margin;

      const safeX = Math.min(Math.max(e.clientX, minX), maxX);
      const safeY = Math.min(Math.max(e.clientY, minY), maxY);

      setPosition({ x: safeX, y: safeY });
      setHoveredSlice(null);
      setIsOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        setHoveredSlice(null);
        setIsOpen(prev => !prev);
      }
    };

    const handleCustomOpen = () => {
      setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      setHoveredSlice(null);
      setIsOpen(true);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('lofty:open-radial', handleCustomOpen);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('lofty:open-radial', handleCustomOpen);
    };
  }, [isOpen]);

  const handleSelect = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleOpenAi = () => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('lofty:open-ai'));
  };

  // SVG Geometry Constants with Generous Padding
  // Total viewBox is 380x380 (radius 190)
  const viewBoxSize = 380;
  const center = viewBoxSize / 2; // 190
  const rInner = 68; // Inner boundary radius (24px gap around center hub)
  const rOuter = 152; // Outer boundary radius (38px padding from halo edge)
  const numSlices = 8;
  const sliceAngle = 360 / numSlices; // 45 deg
  const gapAngle = 6.2; // Wide gap between floating capsules (prevents looking like fruit segments!)
  const cornerRadius = 15; // Pill-like corner curvature

  // Calculate SVG path for a discrete, floating rounded glass capsule
  const getRoundedCapsulePath = (index: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const a0 = index * sliceAngle - 90 + gapAngle / 2;
    const a1 = (index + 1) * sliceAngle - 90 - gapAngle / 2;

    const dThetaOut = (cornerRadius / rOuter) * (180 / Math.PI);
    const dThetaIn = (cornerRadius / rInner) * (180 / Math.PI);

    // Points on outer arc
    const pOutStart = {
      x: center + rOuter * Math.cos(toRad(a0 + dThetaOut)),
      y: center + rOuter * Math.sin(toRad(a0 + dThetaOut)),
    };
    const pOutEnd = {
      x: center + rOuter * Math.cos(toRad(a1 - dThetaOut)),
      y: center + rOuter * Math.sin(toRad(a1 - dThetaOut)),
    };

    // Outer corner control points
    const cornerOutEnd = {
      x: center + rOuter * Math.cos(toRad(a1)),
      y: center + rOuter * Math.sin(toRad(a1)),
    };
    const cornerOutStart = {
      x: center + rOuter * Math.cos(toRad(a0)),
      y: center + rOuter * Math.sin(toRad(a0)),
    };

    // Points on radial side edges
    const pSideEndOut = {
      x: center + (rOuter - cornerRadius) * Math.cos(toRad(a1)),
      y: center + (rOuter - cornerRadius) * Math.sin(toRad(a1)),
    };
    const pSideEndIn = {
      x: center + (rInner + cornerRadius) * Math.cos(toRad(a1)),
      y: center + (rInner + cornerRadius) * Math.sin(toRad(a1)),
    };

    const cornerInEnd = {
      x: center + rInner * Math.cos(toRad(a1)),
      y: center + rInner * Math.sin(toRad(a1)),
    };
    const cornerInStart = {
      x: center + rInner * Math.cos(toRad(a0)),
      y: center + rInner * Math.sin(toRad(a0)),
    };

    // Points on inner arc
    const pInEnd = {
      x: center + rInner * Math.cos(toRad(a1 - dThetaIn)),
      y: center + rInner * Math.sin(toRad(a1 - dThetaIn)),
    };
    const pInStart = {
      x: center + rInner * Math.cos(toRad(a0 + dThetaIn)),
      y: center + rInner * Math.sin(toRad(a0 + dThetaIn)),
    };

    const pSideStartIn = {
      x: center + (rInner + cornerRadius) * Math.cos(toRad(a0)),
      y: center + (rInner + cornerRadius) * Math.sin(toRad(a0)),
    };
    const pSideStartOut = {
      x: center + (rOuter - cornerRadius) * Math.cos(toRad(a0)),
      y: center + (rOuter - cornerRadius) * Math.sin(toRad(a0)),
    };

    return [
      `M ${pOutStart.x.toFixed(2)} ${pOutStart.y.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 0 1 ${pOutEnd.x.toFixed(2)} ${pOutEnd.y.toFixed(2)}`,
      `Q ${cornerOutEnd.x.toFixed(2)} ${cornerOutEnd.y.toFixed(2)} ${pSideEndOut.x.toFixed(2)} ${pSideEndOut.y.toFixed(2)}`,
      `L ${pSideEndIn.x.toFixed(2)} ${pSideEndIn.y.toFixed(2)}`,
      `Q ${cornerInEnd.x.toFixed(2)} ${cornerInEnd.y.toFixed(2)} ${pInEnd.x.toFixed(2)} ${pInEnd.y.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 0 0 ${pInStart.x.toFixed(2)} ${pInStart.y.toFixed(2)}`,
      `Q ${cornerInStart.x.toFixed(2)} ${cornerInStart.y.toFixed(2)} ${pSideStartIn.x.toFixed(2)} ${pSideStartIn.y.toFixed(2)}`,
      `L ${pSideStartOut.x.toFixed(2)} ${pSideStartOut.y.toFixed(2)}`,
      `Q ${cornerOutStart.x.toFixed(2)} ${cornerOutStart.y.toFixed(2)} ${pOutStart.x.toFixed(2)} ${pOutStart.y.toFixed(2)}`,
      'Z',
    ].join(' ');
  };

  // Calculate icon position at centroid of each capsule
  const getIconPosition = (index: number) => {
    const midAngleDeg = index * sliceAngle - 90 + sliceAngle / 2;
    const midRad = (midAngleDeg * Math.PI) / 180;
    const rMid = (rInner + rOuter) / 2; // 110px
    return {
      x: center + rMid * Math.cos(midRad),
      y: center + rMid * Math.sin(midRad),
      angle: midAngleDeg,
    };
  };

  return (
    <>
      {/* Radial Menu Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden select-none pointer-events-auto">
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Floating Dial at Pointer Position */}
            <div
              ref={containerRef}
              className="absolute"
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Padded Translucent Glass Ring Halo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.8, opacity: 0, rotate: 10 }}
                transition={{ type: 'spring', damping: 25, stiffness: 360 }}
                className="relative w-[380px] h-[380px] rounded-full bg-white/20 backdrop-blur-2xl border border-white/40 flex items-center justify-center p-5"
                style={{
                  boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 40px 4px rgba(255, 255, 255, 0.25)',
                }}
              >
                {/* SVG for Floating Glass Capsules */}
                <svg
                  width={viewBoxSize}
                  height={viewBoxSize}
                  viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
                  className="absolute inset-0 w-full h-full overflow-visible"
                >
                  <defs>
                    {/* Neutral Clean Frosted Glass Gradients */}
                    <linearGradient id="glassCapsule" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#F1F5F9" stopOpacity="0.70" />
                    </linearGradient>

                    <linearGradient id="glassCapsuleHover" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.92" />
                    </linearGradient>

                    {/* Neutral Soft Depth Drop Shadow */}
                    <filter id="glassShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0F172A" floodOpacity="0.12" />
                    </filter>
                  </defs>

                  {/* Render 8 Floating Glass Capsules with Generous Gaps */}
                  {slices.map((slice, index) => {
                    const isHovered = hoveredSlice?.id === slice.id;
                    const pathD = getRoundedCapsulePath(index);

                    return (
                      <g
                        key={slice.id}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredSlice(slice)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        onClick={() => handleSelect(slice.path)}
                      >
                        <path
                          d={pathD}
                          fill={isHovered ? 'url(#glassCapsuleHover)' : 'url(#glassCapsule)'}
                          filter="url(#glassShadow)"
                          className="transition-all duration-200"
                          style={{
                            transformOrigin: `${center}px ${center}px`,
                            transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                            stroke: isHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)',
                            strokeWidth: isHovered ? '2' : '1.5',
                            strokeLinejoin: 'round',
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Satellite Icons & Dark Bold Labels Centered in Each Capsule */}
                {slices.map((slice, index) => {
                  const pos = getIconPosition(index);
                  const isHovered = hoveredSlice?.id === slice.id;

                  return (
                    <div
                      key={slice.id}
                      className="absolute pointer-events-none flex flex-col items-center justify-center transition-transform duration-200"
                      style={{
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                        transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.08)' : 'scale(1)'}`,
                      }}
                    >
                      <div className={`transition-colors duration-150 ${isHovered ? 'text-slate-950' : 'text-slate-700'}`}>
                        {slice.icon}
                      </div>
                      <span
                        className={`text-[11px] font-bold tracking-tight mt-0.5 whitespace-nowrap transition-colors duration-150 ${
                          isHovered ? 'text-slate-950 font-extrabold' : 'text-slate-800'
                        }`}
                      >
                        {slice.shortLabel}
                      </span>
                    </div>
                  );
                })}

                {/* Central Frosted Glass Circular Hub with Generous 24px Gap & Clickable AI Button */}
                <button
                  type="button"
                  onClick={handleOpenAi}
                  className="relative z-10 w-22 h-22 rounded-full bg-white/90 hover:bg-orange-50/90 backdrop-blur-xl border border-white/80 shadow-lg flex flex-col items-center justify-center p-2 text-center cursor-pointer group hover:scale-106 active:scale-95 transition-all outline-hidden"
                  style={{
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.9), 0 8px 24px -4px rgba(249, 115, 22, 0.35)',
                  }}
                  title="Click to Launch Lofty AI Assistant Window"
                >
                  <AnimatePresence mode="wait">
                    {hoveredSlice ? (
                      <motion.div
                        key={hoveredSlice.id}
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.88 }}
                        transition={{ duration: 0.12 }}
                        className="flex flex-col items-center justify-center pointer-events-none"
                      >
                        <span className="text-[11px] font-black text-slate-900 tracking-tight leading-tight line-clamp-1">
                          {hoveredSlice.shortLabel}
                        </span>
                        <span className="text-[8px] text-slate-600 font-medium line-clamp-2 leading-tight mt-0.5">
                          {hoveredSlice.description}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="ai-hub"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center pointer-events-none"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center shadow-xs group-hover:rotate-12 transition-transform">
                          <Sparkles className="w-4 h-4 text-white animate-pulse" />
                        </div>
                        <span className="text-[9px] font-black text-slate-900 tracking-tight mt-1 flex items-center">
                          Lofty AI
                        </span>
                        <span className="text-[7.5px] font-bold text-brand-600 uppercase tracking-wider">
                          Assistant
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                {/* Close Button at top corner */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute -top-3 -right-3 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border border-white/60 shadow-md backdrop-blur-md transition-colors z-20"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
