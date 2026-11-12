import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const tsvPath = path.join(__dirname, 'products-raw.tsv');
const seedPath = path.join(rootDir, 'src', 'data', 'productSeed.ts');
const dataPath = path.join(rootDir, 'src', 'data', 'seedData.ts');

const normalize = (value) => value.trim().replace(/\s+/g, ' ');
const parseIdr = (value) => Math.round(Number.parseFloat(value.trim().replace(/\./g, '').replace(',', '.')));

const tsvRows = fs
  .readFileSync(tsvPath, 'utf8')
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/)
  .filter((line) => line.trim())
  .map((line) => {
    const [code, name, category, brand, unit, outletPrice, mallPrice] = line.split('\t');
    return {
      code: normalize(code),
      name: normalize(name),
      category: normalize(category),
      brand: normalize(brand),
      unit: normalize(unit),
      sellPrice: parseIdr(outletPrice),
      sellPriceMall: parseIdr(mallPrice),
    };
  });

const seed = fs.readFileSync(seedPath, 'utf8');
const productSection = seed.slice(seed.indexOf('export const INITIAL_PRODUCTS'));
const productBlocks = [...productSection.matchAll(/\{\n([\s\S]*?)\n  \},/g)].map((match) => match[1]);
const field = (block, key) => {
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${key}: '([^']*)'`));
  if (!match) throw new Error(`Field ${key} tidak ditemukan pada blok produk.`);
  return match[1];
};
const numberField = (block, key) => {
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${key}: (\\d+)`));
  if (!match) throw new Error(`Field ${key} tidak ditemukan pada blok produk.`);
  return Number.parseInt(match[1], 10);
};

const products = productBlocks.map((block) => ({
  id: field(block, 'id'),
  barcode: field(block, 'barcode'),
  code: field(block, 'code'),
  name: field(block, 'name'),
  brand: field(block, 'brand'),
  categoryId: field(block, 'categoryId'),
  categoryName: field(block, 'categoryName'),
  unit: field(block, 'unit'),
  sellPrice: numberField(block, 'sellPrice'),
  sellPriceMall: numberField(block, 'sellPriceMall'),
  wholesalePrice: numberField(block, 'wholesalePrice'),
  costPrice: numberField(block, 'costPrice'),
  stock: numberField(block, 'stock'),
}));

const categorySection = seed.slice(
  seed.indexOf('export const INITIAL_CATEGORIES'),
  seed.indexOf('export const INITIAL_PRODUCTS'),
);
const categories = [...categorySection.matchAll(/\{ id: '([^']+)', name: '([^']+)' \}/g)].map((match) => ({
  id: match[1],
  name: match[2],
}));

const errors = [];

if (tsvRows.length !== products.length) {
  errors.push(`Jumlah produk TSV ${tsvRows.length} != seed ${products.length}`);
}

const byCode = new Map(products.map((product) => [product.code, product]));
for (const row of tsvRows) {
  const product = byCode.get(row.code);
  if (!product) {
    errors.push(`Produk ${row.code} hilang dari seed`);
    continue;
  }
  if (product.name !== row.name) errors.push(`${row.code}: nama "${product.name}" != "${row.name}"`);
  if (product.categoryName !== row.category) errors.push(`${row.code}: kategori "${product.categoryName}" != "${row.category}"`);
  if (product.brand !== row.brand) errors.push(`${row.code}: merek "${product.brand}" != "${row.brand}"`);
  if (product.unit !== row.unit) errors.push(`${row.code}: satuan "${product.unit}" != "${row.unit}"`);
  if (product.sellPrice !== row.sellPrice) errors.push(`${row.code}: harga outlet ${product.sellPrice} != ${row.sellPrice}`);
  if (product.sellPriceMall !== row.sellPriceMall) errors.push(`${row.code}: harga mall ${product.sellPriceMall} != ${row.sellPriceMall}`);
}

const unique = (values) => new Set(values).size === values.length;
if (!unique(products.map((product) => product.code))) errors.push('Kode produk duplikat');
if (!unique(products.map((product) => product.id))) errors.push('ID produk duplikat');
if (!unique(products.map((product) => product.barcode))) errors.push('Barcode produk duplikat');

const categoryIds = new Set(categories.map((category) => category.id));
for (const product of products) {
  if (!categoryIds.has(product.categoryId)) {
    errors.push(`${product.code}: categoryId ${product.categoryId} tidak ada di daftar kategori`);
  }
}

const seedData = fs.readFileSync(dataPath, 'utf8');
const usedCodes = [...seedData.matchAll(/seedProduct\('([^']+)'\)/g)].map((match) => match[1]);
for (const code of usedCodes) {
  if (!byCode.has(code)) errors.push(`Transaksi seed memakai produk tidak ada: ${code}`);
}

const categoryCounts = new Map();
for (const product of products) {
  categoryCounts.set(product.categoryName, (categoryCounts.get(product.categoryName) || 0) + 1);
}

console.log(`Produk      : ${products.length}`);
console.log(`Kategori    : ${categories.length}`);
console.log(`Transaksi   : ${usedCodes.length} item memakai ${new Set(usedCodes).size} produk`);
console.log('Kategori    : ' + categories.map((category) => category.name).join(', '));
console.log('Jumlah per kategori:');
for (const [name, count] of categoryCounts) console.log(`  ${name}: ${count}`);
console.log(errors.length === 0 ? '\nVALID: semua data cocok.' : `\nERROR (${errors.length}):\n- ${errors.join('\n- ')}`);

process.exitCode = errors.length === 0 ? 0 : 1;
