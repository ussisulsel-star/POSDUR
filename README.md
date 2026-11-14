# VC3 Catat POS

Aplikasi **Point of Sale (POS) multi-outlet** untuk kasir ritel: terminal kasir sentuh + barcode, shift kas, multi-pembayaran, retur, laporan, manajemen master data & pengguna, serta dokumentasi arsitektur.

Proyek ini terdiri dari dua bagian:

| Bagian | Teknologi | Lokasi |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 | `src/` |
| Backend API | Node.js, Express 4, TypeScript, PostgreSQL 16 | `server/` |
| Database | PostgreSQL (12 tabel, multi-tenant) | `db/` |
| Deployment | Docker Compose + Nginx | `docker/` |

> **Status integrasi:** login, katalog produk, checkout/nota, buka-tutup shift, kas masuk/keluar, dan retur sudah memakai REST API (`src/services/apiService.ts` + `src/services/posApi.ts`). Master data lain (produk, pengguna, pelanggan, kategori, cabang) serta koreksi/void transaksi masih disimpan di `localStorage` (`src/services/storageService.ts`) dan menjadi tahap integrasi berikutnya.

---

## Fitur Frontend

- Terminal kasir layar penuh: katalog produk, pemindai barcode, keranjang, diskon item/faktur, PPN opsional.
- Multi-outlet & multi-brand, pembatasan akses cabang per pengguna (fail-closed).
- Pembayaran multi-metode: Tunai, QRIS, Debit, Kredit, Transfer, Piutang.
- Shift kasir: buka/tutup shift, kas masuk/keluar, rekonsiliasi selisih kas.
- Tahan transaksi (hold/park), riwayat nota, cetak ulang struk thermal, retur, void/koreksi transaksi.
- Master data: produk, kategori, paket/bundling, pelanggan, e-money, pengguna, cabang.
- Impor/ekspor Excel (`xlsx`) untuk master produk.
- Laporan penjualan, laporan shift, traffic report, log aktivitas pengguna.
- RBAC: `ADMIN`, `SUPERVISOR`, `KASIR`, `GUDANG`.

### Pintasan keyboard

| Tombol | Aksi |
|---|---|
| `F1` | Fokus input barcode/pencarian |
| `F2` | Ubah qty item terakhir |
| `F3` | Diskon faktur (%) |
| `F4` | Hapus item terakhir |
| `F7` | Tahan transaksi / buka daftar tertahan |
| `F8` | Buka pembayaran |
| `F9` | Riwayat nota |
| `F10` | Kas masuk/keluar |
| `F11` | Buka laci kasir (simulasi) |
| `F12` | Bantuan pintasan |
| `Esc` | Tutup modal / kosongkan keranjang |

---

## Struktur Proyek

```
.
├── db/
│   ├── migrations/001_initial_schema.sql   # 12 tabel + index
│   └── seeds/001_initial_seed.sql          # tenant 99999, admin, produk contoh
├── docker/
│   ├── Dockerfile                          # build frontend + Nginx
│   ├── Dockerfile.backend                  # build & jalankan API
│   ├── docker-compose.yml                  # postgres + backend + frontend
│   └── nginx.conf                          # SPA fallback + proxy /api
├── scripts/                                # generator & verifier seed produk
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts                          # registrasi middleware & route
│       ├── server.ts                       # entrypoint + graceful shutdown
│       ├── config.ts                       # pembacaan environment
│       ├── db.ts                           # pool & helper transaksi
│       ├── errors.ts                       # ApiError + asyncHandler
│       ├── middleware/                     # auth JWT, rate limit, error handler
│       ├── routes/                         # auth, products, pos, shifts
│       └── utils/                          # validasi & serializer camelCase
├── src/                                    # aplikasi React
├── .env.example
├── package.json
└── README.md
```

---

## Prasyarat

- Node.js **20+** (disarankan 22)
- npm 10+
- Database: pilih salah satu
  - **PostgreSQL portable** bawaan proyek (`npm run db:start`, tanpa admin) — paling mudah,
  - PostgreSQL 14+ yang sudah terpasang, atau
  - Docker Desktop (untuk mode Compose).

---

## Menjalankan Frontend (development)

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>. Proxy `/api` otomatis diteruskan ke `http://localhost:4000` (dapat diubah lewat `API_PROXY_TARGET`).

Perintah lain:

```bash
npm run lint      # cek TypeScript frontend
npm run build     # build produksi ke dist/
npm run preview   # pratinjau hasil build
```

---

## Menjalankan Backend (development)

1. Salin environment:

   ```bash
   cp .env.example .env
   ```

   Sesuaikan `DATABASE_URL` dan **ganti** `JWT_SECRET`.

2. Install dependency backend:

   ```bash
   npm run install:server
   ```

