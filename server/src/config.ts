import path from 'path';
import dotenv from 'dotenv';

// Muat .env dari root proyek (baik saat `tsx` membaca src/ maupun `node` membaca dist/).
// File .env di direktori kerja server/ tetap didukung sebagai override lokal.
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value.trim() !== '') {
    return value.trim();
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Environment variable ${name} wajib diisi.`);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 4000),
  databaseUrl: readEnv(
    'DATABASE_URL',
    'postgres://ketoko_user:ketoko_secure_password_99999@localhost:5432/ketoko_pos_db'
  ),
  jwtSecret: isProduction
    ? readEnv('JWT_SECRET')
    : process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
  dbPoolMax: Number(process.env.DB_POOL_MAX || 10),
} as const;
