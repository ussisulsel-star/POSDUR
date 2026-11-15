#!/usr/bin/env node
/**
 * Pembuatan akun pengguna massal untuk DUR POS via REST API.
 *
 * Pemakaian:
 *   node scripts/bulk-create-users.mjs \
 *     --url http://203.145.34.10/api/v1 \
 *     --user ADMIN \
 *     --password 'PASSWORD-ADMIN' \
 *     --file private/user-credentials.csv
 *
 * Format CSV (baris pertama = header):
 *   userId,name,role,password,pin,outletId
 *
 * Node.js 18+ (fetch bawaan). Skrip idempoten: akun yang sudah ada dilewati.
 */
import fs from 'node:fs';

function readArg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const baseUrl = readArg('--url', 'http://127.0.0.1:4000/api/v1').replace(/\/+$/, '');
const adminUser = readArg('--user', 'ADMIN');
const adminPass = readArg('--password', '') || process.env.ADMIN_PASS || '';
const file = readArg('--file', 'user-credentials.csv');

if (!adminPass) {
  console.error('[x] Password ADMIN wajib. Gunakan --password atau variabel ADMIN_PASS.');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`[x] File tidak ditemukan: ${file}`);
  process.exit(1);
}

const [rawHeader, ...rawRows] = fs
  .readFileSync(file, 'utf8')
  .trim()
  .split(/\r?\n/);
const header = rawHeader.split(',').map((h) => h.trim());
const rows = rawRows
  .filter((l) => l.trim())
  .map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });

console.log(`[i] Login sebagai ${adminUser} ke ${baseUrl} ...`);
const loginRes = await fetch(`${baseUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ companyId: '001', userId: adminUser, password: adminPass }),
});
const loginJson = await loginRes.json().catch(() => ({}));
if (!loginRes.ok || !loginJson?.data?.token) {
  console.error('[x] Login gagal:', JSON.stringify(loginJson));
  process.exit(1);
}
console.log('[i] Login sukses. Membuat akun ...\n');

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${loginJson.data.token}`,
};

let ok = 0;
let skip = 0;
let fail = 0;
for (const row of rows) {
  const payload = {
    userId: row.userId,
    name: row.name,
    role: row.role,
    password: row.password,
    ...(row.pin ? { pin: row.pin } : {}),
    outletId: row.outletId,
    allowedOutletIds: [row.outletId],
  };
  try {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    const message = String(json?.message ?? json?.error ?? '');
    if (res.ok) {
      ok += 1;
      console.log(`[ok]   ${row.userId} (${row.role}) -> ${row.outletId}`);
    } else if (res.status === 409 || /sudah|duplikat|uq_company_userid/i.test(message)) {
      skip += 1;
      console.log(`[skip] ${row.userId}: sudah terdaftar, dilewati`);
    } else {
      fail += 1;
      console.error(`[gagal] ${row.userId}: ${res.status} ${message}`);
    }
  } catch (err) {
    fail += 1;
    console.error(`[gagal] ${row.userId}: ${err?.message ?? err}`);
  }
}

console.log(`\nSelesai: ${ok} dibuat, ${skip} dilewati, ${fail} gagal — dari ${rows.length} akun.`);
if (fail > 0) process.exit(2);
