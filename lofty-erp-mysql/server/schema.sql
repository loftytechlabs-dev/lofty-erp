-- Lofty ERP Complete Relational Schema for MySQL
CREATE DATABASE IF NOT EXISTS `lofty_erp_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `lofty_erp_db`;

-- 0. Registered Users (Google Auth & Email)
CREATE TABLE IF NOT EXISTS `users` (
  `uid` VARCHAR(128) PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(255) DEFAULT '',
  `photo_url` TEXT,
  `provider_id` VARCHAR(50) DEFAULT 'google.com',
  `phone_number` VARCHAR(50) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB;

-- 1. Businesses
CREATE TABLE IF NOT EXISTS `businesses` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `type` VARCHAR(100) DEFAULT 'Manufacturing',
  `country` VARCHAR(100) DEFAULT 'India',
  `currency_code` VARCHAR(10) DEFAULT 'INR',
  `currency_symbol` VARCHAR(10) DEFAULT '₹',
  `gstin` VARCHAR(50) DEFAULT '',
  `default_tax_rate` DECIMAL(5,2) DEFAULT 18.00,
  `phone` VARCHAR(50) DEFAULT '',
  `email` VARCHAR(255) DEFAULT '',
  `address` TEXT,
  `owner_uid` VARCHAR(128) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Business Members
CREATE TABLE IF NOT EXISTS `business_members` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `uid` VARCHAR(128) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'active',
  `assigned_warehouse_id` VARCHAR(64),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_biz_members` (`business_id`, `uid`)
) ENGINE=InnoDB;

-- 3. Warehouses / Godowns
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `location` TEXT,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_biz_warehouses` (`business_id`)
) ENGINE=InnoDB;

-- 4. Products / Raw Materials
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `unit` VARCHAR(50) NOT NULL,
  `category` VARCHAR(100) DEFAULT '',
  `reorder_threshold` INT DEFAULT 10,
  `tax_rate` DECIMAL(5,2) DEFAULT 18.00,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_biz_products` (`business_id`)
) ENGINE=InnoDB;

-- 5. Vendors / Suppliers
CREATE TABLE IF NOT EXISTS `vendors` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `contact_person` VARCHAR(255) DEFAULT '',
  `email` VARCHAR(255) DEFAULT '',
  `phone` VARCHAR(50) DEFAULT '',
  `address` TEXT,
  `gstin` VARCHAR(50) DEFAULT '',
  `payment_terms` VARCHAR(50) DEFAULT 'Net 30',
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_biz_vendors` (`business_id`)
) ENGINE=InnoDB;

-- 6. Vendor Product Catalog
CREATE TABLE IF NOT EXISTS `vendor_products` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `vendor_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(64) NOT NULL,
  `vendor_price` DECIMAL(12,2) NOT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_biz_vp` (`business_id`, `vendor_id`, `product_id`)
) ENGINE=InnoDB;

-- 7. Purchase Orders
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `order_number` VARCHAR(100) NOT NULL,
  `vendor_id` VARCHAR(64) NOT NULL,
  `vendor_name` VARCHAR(255) NOT NULL,
  `vendor_gstin` VARCHAR(50) DEFAULT '',
  `warehouse_id` VARCHAR(64) NOT NULL,
  `warehouse_name` VARCHAR(255) NOT NULL,
  `subtotal` DECIMAL(12,2) DEFAULT 0.00,
  `tax_total` DECIMAL(12,2) DEFAULT 0.00,
  `grand_total` DECIMAL(12,2) DEFAULT 0.00,
  `status` VARCHAR(50) DEFAULT 'Ordered',
  `expected_delivery_date` DATE,
  `notes` TEXT,
  `created_by` VARCHAR(128) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_biz_pos` (`business_id`, `status`)
) ENGINE=InnoDB;

