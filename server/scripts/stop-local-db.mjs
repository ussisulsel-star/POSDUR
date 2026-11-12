import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Menghentikan cluster PostgreSQL portable yang dijalankan oleh `local-db.mjs`.
 * Berguna ketika proses Node-nya terhenti paksa (mis. terminal ditutup).
 */

const serverRoot = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(serverRoot, '.pgdata');
const windowsPgCtl = path.join(
  serverRoot,
  'node_modules',
  '@embedded-postgres',
  'windows-x64',
  'native',
  'bin',
  'pg_ctl.exe'
);

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
  console.log('[db] Cluster belum pernah diinisialisasi. Tidak ada yang dihentikan.');
  process.exit(0);
}

const pgCtl = fs.existsSync(windowsPgCtl) ? windowsPgCtl : 'pg_ctl';

try {
  execFileSync(pgCtl, ['-D', dataDir, 'stop', '-m', 'fast'], {
    stdio: 'inherit',
  });
  console.log('[db] PostgreSQL dihentikan.');
} catch (error) {
  console.error('[db] Gagal menghentikan PostgreSQL:', error?.message || error);
  process.exit(1);
}
