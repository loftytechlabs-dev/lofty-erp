import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftAddon, rightAddon, className, id, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 7);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative flex rounded-md shadow-sm">
          {leftAddon && (
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
              {leftAddon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400',
              'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
              'disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200',
              leftAddon && 'rounded-l-none',
              rightAddon && 'rounded-r-none',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
              {rightAddon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
