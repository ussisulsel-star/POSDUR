// Generate src/data/productSeed.ts dari scripts/products-raw.tsv
// Jalankan: node scripts/generate-product-seed.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const rawPath = path.join(__dirname, 'products-raw.tsv');
const outPath = path.join(rootDir, 'src', 'data', 'productSeed.ts');

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
  'Snack': 'cat-snack',
  'Food': 'cat-food',
  'Take Away': 'cat-take-away',
  'Djoes Reg': 'cat-djoes-reg',
  Drink: 'cat-drink',
  Topping: 'cat-topping',
  Grab: 'cat-grab',
  Shopee: 'cat-shopee',
  Gojek: 'cat-gojek',
  'DI/TA': 'cat-di-ta',
};

const normalizeText = (value) => value.trim().replace(/\s+/g, ' ');

const parseIdr = (value) => {
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Harga tidak valid: "${value}"`);
  }
  return Math.round(parsed);
};

const quote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const raw = fs.readFileSync(rawPath, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

if (lines.length < 1) {
  throw new Error('File products-raw.tsv kosong atau tidak memiliki data.');
}

// File mentah boleh menyertakan baris header atau tidak.
const firstLine = lines[0].split('\t');
const hasHeader = normalizeText(firstLine[0]).toLowerCase() === 'kode item';
const dataLines = hasHeader ? lines.slice(1) : lines;

const rows = dataLines.map((line, index) => {
  const columns = line.split('\t');
  if (columns.length !== 7) {
    throw new Error(`Baris ${index + 2} memiliki ${columns.length} kolom (harus 7).`);
  }

  const [code, name, category, brand, unit, outletPrice, mallPrice] = columns;
  const normalizedCategory = normalizeText(category);

  if (!CATEGORY_ID[normalizedCategory]) {
    throw new Error(`Kategori tidak dikenal: "${normalizedCategory}" pada baris ${index + 2}.`);
  }

  return {
    code: normalizeText(code),
    name: normalizeText(name),
    categoryName: normalizedCategory,
    categoryId: CATEGORY_ID[normalizedCategory],
    brand: normalizeText(brand),
    unit: normalizeText(unit),
    sellPrice: parseIdr(outletPrice),
    sellPriceMall: parseIdr(mallPrice),
  };
});

const seenCodes = new Set();
for (const row of rows) {
  if (seenCodes.has(row.code)) {
    throw new Error(`Kode item duplikat: ${row.code}`);
  }
  seenCodes.add(row.code);
}

const usedCategories = new Set(rows.map((row) => row.categoryName));
const missingCategories = CATEGORY_ORDER.filter((category) => !usedCategories.has(category));
const extraCategories = [...usedCategories].filter((category) => !CATEGORY_ORDER.includes(category));

if (missingCategories.length > 0) {
  throw new Error(`Kategori berikut tidak dipakai produk: ${missingCategories.join(', ')}`);
}
if (extraCategories.length > 0) {
  throw new Error(`Kategori di luar daftar: ${extraCategories.join(', ')}`);
}

const productEntries = rows
  .map((row) => {
    const numericCode = row.code.replace(/\D/g, '').padStart(8, '0');
    const id = `prod-${row.code.toLowerCase()}`;
    const barcode = `8999${numericCode}`;

    return `  {
    id: ${quote(id)},
    barcode: ${quote(barcode)},
    code: ${quote(row.code)},
    name: ${quote(row.name)},
    brand: ${quote(row.brand)},
    categoryId: ${quote(row.categoryId)},
    categoryName: ${quote(row.categoryName)},
    unit: ${quote(row.unit)},
    costPrice: 0,
    sellPrice: ${row.sellPrice},
    sellPriceMall: ${row.sellPriceMall},
    wholesalePrice: ${row.sellPrice},
    stock: 100,
    minStock: 10,
    isPackage: false,
  },`;
  })
  .join('\n');

const categoryEntries = [
  "  { id: 'cat-all', name: 'Semua' },",
  ...CATEGORY_ORDER.map(
    (category) => `  { id: ${quote(CATEGORY_ID[category])}, name: ${quote(category)} },`,
  ),
].join('\n');

const output = `// File ini digenerate dari scripts/products-raw.tsv.
// Jangan edit manual; ubah data mentah lalu jalankan:
//   node scripts/generate-product-seed.mjs
import { Category, Product } from '../types/pos';

export const INITIAL_CATEGORIES: Category[] = [
${categoryEntries}
];

export const INITIAL_PRODUCTS: Product[] = [
${productEntries}
];
`;

fs.writeFileSync(outPath, output, 'utf8');

console.log(`Berhasil membuat ${path.relative(rootDir, outPath)}`);
console.log(`  Kategori : ${CATEGORY_ORDER.length + 1} (termasuk "Semua")`);
console.log(`  Produk   : ${rows.length}`);
