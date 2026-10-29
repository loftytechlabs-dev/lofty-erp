/**
 * Comprehensive Validation Utilities for Lofty ERP
 * Designed to enforce enterprise data constraints on both Frontend and Backend:
 * - Vendor / Contact names (no empty/whitespace, min length, sane character sets)
 * - Phone numbers (numbers only, exactly 10 digits)
 * - Email format (RFC 5322 compliant format validation)
 * - GSTIN numbers (strictly 15 alphanumeric characters matching Indian GST format)
 * - Financial & inventory operational constraints
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface MultiValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates a name (vendor name, contact person, product name, etc.)
 * - Must be non-empty and non-whitespace
 * - Must be at least 2 characters long
 * - Must not exceed 120 characters
 */
export function validateName(name: string | undefined | null, fieldLabel = 'Name'): ValidationResult {
  if (name === undefined || name === null || typeof name !== 'string') {
    return { isValid: false, error: `${fieldLabel} is required` };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: `${fieldLabel} cannot be blank or whitespace only` };
  }
  if (trimmed.length < 2) {
    return { isValid: false, error: `${fieldLabel} must be at least 2 characters` };
  }
  if (trimmed.length > 120) {
    return { isValid: false, error: `${fieldLabel} cannot exceed 120 characters` };
  }
  return { isValid: true };
}

/**
 * Validates a phone number:
 * - "number should take only number"
 * - Must contain ONLY numeric digits (0-9)
 * - Must have exactly 10 digits (standard Indian mobile/business phone number)
 * - Supports stripping standard country prefix (+91 or 91) if 12 digits
 */
export function validatePhone(phone: string | undefined | null, isRequired = true): ValidationResult {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    if (!isRequired) return { isValid: true };
    return { isValid: false, error: 'Phone number is required' };
  }

  const trimmed = phone.trim();

  // Check if user entered letters or illegal non-numeric symbols
  // Allow leading '+' for country code, spaces, hyphens, and parentheses during typing
  const containsLetters = /[a-zA-Z]/.test(trimmed);
  if (containsLetters) {
    return { isValid: false, error: 'Phone number must contain numbers only (no alphabetic characters allowed)' };
  }

  const containsIllegalChars = /[^0-9\+\-\s\(\)]/.test(trimmed);
  if (containsIllegalChars) {
    return { isValid: false, error: 'Phone number must contain numbers only' };
  }

  // Extract raw digits
  const rawDigits = trimmed.replace(/\D/g, '');

  // Handle Indian country code prefix 91 if 12 digits
  let normalizedDigits = rawDigits;
  if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
    normalizedDigits = rawDigits.slice(2);
  } else if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
    normalizedDigits = rawDigits.slice(1);
  }

  if (normalizedDigits.length === 0) {
    return { isValid: false, error: 'Phone number must contain numbers only' };
  }

  if (normalizedDigits.length !== 10) {
    return {
      isValid: false,
      error: `Phone number must be exactly 10 digits (entered ${normalizedDigits.length} digit${normalizedDigits.length === 1 ? '' : 's'})`,
    };
  }

  // Optional sanity: Indian mobile numbers typically start with 6, 7, 8, or 9
  if (!/^[6-9][0-9]{9}$/.test(normalizedDigits) && !/^[1-9][0-9]{9}$/.test(normalizedDigits)) {
    return { isValid: false, error: 'Please enter a valid 10-digit phone number' };
  }

  return { isValid: true };
}

/**
 * Sanitizes input so that only numeric digits remain.
 * Useful for real-time `onChange` handlers on phone number fields.
 */
export function sanitizeNumericOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

/**
 * Validates email format:
 * - RFC compliant regex check
 * - Checks for valid user part, '@', valid domain, and top-level domain
 * - Rejects consecutive dots, spaces, or malformed domain extensions
 */
export function validateEmail(email: string | undefined | null, isRequired = false): ValidationResult {
  if (!email || typeof email !== 'string' || !email.trim()) {
    if (!isRequired) return { isValid: true };
    return { isValid: false, error: 'Email address is required' };
  }

  const trimmed = email.trim();

  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email address cannot exceed 254 characters' };
  }

  // Standard robust email regex (RFC 5322 compatible)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format (e.g. supplier@company.com)' };
  }

  if (trimmed.includes('..')) {
    return { isValid: false, error: 'Email format cannot contain consecutive dots' };
  }

  return { isValid: true };
}

/**
 * Validates Indian Goods and Services Tax Identification Number (GSTIN):
 * - "gst number count should be correct"
 * - Must be strictly 15 alphanumeric characters
 * - Format: 2-digit state code (01-37, 97, 99) + 10-character PAN (5 letters + 4 digits + 1 letter) + 1 entity char + 'Z' + 1 checksum char
 * - Example: 27AABCT9876C1Z3
 */
