-- =====================================================================
-- KETOKO POS SEED SCRIPT
-- Default Tenant, Admin Account & Indonesian Retail Inventory
-- =====================================================================

-- 1. Insert Company Tenant (ID 99999)
INSERT INTO companies (id, name, branch_name, phone, address, tax_enabled, tax_rate, receipt_header, receipt_footer)
VALUES (
    '99999',
    'TOKO BERKAH SEJAHTERA',
    'Cabang Utama Jakarta',
    '(021) 4589-1234',
    'Jl. Boulevard Raya Blok A2 No. 10, Kelapa Gading',
    FALSE,
    11.00,
    'Selamat Datang di Toko Berkah',
    'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.\nTerima Kasih Atas Kunjungan Anda!'
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert User (ID: ADMIN, Password: 99999psfdv)
-- password_hash adalah hash bcrypt asli dari '99999psfdv' (10 rounds).
-- Untuk mengganti password: npm run hash-password -- "password-baru" (dari folder server/).
INSERT INTO users (company_id, user_id, name, password_hash, role)
VALUES (
    '99999',
    'ADMIN',
    'ADMINISTRATOR',
    '$2a$10$JCaQJhLCyM9OyVRXRHYNIeYXq2gDCUFNjpYaJjGcmI0tAOY3zDGIG',
    'ADMIN'
) ON CONFLICT ON CONSTRAINT uq_company_userid DO NOTHING;

-- 3. Categories
INSERT INTO categories (id, company_id, name) VALUES
('cat-makanan', '99999', 'Makanan Instan'),
('cat-minuman', '99999', 'Minuman Dingin & Panas'),
('cat-sembako', '99999', 'Sembako & Bumbu'),
('cat-snack', '99999', 'Snack & Biskuit'),
('cat-perawatan', '99999', 'Perawatan Tubuh'),
('cat-rokok', '99999', 'Rokok & Tembakau')
ON CONFLICT (id) DO NOTHING;

-- 4. Sample Products
INSERT INTO products (company_id, code, barcode, name, category_id, unit, cost_price, sell_price, wholesale_price, stock, min_stock) VALUES
('99999', 'MKN-001', '899999900101', 'Indomie Goreng Spesial 85g', 'cat-makanan', 'Bks', 2800, 3500, 3200, 140, 20),
('99999', 'MNM-001', '899999900201', 'Aqua Air Mineral Botol 600ml', 'cat-minuman', 'Btl', 3000, 4500, 3800, 180, 30),
('99999', 'SMB-001', '899999900301', 'Minyak Goreng Sania Pouch 2 Liter', 'cat-sembako', 'Pouch', 32000, 38000, 35500, 50, 10),
('99999', 'SNK-001', '899999900401', 'Chitato Sapi Panggang 68g', 'cat-snack', 'Bks', 9000, 12000, 10800, 35, 8),
('99999', 'PRW-001', '899999900501', 'Sabun Mandi Lifebuoy Total 10', 'cat-perawatan', 'Batang', 3800, 5000, 4400, 60, 12),
('99999', 'RKK-001', '899999900701', 'Sampoerna A Mild 16 Batang', 'cat-rokok', 'Bks', 33500, 36000, 35000, 80, 20)
ON CONFLICT ON CONSTRAINT uq_company_barcode DO NOTHING;

-- 5. Customers
INSERT INTO customers (company_id, code, name, phone, tier, discount_percent, points) VALUES
('99999', 'PLG-0000', 'Umum (Walk-in)', '-', 'UMUM', 0, 0),
('99999', 'PLG-0001', 'Budi Santoso', '081234567890', 'MEMBER_GOLD', 5.00, 350),
('99999', 'PLG-0002', 'Siti Rahmawati', '085678912345', 'MEMBER_SILVER', 2.00, 120),
('99999', 'PLG-0003', 'Toko Berkah Bersama (Mitra Grosir)', '081398765432', 'GROSIR', 8.00, 1250);
