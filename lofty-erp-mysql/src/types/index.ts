export type BusinessRole = 'Owner' | 'Manager' | 'Purchasing' | 'Warehouse' | 'Accountant';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  onboardingCompleted: boolean;
  intendedRole?: string;
  businessIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BusinessMember {
  uid: string;
  businessId: string;
  email: string;
  displayName: string;
  role: BusinessRole;
  assignedWarehouseId?: string;
  joinedAt: string;
}

export interface BusinessInvitation {
  code: string;
  businessId: string;
  businessName?: string;
  role: BusinessRole;
  recipientEmail?: string | null;
  createdBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
}

export interface TaxSettings {
  gstin?: string;
  defaultTaxRate: number; // e.g. 18
}

export interface BusinessContact {
  phone?: string;
  email?: string;
  address?: string;
}

export interface Business {
  id: string;
  name: string;
  type: string;
  country: string;
  currency: CurrencyConfig;
  taxSettings: TaxSettings;
  contact: BusinessContact;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  businessId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstin?: string;
  paymentTerms: string; // e.g., 'Net 30', 'Net 15', 'Due on Receipt'
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VendorProduct {
  id: string;
  businessId: string;
  vendorId: string;
  productId: string;
  vendorPrice: number; // in minor units or 2-decimal rounded
  unit: string;
  leadTimeDays: number;
  minOrderQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  unit: string; // e.g., 'Pcs', 'Kg', 'Meters', 'Boxes'
  category: string;
  reorderThreshold: number;
  taxRate: number; // GST rate percentage (e.g. 18)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  businessId: string;
  name: string;
  code: string;
  location: string;
  isActive: boolean;
  createdAt: string;
}

export type POStatus = 'Draft' | 'Ordered' | 'Partially Received' | 'Received' | 'Closed' | 'Cancelled';

export interface POLineItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  orderedQuantity?: number;
  receivedQuantity: number;
  unitPrice: number;
  lineTotal: number; // quantity * unitPrice
  taxRate: number; // %
  taxAmount: number;
  totalWithTax: number;
}

export interface PurchaseOrder {
  id: string;
  businessId: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  vendorGstin?: string;
  warehouseId: string;
  warehouseName: string;
  items: POLineItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: POStatus;
  expectedDeliveryDate: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type OwnerConfirmationStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type DeliveryStatus =
  | 'AWAITING_REVIEW'
  | 'AWAITING_OWNER_CONFIRMATION'
  | 'PARTIALLY_VERIFIED'
  | 'VERIFIED'
  | 'REJECTED';
export type ProductVerificationStatus = 'PENDING' | 'ACCEPTED' | 'ACCEPTED_WITH_DISCREPANCY' | 'REJECTED';
export type BillVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CORRECTION_REQUESTED';

export interface DeliveryItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  orderedQuantity: number;
  deliveredQuantity: number;
  acceptedQuantity: number; // Physical count verified
  rejectedQuantity: number; // Damaged or missing
  inspectionNotes?: string;
}

export interface FraudCheckItem {
  name: string;
  passed: boolean;
  details: string;
}

export interface BillAiVerification {
  isAuthentic: boolean;
  confidenceScore: number;
  documentType: 'TAX_INVOICE' | 'DELIVERY_CHALLAN' | 'LORRY_RECEIPT' | 'INVALID_OR_FAKE';
  isScamOrSuspicious: boolean;
  scamRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedVendor?: string;
  detectedGstin?: string;
  detectedInvoiceNumber?: string;
  detectedTotalAmount?: number;
  verdict: string;
  fraudChecks: FraudCheckItem[];
  warnings?: string[];
  analyzedAt: string;
  source?: 'gemini' | 'heuristic_engine';
}

export interface Delivery {
  id: string;
  businessId: string;
  purchaseOrderId: string;
  poNumber: string;
  vendorName: string;
  warehouseId: string;
  warehouseName: string;
  challanNumber: string;
  challanDate: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  items: DeliveryItem[];
  notes?: string;
  billPhotoBase64?: string;
  aiVerification?: BillAiVerification | null;
  hasQuantityDiscrepancy?: boolean;
  ownerConfirmationStatus?: OwnerConfirmationStatus;
  ownerConfirmedBy?: string;
  ownerConfirmedAt?: string;
  ownerConfirmationNotes?: string;
  status: DeliveryStatus;
  productVerificationStatus: ProductVerificationStatus;
  productVerifiedBy?: string;
  productVerifiedAt?: string;
  productVerificationNotes?: string;
  billVerificationStatus: BillVerificationStatus;
  billVerifiedBy?: string;
  billVerifiedAt?: string;
  billVerificationNotes?: string;
  submittedAt: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DeliveryToken {
  token: string;
  businessId: string;
  purchaseOrderId: string;
  poNumber: string;
  vendorName: string;
  warehouseId: string;
  warehouseName: string;
  items?: POLineItem[];
  isUsed: boolean;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
}

export type BillStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CORRECTION_REQUESTED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface BillLineItem {
  productId: string;
  productName: string;
  sku: string;
  billedQuantity: number;
  unitPrice: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface SupplierBill {
  id: string;
  businessId: string;
  purchaseOrderId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  vendorGstin?: string;
  invoiceNumber: string;
  invoiceDate: string;
  lineItems: BillLineItem[];
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
  paidAmount: number;
  status: BillStatus;
  paymentStatus: PaymentStatus;
  billPhotoBase64?: string;
  aiVerification?: BillAiVerification | null;
  rejectionReason?: string;
  correctionDetails?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 'PURCHASE_RECEIPT' | 'ADJUSTMENT_ADD' | 'ADJUSTMENT_SUBTRACT' | 'STOCK_TRANSFER';

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  referenceType: 'DELIVERY' | 'MANUAL';
  referenceId?: string;
  purchaseOrderId?: string;
  actorUid: string;
  timestamp: string;
  notes?: string;
}

export interface StockBalance {
  id: string; // productId_warehouseId
  businessId: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  quantity: number;
  lastUpdated: string;
}

export type PaymentMethod = 'Bank Transfer' | 'UPI' | 'Cheque' | 'Cash';

export interface PaymentRecord {
  id: string;
  businessId: string;
  billId: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  businessId: string;
  type: 'DELIVERY_SUBMITTED' | 'DELIVERY_DISCREPANCY' | 'LOW_STOCK' | 'BILL_ACTION' | 'ORDER_UPDATE';
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  businessId: string;
  entityType: string;
  entityId: string;
  actorUid: string;
  details: Record<string, any>;
  timestamp: string;
}

// Interactive Canvas Dashboard Types
export type CanvasWidgetType =
  | 'spend_by_supplier'
  | 'spend_timeline'
  | 'stock_vs_reorder'
  | 'stock_valuation'
  | 'godown_split'
  | 'kpi_metric'
  | 'live_orders'
  | 'ai_summary';

export type KpiMetricType =
  | 'total_spend'
  | 'active_orders'
  | 'low_stock'
  | 'unpaid_bills'
  | 'pending_deliveries';

export interface CanvasWidget {
  id: string;
  type: CanvasWidgetType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: {
    metricKey?: KpiMetricType;
    notes?: string;
    viewMode?: string;
  };
}

export interface AiCanvasAction {
  type: 'ADD_WIDGET' | 'ARRANGE_COLUMNS' | 'RESET_LAYOUT' | 'CLEAR_CANVAS';
  widgetType?: CanvasWidgetType;
  metricKey?: KpiMetricType;
  title?: string;
  columns?: number;
}

