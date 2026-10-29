import React from 'react';
import { Button } from './Button';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 bg-white border border-dashed border-slate-200 rounded-lg my-4',
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-orange-50 text-brand-600 flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-800">{t(title, title)}</h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1">{t(description, description)}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction} className="mt-4">
          {t(actionLabel, actionLabel)}
        </Button>
      )}
    </div>
  );
};