3. Siapkan database (pilih salah satu):

   **A. PostgreSQL portable bawaan proyek (disarankan, tanpa admin)**

   ```bash
   npm run db:start
   ```

   Perintah ini menginisialisasi cluster PostgreSQL 16 di `server/.pgdata`, membuat database `ketoko_pos_db`, lalu menerapkan skema dan seed secara otomatis. Biarkan terminal ini tetap terbuka selama API dipakai. Hentikan dengan `Ctrl+C` atau:

   ```bash
   npm run db:stop
   ```

   **B. PostgreSQL lokal yang sudah terpasang**

   ```bash
   createdb ketoko_pos_db
   psql -d ketoko_pos_db -f db/migrations/001_initial_schema.sql
   psql -d ketoko_pos_db -f db/seeds/001_initial_seed.sql
   ```

   **C. Hanya PostgreSQL via Docker**

   ```bash
   docker compose -f docker/docker-compose.yml up -d postgres
   ```

   Skema dan seed akan dijalankan otomatis saat volume database masih kosong.

4. Jalankan API (di terminal terpisah bila memakai opsi A):

   ```bash
   npm run dev:server
   ```

   API tersedia di <http://localhost:4000>, health check di `/health`.

5. Build produksi backend:

   ```bash
   npm run build:server
   npm run start:server
   ```

---

## Menjalankan Semua dengan Docker Compose

```bash
cd docker
docker compose up -d --build
```

| Layanan | URL |
|---|---|
| Web POS | <http://localhost:3000> |
| API | <http://localhost:4000> |
| PostgreSQL | `localhost:5432` |

Nginx meneruskan `/api/*` ke service `backend:4000`, jadi frontend dapat memanggil API lewat origin yang sama.

Perintah operasional:

```bash
docker compose ps
docker compose logs -f backend
docker compose down          # hentikan, data tetap tersimpan
docker compose down -v       # hentikan + hapus volume (skema & seed dijalankan ulang)
```

> Migrasi & seed **hanya** dijalankan otomatis saat volume `postgres_data` masih kosong. Untuk database yang sudah ada, jalankan file SQL secara manual.

---

## Environment Variables

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `4000` | Port API |
| `DATABASE_URL` | `postgres://ketoko_user:...@localhost:5432/ketoko_pos_db` | Koneksi PostgreSQL |
| `JWT_SECRET` | — (**wajib** di produksi) | Kunci tanda tangan JWT |
| `JWT_EXPIRES_IN` | `8h` | Masa berlaku token |
| `CORS_ORIGIN` | `*` | Origin yang diizinkan (pisahkan koma) |
| `BCRYPT_ROUNDS` | `10` | Cost factor hash password |
| `DB_POOL_MAX` | `10` | Jumlah koneksi pool |
| `API_PROXY_TARGET` | `http://localhost:4000` | Target proxy Vite |

Compose juga membaca `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `API_PORT`, `WEB_PORT`.

---

## Akun Demo

| Field | Nilai |
|---|---|
| ID Perusahaan | `99999` |
| User ID | `ADMIN` |
| Password | `99999psfdv` |
| Role | `ADMIN` |

Seed berisi 6 produk contoh. Untuk mengganti password admin di database:

```bash
cd server
npm run hash-password -- "password-baru"
# lalu update kolom users.password_hash dengan hash yang dihasilkan
```

---

## Endpoint API

Semua endpoint bisnis memerlukan header `Authorization: Bearer <token>` dan otomatis dibatasi per `company_id` dari token.

### Auth

| Method | Endpoint | Akses |
|---|---|---|
| `POST` | `/api/v1/auth/login` | publik (rate limit 20/15 menit) |
| `GET` | `/api/v1/auth/me` | terautentikasi |

### Produk

| Method | Endpoint | Akses |
|---|---|---|
| `GET` | `/api/v1/products?search=&categoryId=&limit=&offset=` | semua role |
| `GET` | `/api/v1/products/barcode/:barcode` | semua role |
| `GET` | `/api/v1/products/:id` | semua role |
| `POST` | `/api/v1/products` | `ADMIN`, `GUDANG` |
| `PUT` | `/api/v1/products/:id` | `ADMIN`, `GUDANG` |
| `DELETE` | `/api/v1/products/:id` | `ADMIN`, `GUDANG` (soft delete) |

### Penjualan

| Method | Endpoint | Akses |
|---|---|---|
| `POST` | `/api/v1/pos/checkout` | semua role |
| `GET` | `/api/v1/pos/transactions?from=&to=&status=&invoiceNo=` | semua role |
| `GET` | `/api/v1/pos/transactions/:invoiceNo` | semua role |
| `POST` | `/api/v1/pos/returns` | `ADMIN`, `SUPERVISOR` |

### Shift & Kas

| Method | Endpoint | Akses |
|---|---|---|
| `GET` | `/api/v1/shifts/active` | semua role (`?all=true` untuk ADMIN) |
| `POST` | `/api/v1/shifts/open` | semua role |
| `POST` | `/api/v1/shifts/close` | semua role |
| `POST` | `/api/v1/shifts/cash-movement` | semua role |
| `GET` | `/api/v1/shifts/:id/movements` | semua role |

### Utilitas

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/health` | status API + database |
| `GET` | `/api/v1/health` | sama, di bawah prefix API |

