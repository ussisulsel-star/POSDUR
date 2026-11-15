// Generate db/seeds/002_master_data.sql dari scripts/products-raw.tsv
// Jalankan: node scripts/generate-master-seed.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const rawPath = path.join(__dirname, 'products-raw.tsv');
const outPath = path.join(rootDir, 'db', 'seeds', '002_master_data.sql');

const CATEGORY_ORDER = [
  'Dine In',
  'Snack',
  'Food',
  'Take Away',
  'Djoes Reg',
  'Drink',
  'Topping',
  'Grab',
  'Shopee',
  'Gojek',
  'DI/TA',
];

const CATEGORY_ID = {
  'Dine In': 'cat-dine-in',
  Snack: 'cat-snack',
  Food: 'cat-food',
  'Take Away': 'cat-take-away',
  'Djoes Reg': 'cat-djoes-reg',
  Drink: 'cat-drink',
  Topping: 'cat-topping',
  Grab: 'cat-grab',
  Shopee: 'cat-shopee',
  Gojek: 'cat-gojek',
  'DI/TA': 'cat-di-ta',
};

const OUTLETS = [
  ['out-001', 'CAB-001', 'Pattiro Seruni', 'Es Teler Pattiro', 'Jl. Seruni Makassar', '-', 'Makassar', true, false],
  ['out-002', 'CAB-002', 'Pattiro Aroepala', 'Es Teler Pattiro', 'Jl. Aroepala Makassar', '-', 'Makassar', false, false],
  ['out-003', 'CAB-003', 'Pattiro Andi Jemma', 'Es Teler Pattiro', 'Jl. A. Djemma Makassar', '-', 'Makassar', false, false],
  ['out-004', 'CAB-004', 'Pattiro BTP', 'Es Teler Pattiro', 'Jl. BTP Makassar', '-', 'Makassar', false, false],
  ['out-005', 'CAB-005', 'Pattiro Gowa', 'Es Teler Pattiro', 'Jl. Sultan Hasanuddin Gowa', '-', 'Gowa', false, false],
  ['out-006', 'CAB-006', 'Pattiro Dg Tata', 'Es Teler Pattiro', 'Jl. Dg Tata Makassar', '-', 'Makassar', false, false],
  ['out-007', 'CAB-007', 'Pattiro Tupai', 'Es Teler Pattiro', 'Jl. Tupai Makassar', '-', 'Makassar', false, false],
  ['out-008', 'CAB-008', 'Del Manggo MP', 'Del Mango', 'Mall Panakkukang Makassar', '-', 'Makassar', false, true],
  ['out-009', 'CAB-009', 'Del Manggo Aroepala', 'Del Mango', 'Jl. Areopala Makassar', '-', 'Makassar', false, false],
  ['out-010', 'CAB-010', 'Koala Hertasning', 'Es Tes Koala', 'Jl. Hertasning Makassar', '-', 'Makassar', false, false],
  ['out-011', 'CAB-011', 'Koala Pongtiku', 'Es Tes Koala', 'Jl. Pongtiku Makassar', '-', 'Makassar', false, false],
  ['out-012', 'CAB-012', 'Donat Halus Gowa', 'Donat Halus', 'Jl. Sultan Hasanuddin Gowa', '-', 'Gowa', false, false],
];

// Kolom emoji sengaja dibiarkan kosong di seed agar file SQL tetap ASCII.
// Cluster PostgreSQL lokal (Windows) memakai encoding WIN1252 sehingga karakter
// emoji gagal disimpan. Emoji brand dapat diisi/diubah lewat menu Master Brand.
const BRANDS = [
  ['brand-del-mango', 'Del Mango', 'Olahan Mangga Segar, Smoothie & Dessert', '', 'amber'],
  ['brand-es-teler-pattiro', 'Es Teler Pattiro', 'Es Teler Tradisional & Minuman Nusantara', '', 'emerald'],
  ['brand-donat-halus', 'Donat Halus', 'Donat Lembut Artisan & Pastry Kekinian', '', 'pink'],
  ['brand-es-tes-koala', 'Es Tes Koala', 'Minuman Segar & Es Buah Kekinian', '', 'cyan'],
];

const PRODUCT_BRAND = 'Es Teler Pattiro';

const normalizeText = (value) => value.trim().replace(/\s+/g, ' ');

