# Panduan Deploy VPS (Ubuntu/Debian + PostgreSQL 16 Native)

Panduan ini membangun seluruh tumpukan di satu VPS dengan PostgreSQL 16
yang **sudah terpasang** (bukan container), backend Node.js, dan frontend
hasil build Vite yang disajikan Nginx.

Arsitektur akhir:

```
Browser/Perangkat Kasir
        â”‚  http://IP-VPS  (port 80/443)
        â–¼
   Nginx â”€â”€ /api/ â”€â”€â–¶ Express API (pm2, 127.0.0.1:4000)
     â”‚                       â”‚
     â””â”€â”€ dist/ (statik)      â–¼
                    PostgreSQL 16 (127.0.0.1:5432)
```

> Database **tidak** perlu dibuka ke publik. Port 5432 tetap bind ke
> localhost dan hanya diakses backend.

---

## 1. Salin kode proyek ke VPS

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/ussisulsel-star/POSDUR.git vc3-posdur
cd vc3-posdur
```

Bila repo privat, gunakan SSH key atau personal access token.

## 2. Bangun database (skema + seed)

Jalankan satu perintah berikut. Skrip akan membuat role + database
(UTF-8), lalu menerapkan `001` (skema & seed awal) dan `002` (master data
12 cabang, 230 produk, pengaturan poin) secara idempoten:

```bash
# Password DB dibuat acak dan dicetak di akhir â€” catat!
sudo bash scripts/setup-vps-db.sh

# Atau tentukan sendiri:
sudo DB_PASSWORD='PasswordAndaYangKuat' bash scripts/setup-vps-db.sh
```

Kredensial default lain: database `dur_pos_db`, user `dur_user`
(ubah lewat `DB_NAME`/`DB_USER` bila perlu).

## 3. Konfigurasi backend

Buat `server/.env` (nilai contoh memakai hasil skrip di langkah 2):

```ini
PORT=4000
NODE_ENV=production
DATABASE_URL=postgres://dur_user:PASSWORD_DB@127.0.0.1:5432/dur_pos_db
JWT_SECRET=GANTI-DENGAN-STRING-ACAK-MINIMAL-32-KARAKTER
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://IP-ATAU-DOMAIN-VPS
BCRYPT_ROUNDS=10
DB_POOL_MAX=10
```

> Buat `JWT_SECRET` acak: `openssl rand -base64 48`.
> Saat `NODE_ENV=production`, JWT_SECRET wajib diisi.

## 4. Jalankan backend dengan pm2

```bash
# Node.js 20+ (bila belum ada)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

cd server
npm ci               # lengkap dulu, termasuk TypeScript untuk build
npm run build        # tsc -> dist/
npm prune --omit=dev # buang dependensi development sebelum produksi
sudo npm install -g pm2
pm2 start dist/server.js --name dur-api
pm2 save
pm2 startup            # ikuti instruksi agar auto-start saat boot
```

Saat pertama start, backend otomatis menjalankan `runMigrations()`
(`db/migrations/002_master_data.sql` + `db/seeds/002_master_data.sql`),
jadi migrasi tetap mutakhir setiap kali kode di-pull ulang.

Cek cepat:

```bash
curl http://127.0.0.1:4000/health
```

## 5. Build frontend & sajikan lewat Nginx

```bash
cd ..                     # kembali ke root proyek
npm ci
npm run build             # hasilnya di dist/
```

Pasang Nginx dengan konfigurasi `deploy/nginx-vps.conf`
(sudah diadaptasi untuk backend di `127.0.0.1:4000`):

```bash
sudo apt install -y nginx
sudo cp deploy/nginx-vps.conf /etc/nginx/sites-available/vc3-posdur
# Edit root sesuai lokasi proyek di VPS, mis. /var/www/vc3-posdur/dist
sudo ln -s /etc/nginx/sites-available/vc3-posdur /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Buka aplikasi di `http://IP-VPS` lalu login dengan tenant demo:

| Field | Nilai |
|---|---|
| Company ID | `99999` |
| User ID | `ADMIN` |
| Password | `99999psfdv` |

> **Segera ganti password ADMIN** setelah login pertama: menu
> Master Data â†’ Pengguna â†’ ubah password akun ADMIN, lalu buat akun
> kasir masing-masing cabang.

## 6. Keamanan minimum

- **Port 5432** tidak dibuka ke publik (`postgresql.conf` tetap
  `listen_addresses = 'localhost'`, atau batasi firewall).
- Firewall (ufw) hanya membuka `80`/`443` (dan `22` untuk admin):

  ```bash
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- Sertifikat TLS gratis bila memakai domain: `sudo apt install certbot python3-certbot-nginx`.
- Setelah produksi berjalan, ganti seed password ADMIN (langkah 5) dan
  `JWT_SECRET` di `server/.env`.

## 7. Perawatan harian

| Tugas | Perintah |
|---|---|
| Update aplikasi | `git pull && cd server && npm ci && npm run build && pm2 restart dur-api && cd .. && npm ci && npm run build` |
| Log backend | `pm2 logs dur-api` |
| Status backend | `pm2 status` |
| Backup database | `sudo -u postgres pg_dump dur_pos_db > backup-$(date +%F).sql` |
| Restore backup | `sudo -u postgres psql dur_pos_db < backup-TANGGAL.sql` |

Cadangkan `pg_dump` secara berkala (cron harian) ke lokasi aman.

## 8. Pemecahan masalah

| Gejala | Penyebab umum |
|---|---|
| `health` gagal / API 500 | `DATABASE_URL` salah, PostgreSQL tidak jalan (`systemctl status postgresql`) |
| Frontend blank / 404 aset | `root` Nginx tidak menunjuk folder `dist/` hasil `npm run build` |
| `/api` 502 | backend belum jalan (`pm2 status`) atau port bukan 4000 |
| Login 401 | password salah, atau akun nonaktif |
| CORS error | `CORS_ORIGIN` di `server/.env` tidak cocok dengan origin web |