### Contoh: login

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"companyId":"99999","userId":"ADMIN","password":"99999psfdv"}'
```

### Contoh: checkout

```bash
curl -X POST http://localhost:4000/api/v1/pos/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNo": "PJ-202611-0001",
    "customerName": "Umum (Walk-in)",
    "items": [
      { "productId": "<UUID_PRODUK>", "qty": 2, "unitPrice": 3500, "discountRp": 0 }
    ],
    "discountTotal": 0,
    "taxTotal": 0,
    "grandTotal": 7000,
    "payAmount": 10000,
    "payments": [
      { "method": "TUNAI", "amount": 10000 }
    ]
  }'
```

Catatan perilaku backend:

- Harga, diskon, dan stok divalidasi ulang di server; `grandTotal` harus cocok dengan perhitungan server (toleransi Rp 0,01).
- Stok dikunci dengan `SELECT ... FOR UPDATE` sehingga aman dari overselling.
- Nota otomatis masuk ke rekap shift aktif kasir (kas tunai = grand total − pembayaran non-tunai).
- Retur mengembalikan stok dan mencatat refund tunai sebagai kas keluar shift.
- Skema DB saat ini **belum** memiliki `outlet_id`; isolasi data backend berbasis `company_id`. Multi-outlet masih berjalan di sisi frontend/localStorage.

---

## Role & Kewenangan

| Role | POS | Master Data | Laporan | Dokumentasi | Void/Retur/Diskon |
|---|---|---|---|---|---|
| `ADMIN` | ✅ | ✅ (edit) | ✅ | ✅ | ✅ |
| `SUPERVISOR` | ✅ | ✅ (baca) | ✅ | ❌ | ✅ |
| `KASIR` | ✅ | ❌ | ❌ | ❌ | hanya buka laci |
| `GUDANG` | ❌ | ✅ (produk/kategori) | ❌ | ❌ | ❌ |

Detail aturan ada di `src/services/accessControl.ts` (frontend) dan `requireRole` pada route backend.

---

## Scripts

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Vite dev server (port 3000) |
| `npm run build` | Build frontend |
| `npm run lint` | Typecheck frontend |
| `npm run dev:server` | API mode watch |
| `npm run build:server` | Compile API ke `server/dist` |
| `npm run start:server` | Jalankan API hasil build |
| `npm run typecheck:server` | Typecheck API |
| `npm run install:server` | Install dependency API |
| `npm run db:start` | Jalankan PostgreSQL portable (port 5432) |
| `npm run db:stop` | Hentikan PostgreSQL portable |
| `npm run hash-password -- "..."` | Buat hash bcrypt password |

Verifikasi data seed produk:

```bash
node scripts/verify-product-seed.mjs
```

---

## Catatan Keamanan & Produksi

- `JWT_SECRET` wajib diisi dan bersifat rahasia saat `NODE_ENV=production`.
- Ganti seluruh password default (`POSTGRES_PASSWORD`, password admin) sebelum deploy.
- Jangan commit `.env` (sudah di-ignore). Gunakan secret manager di server.
- Login dibatasi rate limit in-memory; untuk skala besar gunakan Redis.
- Tambahkan HTTPS (reverse proxy/TLS) di depan Nginx.
- Backup volume `postgres_data` secara berkala.

---

## Troubleshooting

| Gejala | Solusi |
|---|---|
| `503 degraded` pada `/health` | PostgreSQL belum berjalan atau `DATABASE_URL` salah |
| `EADDRINUSE :5432` saat `db:start` | Port dipakai PostgreSQL lain; hentikan service tersebut atau set `PGPORT` + sesuaikan `DATABASE_URL` |
| Ingin mengulang seed DB portable | `npm run db:stop`, hapus folder `server/.pgdata`, lalu `npm run db:start` |
| `Environment variable JWT_SECRET wajib diisi` | Set `JWT_SECRET` saat produksi |
| `npm ci` gagal di Docker | Pastikan `package-lock.json` dan `server/package-lock.json` ada serta sinkron |
| Perubahan seed tidak muncul | Seed hanya jalan pada volume kosong: `docker compose down -v` lalu `up` lagi |
| `EADDRINUSE :4000` | Port dipakai proses lain; ubah `PORT`/`API_PORT` |
| Login gagal setelah ganti password | Buat hash baru dengan `npm run hash-password` lalu update DB |
