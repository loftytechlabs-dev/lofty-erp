/**
 * Safe currency and numeric formatting
 */
export function formatCurrency(amount: number | undefined | null, symbol = '₹'): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return `${symbol}0.00`;
  }
  
  // Format with 2 decimal places and standard thousand commas
  const fixed = (Math.round((amount + Number.EPSILON) * 100) / 100).toFixed(2);
  const parts = fixed.split('.');
  const whole = parts[0];
  const decimal = parts[1];

  // Indian currency comma separation: 1,00,000.00
  if (symbol === '₹') {
    const lastThree = whole.substring(whole.length - 3);
    const otherNumbers = whole.substring(0, whole.length - 3);
    const formattedWhole = otherNumbers !== '' 
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree 
      : lastThree;
    return `${symbol}${formattedWhole}.${decimal}`;
  }

  // International formatting
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${formattedWhole}.${decimal}`;
}

export function toDateObj(dateInput: any): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === 'object') {
    if (typeof dateInput.toDate === 'function') {
      const d = dateInput.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateInput.seconds === 'number') {
      const d = new Date(dateInput.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toIsoDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    return val.includes('T') ? val.split('T')[0] : val.slice(0, 10);
  }
  const d = toDateObj(val);
  return d ? d.toISOString().split('T')[0] : '';
}

export function toIsoDateTime(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  const d = toDateObj(val);
  return d ? d.toISOString() : '';
}

export function formatDate(dateInput: any): string {
  if (!dateInput) return '—';
  try {
    const d = toDateObj(dateInput);
    if (!d) return typeof dateInput === 'string' ? dateInput : '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return typeof dateInput === 'string' ? dateInput : '—';
  }
}

export function formatDateTime(dateInput: any): string {
  if (!dateInput) return '—';
  try {
    const d = toDateObj(dateInput);
    if (!d) return typeof dateInput === 'string' ? dateInput : '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return typeof dateInput === 'string' ? dateInput : '—';
  }
}

/**
 * 2-decimal rounded precision arithmetic
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateLineItem(quantity: number, unitPrice: number, taxRate: number) {
  const safeQty = Math.max(0, quantity || 0);
  const safePrice = Math.max(0, unitPrice || 0);
  const safeTaxRate = Math.max(0, taxRate || 0);

  const lineTotal = round2(safeQty * safePrice);
  const taxAmount = round2((lineTotal * safeTaxRate) / 100);
  const totalWithTax = round2(lineTotal + taxAmount);

  return {
    quantity: safeQty,
    unitPrice: safePrice,
    lineTotal,
    taxRate: safeTaxRate,
    taxAmount,
    totalWithTax,
  };
}

export function generateId(prefix = 'id'): string {
  const randomPart = Math.random().toString(36).substring(2, 9);
  const timestamp = Date.now().toString(36).slice(-4);
  return `${prefix}_${randomPart}${timestamp}`;
}

export function cn(...classes: any[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Wraps a promise with a timeout in milliseconds.
 * If the promise does not resolve within the given duration,
 * it returns the fallback value or rejects with a Timeout error.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms = 2000,
  fallback?: T
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallback !== undefined) {
        resolve(fallback);
      } else {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

