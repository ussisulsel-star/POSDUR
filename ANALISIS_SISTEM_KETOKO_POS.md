# DOKUMEN ANALISIS SISTEM & SPESIFIKASI REPLIKA KETOKO POS
**Target URL:** https://pos.ketoko.co.id  
**Kredensial Pengujian:** ID Perusahaan `99999` | User ID `ADMIN` | Password `99999psfdv`

---

## 1. Analisis Seluruh Struktur Frontend

### A. Layout & Viewport Architecture
- **Single-Screen Cashier Terminal:** Berbeda dengan dashboard admin konvensional, antarmuka kasir Ketoko POS mengusung layout *full-viewport fixed* tanpa scroll halaman secara keseluruhan. Tujuannya adalah memastikan kasir selalu dapat melihat ringkasan tagihan (total LED), daftar barang belanjaan, dan pemindai barcode dalam satu pandangan.
- **2-Column Split:**
  - **Sisi Kiri (60%):** Barcode scanner input, filter kategori (Makanan, Minuman, Sembako, dll), dan katalog barang berbasis sentuh (touchscreen tiles) dengan informasi stok realtime.
  - **Sisi Kanan (40%):** Panel keranjang kasir (Cart / Bill Panel), pemilih pelanggan/member, baris item belanjaan dengan tombol kontrol kuantitas (+/-), subtotal, diskon item, diskon faktur (%), PPN 11%, display LED total digital, dan tombol aksi (Batal/Esc, Tahan/F7, Bayar/F8).
- **Header Multifungsi:**
  - Menampilkan ID Perusahaan (`99999`), Toko/Cabang, User Kasir (`ADMIN`), Status Shift aktif, Jam digital realtime, dan pintasan cepat (Tahan transaksi, Riwayat Nota F9, Retur, Buka Laci Kasir).
- **ESC/POS Print Viewport:**
  - Area tersembunyi khusus berukuran 58mm atau 80mm yang dioptimalkan dengan CSS `@media print` untuk mencetak nota thermal secara presisi ke printer kasir bluetooth/USB.

### B. Navigasi & Keyboard Shortcuts (F1 - F12)
Kasir ritel menuntut kecepatan input sub-detik tanpa ketergantungan pada mouse:
- **Enter:** Memproses input barcode scanner secara otomatis.
- **F1:** Fokus langsung ke input pemindai barcode / pencarian barang.
- **F2:** Mengubah quantity barang terakhir di keranjang belanja.
- **F3:** Memberikan diskon faktur tambahan (persen / rupiah).
- **F4:** Menghapus baris produk dari keranjang belanja.
- **F7:** Menahan (Hold / Park) transaksi saat pelanggan mengambil item tambahan.
- **F8:** Membuka jendela pembayaran (Checkout Modal) dengan pilihan Tunai, QRIS, Kartu Debit, Transfer, atau Piutang.
- **F9:** Membuka riwayat nota dan melakukan cetak ulang struk (Reprint).
- **F10:** Mencatat mutasi kas operasional laci (Kas Masuk / Kas Keluar).
- **F11:** Mengirimkan trigger ESC/POS untuk membuka laci kasir (Cash Drawer Kick).
- **F12:** Menampilkan panduan bantuan pintasan keyboard.
- **Esc:** Membatalkan aksi, menutup modal, atau membersihkan keranjang.

### C. Komponen UI & Responsiveness
- **Display LED Grand Total:** Tampilan visual menyerupai customer pole display fisik dengan kontras tinggi (latar gelap dan teks neon/emerald font monospace `tabular-nums`).
- **Numpad Uang Pas & Pecahan:** Tombol cepat (Uang Pas, 50.000, 100.000, 200.000, 500.000) dan kalkulator kembalian otomatis.
- **Dynamic QRIS Simulator:** Komponen visual QR Code Standar Indonesia dengan NMID toko resmi dan validasi simulasi scan otomatis.
- **Stock Status Badges:** Visualisasi stok aman (hijau), stok menipis (kuning), dan stok habis (merah).
- **Responsiveness:** Tampilan beradaptasi mulus dari tablet/iPad 10 inci hingga layar monitor kasir touchscreen 1080p.

### D. State Management
- **Cart State:** Mengelola array `CartItem` reaktif berisi relasi produk, kuantitas, harga berjenjang (retail vs grosir), diskon item, dan diskon member.
- **Multi-Tenant Session State:** Token JWT tersimpan di secure storage dengan identitas `companyId: '99999'`, `userId: 'ADMIN'`, dan hak akses role `ADMIN`.
- **Shift & Drawer Float State:** Melacak kas awal, penjualan tunai, non-tunai, mutasi kas, hingga rekonsiliasi selisih kas fisik.
- **Offline / Local Storage Fallback:** Seluruh katalog, transaksi, dan order tertahan tersinkronisasi di local storage sehingga kasir tetap dapat bertransaksi instan tanpa lag jaringan.

