import fs from 'fs';
import path from 'path';
import EmbeddedPostgres from 'embedded-postgres';

/**
 * Menjalankan PostgreSQL portable (embedded) untuk development lokal,
 * tanpa instalasi server database atau hak administrator.
 *
 * Data disimpan di `server/.pgdata` sehingga tetap ada setelah restart.
 * Kredensial default sama dengan `DATABASE_URL` di `.env.example`.
 */

const serverRoot = path.resolve(import.meta.dirname, '..');
const projectRoot = path.resolve(serverRoot, '..');
const dataDir = path.join(serverRoot, '.pgdata');

const port = Number(process.env.PGPORT || 5432);
const user = process.env.PGUSER || 'ketoko_user';
const password = process.env.PGPASSWORD || 'ketoko_secure_password_99999';
const database = process.env.PGDATABASE || 'ketoko_pos_db';

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  port,
  user,
  password,
  persistent: true,
  autoRehydrateSymlinks: true,
});

async function applySqlFile(client, relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

async function main() {
  const alreadyInitialised = fs.existsSync(path.join(dataDir, 'PG_VERSION'));

  if (!alreadyInitialised) {
    console.log(`[db] Inisialisasi cluster PostgreSQL di ${dataDir} ...`);
    await postgres.initialise();
  }

  await postgres.start();
  console.log(`[db] PostgreSQL berjalan di localhost:${port}.`);

  const admin = postgres.getPgClient('postgres');
  await admin.connect();
  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [database]
  );
  await admin.end();

  if (exists.rowCount === 0) {
    await postgres.createDatabase(database);
    console.log(`[db] Database "${database}" dibuat.`);
  }

  const client = postgres.getPgClient(database);
  await client.connect();

  const schemaCheck = await client.query(
    "SELECT to_regclass('public.companies') AS table_name"
  );

  if (!schemaCheck.rows[0]?.table_name) {
    console.log('[db] Menerapkan skema 001_initial_schema.sql ...');
    await applySqlFile(client, 'db/migrations/001_initial_schema.sql');

    console.log('[db] Menerapkan seed 001_initial_seed.sql ...');
    await applySqlFile(client, 'db/seeds/001_initial_seed.sql');
    console.log('[db] Skema & seed selesai.');
  } else {
    console.log('[db] Skema sudah ada, seed dilewati.');
  }

  await client.end();

  console.log(
    `[db] Siap dipakai: postgres://${user}:***@localhost:${port}/${database}`
  );
  console.log('[db] Tekan Ctrl+C untuk menghentikan PostgreSQL.');

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log('\n[db] Menghentikan PostgreSQL ...');
    try {
      await postgres.stop();
    } catch (error) {
      console.error('[db] Gagal menghentikan:', error?.message || error);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Jaga proses tetap hidup selama database dipakai.
  setInterval(() => undefined, 1 << 30);
}

main().catch(async (error) => {
  console.error('[db] Gagal menjalankan PostgreSQL:', error);
  try {
    await postgres.stop();
  } catch {
    // abaikan
  }
  process.exit(1);
});
