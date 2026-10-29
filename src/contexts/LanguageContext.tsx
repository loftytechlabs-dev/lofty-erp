import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  PHRASE_DICTIONARY,
  LanguageMeta,
} from '../lib/translations';

export type TranslationParams = Record<string, string | number | boolean>;

export interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (langCode: string) => void;
  t: (key: string, defaultOrParams?: string | TranslationParams, params?: TranslationParams) => string;
  languages: LanguageMeta[];
  currentLanguageMeta: LanguageMeta;
  formatDate: (date?: string | Date | number | null, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date?: string | Date | number | null) => string;
  formatDateTime: (date?: string | Date | number | null) => string;
  formatCurrency: (amount: number, symbol?: string) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const STORAGE_KEY = 'lofty_language';

export const LOCALE_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
};

// Interpolation helper: replaces {{key}} or {key} with params[key]
export function interpolate(text: string, params?: TranslationParams): string {
  const p = params || {};
  return text.replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (_, k1, k2) => {
    const key = k1 || k2;
    if (p[key] !== undefined && p[key] !== null) {
      return String(p[key]);
    }
    if (key === 'count') return '0';
    return '';
  });
}

export function resolveTranslation(key: string, lang: string): string | null {
  const dict = TRANSLATIONS[lang];
  if (dict && dict[key]) return dict[key];

  const phraseDict = PHRASE_DICTIONARY[lang];
  if (phraseDict) {
    if (phraseDict[key]) return phraseDict[key];
    const lower = key.toLowerCase();
    if (phraseDict[lower]) return phraseDict[lower];
  }
  return null;
}

export function resolvePhrase(phrase: string, lang: string): string | null {
  const phraseDict = PHRASE_DICTIONARY[lang];
  if (!phraseDict) return null;
  if (phraseDict[phrase]) return phraseDict[phrase];
  const lower = phrase.toLowerCase();
  if (phraseDict[lower]) return phraseDict[lower];
  return null;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
        return saved;
      }
    }
    return 'en';
  });

  const setLanguage = (langCode: string) => {
    if (SUPPORTED_LANGUAGES.some(l => l.code === langCode)) {
      setCurrentLanguageState(langCode);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, langCode);
        document.documentElement.lang = langCode;
        window.dispatchEvent(
          new CustomEvent('lofty:language-changed', { detail: { language: langCode } })
        );
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage]);

  const t = (
    key: string,
    defaultOrParams?: string | TranslationParams,
    params?: TranslationParams
  ): string => {
    let fallback: string | undefined;
    let interpolations: TranslationParams | undefined;

    if (typeof defaultOrParams === 'string') {
      fallback = defaultOrParams;
      interpolations = params;
    } else if (defaultOrParams && typeof defaultOrParams === 'object') {
      interpolations = defaultOrParams;
      fallback = (interpolations.defaultValue as string) || undefined;
    }

    // Pluralization support
    if (interpolations && typeof interpolations.count === 'number') {
      const count = interpolations.count;
      const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
      const zeroKey = count === 0 ? `${key}_zero` : null;

      if (zeroKey) {
        const zeroVal = resolveTranslation(zeroKey, currentLanguage);
        if (zeroVal) return interpolate(zeroVal, interpolations);
      }
      const pluralVal = resolveTranslation(pluralKey, currentLanguage);
      if (pluralVal) return interpolate(pluralVal, interpolations);
    }

    // 1. Check exact key in currentLanguage
    const val = resolveTranslation(key, currentLanguage);
    if (val) {
      return interpolate(val, interpolations);
    }

    // 2. Check fallback phrase in currentLanguage
    if (fallback) {
      const phraseVal = resolvePhrase(fallback, currentLanguage);
      if (phraseVal) return interpolate(phraseVal, interpolations);
      return interpolate(fallback, interpolations);
    }

    // 3. Fallback to English dictionary
    if (currentLanguage !== 'en') {
      const enVal = resolveTranslation(key, 'en');
      if (enVal) return interpolate(enVal, interpolations);
    }

    return interpolate(key, interpolations);
  };

  const getLocale = () => LOCALE_MAP[currentLanguage] || 'en-IN';

  const formatDate = (date?: string | Date | number | null, options?: Intl.DateTimeFormatOptions): string => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const defaultOpts: Intl.DateTimeFormatOptions = options || {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return new Intl.DateTimeFormat(getLocale(), defaultOpts).format(d);
  };

  const formatTime = (date?: string | Date | number | null): string => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return new Intl.DateTimeFormat(getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const formatDateTime = (date?: string | Date | number | null): string => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return new Intl.DateTimeFormat(getLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const formatCurrency = (amount: number, symbol = '₹'): string => {
    const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const formatted = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(val);
    return `${symbol}${formatted}`;
  };

  const formatNumber = (num: number, options?: Intl.NumberFormatOptions): string => {
    const val = typeof num === 'number' && !isNaN(num) ? num : 0;
    return new Intl.NumberFormat(getLocale(), options).format(val);
  };

  const currentLanguageMeta =
    SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        setLanguage,
        t,
        languages: SUPPORTED_LANGUAGES,
        currentLanguageMeta,
        formatDate,
        formatTime,
        formatDateTime,
        formatCurrency,
        formatNumber,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
