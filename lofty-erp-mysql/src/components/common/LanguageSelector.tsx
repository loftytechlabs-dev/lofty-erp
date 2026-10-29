import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export interface LanguageSelectorProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { currentLanguage, setLanguage, languages, currentLanguageMeta } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Application Language"
        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/20"
      >
        <Globe className="w-3.5 h-3.5 text-orange-600" />
        <span className="text-sm leading-none">{currentLanguageMeta.flag}</span>
        {variant === 'full' ? (
          <span className="font-medium text-slate-800">{currentLanguageMeta.nativeName}</span>
        ) : (
          <span className="uppercase text-[11px] font-bold text-slate-600 tracking-wider">
            {currentLanguageMeta.code}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-60 max-h-80 overflow-y-auto rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Select Language (13)</span>
            <span className="text-[10px] text-orange-600 font-semibold">{currentLanguageMeta.nativeName}</span>
          </div>

          <div className="py-1">
            {languages.map(lang => {
              const isSelected = lang.code === currentLanguage;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-orange-50/80 font-bold text-orange-700'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <span className="text-base leading-none shrink-0">{lang.flag}</span>
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-semibold leading-tight">{lang.nativeName}</span>
                      <span className="text-[10px] text-slate-400 leading-tight">{lang.name}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-orange-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
