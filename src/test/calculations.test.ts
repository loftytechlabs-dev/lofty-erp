import { describe, it, expect } from 'vitest';
import { round2, formatCurrency, calculateLineItem } from '../lib/utils';

describe('Financial & Arithmetic Precision Calculations', () => {
  it('correctly rounds decimals to 2 places without floating point creep', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(100.555)).toBe(100.56);
    expect(round2(100.554)).toBe(100.55);
  });

  it('formats Indian Rupee currency correctly with comma separation', () => {
    expect(formatCurrency(6000, '₹')).toBe('₹6,000.00');
    expect(formatCurrency(7080, '₹')).toBe('₹7,080.00');
    expect(formatCurrency(125000.5, '₹')).toBe('₹1,25,000.50');
  });

  it('correctly calculates the Master Worked Example line item (60 wooden planks @ ₹100, 18% GST)', () => {
    const result = calculateLineItem(60, 100, 18);
    expect(result.quantity).toBe(60);
    expect(result.unitPrice).toBe(100);
    expect(result.lineTotal).toBe(6000); // 60 * 100 = 6,000
    expect(result.taxAmount).toBe(1080); // 18% of 6,000 = 1,080
    expect(result.totalWithTax).toBe(7080); // 6,000 + 1,080 = 7,080
  });

  it('safely handles zero and negative inputs', () => {
    const zeroResult = calculateLineItem(0, 100, 18);
    expect(zeroResult.lineTotal).toBe(0);
    expect(zeroResult.taxAmount).toBe(0);
    expect(zeroResult.totalWithTax).toBe(0);

    const negResult = calculateLineItem(-5, 100, 18);
    expect(negResult.quantity).toBe(0);
    expect(negResult.lineTotal).toBe(0);
  });
});
