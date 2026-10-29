/**
 * Mentor-Designed Comprehensive Quality & Constraint Test Suite
 * Designed by Senior ERP Architect & Quality Mentor.
 * 
 * Verifies every single enterprise data constraint and business invariant:
 * 1. Name constraints (non-empty, non-whitespace, min 2 chars, max 120 chars)
 * 2. Phone constraints ("number should take only number", 10 digits, prefix normalization)
 * 3. Email RFC format constraints (RFC 5322 compliance, dot/at rules)
 * 4. GSTIN Indian Tax constraints ("gst number count should be correct", strictly 15 chars, PAN structure)
 * 5. Product & Catalog constraint enforcement (positive price, min order qty >= 1, lead times)
 * 6. Purchase Order financial integrity (positive line items, accurate tax calculation, no float drift)
 * 7. Internationalization coverage across all 13 supported languages
 */

import { describe, it, expect } from 'vitest';
import {
  validateName,
  validatePhone,
  sanitizeNumericOnly,
  validateEmail,
  validateGSTIN,
  validateVendorPayload,
  validateProductPayload,
  validatePurchaseOrderPayload,
} from '../lib/validation';
import { round2, calculateLineItem } from '../lib/utils';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from '../lib/translations';

describe('ERP Mentor Quality Audit: Constraint & Data Integrity Suite', () => {

  // =========================================================================
  // PILLAR 1: Name Validation Constraints
  // =========================================================================
  describe('Pillar 1: Name Constraints', () => {
    it('rejects null, undefined, or empty names', () => {
      expect(validateName(null).isValid).toBe(false);
      expect(validateName(undefined).isValid).toBe(false);
      expect(validateName('').isValid).toBe(false);
      expect(validateName('   ').isValid).toBe(false);
    });

    it('rejects names with fewer than 2 characters', () => {
      const res = validateName('A', 'Vendor Name');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('at least 2 characters');
    });

    it('rejects names exceeding 120 characters', () => {
      const longName = 'A'.repeat(121);
      const res = validateName(longName, 'Vendor Name');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('cannot exceed 120 characters');
    });

    it('accepts valid company and individual names with spaces and symbols', () => {
      expect(validateName('Western Timber & Forest Supplies').isValid).toBe(true);
      expect(validateName('Mahesh Sawant').isValid).toBe(true);
      expect(validateName('3M India Ltd.').isValid).toBe(true);
      expect(validateName('K-Tech Fasteners').isValid).toBe(true);
    });
  });

  // =========================================================================
  // PILLAR 2: Phone Number Constraints ("number should take only number")
  // =========================================================================
  describe('Pillar 2: Phone Number Constraints (Numbers Only & Strict 10 Digits)', () => {
    it('rejects phone numbers containing alphabetic letters', () => {
      const res = validatePhone('98901abc23');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('numbers only');
    });

    it('rejects phone numbers containing illegal special characters', () => {
      const res = validatePhone('9890@#$123');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('numbers only');
    });

    it('rejects phone numbers with fewer than 10 digits', () => {
      const res = validatePhone('9890123'); // 7 digits
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('exactly 10 digits');
      expect(res.error).toContain('entered 7 digits');
    });

    it('rejects phone numbers with more than 10 digits (without valid country prefix)', () => {
      const res = validatePhone('989012345678'); // 12 digits not starting with 91
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('exactly 10 digits');
    });

    it('accepts valid 10-digit Indian phone numbers', () => {
      expect(validatePhone('9890122334').isValid).toBe(true);
      expect(validatePhone('9876543210').isValid).toBe(true);
      expect(validatePhone('7823456789').isValid).toBe(true);
    });

    it('normalizes and accepts phone numbers with +91 or 91 country code', () => {
      expect(validatePhone('+91 98901 22334').isValid).toBe(true);
      expect(validatePhone('919890122334').isValid).toBe(true);
      expect(validatePhone('09890122334').isValid).toBe(true);
    });

    it('sanitizeNumericOnly strips non-digits immediately on user typing', () => {
      expect(sanitizeNumericOnly('abc98-901 22334xyz')).toBe('9890122334');
      expect(sanitizeNumericOnly('123456789012345')).toBe('1234567890'); // capped at 10
      expect(sanitizeNumericOnly('Phone: +91 98')).toBe('9198');
    });
  });

  // =========================================================================
  // PILLAR 3: Email Format Constraints
  // =========================================================================
  describe('Pillar 3: Email RFC Format Constraints', () => {
    it('rejects malformed email strings missing @', () => {
      const res = validateEmail('plainaddress');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid email format');
    });

    it('rejects email addresses missing domain or user part', () => {
      expect(validateEmail('@domain.com').isValid).toBe(false);
      expect(validateEmail('user@').isValid).toBe(false);
      expect(validateEmail('user@domain').isValid).toBe(false);
    });

    it('rejects email addresses containing consecutive dots', () => {
      const res = validateEmail('user..name@domain.com');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('consecutive dots');
    });

    it('accepts valid corporate and personal emails', () => {
      expect(validateEmail('sales@westerntimber.example').isValid).toBe(true);
      expect(validateEmail('contact.us+procure@enterprise-supply.co.in').isValid).toBe(true);
      expect(validateEmail('accounts_dept@loftyerp.com').isValid).toBe(true);
    });

    it('allows empty email when field is optional', () => {
      expect(validateEmail('', false).isValid).toBe(true);
      expect(validateEmail(undefined, false).isValid).toBe(true);
    });
  });

  // =========================================================================
  // PILLAR 4: GSTIN Constraints ("gst number count should be correct")
  // =========================================================================
  describe('Pillar 4: GSTIN Tax Constraints (Strict 15 Characters & Indian Structure)', () => {
    it('rejects GSTIN with count less than 15 characters', () => {
      const res = validateGSTIN('27AABCT9876C1Z'); // 14 characters
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('exactly 15 characters');
      expect(res.error).toContain('currently 14 characters');
    });

    it('rejects GSTIN with count greater than 15 characters', () => {
      const res = validateGSTIN('27AABCT9876C1Z399'); // 17 characters
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('exactly 15 characters');
      expect(res.error).toContain('currently 17 characters');
    });

    it('rejects GSTIN with non-numeric state code', () => {
      const res = validateGSTIN('XXAABCT9876C1Z3'); // 15 chars but letters in state code
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('2-digit Indian state code');
    });

    it('rejects GSTIN that violates Indian PAN format (chars 3-12)', () => {
      const res = validateGSTIN('2712345678901Z3'); // 15 characters, but digits instead of letters in PAN
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid GSTIN structure');
    });

    it('rejects GSTIN where 14th character is not "Z"', () => {
      const res = validateGSTIN('27AABCT9876C1X3'); // 14th char is X, must be Z
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid GSTIN structure');
    });

    it('accepts valid 15-character Indian GSTIN numbers across states', () => {
      expect(validateGSTIN('27AABCT9876C1Z3').isValid).toBe(true); // Maharashtra (27)
      expect(validateGSTIN('29ABCDE1234F1Z5').isValid).toBe(true); // Karnataka (29)
      expect(validateGSTIN('07AAACH7409R1ZZ').isValid).toBe(true); // Delhi (07)
      expect(validateGSTIN('24AAACW3456M1Z2').isValid).toBe(true); // Gujarat (24)
    });

    it('handles lowercase GSTIN by uppercasing and validating successfully', () => {
      expect(validateGSTIN('27aabct9876c1z3').isValid).toBe(true);
    });
  });

  // =========================================================================
  // PILLAR 5: Aggregate Vendor Payload Validation
  // =========================================================================
  describe('Pillar 5: Aggregate Vendor Payload Validation', () => {
    it('catches multiple simultaneous validation errors in a dirty payload', () => {
      const dirty = {
        name: ' ', // blank
        contactPerson: 'A', // too short (< 2 chars)
        phone: '98invalid', // letters in phone
        email: 'broken-email', // missing @ and domain
        gstin: '27AABCT', // only 7 chars (must be 15)
      };

      const result = validateVendorPayload(dirty);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.contactPerson).toBeDefined();
      expect(result.errors.phone).toBeDefined();
      expect(result.errors.email).toBeDefined();
      expect(result.errors.gstin).toBeDefined();
    });

    it('passes completely for a clean enterprise payload', () => {
      const clean = {
        name: 'Western Timber & Forest Supplies',
        contactPerson: 'Mahesh Sawant',
        phone: '9890122334',
        email: 'sales@westerntimber.example',
        gstin: '27AABCT9876C1Z3',
        address: 'Sawmill Gate, Old Pune-Bangalore Road, Kolhapur 416004',
        paymentTerms: 'Net 30 Days',
      };

      const result = validateVendorPayload(clean);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });
  });

  // =========================================================================
  // PILLAR 6: Product & Catalog Constraints
  // =========================================================================
  describe('Pillar 6: Product & Catalog Constraints', () => {
    it('rejects zero or negative prices', () => {
      expect(validateProductPayload({ name: 'Plank', sku: 'SKU-01', price: 0 }).isValid).toBe(false);
      expect(validateProductPayload({ name: 'Plank', sku: 'SKU-01', price: -50 }).isValid).toBe(false);
    });

    it('rejects invalid minimum order quantity (< 1)', () => {
      const res = validateProductPayload({ name: 'Plank', sku: 'SKU-01', price: 100, minOrderQty: 0 });
      expect(res.isValid).toBe(false);
      expect(res.errors.minOrderQty).toContain('at least 1');
    });

    it('rejects negative lead times', () => {
      const res = validateProductPayload({ name: 'Plank', sku: 'SKU-01', price: 100, leadTimeDays: -2 });
      expect(res.isValid).toBe(false);
      expect(res.errors.leadTimeDays).toContain('cannot be negative');
    });

    it('rejects invalid GST rate brackets', () => {
      const res = validateProductPayload({ name: 'Plank', sku: 'SKU-01', price: 100, taxRate: 15 }); // 15% is not Indian GST
      expect(res.isValid).toBe(false);
      expect(res.errors.taxRate).toContain('0%, 5%, 12%, 18%, or 28%');
    });

    it('accepts valid product configurations', () => {
      const res = validateProductPayload({
        name: 'Teak Wooden Planks',
        sku: 'WD-TEAK-001',
        price: 850,
        minOrderQty: 5,
        leadTimeDays: 7,
        taxRate: 18,
      });
      expect(res.isValid).toBe(true);
    });
  });

  // =========================================================================
  // PILLAR 7: Purchase Order Financial Precision & Calculation Integrity
  // =========================================================================
  describe('Pillar 7: Purchase Order Financial Precision & Calculation Integrity', () => {
    it('rejects PO without vendor or empty items array', () => {
      expect(validatePurchaseOrderPayload([], 'ven_001').isValid).toBe(false);
      expect(validatePurchaseOrderPayload([{ productId: 'p1', quantity: 1, unitPrice: 10, taxRate: 18 }], '').isValid).toBe(false);
    });

    it('rejects items with zero or negative quantity', () => {
      const items = [{ productId: 'p1', quantity: 0, unitPrice: 100, taxRate: 18 }];
      const res = validatePurchaseOrderPayload(items, 'ven_001');
      expect(res.isValid).toBe(false);
      expect(res.errors['item_0_quantity']).toBeDefined();
    });

    it('calculates line items with exact rounding and no floating point artifacts', () => {
      // 0.1 + 0.2 float precision edge case test
      const calc1 = calculateLineItem(3, 0.1, 18);
      expect(calc1.lineTotal).toBe(0.3); // 3 * 0.1 = 0.30

      // Realistic ERP purchase: 60 units @ Rs 950.50 @ 18% GST
      const calc2 = calculateLineItem(60, 950.5, 18);
      expect(calc2.lineTotal).toBe(57030); // 60 * 950.50
      expect(calc2.taxAmount).toBe(10265.4); // 57030 * 0.18 = 10265.40
      expect(calc2.totalWithTax).toBe(67295.4); // 57030 + 10265.40
    });

    it('round2 utility guarantees 2 decimal places precision', () => {
      expect(round2(100.456)).toBe(100.46);
      expect(round2(100.454)).toBe(100.45);
      expect(round2(0.1 + 0.2)).toBe(0.3);
    });
  });

  // =========================================================================
  // PILLAR 8: Multi-Language Dictionary Completeness (13 Languages)
  // =========================================================================
  describe('Pillar 8: 13-Language Internationalization Integrity', () => {
    it('verifies that all 13 required languages are registered in metadata', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(13);
      const codes = SUPPORTED_LANGUAGES.map(l => l.code);
      const required = ['en', 'hi', 'kn', 'te', 'ta', 'ml', 'mr', 'bn', 'gu', 'pa', 'es', 'fr', 'de'];
      required.forEach(code => {
        expect(codes).toContain(code);
      });
    });

    it('verifies that each of the 13 languages has essential dictionary keys defined', () => {
      const essentialKeys = [
        'nav.home',
        'nav.purchases',
        'nav.inventory',
        'nav.vendors',
        'dashboard.title',
        'common.language',
        'vendors.title',
        'vendors.addVendor',
      ];

      SUPPORTED_LANGUAGES.forEach(lang => {
        const dict = TRANSLATIONS[lang.code];
        expect(dict, `Dictionary missing for language ${lang.code}`).toBeDefined();
        essentialKeys.forEach(key => {
          expect(dict[key], `Missing key "${key}" in language "${lang.code}"`).toBeDefined();
          expect(dict[key].trim().length).toBeGreaterThan(0);
        });
      });
    });
  });

});
