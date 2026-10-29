import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  noPadding = false,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden',
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'p-5')}>{children}</div>
    </div>
  );
};
