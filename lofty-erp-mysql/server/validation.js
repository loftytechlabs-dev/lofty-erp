/**
 * Server-Side Validation Module for Lofty ERP (MySQL Backend)
 * Enforces enterprise data integrity at the API layer.
 */

export function validateName(name, fieldLabel = 'Name') {
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

export function validatePhone(phone, isRequired = true) {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    if (!isRequired) return { isValid: true };
    return { isValid: false, error: 'Phone number is required' };
  }

  const trimmed = phone.trim();

  // Check if phone contains alphabetic letters
  if (/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Phone number must contain numbers only (no alphabetic characters allowed)' };
  }

  // Extract raw digits
  const rawDigits = trimmed.replace(/\D/g, '');

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

  return { isValid: true };
}

export function validateEmail(email, isRequired = false) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    if (!isRequired) return { isValid: true };
    return { isValid: false, error: 'Email address is required' };
  }

  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email address cannot exceed 254 characters' };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format (e.g. supplier@company.com)' };
  }

  if (trimmed.includes('..')) {
    return { isValid: false, error: 'Email format cannot contain consecutive dots' };
  }

  return { isValid: true };
}

export function validateGSTIN(gstin, isRequired = false) {
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

  const stateCodeStr = cleanGstin.substring(0, 2);
  if (!/^\d{2}$/.test(stateCodeStr)) {
    return { isValid: false, error: 'GSTIN must begin with a 2-digit Indian state code' };
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(cleanGstin)) {
    return {
      isValid: false,
      error: 'Invalid GSTIN structure (expected 2-digit state code + 10-char PAN + entity code + Z + checksum, e.g. 27AABCT9876C1Z3)',
    };
  }

  return { isValid: true };
}

export function validateVendorPayload(data) {
  const errors = {};

  const nameVal = validateName(data.name, 'Vendor Name');
  if (!nameVal.isValid) errors.name = nameVal.error;

  const contactVal = validateName(data.contactPerson, 'Contact Person');
  if (!contactVal.isValid) errors.contactPerson = contactVal.error;

  const phoneVal = validatePhone(data.phone, true);
  if (!phoneVal.isValid) errors.phone = phoneVal.error;

  if (data.email) {
    const emailVal = validateEmail(data.email, false);
    if (!emailVal.isValid) errors.email = emailVal.error;
  }

  if (data.gstin) {
    const gstinVal = validateGSTIN(data.gstin, false);
    if (!gstinVal.isValid) errors.gstin = gstinVal.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
