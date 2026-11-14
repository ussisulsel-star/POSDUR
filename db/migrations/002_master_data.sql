-- =====================================================================
-- 002: MASTER DATA, OUTLET, USER METADATA & PENGATURAN POIN
-- Idempoten: aman dijalankan berulang pada database yang sudah ada.
-- =====================================================================

-- 1. OUTLET / CABANG
CREATE TABLE IF NOT EXISTS outlets (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    address TEXT,
    phone VARCHAR(50),
    city VARCHAR(100),
    is_hq BOOLEAN NOT NULL DEFAULT FALSE,
    is_mall BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_outlets_company_code
    ON outlets(company_id, code);

-- 2. BRAND PRODUK
CREATE TABLE IF NOT EXISTS brands (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    tagline VARCHAR(255),
    emoji VARCHAR(20),
    color_key VARCHAR(30) NOT NULL DEFAULT 'blue',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_company_name
    ON brands(company_id, name);

-- 3. KOLOM TAMBAHAN PRODUK (brand, harga mall, paket, stok per outlet)
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sell_price_mall NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS image TEXT,
    ADD COLUMN IF NOT EXISTS is_package BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS package_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS outlet_stocks JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_brand
    ON products(company_id, brand);

-- 4. METADATA USER (akses outlet, PIN, permission granular)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS allowed_outlet_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS can_access_all_outlets BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- 5. PENGATURAN POIN PER PERUSAHAAN
CREATE TABLE IF NOT EXISTS point_settings (
    company_id VARCHAR(50) PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    active_from DATE,
    active_until DATE,
    redeem_value NUMERIC(15,2) NOT NULL DEFAULT 100,
    min_redeem_points INTEGER NOT NULL DEFAULT 10,
    product_points JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. KOLOM TAMBAHAN TRANSAKSI & SHIFT
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS points_redeemed INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS point_discount NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE pos_shifts
    ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_transactions_outlet
    ON transactions(company_id, outlet_id);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_outlet
    ON pos_shifts(company_id, outlet_id);