export function validateGSTIN(gstin: string | undefined | null, isRequired = false): ValidationResult {
  if (!gstin || typeof gstin !== 'string' || !gstin.trim()) {
    if (!isRequired) return { isValid: true };
    return { isValid: false, error: 'GSTIN number is required' };
  }

  const cleanGstin = gstin.trim().toUpperCase();

  // Strict count check: Indian GSTIN must be exactly 15 characters
  if (cleanGstin.length !== 15) {
    return {
      isValid: false,
      error: `GSTIN must be exactly 15 characters (currently ${cleanGstin.length} character${cleanGstin.length === 1 ? '' : 's'})`,
    };
  }

  // State code must be 2 digits (01 to 37, 97, 99)
  const stateCodeStr = cleanGstin.substring(0, 2);
  const stateCode = parseInt(stateCodeStr, 10);
  if (isNaN(stateCode) || !/^\d{2}$/.test(stateCodeStr)) {
    return { isValid: false, error: 'GSTIN must begin with a 2-digit Indian state code (e.g., 27 for Maharashtra)' };
  }

  // Full GSTIN Regex
  // 2 digits state code + 5 letters PAN + 4 digits PAN + 1 letter PAN + 1 entity digit/char + 1 'Z' + 1 checksum
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstinRegex.test(cleanGstin)) {
    return {
      isValid: false,
      error: 'Invalid GSTIN structure (expected 2-digit state code + 10-char PAN + entity code + Z + checksum, e.g. 27AABCT9876C1Z3)',
    };
  }

  return { isValid: true };
}

/**
 * Validates Vendor input payload comprehensively
 */
export interface VendorInput {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  paymentTerms?: string;
}

export function validateVendorPayload(data: VendorInput): MultiValidationResult {
  const errors: Record<string, string> = {};

  const nameVal = validateName(data.name, 'Vendor Name');
  if (!nameVal.isValid && nameVal.error) {
    errors.name = nameVal.error;
  }

  const contactVal = validateName(data.contactPerson, 'Contact Person');
  if (!contactVal.isValid && contactVal.error) {
    errors.contactPerson = contactVal.error;
  }

  const phoneVal = validatePhone(data.phone, true);
  if (!phoneVal.isValid && phoneVal.error) {
    errors.phone = phoneVal.error;
  }

  if (data.email) {
    const emailVal = validateEmail(data.email, false);
    if (!emailVal.isValid && emailVal.error) {
      errors.email = emailVal.error;
    }
  }

  if (data.gstin) {
    const gstinVal = validateGSTIN(data.gstin, false);
    if (!gstinVal.isValid && gstinVal.error) {
      errors.gstin = gstinVal.error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Product / Catalog item constraints
 */
export interface ProductInput {
  name?: string;
  sku?: string;
  price?: number;
  minOrderQty?: number;
  leadTimeDays?: number;
  taxRate?: number;
}

export function validateProductPayload(data: ProductInput): MultiValidationResult {
  const errors: Record<string, string> = {};

  const nameVal = validateName(data.name, 'Product Name');
  if (!nameVal.isValid && nameVal.error) {
    errors.name = nameVal.error;
  }

  if (!data.sku || !data.sku.trim()) {
    errors.sku = 'SKU is required';
  } else if (!/^[A-Z0-9\-_]{2,30}$/i.test(data.sku.trim())) {
    errors.sku = 'SKU must be alphanumeric with optional dashes (2-30 characters)';
  }

  if (data.price !== undefined && (isNaN(data.price) || data.price <= 0)) {
    errors.price = 'Price must be a positive number greater than 0';
  }

  if (data.minOrderQty !== undefined && (isNaN(data.minOrderQty) || data.minOrderQty < 1)) {
    errors.minOrderQty = 'Minimum order quantity must be at least 1';
  }

  if (data.leadTimeDays !== undefined && (isNaN(data.leadTimeDays) || data.leadTimeDays < 0)) {
    errors.leadTimeDays = 'Lead time days cannot be negative';
  }

  const validGSTRates = [0, 5, 12, 18, 28];
  if (data.taxRate !== undefined && !validGSTRates.includes(data.taxRate)) {
    errors.taxRate = 'GST tax rate must be 0%, 5%, 12%, 18%, or 28%';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Purchase Order financial integrity
 */
export interface POItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export function validatePurchaseOrderPayload(items: POItemInput[], vendorId?: string): MultiValidationResult {
  const errors: Record<string, string> = {};

  if (!vendorId || !vendorId.trim()) {
    errors.vendorId = 'A valid vendor must be selected';
  }

  if (!Array.isArray(items) || items.length === 0) {
    errors.items = 'Purchase order must have at least one product item';
    return { isValid: false, errors };
  }

  items.forEach((item, index) => {
    if (!item.productId) {
      errors[`item_${index}_product`] = `Item #${index + 1}: Product must be selected`;
    }
    if (isNaN(item.quantity) || item.quantity <= 0) {
      errors[`item_${index}_quantity`] = `Item #${index + 1}: Quantity must be greater than 0`;
    }
    if (isNaN(item.unitPrice) || item.unitPrice < 0) {
      errors[`item_${index}_price`] = `Item #${index + 1}: Unit price cannot be negative`;
    }
    if (isNaN(item.taxRate) || item.taxRate < 0 || item.taxRate > 100) {
      errors[`item_${index}_tax`] = `Item #${index + 1}: Tax rate must be between 0% and 100%`;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
