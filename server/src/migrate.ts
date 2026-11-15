import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db';

/**
 * Migrasi master data & seed tambahan yang harus jalan pada database
 * yang SUDAH ada (bukan hanya saat volume PostgreSQL pertama kali dibuat).
 *
 * Semua file di bawah ditulis idempoten sehingga aman dijalankan setiap
 * kali server start.
 */
const MIGRATION_FILES = [
  // 003 harus lebih dulu: mengganti ID perusahaan 99999 -> 001 di database
  // yang sudah ada, agar seed 002 (yang memakai '001') lolos FK.
  'db/migrations/003_rename_company_id.sql',
  'db/migrations/002_master_data.sql',
  'db/seeds/002_master_data.sql',
];

function resolveProjectFile(relativePath: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '..', relativePath),
    path.resolve(__dirname, '..', '..', relativePath),
    path.resolve(__dirname, '..', relativePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function applyFile(
  client: import('pg').PoolClient,
  relativePath: string
): Promise<void> {
  const filePath = resolveProjectFile(relativePath);
  if (!filePath) {
    console.warn(`[migrate] File tidak ditemukan, dilewati: ${relativePath}`);
    return;
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
  console.log(`[migrate] Diterapkan: ${relativePath}`);
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // File SQL ditulis dalam UTF-8; paksa encoding klien agar konsisten
    // meski cluster PostgreSQL Windows memakai WIN1252.
    await client.query("SET LOCAL client_encoding TO 'UTF8'");
    for (const relativePath of MIGRATION_FILES) {
      await applyFile(client, relativePath);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw new Error(
      `Migrasi master data gagal: ${(error as Error).message}`
    );
  } finally {
    client.release();
  }
}
