#!/usr/bin/env bash
# =====================================================================
# Setup database VC3 POS di VPS (PostgreSQL 16 native, Ubuntu/Debian).
#
# Pemakaian (dari root proyek di VPS):
#   sudo bash scripts/setup-vps-db.sh
#
# Variabel lingkungan opsional:
#   DB_NAME     nama database   (default: ketoko_pos_db)
#   DB_USER     user aplikasi   (default: ketoko_user)
#   DB_PASSWORD password user   (default: dibuat acak & dicetak di akhir)
#
# Skrip ini idempoten: aman dijalankan ulang.
# Skema 001 hanya diterapkan bila database masih kosong.
# =====================================================================
set -euo pipefail

DB_NAME="${DB_NAME:-ketoko_pos_db}"
DB_USER="${DB_USER:-ketoko_user}"
GENERATED_PASSWORD=""

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[x] Jalankan dengan sudo: sudo bash scripts/setup-vps-db.sh"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[x] psql tidak ditemukan. Pastikan PostgreSQL 16 terpasang."
  exit 1
fi

if [[ -z "${DB_PASSWORD:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    DB_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')"
  else
    DB_PASSWORD="$(head -c 256 /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 24)"
  fi
  GENERATED_PASSWORD="$DB_PASSWORD"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PSQL_ADMIN=(sudo -u postgres psql -v ON_ERROR_STOP=1)

# Pastikan password tidak mengandung karakter yang merusak SQL.
DB_PASSWORD_ESCAPED="${DB_PASSWORD//\'/\'\'}"

echo "[1/4] Menyiapkan role aplikasi: $DB_USER"
if "${PSQL_ADMIN[@]}" -Atqc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  "${PSQL_ADMIN[@]}" -c "ALTER ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASSWORD_ESCAPED';"
else
  "${PSQL_ADMIN[@]}" -c "CREATE ROLE \"$DB_USER\" LOGIN PASSWORD '$DB_PASSWORD_ESCAPED';"
fi

echo "[2/4] Menyiapkan database: $DB_NAME (UTF-8)"
if ! "${PSQL_ADMIN[@]}" -Atqc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  "${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\" ENCODING 'UTF8' TEMPLATE template0;"
fi

# Ekstensi uuid-ossp butuh hak superuser; buat di sini agar aman dipakai
# oleh skema 001 yang dijalankan dengan user aplikasi.
"${PSQL_ADMIN[@]}" -d "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

# Koneksi uji sebagai user aplikasi (TCP localhost + password).
if ! PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -Atqc 'SELECT 1' >/dev/null 2>&1; then
  echo "[x] Koneksi psql sebagai $DB_USER gagal."
  echo "    Periksa pg_hba.conf (host 127.0.0.1/32 harus scram-sha-256/md5) dan password."
  exit 1
fi

PSQL_APP=(env PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME")

echo "[3/4] Menerapkan skema & seed awal (001) bila database masih kosong"
HAS_SCHEMA="$("${PSQL_APP[@]}" -Atqc "SELECT to_regclass('public.companies') IS NOT NULL")"
if [[ "$HAS_SCHEMA" != "t" ]]; then
  "${PSQL_APP[@]}" -f "$ROOT/db/migrations/001_initial_schema.sql"
  "${PSQL_APP[@]}" -f "$ROOT/db/seeds/001_initial_seed.sql"
else
  echo "      Skema 001 sudah ada, dilewati."
fi

echo "[4/4] Menerapkan migrasi & seed master data (002, idempoten)"
"${PSQL_APP[@]}" -f "$ROOT/db/migrations/002_master_data.sql"
"${PSQL_APP[@]}" -f "$ROOT/db/seeds/002_master_data.sql"

echo ""
echo "=============================================="
echo " Database siap dipakai."
echo " DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME"
[[ -n "$GENERATED_PASSWORD" ]] && \
  echo " Password dibuat acak: $GENERATED_PASSWORD"
echo "=============================================="
