import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import {
  BookOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Package,
  Receipt,
  Truck,
  Building,
  Users,
} from 'lucide-react';

interface GuideSection {
  number: number;
  title: string;
  summary: string;
  content: React.ReactNode;
}

export const HelpPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSectionNum, setActiveSectionNum] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');

  const sections: GuideSection[] = [
    {
      number: 1,
      title: 'What Lofty ERP does',
      summary: 'Product vision, core operational workflows, and small-business focus.',
      content: (
        <div className="space-y-3">
          <p>
            <strong>Lofty ERP</strong> is a production-oriented, responsive web application purpose-built for small businesses, workshops, and small manufacturers (such as furniture makers, fabrication units, component assemblers, and wholesale distributors).
          </p>
          <p>
            Unlike overly complex enterprise ERPs that require months of formal training, Lofty ERP concentrates on the everyday operational cycle:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Vendor catalogs & price negotiations:</strong> Maintain agreed supplier rates per raw material.</li>
            <li><strong>4-step guided Purchase Orders:</strong> Generate orders strictly from vendor-specific catalogs with exact GST calculations.</li>
            <li><strong>Mobile QR delivery registration:</strong> Delivery drivers check in trucks using mobile phones without needing an account or app installation.</li>
            <li><strong>Dual independent verification:</strong> Physical goods inspection is separated completely from invoice bill verification.</li>
            <li><strong>Atomic inventory integrity:</strong> Stock increases only when usable physical quantities are accepted at the receiving godown.</li>
          </ul>
        </div>
      ),
    },
    {
      number: 2,
      title: 'Google Sign-In & Authentication',
      summary: 'Secure passwordless authentication using Google accounts.',
      content: (
        <div className="space-y-3">
          <p>
            Lofty ERP uses secure Firebase Authentication with Google Sign-In. You do not need to create or remember separate application passwords.
          </p>
          <h4 className="font-semibold text-slate-800">Signing In:</h4>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Open the Lofty ERP login screen.</li>
            <li>Click <strong>Continue with Google</strong>.</li>
            <li>Select your Google or Google Workspace business account.</li>
            <li>On mobile browsers where popups might be blocked, the system automatically uses secure redirect authentication.</li>
          </ol>
          <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-800 text-xs">
            <strong>Important:</strong> A successful Google login does not grant access to any business by itself. Access to business data requires ownership or an invitation code issued by an authorized administrator.
          </div>
        </div>
      ),
    },
    {
      number: 3,
      title: 'First-time onboarding',
      summary: 'Selecting your intended workflow after initial sign-in.',
      content: (
        <div className="space-y-3">
          <p>
            After signing in for the first time, you are presented with the onboarding screen: <em>"How will you use Lofty ERP?"</em>
          </p>
          <p>You may choose between 4 options:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>I own or manage a business:</strong> Directs you to create your business workspace.</li>
            <li><strong>I work for a business:</strong> Directs you to enter an invitation code from your employer.</li>
            <li><strong>I manage purchasing or inventory:</strong> Guides you to the appropriate setup or joining screen.</li>
            <li><strong>I manage accounts or bills:</strong> Guides you to review supplier bills and payment records.</li>
          </ul>
          <p className="text-xs text-slate-500 italic">
            Note: Role selection helps configure your initial screen, but does not grant permissions automatically. Real permissions are business-scoped and governed by the business owner.
          </p>
        </div>
      ),
    },
    {
      number: 4,
      title: 'Creating a business',
      summary: 'Setting up enterprise details, currency, and tax settings.',
      content: (
        <div className="space-y-3">
          <p>
            Any authenticated user can create a new business workspace. Setting up takes less than 60 seconds.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Click <strong>Create New Business</strong> from the top bar dropdown or onboarding.</li>
            <li>Enter your Business Name (e.g. <em>Acme Precision Manufacturing Ltd.</em>).</li>
            <li>Choose your currency (Indian Rupee ₹ INR, US Dollar $, Euro €).</li>
            <li>Enter your GSTIN / Tax Identification (e.g. <em>27AABCA1234F1Z8</em>) and default tax rate (18% GST).</li>
            <li>Provide optional factory address and phone number.</li>
            <li>Click <strong>Create Business & Launch</strong>.</li>
          </ol>
          <p>
            The creator is automatically assigned as the <strong>Owner</strong> and an initial godown (<em>Main Godown / Warehouse 1</em>) is created.
          </p>
        </div>
      ),
    },
    {
      number: 5,
      title: 'Joining a business',
      summary: 'Redeeming invitation codes provided by authorized staff.',
      content: (
        <div className="space-y-3">
          <p>
            To join an existing business workspace:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Obtain an 8-character invitation code (e.g., <code>7X9K2M4P</code>) from your business administrator.</li>
            <li>Navigate to <strong>Join with Invitation Code</strong>.</li>
            <li>Enter or paste the 8-character code and click <strong>Verify Code & Join</strong>.</li>
            <li>You will immediately be granted access with the exact role (Manager, Purchasing, Warehouse, or Accountant) authorized for that code.</li>
          </ol>
        </div>
      ),
    },
    {
      number: 6,
      title: 'Switching businesses',
      summary: 'Seamless multi-tenant switching without logging out.',
      content: (
        <div className="space-y-3">
          <p>
            If you own multiple businesses or work across multiple facilities, you can switch between them instantly.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Click the Business Switcher dropdown at the top-left of the top bar.</li>
            <li>Select the desired business.</li>
            <li>The interface immediately updates context and clears queries from the previous business, preventing data cross-contamination.</li>
            <li>Logging out and logging back in is never required to switch workspaces.</li>
          </ul>
        </div>
      ),
    },
    {
      number: 7,
      title: 'Understanding roles and permissions',
      summary: 'Owner, Manager, Purchasing, Warehouse, and Accountant capabilities.',
      content: (
        <div className="space-y-3">
          <p>Lofty ERP enforces 5 distinct operational roles:</p>
          <div className="space-y-2">
            <div className="p-2.5 bg-orange-50 border border-orange-200 rounded text-xs">
              <strong className="text-orange-900">Owner:</strong> Full authority over business settings, team invitations, purchasing, inventory, deliveries, bills, and payments.
            </div>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs">
              <strong className="text-blue-900">Manager:</strong> Operational oversight across purchase orders, stock counts, physical delivery verification, and bill checks.
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs">
              <strong className="text-emerald-900">Purchasing:</strong> Creates and edits vendors, manages vendor-specific product catalogs and prices, and issues purchase orders.
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs">
              <strong className="text-amber-900">Warehouse / Godown Staff:</strong> Generates delivery QR codes, performs physical count inspections, accepts usable goods, and records damaged/rejected items.
            </div>
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded text-xs">
              <strong className="text-indigo-900">Accountant:</strong> Reviews supplier invoices against POs, verifies GST breakdown, requests invoice corrections, and records payments.
            </div>
          </div>
        </div>
      ),
    },
    {
      number: 8,
      title: 'Vendor management',
      summary: 'Adding suppliers, contact info, payment terms, and GSTIN.',
      content: (
        <div className="space-y-3">
          <p>
            Vendors represent your suppliers of raw materials, parts, and hardware.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Navigate to <strong>Vendors</strong> in the left sidebar or radial menu.</li>
            <li>Click <strong>Add New Vendor</strong>.</li>
            <li>Enter Company Name, Contact Person, Phone, Email, and Address.</li>
            <li>Enter the vendor's GSTIN (crucial for tax invoicing and input credit).</li>
            <li>Set standard Payment Terms (e.g. <em>Net 30 Days</em> or <em>Due on Receipt</em>).</li>
            <li>Click <strong>Save Vendor & Configure Catalog</strong>.</li>
          </ol>
        </div>
      ),
    },
    {
      number: 9,
      title: 'Assigning products to vendors (Mandatory)',
      summary: 'Setting vendor-specific negotiated purchase prices and MOQs.',
      content: (
        <div className="space-y-3">
          <p>
            In Lofty ERP, products exist centrally, but purchase prices are <strong>vendor-specific</strong>. The same material (e.g. <em>Teak Wooden Planks</em>) might be supplied by Vendor A at ₹100 each and by Vendor B at ₹110 each.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Open the Vendor's Profile page.</li>
            <li>In the <em>Vendor-Specific Product Catalog</em> section, click <strong>Assign Product to Vendor</strong>.</li>
            <li>Select an item from the central product catalog.</li>
            <li>Enter your agreed purchase price (pre-tax), expected lead time in days, and minimum order quantity (MOQ).</li>
            <li>Click <strong>Save to Catalog</strong>.</li>
          </ol>
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
            <strong>Integrity Guarantee:</strong> Updating catalog prices in the future will never alter historical purchase orders already issued.
          </div>
        </div>
      ),
    },
    {
      number: 10,
      title: 'Creating products',
      summary: 'Central catalog with SKUs, units of measure, and GST rates.',
      content: (
        <div className="space-y-3">
          <p>
            The Central Product Catalog maintains the master list of all raw materials, hardware, and packaging used by your business.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Navigate to <strong>Products</strong>.</li>
            <li>Click <strong>Add New Product</strong>.</li>
            <li>Enter Material Name (e.g. <em>Countersunk Zinc Wood Screws #8 x 1.5"</em>).</li>
            <li>Assign a unique SKU (e.g. <code>HD-SCRW-815</code>).</li>
            <li>Select the Unit of Measure (Pcs, Kg, Boxes, Sets, Meters).</li>
            <li>Select the applicable GST tax bracket (0%, 5%, 12%, 18%, 28%).</li>
            <li>Set a low-stock reorder threshold to receive automatic dashboard warnings.</li>
          </ol>
        </div>
      ),
    },
    {
      number: 11,
      title: 'Warehouse & inventory management',
      summary: 'Godown locations, real-time balances, and movement logs.',
      content: (
        <div className="space-y-3">
          <p>
            Businesses can configure multiple godowns or warehouses (e.g. <em>Godown 1 — Pune Central Raw Materials</em> and <em>Godown 2 — Nashik Assembly Depot</em>).
          </p>
          <p>
            Under <strong>Inventory</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Current Stock Balances:</strong> View physical counts by product and by godown.</li>
            <li><strong>Movement Audit Log:</strong> Every stock addition or subtraction is traceable to a specific purchase receipt or manual reconciliation with timestamp and actor UID.</li>
          </ul>
        </div>
      ),
    },
    {
      number: 12,
      title: 'Creating purchase orders (Guided 4-Step Wizard)',
      summary: 'The structured workflow from vendor selection to order issuance.',
      content: (
        <div className="space-y-3">
          <p>
            Purchase Orders follow a guided 4-step wizard ensuring zero errors:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li><strong>Step 1 (Select Vendor):</strong> Pick your supplier. Their payment terms and GSTIN are automatically fetched.</li>
            <li><strong>Step 2 (Add Products):</strong> Only products associated with that vendor's catalog appear. Unit prices are pre-filled with the agreed rate. Set quantities. Line totals and taxes recalculate dynamically.</li>
            <li><strong>Step 3 (Delivery Details):</strong> Select the receiving godown and expected delivery date. Add optional instructions (e.g., moisture test requirements).</li>
            <li><strong>Step 4 (Review & Save):</strong> Review the complete financial breakdown (subtotal, CGST, SGST, grand total). Click <strong>Save & Issue Purchase Order</strong>.</li>
          </ol>
        </div>
      ),
    },
    {
      number: 13,
      title: 'QR delivery registration (Mobile Gate Check-In)',
      summary: 'Driver QR scanning without app install or account creation.',
      content: (
        <div className="space-y-3">
          <p>
            When goods arrive at the factory gate:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Open the Purchase Order in Lofty ERP and click <strong>Generate Delivery QR Code</strong>.</li>
            <li>The delivery driver scans the QR code using any smartphone camera.</li>
            <li>A fast, mobile-friendly check-in web page opens directly in their phone browser without requiring an application download or password.</li>
            <li>The driver enters the supplier's Delivery Challan number, date, vehicle number, and delivered quantities.</li>
            <li>Upon clicking Submit, the delivery is logged into Lofty ERP as <em>AWAITING_REVIEW</em> and an in-app notification alerts the warehouse team.</li>
          </ol>
        </div>
      ),
    },
    {
      number: 14,
      title: 'Product verification (Physical goods counting)',
      summary: 'Physical inspection of sound vs damaged quantities.',
      content: (
        <div className="space-y-3">
          <p>
            Physical goods inspection is conducted by godown staff:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Open the Delivery record and click <strong>Inspect & Count Physical Goods</strong>.</li>
            <li>Compare physical packages against ordered quantities.</li>
            <li>Enter the exact <strong>Accepted Quantity</strong> of sound, usable goods.</li>
            <li>Enter any <strong>Rejected Quantity</strong> (e.g., damaged in transit, cracked, warped) with inspection remarks.</li>
            <li>Click <strong>Confirm Physical Counts & Update Inventory</strong>.</li>
          </ul>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 font-medium">
            Rule: Only accepted quantities increment warehouse stock balances. Rejected quantities are excluded from available inventory.
          </div>
        </div>
      ),
    },
    {
      number: 15,
      title: 'Bill verification (Financial invoice check)',
      summary: 'Comparing supplier invoice rates and amounts against PO terms.',
      content: (
        <div className="space-y-3">
          <p>
            Bill verification is conducted independently by accounts staff:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Open the Delivery or Supplier Bill and click <strong>Review Bill</strong>.</li>
            <li>Check billed quantities against the PO and physical gate receipt.</li>
            <li>Verify unit prices, tax rates, CGST, and SGST calculations.</li>
            <li>Choose an authorized decision:
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li><strong>Accept Bill:</strong> Bill is verified for payment.</li>
                <li><strong>Request Fix:</strong> Informs the supplier of a quantity or rate discrepancy so they can issue an amended invoice or credit note.</li>
                <li><strong>Reject Bill:</strong> Rejects with a mandatory recorded reason.</li>
              </ul>
            </li>
          </ul>
          <p className="text-xs text-slate-500 italic">
            Crucial: Approving a bill never alters physical inventory balances. Physical counts and financial bills remain strictly decoupled.
          </p>
        </div>
      ),
    },
    {
      number: 16,
      title: 'Handling discrepancies (Worked Example)',
      summary: 'Step-by-step walkthrough of the 60 planks order with 5 defects.',
      content: (
        <div className="space-y-3">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">Master Worked Example</h4>
            <p>
              Acme Manufacturing orders <strong>60 Precision Raw Components</strong> at ₹100 each before tax from Western Suppliers.
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              <li>Ordered: 60 planks @ ₹100 = ₹6,000 pre-tax. 18% GST = ₹1,080. Total = ₹7,080.</li>
              <li>Truck arrives with 60 planks under Challan DC/WT/8892.</li>
              <li>Godown inspector Anil Kumar inspects the load and finds <strong>55 sound planks</strong> and <strong>5 warped/split planks</strong>.</li>
              <li>Anil enters: Accepted = 55, Rejected = 5, Note: <em>"5 planks had longitudinal knots exceeding tolerance."</em></li>
              <li><strong>Inventory result:</strong> Godown 1 stock balance increases by exactly <strong>55 planks</strong> (NOT 60).</li>
              <li>Western Timber sends Invoice INV/2026/0991 for the full 60 planks (₹7,080).</li>
              <li>Accountant Priya reviews the bill against the physical count of 55 accepted. She selects <strong>Request Fix</strong>, noting: <em>"Billed for 60 planks, but physical inspection accepted 55 due to 5 transit defects. Please provide revised bill for ₹6,490 or credit note of ₹590."</em></li>
            </ul>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/purchases/po_worked_example_01')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Open Worked Example PO (PO-2026-0101) in Lofty ERP
          </Button>
        </div>
      ),
    },
    {
      number: 17,
      title: 'Supplier bills & outstanding payments',
      summary: 'Tracking unpaid balances, payment methods, and remittance advice.',
      content: (
        <div className="space-y-3">
          <p>
            Track every rupee owed to suppliers under <strong>Supplier Bills</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>View total invoiced, total paid, and net outstanding balance across all vendors.</li>
            <li>Click <strong>Record Payment</strong> to log full or partial remittances.</li>
            <li>Choose payment method: Bank Transfer (NEFT/RTGS), UPI, Cheque, or Cash.</li>
            <li>Enter transaction reference / UTR number.</li>
            <li>If the vendor has an email address, an automated payment remittance advice is dispatched via the Google Apps Script mailer.</li>
          </ul>
        </div>
      ),
    },
    {
      number: 18,
      title: 'GST-related information & Input Tax Credit',
      summary: 'CGST, SGST, IGST breakdown and statutory clarity.',
      content: (
        <div className="space-y-3">
          <p>
            Lofty ERP tracks GST components across purchase orders and supplier bills:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Intrastate transactions automatically partition GST into <strong>CGST</strong> (Central GST) and <strong>SGST</strong> (State GST) in equal 50/50 parts.</li>
            <li>Interstate transactions track integrated <strong>IGST</strong>.</li>
            <li>Vendor GSTINs are verified for standard 15-character structure.</li>
          </ul>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
            <strong>Statutory Notice:</strong> Lofty ERP organizes your purchase invoices, delivery proofs, and GST details for operational efficiency. It does not replace filing statutory GST returns (GSTR-1, GSTR-3B) on the official government tax portal.
          </div>
        </div>
      ),
    },
    {
      number: 19,
      title: 'Reports & audit history',
      summary: 'Immutable logs and operational traceability.',
      content: (
        <div className="space-y-3">
          <p>
            Every major operational and financial action in Lofty ERP creates an immutable record under <strong>Audit Trail</strong>.
          </p>
          <p>
            Audit entries include the event type, entity ID, actor user UID, full timestamp, and JSON delta snapshot. This guarantees complete compliance and accountability during internal audits.
          </p>
        </div>
      ),
    },
    {
      number: 20,
      title: 'Troubleshooting & common mistakes',
      summary: 'Solutions to common small-business operating questions.',
      content: (
        <div className="space-y-3">
          <div className="space-y-2 text-xs">
            <div className="p-3 bg-white rounded border border-slate-200">
              <strong className="text-slate-900">Issue: "I cannot see any products when creating a PO."</strong>
              <p className="text-slate-600 mt-1">
                <strong>Solution:</strong> In Lofty ERP, products must be assigned to that specific vendor's catalog. Open the Vendor profile, click <em>Assign Product to Vendor</em>, and specify the purchase price.
              </p>
            </div>
            <div className="p-3 bg-white rounded border border-slate-200">
              <strong className="text-slate-900">Issue: "Inventory did not increase after the delivery check-in."</strong>
              <p className="text-slate-600 mt-1">
                <strong>Solution:</strong> The mobile delivery check-in registers the truck arrival. Inventory only increments after warehouse staff inspect and submit the <em>Physical Product Verification</em> count.
              </p>
            </div>
            <div className="p-3 bg-white rounded border border-slate-200">
              <strong className="text-slate-900">Issue: "Can I use Lofty ERP offline?"</strong>
              <p className="text-slate-600 mt-1">
                <strong>Solution:</strong> Lofty ERP caches static assets for PWA offline viewing. However, financial approvals and stock updates require live connectivity to prevent inventory inconsistencies.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      number: 21,
      title: 'Glossary of terms',
      summary: 'Clear definitions of all ERP terms used in the application.',
      content: (
        <div className="space-y-2 text-xs">
          <div className="p-2 border-b border-slate-100">
            <strong>SKU (Stock Keeping Unit):</strong> Unique identifier for each material or product (e.g. <code>WD-TEAK-001</code>).
          </div>
          <div className="p-2 border-b border-slate-100">
            <strong>Delivery Challan (DC):</strong> The physical transport document accompanying the supplier's truck.
          </div>
          <div className="p-2 border-b border-slate-100">
            <strong>MOQ (Minimum Order Quantity):</strong> The minimum batch size a vendor accepts for an order.
          </div>
          <div className="p-2 border-b border-slate-100">
            <strong>GSTIN:</strong> 15-digit Goods and Services Tax Identification Number in India.
          </div>
          <div className="p-2 border-b border-slate-100">
            <strong>Input Tax Credit (ITC):</strong> The GST tax paid on business purchases that can be credited against tax liability on sales.
          </div>
          <div className="p-2">
            <strong>Radial Menu:</strong> The quick circular navigation launcher opened by right-clicking on desktop or pressing <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">Ctrl+K</kbd>.
          </div>
        </div>
      ),
    },
  ];

  const activeSection = sections.find(s => s.number === activeSectionNum) || sections[0];

  const filteredSections = sections.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Help & User Guide</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete, plain-language operating manual covering all 21 core workflows in Lofty ERP.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search guide topics..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-md border border-slate-300 px-3 py-1.5 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Guide Layout: Left Table of Contents, Right Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Table of Contents */}
        <div className="md:col-span-4 space-y-1 max-h-[calc(100vh-14rem)] overflow-y-auto pr-2 border-r border-slate-200">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
            Table of Contents (21 Sections)
          </div>
          {filteredSections.map(s => {
            const isSelected = activeSectionNum === s.number;
            return (
              <button
                key={s.number}
                onClick={() => setActiveSectionNum(s.number)}
                className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start space-x-2 ${
                  isSelected
                    ? 'bg-orange-50 text-brand-700 font-semibold border border-orange-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono text-slate-400 shrink-0">{s.number}.</span>
                <span className="truncate">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Section Reading Pane */}
        <div className="md:col-span-8">
          <Card noPadding className="p-6">
            <div className="pb-4 border-b border-slate-100 mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                Section {activeSection.number} of 21
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{activeSection.title}</h2>
              <p className="text-xs text-slate-500 mt-1">{activeSection.summary}</p>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed">
              {activeSection.content}
            </div>

            {/* Next / Previous Navigation */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={activeSection.number === 1}
                onClick={() => setActiveSectionNum(activeSection.number - 1)}
              >
                &larr; Previous Topic
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={activeSection.number === sections.length}
                onClick={() => setActiveSectionNum(activeSection.number + 1)}
              >
                Next Topic &rarr;
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
