-- =====================================================================
-- KETOKO POS MIGRATION SCRIPT (PostgreSQL 14+)
-- Multi-Tenant Point of Sale Database Schema
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPANIES (Multi-Tenant Master)
CREATE TABLE companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255) DEFAULT 'Cabang Utama',
    phone VARCHAR(50),
    address TEXT,
    tax_enabled BOOLEAN DEFAULT FALSE,
    tax_rate NUMERIC(5,2) DEFAULT 11.00,
    receipt_header TEXT,
    receipt_footer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS (Kasir & Admin Authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'KASIR', -- 'ADMIN', 'KASIR', 'SUPERVISOR'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_company_userid UNIQUE (company_id, user_id)
);

-- 3. PRODUCT CATEGORIES
CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(100)
);

-- 4. PRODUCTS (Barang & Persediaan)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category_id VARCHAR(50) REFERENCES categories(id),
    unit VARCHAR(50) NOT NULL DEFAULT 'Pcs',
    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    sell_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    wholesale_price NUMERIC(15,2) DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_company_barcode UNIQUE (company_id, barcode),
    CONSTRAINT uq_company_code UNIQUE (company_id, code)
);

CREATE INDEX idx_products_barcode ON products(company_id, barcode);
CREATE INDEX idx_products_name ON products(company_id, name);

-- 5. CUSTOMERS & MEMBERS
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    tier VARCHAR(50) NOT NULL DEFAULT 'UMUM', -- 'UMUM', 'MEMBER_SILVER', 'MEMBER_GOLD', 'GROSIR'
    discount_percent NUMERIC(5,2) DEFAULT 0,
    points INTEGER DEFAULT 0,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_code ON customers(company_id, code);

-- 6. POS SHIFTS (Sesi Kasir & Buka-Tutup Laci)
CREATE TABLE pos_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shift_number INTEGER NOT NULL,
    cashier_id UUID NOT NULL REFERENCES users(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    initial_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_non_cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_cash_in NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_cash_out NUMERIC(15,2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(15,2),
    cash_difference NUMERIC(15,2),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
    notes TEXT
);

-- 7. CASH MOVEMENTS (Kas Operasional Masuk & Keluar)
CREATE TABLE cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES pos_shifts(id),
    type VARCHAR(20) NOT NULL, -- 'MASUK', 'KELUAR'
    amount NUMERIC(15,2) NOT NULL,
    reason TEXT NOT NULL,
    cashier_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TRANSACTIONS (Nota Penjualan POS)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_no VARCHAR(100) NOT NULL,
    shift_id UUID REFERENCES pos_shifts(id),
    cashier_id UUID REFERENCES users(id),
    cashier_name VARCHAR(100) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(255) NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL,
    discount_total NUMERIC(15,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(15,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15,2) NOT NULL,
    pay_amount NUMERIC(15,2) NOT NULL,
    change_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'LUNAS', -- 'LUNAS', 'PIUTANG', 'BATAL'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_company_invoice UNIQUE (company_id, invoice_no)
);

CREATE INDEX idx_transactions_invoice ON transactions(company_id, invoice_no);
CREATE INDEX idx_transactions_created ON transactions(company_id, created_at);

-- 9. TRANSACTION ITEMS
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    qty INTEGER NOT NULL,
    unit VARCHAR(50) NOT NULL,
    cost_price NUMERIC(15,2) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    discount_rp NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15,2) NOT NULL
);

-- 10. PAYMENTS (Multi Payment Support)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL, -- 'TUNAI', 'QRIS', 'DEBIT', 'KREDIT', 'TRANSFER', 'PIUTANG'
    amount NUMERIC(15,2) NOT NULL,
    bank_name VARCHAR(50),
    card_last_four VARCHAR(10),
    trace_number VARCHAR(100),
    qr_ref VARCHAR(100),
    due_date DATE
);

-- 11. HELD ORDERS (Tahan Transaksi / Park Bill)
CREATE TABLE held_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    hold_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    subtotal NUMERIC(15,2) NOT NULL,
    items_json JSONB NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. SALES RETURNS (Retur Penjualan)
CREATE TABLE sales_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    return_no VARCHAR(100) NOT NULL,
    invoice_no VARCHAR(100) NOT NULL,
    total_refund NUMERIC(15,2) NOT NULL,
    refund_method VARCHAR(50) NOT NULL,
    cashier_name VARCHAR(100) NOT NULL,
    items_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
