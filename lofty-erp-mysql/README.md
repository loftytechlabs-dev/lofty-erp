# Lofty ERP — MySQL Edition 🚀

Complete replica of **Lofty ERP** powered by a **MySQL relational database** and an **Express REST API backend**, maintaining all features:
- **Operations Command Center:** Key performance indicators, financial analytics, inventory health, and pipeline management.
- **Drag & Drop Chart Canvas Studio:** Real-time draggable & resizable cards, snap-to-grid, live spend donuts/bars, stock thresholds, and MySQL layout persistence.
- **Gemini AI Copilot:** Natural language operations analyst powered by the Gemini API (`gemini-2.5-flash`), with automated canvas card addition and layout execution.
- **Operations Deck Studio (PPT):** 6-slide executive presentation generator from real operational charts and inventory, with 16:9 preview and direct `.pptx` PowerPoint export (`pptxgenjs`).
- **Complete Procurement & Delivery Lifecycle:** 4-step PO wizard, vendor product catalog, QR token dispatch portal, driver arrival & receipt inspection, discrepancy approval gate, base64 bill photo storage, and 3-way invoice matching.

---

## 🗄️ MySQL Database Architecture (`lofty_erp_db`)

The database contains 18 normalized relational tables defined in `server/schema.sql`:

1. `businesses`: Multi-tenant business entities with currency and GSTIN settings.
2. `business_members`: User assignments with role-based access (Owner, Warehouse, Manager, Driver).
3. `warehouses`: Physical godowns, codes, and location identifiers.
4. `products`: Raw materials, SKUs, units, and safety reorder thresholds.
5. `vendors`: Supplier partners, GSTINs, payment terms, and contact profiles.
6. `vendor_products`: Vendor catalog pricing linked to products.
7. `purchase_orders`: Committed purchase orders with subtotals, GST breakdown, and statuses.
8. `po_line_items`: Individual items ordered and received counts.
9. `deliveries`: Physical inbound delivery logs, inspection status, discrepancy flags, and base64 bill photos.
10. `delivery_items`: Delivered quantities vs ordered quantities.
11. `delivery_tokens`: Secure dispatch tokens for external driver QR delivery portal.
12. `supplier_bills`: Supplier invoices for 3-way reconciliation audit.
13. `stock_balances`: On-hand physical inventory per product and warehouse.
14. `stock_movements`: Immutable stock transaction ledger (inbound, outbound, adjustment).
15. `payment_records`: Accounts payable settlement records.
16. `canvas_widgets`: Drag-and-drop interactive canvas cards and coordinate persistence.
17. `notifications`: Alert notifications (discrepancies, low stock, approval requests).
18. `audit_logs`: Timestamped system audit events.

---

## ⚙️ Quick Start

### 1. Configure MySQL
Ensure MySQL is running locally (e.g. Homebrew MySQL or Docker):
```bash
mysql -u root -p
```

Create the database and seed it with initial real data:
```bash
npm run db:setup
```
*(Or manually: `mysql -u root -p < server/schema.sql && node server/seed.js`)*

### 2. Environment Variables
Verify `.env`:
```env
PORT=5001
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=lofty_erp_db
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Application
Run backend Express server + Vite frontend concurrently:
```bash
npm run dev
```

Or run them individually in separate terminals:
```bash
# Terminal 1: Backend Express Server
npm run server    # Runs on http://localhost:5001

# Terminal 2: Frontend Vite Client
npm run client    # Runs on http://localhost:5174
```

---

## 🔌 Express REST API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check and MySQL connectivity test |
| `/api/businesses` | `GET`, `POST` | List and create business profiles |
| `/api/businesses/:id/products` | `GET`, `POST` | Manage products and reorder thresholds |
| `/api/businesses/:id/vendors` | `GET`, `POST` | Manage supplier partners |
| `/api/businesses/:id/purchase-orders` | `GET`, `POST` | List and create POs with line items |
| `/api/businesses/:id/deliveries` | `GET`, `POST` | Manage inbound deliveries and bill photos |
| `/api/businesses/:id/stock-balances` | `GET` | Physical warehouse inventory balances |
| `/api/businesses/:id/bills` | `GET`, `POST` | Supplier bills for 3-way match |
| `/api/businesses/:id/canvas-widgets` | `GET`, `POST` | Retrieve and persist drag-and-drop dashboard canvas layout |

---

## 📦 Project Structure

```
lofty-erp-mysql/
├── server/
│   ├── db.js          # MySQL2 connection pool
│   ├── schema.sql     # Complete relational database DDL
│   ├── seed.js        # Seed script populating initial business data
│   └── index.js       # Express REST API backend server
├── src/
│   ├── components/    # Reusable UI & Dashboard Canvas components
│   ├── contexts/      # Auth & Business state providers
│   ├── pages/         # Full application views (Purchases, Inventory, Deliveries, Bills)
│   ├── services/      # MySQL API client & presentation services
│   └── types/         # TypeScript interfaces
├── .env               # Environment configuration
├── package.json       # Project dependencies & scripts
└── vite.config.ts     # Vite bundler with API reverse-proxy
```