-- 8. Purchase Order Line Items
CREATE TABLE IF NOT EXISTS `po_line_items` (
  `id` VARCHAR(64) PRIMARY KEY,
  `po_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(64) NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `ordered_quantity` INT NOT NULL,
  `received_quantity` INT DEFAULT 0,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `tax_rate` DECIMAL(5,2) DEFAULT 0.00,
  `line_total` DECIMAL(12,2) NOT NULL,
  `total_with_tax` DECIMAL(12,2) NOT NULL,
  INDEX `idx_po_items` (`po_id`)
) ENGINE=InnoDB;

-- 9. Deliveries
CREATE TABLE IF NOT EXISTS `deliveries` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `po_id` VARCHAR(64) NOT NULL,
  `po_number` VARCHAR(100) NOT NULL,
  `vendor_id` VARCHAR(64),
  `vendor_name` VARCHAR(255),
  `warehouse_id` VARCHAR(64),
  `warehouse_name` VARCHAR(255),
  `status` VARCHAR(50) DEFAULT 'AWAITING_REVIEW',
  `product_verification_status` VARCHAR(50) DEFAULT 'PENDING',
  `bill_verification_status` VARCHAR(50) DEFAULT 'PENDING',
  `owner_confirmation_status` VARCHAR(50) DEFAULT 'NOT_REQUIRED',
  `owner_confirmation_note` TEXT,
  `has_quantity_discrepancy` BOOLEAN DEFAULT FALSE,
  `driver_name` VARCHAR(255),
  `driver_phone` VARCHAR(50),
  `vehicle_number` VARCHAR(50),
  `notes` TEXT,
  `bill_photo_base64` LONGTEXT,
  `verified_by` VARCHAR(128),
  `verified_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_biz_deliveries` (`business_id`, `status`)
) ENGINE=InnoDB;

-- 10. Delivery Items
CREATE TABLE IF NOT EXISTS `delivery_items` (
  `id` VARCHAR(64) PRIMARY KEY,
  `delivery_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(64) NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `ordered_quantity` INT NOT NULL,
  `delivered_quantity` INT NOT NULL,
  `verification_status` VARCHAR(50) DEFAULT 'PENDING',
  `discrepancy_reason` TEXT,
  INDEX `idx_del_items` (`delivery_id`)
) ENGINE=InnoDB;

-- 11. Delivery Dispatch Tokens (QR Portal)
CREATE TABLE IF NOT EXISTS `delivery_tokens` (
  `token` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `po_id` VARCHAR(64) NOT NULL,
  `po_number` VARCHAR(100),
  `vendor_id` VARCHAR(64),
  `vendor_name` VARCHAR(255),
  `warehouse_id` VARCHAR(64),
  `warehouse_name` VARCHAR(255),
  `is_used` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NULL,
  INDEX `idx_tokens` (`token`, `is_used`)
) ENGINE=InnoDB;

-- 12. Supplier Bills (3-Way Match)
CREATE TABLE IF NOT EXISTS `supplier_bills` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `po_id` VARCHAR(64) NOT NULL,
  `po_number` VARCHAR(100) NOT NULL,
  `vendor_id` VARCHAR(64) NOT NULL,
  `vendor_name` VARCHAR(255) NOT NULL,
  `bill_number` VARCHAR(100) NOT NULL,
  `bill_date` DATE,
  `subtotal` DECIMAL(12,2) DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) DEFAULT 0.00,
  `total_amount` DECIMAL(12,2) DEFAULT 0.00,
  `status` VARCHAR(50) DEFAULT 'PENDING',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_biz_bills` (`business_id`, `status`)
) ENGINE=InnoDB;

-- 13. Stock Balances
CREATE TABLE IF NOT EXISTS `stock_balances` (
  `id` VARCHAR(128) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(64) NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `warehouse_id` VARCHAR(64) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 0,
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_biz_stock` (`business_id`, `product_id`, `warehouse_id`)
) ENGINE=InnoDB;

-- 14. Stock Movements
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(64) NOT NULL,
  `warehouse_id` VARCHAR(64) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `quantity` INT NOT NULL,
  `reference_id` VARCHAR(64),
  `reference_type` VARCHAR(50),
  `actor_uid` VARCHAR(128),
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_biz_movements` (`business_id`)
) ENGINE=InnoDB;

-- 15. Payment Records
CREATE TABLE IF NOT EXISTS `payment_records` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `bill_id` VARCHAR(64) NOT NULL,
  `vendor_id` VARCHAR(64) NOT NULL,
  `vendor_name` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL,
  `reference_number` VARCHAR(100),
  `notes` TEXT,
  `recorded_by` VARCHAR(128),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_biz_payments` (`business_id`)
) ENGINE=InnoDB;

-- 16. Canvas Dashboard Widgets (Drag & Drop Persistence)
CREATE TABLE IF NOT EXISTS `canvas_widgets` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `x` INT NOT NULL DEFAULT 24,
  `y` INT NOT NULL DEFAULT 24,
  `w` INT NOT NULL DEFAULT 480,
  `h` INT NOT NULL DEFAULT 300,
  `config` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_biz_widgets` (`business_id`)
) ENGINE=InnoDB;

-- 17. Notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `entity_id` VARCHAR(64),
  `entity_type` VARCHAR(64),
  `is_read` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_biz_notifs` (`business_id`, `is_read`)
) ENGINE=InnoDB;

-- 18. Audit Logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(64) PRIMARY KEY,
  `business_id` VARCHAR(64) NOT NULL,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` VARCHAR(64) NOT NULL,
  `actor_uid` VARCHAR(128) NOT NULL,
  `details` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_biz_audit` (`business_id`)
) ENGINE=InnoDB;
