import app from './app';
import { config } from './config';
import { pool } from './db';

const server = app.listen(config.port, () => {
  console.log(
    `VC3 Catat API berjalan di port ${config.port} (env: ${config.env}).`
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[${signal}] Menutup server dengan rapi...`);

  server.close(async () => {
    try {
      await pool.end();
      console.log('[shutdown] Koneksi database ditutup.');
      process.exit(0);
    } catch (error) {
      console.error(
        '[shutdown] Gagal menutup database:',
        (error as Error).message
      );
      process.exit(1);
    }
  });

  // Jangan menggantung selamanya bila ada koneksi yang macet.
  setTimeout(() => {
    console.error('[shutdown] Timeout, keluar paksa.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
});
