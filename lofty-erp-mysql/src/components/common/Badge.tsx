import React from 'react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'orange';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className,
}) => {
  const { t } = useLanguage();
  const displayContent = typeof children === 'string' ? t(children, children) : children;

  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-0.5 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border tracking-wide uppercase',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {displayContent}
    </span>
  );
};

export function getStatusBadgeVariant(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'orange' {
  switch (status?.toUpperCase()) {
    case 'RECEIVED':
    case 'VERIFIED':
    case 'ACCEPTED':
    case 'PAID':
    case 'ACTIVE':
      return 'success';
    case 'ORDERED':
    case 'PARTIALLY RECEIVED':
    case 'PARTIALLY_VERIFIED':
    case 'PARTIALLY_PAID':
    case 'ACCEPTED_WITH_DISCREPANCY':
      return 'orange';
    case 'PENDING':
    case 'AWAITING_REVIEW':
    case 'AWAITING_OWNER_CONFIRMATION':
    case 'DRAFT':
    case 'UNPAID':
      return 'warning';
    case 'REJECTED':
    case 'CANCELLED':
    case 'CORRECTION_REQUESTED':
      return 'danger';
    case 'CLOSED':
      return 'neutral';
    default:
      return 'neutral';
  }
}
