import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  showCloseButton = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'relative w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8 z-10',
              maxWidthClasses[maxWidth]
            )}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div>
                  {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
                  {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-6 max-h-[calc(85vh-8rem)] overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