---

## 2. Analisis Arsitektur Backend: Node.js + Express

### A. Endpoint REST API Utama
1. **Autentikasi & Tenant:**
   - `POST /api/v1/auth/login` (Input: `companyId`, `userId`, `password` -> Output: JWT Token & Profil Kasir)
2. **Katalog & Stok:**
   - `GET /api/v1/products` (Mendukung parameter search, barcode, dan kategori)
   - `GET /api/v1/products/barcode/:barcode` (Lookup barcode sub-millisecond)
3. **Transaksi Penjualan (POS):**
   - `POST /api/v1/pos/checkout` (Atomic transaction: simpan nota, potong stok, update shift kas)
   - `GET /api/v1/pos/transactions` (Riwayat nota kasir)
   - `GET /api/v1/pos/transactions/:invoiceNo` (Detail nota untuk cetak ulang)
4. **Shift & Kas Laci:**
   - `POST /api/v1/shifts/open` (Buka shift dengan modal awal)
   - `POST /api/v1/shifts/close` (Tutup shift, input uang fisik pecahan, hitung selisih kas)
   - `POST /api/v1/shifts/cash-movement` (Catat kas masuk/keluar)
5. **Retur Penjualan:**
   - `POST /api/v1/pos/returns` (Retur item, kembalikan stok, pengembalian dana)

### B. Logika Bisnis & Transaksi ACID
- **Multi-Tenant Isolation:** Setiap query database wajib memfilter klausa `WHERE company_id = req.user.companyId`.
- **Atomic Stock Deduction:** Pengurangan stok produk dilakukan dalam blok transaksi database `BEGIN ... COMMIT` dengan row-level lock (`SELECT ... FOR UPDATE`) untuk mencegah overselling.
- **Cash Reconciliation:** Menghitung total fisik uang laci vs saldo kas sistem dan mencatat selisih (*variance*) untuk mencegah kecurangan kasir.

### C. Middleware Pipeline
- `rateLimiter`: Mencegah serangan brute-force login.
- `authenticateJWT`: Validasi token bearer dan parsing user identity.
- `companyScope`: Memastikan tenant scope terisolasi.
- `roleGuard`: Memvalidasi otorisasi kasir vs supervisor/admin.

---

## 3. Desain Database & ERD (PostgreSQL)

Database dirancang dengan 12 tabel relasional yang dinormalisasi:
1. `companies`: Multi-tenant master (ID `99999`, nama toko, pengaturan pajak PPN 11%, template struk).
2. `users`: Akun kasir dan admin dengan enkripsi kata sandi bcrypt.
3. `categories`: Kategori barang ritel (Makanan, Minuman, Sembako, Snack, dll).
4. `products`: Master barang, barcode unik per tenant, harga pokok (HPP), harga jual, harga grosir, dan stok realtime.
5. `customers`: Data member/pelanggan, tingkat member (Silver, Gold, Grosir), dan poin loyalitas.
6. `pos_shifts`: Sesi kerja kasir (waktu buka, waktu tutup, modal awal, total tunai, kas fisik, selisih kas).
7. `cash_movements`: Log mutasi kas operasional (kas masuk & kas keluar).
8. `transactions`: Faktur nota penjualan (no nota unik, total, diskon, pajak, kasir, pelanggan).
9. `transaction_items`: Rincian per item belanjaan (produk, qty, harga satuan, diskon item, subtotal).
10. `payments`: Rincian multi-pembayaran (Tunai, QRIS, Kartu Debit/Kredit EDC, Transfer, Piutang).
11. `held_orders`: Transaksi tertahan / pending antrean kasir.
12. `sales_returns`: Retur penjualan beserta pemulihan stok inventaris.

**Indeks Kinerja:**
- `idx_products_barcode` pada `(company_id, barcode)`
- `idx_transactions_invoice` pada `(company_id, invoice_no)`
- `idx_transactions_created` pada `(company_id, created_at)`

---

## 4. Berkas Proyek & Deployment

- **Database Migration:** Disediakan pada `/db/migrations/001_initial_schema.sql`
- **Seed Data Ritel Indonesia:** Disediakan pada `/db/seeds/001_initial_seed.sql`
- **Docker Compose:** Disediakan pada `/docker/docker-compose.yml` (PostgreSQL 16, Node.js API, Nginx Web POS)
- **Production Dockerfile:** Disediakan pada `/docker/Dockerfile`
- **Aplikasi Interaktif:** Berjalan langsung di preview browser dengan mode Terminal Kasir, Master & Stok, Laporan Penjualan, Manajemen Pengguna & Kasir, serta Studio Arsitektur & Dokumentasi.