const parseIdr = (value) => {
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Harga tidak valid: "${value}"`);
  }
  return Math.round(parsed);
};

const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
const bool = (value) => (value ? 'TRUE' : 'FALSE');

const raw = fs.readFileSync(rawPath, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
const firstLine = lines[0].split('\t');
const hasHeader = normalizeText(firstLine[0]).toLowerCase() === 'kode item';
const dataLines = hasHeader ? lines.slice(1) : lines;

const rows = dataLines.map((line, index) => {
  const columns = line.split('\t');
  if (columns.length !== 7) {
    throw new Error(`Baris ${index + 2} memiliki ${columns.length} kolom (harus 7).`);
  }

  const [code, name, category, , unit, outletPrice, mallPrice] = columns;
  const normalizedCategory = normalizeText(category);

  if (!CATEGORY_ID[normalizedCategory]) {
    throw new Error(`Kategori tidak dikenal: "${normalizedCategory}" pada baris ${index + 2}.`);
  }

  const numericCode = code.replace(/\D/g, '').padStart(8, '0');

  return {
    code: normalizeText(code),
    barcode: `8999${numericCode}`,
    name: normalizeText(name),
    categoryId: CATEGORY_ID[normalizedCategory],
    unit: normalizeText(unit),
    sellPrice: parseIdr(outletPrice),
    sellPriceMall: parseIdr(mallPrice),
  };
});

const outletValues = OUTLETS.map(
  ([id, code, name, brand, address, phone, city, isHq, isMall]) =>
    `(${quote(id)}, '001', ${quote(code)}, ${quote(name)}, ${quote(brand)}, ${quote(
      address,
    )}, ${quote(phone)}, ${quote(city)}, ${bool(isHq)}, ${bool(isMall)}, TRUE)`,
).join(',\n');

const brandValues = BRANDS.map(
  ([id, name, tagline, emoji, colorKey]) =>
    `(${quote(id)}, '001', ${quote(name)}, ${quote(tagline)}, ${quote(emoji)}, ${quote(
      colorKey,
    )}, TRUE)`,
).join(',\n');

const categoryValues = [
  ['cat-all', 'Semua'],
  ...CATEGORY_ORDER.map((name) => [CATEGORY_ID[name], name]),
]
  .map(([id, name]) => `(${quote(id)}, '001', ${quote(name)})`)
  .join(',\n');

const productValues = rows
  .map(
    (row) =>
      `('001', ${quote(row.code)}, ${quote(row.barcode)}, ${quote(row.name)}, ${quote(
        row.categoryId,
      )}, ${quote(PRODUCT_BRAND)}, ${quote(row.unit)}, 0, ${row.sellPrice}, ${
        row.sellPriceMall
      }, ${row.sellPrice}, 100, 10)`,
  )
  .join(',\n');

const year = new Date().getFullYear();

const sql = `-- =====================================================================
-- 002: SEED MASTER DATA (OUTLET, BRAND, KATEGORI, PRODUK, POIN)
-- Dihasilkan oleh scripts/generate-master-seed.mjs - jangan edit manual.
-- Idempoten: seluruh INSERT memakai ON CONFLICT DO NOTHING.
-- =====================================================================

-- 1. Outlet / cabang
INSERT INTO outlets
    (id, company_id, code, name, brand, address, phone, city, is_hq, is_mall, is_active)
VALUES
${outletValues}
ON CONFLICT (id) DO NOTHING;

-- 2. Brand produk
INSERT INTO brands
    (id, company_id, name, tagline, emoji, color_key, is_active)
VALUES
${brandValues}
ON CONFLICT (id) DO NOTHING;

-- 3. Kategori produk
INSERT INTO categories (id, company_id, name)
VALUES
${categoryValues}
ON CONFLICT (id) DO NOTHING;

-- 4. Katalog produk (${rows.length} item)
INSERT INTO products
    (company_id, code, barcode, name, category_id, brand, unit,
     cost_price, sell_price, sell_price_mall, wholesale_price, stock, min_stock)
VALUES
${productValues}
ON CONFLICT ON CONSTRAINT uq_company_code DO NOTHING;

-- 5. Pengaturan poin awal
INSERT INTO point_settings
    (company_id, enabled, active_from, active_until, redeem_value, min_redeem_points, product_points)
VALUES
    ('001', TRUE, '${year}-01-01', '${year}-12-31', 100, 10, '{}'::jsonb)
ON CONFLICT (company_id) DO NOTHING;

-- 6. Metadata admin tenant demo: akses seluruh outlet & permission penuh
UPDATE users
   SET outlet_id = COALESCE(outlet_id, 'out-001'),
       allowed_outlet_ids = CASE
         WHEN allowed_outlet_ids = '[]'::jsonb THEN
           '["out-001","out-002","out-003","out-004","out-005","out-006","out-007","out-008","out-009","out-010","out-011","out-012"]'::jsonb
         ELSE allowed_outlet_ids
       END,
       can_access_all_outlets = TRUE,
       permissions = CASE
         WHEN permissions = '{}'::jsonb THEN
           '{"canDiscount":true,"canVoid":true,"canReturn":true,"canOpenDrawer":true,"canViewReports":true,"canEditPrice":true}'::jsonb
         ELSE permissions
       END
 WHERE company_id = '001' AND user_id = 'ADMIN';
`;

fs.writeFileSync(outPath, sql, 'utf8');

console.log(`Berhasil membuat ${path.relative(rootDir, outPath)}`);
console.log(`  Outlet   : ${OUTLETS.length}`);
console.log(`  Brand    : ${BRANDS.length}`);
console.log(`  Kategori : ${CATEGORY_ORDER.length + 1}`);
console.log(`  Produk   : ${rows.length}`);
