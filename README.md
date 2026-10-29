# LOFTY ERP — Production Business Operations

**Lofty ERP** is a modern, responsive web application and installable Progressive Web App (PWA) built specifically for small businesses and small manufacturers.

It simplifies everyday operational cycles: vendor management, vendor-specific product catalogs, 4-step purchase order issuance, mobile QR-based delivery check-ins, independent physical vs. financial verification, atomic inventory movements, supplier bills, payment records, and GST tracking.

---

## 🌟 Key Features

1. **Google Sign-In & Onboarding:**
   - Passwordless sign-in through Firebase Authentication.
   - Post-login onboarding: *"How will you use Lofty ERP?"* (Role intention without insecure auto-elevation).
   - Multi-tenant business isolation with instant business switcher (no logout required).

2. **5 Business Roles:**
   - **Owner:** Full enterprise settings, team invitations, and complete operational authority.
   - **Manager:** Operational oversight across purchases, warehouse receipts, and bill checks.
   - **Purchasing:** Vendor catalog price negotiations and Purchase Order management.
   - **Warehouse:** QR delivery generation, physical count inspections, sound vs damaged goods recording.
   - **Accountant:** Reviewing supplier invoices against POs, GST tax breakdowns, payment remittance.

3. **Vendor-Specific Product Catalogs (Mandatory):**
   - Products are defined centrally (name, SKU, unit, category, tax bracket).
   - Purchase prices, MOQs, and lead times are negotiated and assigned per vendor.
   - A single material can be supplied by multiple vendors at different agreed prices.
   - Historical purchase orders preserve their agreed pricing even if catalog rates change.

4. **Guided 4-Step Purchase Order Wizard:**
   - Step 1: Select Vendor
   - Step 2: Add Products (only eligible catalog items at agreed prices)
   - Step 3: Delivery Details (Godown destination & expected delivery date)
   - Step 4: Review and Issue (subtotal, CGST, SGST, IGST, grand total)

5. **QR Delivery Registration (Mobile Carrier Check-In):**
   - Generates unpredictable, scoped 48-hour delivery tokens.
   - Delivery drivers scan the QR code at the gate with any smartphone.
   - Standalone web check-in portal opens directly in mobile browser without requiring an app installation or login.
   - Carrier enters challan number, date, vehicle number, and delivered quantities.

6. **Dual Independent Verification:**
   - **Physical Product Verification:** Physical goods counting by godown staff (ordered vs delivered vs accepted sound goods vs rejected/damaged goods). **Only accepted physical quantities update warehouse inventory balances.**
   - **Supplier Bill Verification:** Financial review of supplier invoices against PO terms. Highlight mismatches. Actions: *Accept*, *Reject (with reason)*, or *Request Correction*. **Bill approval never modifies inventory balances.**

7. **Distinctive Desktop Radial Right-Click Menu:**
   - Right-click anywhere in the workspace or press <kbd>Ctrl+K</kbd> to launch the edge-aware circular navigation launcher.
   - Touch-friendly bottom navigation bar on mobile phones.

8. **Serverless Mail Dispatcher via Google Apps Script (Zero Cloud Functions Needed):**
   - Pure client-side Firestore architecture.
   - Includes ready-to-deploy Google Apps Script (`google-apps-script/Code.gs`) that runs free inside Google Apps Script to send emails via Gmail/Google Workspace for invitations, PO dispatches, delivery notifications, bill corrections, and payment remittance receipts.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Configuration (`.env`)
Copy `.env.example` to `.env` or `.env.local` and configure your credentials:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=1:your-app-id:web:your-app-code
VITE_FIREBASE_USE_EMULATOR=false
VITE_USE_DEMO_MODE=false
VITE_MAIL_WEBHOOK_URL=
```

### 3. Deploy Free Google Apps Script Mailer (Optional)
To enable automated emails without third-party mail costs or Cloud Functions:
1. Open [script.google.com](https://script.google.com/) and create a new project.
2. Copy the contents of [`google-apps-script/Code.gs`](file:///Users/akhilesh/Documents/lofty-erp/google-apps-script/Code.gs) into `Code.gs`.
3. Click **Deploy** &rarr; **New deployment** &rarr; Select type **Web app**.
4. Set *Execute as:* **Me** and *Who has access:* **Anyone**.
5. Copy the generated Web App URL and paste it as `VITE_MAIL_WEBHOOK_URL` in `.env`.

### 4. Running Locally

```bash
# Run local development server
npm run dev

# Run automated test suite (Vitest)
npm run test

# Run production build (TypeScript check + Vite production bundle)
npm run build
```

---

## 📋 Master Worked Example

The application includes a standard worked example for training and verification:
- **Order:** 60 Teak Wooden Planks at ₹100 each before tax from *Western Timber & Forest Supplies*.
- **Pre-tax Subtotal:** ₹6,000 | **18% GST:** ₹1,080 | **Grand Total:** ₹7,080.
- **Physical Delivery:** Truck arrives under Challan `DC/WT/8892`.
- **Physical Inspection:** Gate inspection accepts 55 sound planks and rejects 5 split/damaged planks.
- **Inventory Balance:** Only 55 planks enter Godown 1 stock.
- **Supplier Bill:** Western Timber bills for 60 planks (₹7,080). Accounts department requests correction for the 5 defective planks.
- **Inspect Live:** Available directly under `PO-2026-0101` in the app.

---

## 🔒 Security & Firestore Rules

`firestore.rules` enforces multi-tenant tenant isolation and role restrictions. Data is scoped strictly under `/businesses/{businessId}/...` and documents can only be accessed by authenticated members of that business.
