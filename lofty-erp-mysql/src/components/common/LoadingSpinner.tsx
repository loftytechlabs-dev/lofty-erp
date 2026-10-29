import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export const LoadingSpinner: React.FC<{ message?: string; className?: string }> = ({
  message = 'Loading Lofty ERP...',
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 space-y-3', className)}>
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      {message && <p className="text-xs font-medium text-slate-500 tracking-wide">{message}</p>}
    </div>
  );
};
