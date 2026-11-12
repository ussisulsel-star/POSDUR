import React, { useState } from 'react';
import { 
  Layers, 
  Server, 
  Database, 
  Code, 
  Terminal, 
  FolderTree, 
  FileCode, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Cpu,
  Boxes
} from 'lucide-react';

export const ArchitectureDocsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'frontend' | 'backend' | 'database' | 'api' | 'migrations' | 'seeds' | 'docker' | 'structure'
  >('frontend');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Interactive API tester state
  const [apiEndpoint, setApiEndpoint] = useState<string>('/api/v1/pos/checkout');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestApi = (endpoint: string, sampleResponse: object) => {
    setApiLoading(true);
    setApiEndpoint(endpoint);
    setTimeout(() => {
      setApiResponse(JSON.stringify(sampleResponse, null, 2));
      setApiLoading(false);
    }, 300);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sub-Header Tabs */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <Layers className="w-4 h-4 text-emerald-400 mr-1" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Dokumentasi & Arsitektur Sistem
          </span>
        </div>

        <nav className="flex items-center gap-1 shrink-0 text-xs">
          {[
            { id: 'frontend', label: '1. Frontend', icon: LayoutIcon },
            { id: 'backend', label: '2. Backend', icon: Server },
            { id: 'database', label: '3. ERD & Database', icon: Database },
            { id: 'api', label: '4. API Docs & Tester', icon: Code },
            { id: 'migrations', label: '5. Migrations SQL', icon: Terminal },
            { id: 'seeds', label: '6. Seed Data SQL', icon: Boxes },
            { id: 'docker', label: '7. Docker Deployment', icon: Cpu },
            { id: 'structure', label: '8. Struktur Folder', icon: FolderTree },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* TAB 1: FRONTEND ANALYSIS */}
        {activeTab === 'frontend' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h1 className="text-xl font-bold text-white">1. Analisis Arsitektur Frontend: pos.ketoko.co.id</h1>
              <p className="text-xs text-slate-400 mt-1">
                Kajian menyeluruh antarmuka web, navigasi kasir cepat, event handling keyboard, dan state management.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-2">
                <h2 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                  <LayoutIcon className="w-4 h-4" />
                  <span>A. Tata Letak (Layout & Viewport)</span>
                </h2>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Single-Viewport POS Grid:</strong> Tata letak kasir didesain fixed tanpa page-scroll untuk memastikan seluruh kontrol (katalog, keranjang, summary LED, dan tombol bayar) berada dalam 1 layar.</li>
                  <li><strong>Split Column Workstation:</strong> Sisi kiri untuk pemindai barcode, pencarian, dan grid sentuh (Touchscreen catalog). Sisi kanan untuk keranjang nota dan keypad pembayaran.</li>
                  <li><strong>Header & Status Strip:</strong> Menampilkan ID Perusahaan (Multi-tenant), Nama Toko/Cabang, User ID Kasir, Shift aktif, jam real-time, dan strip tombol fungsi F1-F12.</li>
                  <li><strong>ESC/POS Print Container:</strong> Elemen tersembunyi berformat lebar kertas thermal 58mm atau 80mm yang otomatis aktif saat print event dipanggil.</li>
                </ul>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-2">
                <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>B. Navigasi & Keyboard Shortcuts (F-Keys)</span>
                </h2>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Zero-Mouse Operation:</strong> Kasir profesional dapat menyelesaikan seluruh alur transaksi menggunakan keyboard: F1 (Cari), F2 (Ubah Qty), F7 (Tahan Transaksi), F8 (Bayar), F9 (Cetak Ulang).</li>
                  <li><strong>Barcode Interceptor:</strong> Input barcode mendengarkan karakter cepat dari USB/Bluetooth barcode scanner yang diakhiri karakter Enter (CR/LF).</li>
                  <li><strong>Modal Layering:</strong> Dialog modal untuk kalkulator kembalian, QRIS dynamic, retur barang, dan buka laci kasir (ESC/POS drawer kick pulse).</li>
                </ul>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-2">
                <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  <span>C. Komponen UI & Responsiveness</span>
                </h2>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Display LED Total:</strong> Indikator angka besar dengan font monospace tabular-nums kontras tinggi menyerupai layar pole customer display fisik.</li>
                  <li><strong>Quick Cash Nominal Pad:</strong> Tombol pecahan uang pas, 50k, 100k, 200k, 500k untuk memangkas waktu input uang tunai.</li>
                  <li><strong>Dynamic QRIS Simulator:</strong> Komponen rendering visual QR standard Indonesia lengkap dengan NMID toko dan listener status pembayaran lunas.</li>
                  <li><strong>Responsive Breakpoint:</strong> Pada tablet / iPad, sidebar bergeser fleksibel; pada desktop terminal 1440px+ tampil dalam mode desktop 2 kolom penuh.</li>
                </ul>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-2">
                <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <span>D. State Management</span>
                </h2>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Cart State:</strong> Array objek CartItem reaktif mencatat quantity, diskon berjenjang, dan subtotal yang otomatis mengkalkulasi PPN 11%.</li>
                  <li><strong>Multi-Tenant Session:</strong> Penyimpanan JWT Token, Company ID (99999), dan Kasir Roles di localStorage / secure cookie.</li>
                  <li><strong>Offline Resilience:</strong> Menggunakan local storage buffer sehingga transaksi kasir tetap dapat berjalan tanpa jeda latency jaringan.</li>
                  <li><strong>Shift & Cash Movement State:</strong> Menghitung uang fisik vs kas sistem untuk mencatat selisih kas saat tutup kasir.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BACKEND ANALYSIS */}
        {activeTab === 'backend' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h1 className="text-xl font-bold text-white">2. Analisis Arsitektur Backend: Node.js + Express</h1>
              <p className="text-xs text-slate-400 mt-1">
                Kajian logika bisnis, middleware autentikasi JWT multi-tenant, dan transaksi ACID perbankan kasir.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/80 space-y-3">
                <h2 className="text-sm font-bold text-blue-400">A. Alur Logika Bisnis & Validasi (Business Logic)</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50">
                    <span className="font-bold text-emerald-400 block mb-1">1. Multi-Tenant Isolation</span>
                    <p className="text-slate-300 leading-relaxed">
                      Setiap query database wajib menyertakan filter <code>company_id</code> (misal: <code>99999</code>) untuk memastikan pemisahan data mutlak antar perusahaan.
                    </p>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50">
                    <span className="font-bold text-cyan-400 block mb-1">2. Atomic Inventory Deduct</span>
                    <p className="text-slate-300 leading-relaxed">
                      Pengurangan stok barang dan pembuatan invoice berjalan dalam satu <strong>PostgreSQL Transaction (BEGIN...COMMIT)</strong> dengan lock <code>FOR UPDATE</code> untuk mencegah race condition.
                    </p>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50">
                    <span className="font-bold text-amber-400 block mb-1">3. Cash Reconciliation</span>
                    <p className="text-slate-300 leading-relaxed">
                      Shift kasir melacak modal awal, penjualan tunai, kas masuk operasional, dan kas keluar. Saat closing kasir, sistem menghitung <code>cash_difference = actual_cash - expected_cash</code>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/80 space-y-3">
                <h2 className="text-sm font-bold text-emerald-400">B. Middleware Architecture Pipeline</h2>
                <div className="text-xs space-y-2 font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300">
                  <div className="text-slate-500">// Request Lifecycle:</div>
                  <div>1. <code>corsMiddleware</code>: Mengizinkan request dari domain pos.ketoko.co.id</div>
                  <div>2. <code>rateLimiter</code>: Mencegah brute force login (100 req / menit)</div>
                  <div>3. <code>authenticateJWT</code>: Memvalidasi Header <code>Authorization: Bearer &lt;token&gt;</code></div>
                  <div>4. <code>companyScopeMiddleware</code>: Menetapkan <code>req.companyId = decoded.companyId</code></div>
                  <div>5. <code>roleGuard(['ADMIN', 'KASIR'])</code>: Verifikasi hak akses kasir / supervisor</div>
                  <div>6. <code>zodValidationMiddleware(schema)</code>: Validasi payload JSON input</div>
                  <div>7. <code>posController.createTransaction</code>: Eksekusi transaksi bisnis</div>
                  <div>8. <code>globalErrorHandler</code>: Menangkap error unhandled dan rollback SQL transaction</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DATABASE DESIGN & ERD */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h1 className="text-xl font-bold text-white">3. Desain Database & Entity Relationship Diagram (PostgreSQL)</h1>
              <p className="text-xs text-slate-400 mt-1">
                Skema relational database 12 tabel dengan foreign key, composite indexes, dan partisi tenant.
              </p>
            </div>

            {/* Visual ERD Diagram */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                Visual Entity Relationship Diagram (ERD):
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-900 p-3 rounded-lg border border-blue-500/40">
                  <div className="font-bold text-blue-400 pb-1 border-b border-slate-800">companies</div>
                  <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                    <div>* id (PK, VARCHAR)</div>
                    <div>· name (VARCHAR)</div>
                    <div>· tax_rate (NUMERIC)</div>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-emerald-500/40">
                  <div className="font-bold text-emerald-400 pb-1 border-b border-slate-800">users</div>
                  <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                    <div>* id (PK, UUID)</div>
                    <div>&rarr; company_id (FK)</div>
                    <div>· username (VARCHAR)</div>
                    <div>· password_hash</div>
                    <div>· role (ENUM)</div>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-amber-500/40">
                  <div className="font-bold text-amber-400 pb-1 border-b border-slate-800">products</div>
                  <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                    <div>* id (PK, UUID)</div>
                    <div>&rarr; company_id (FK)</div>
                    <div>· barcode (INDEX)</div>
                    <div>· sell_price (NUMERIC)</div>
                    <div>· stock (INT)</div>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-purple-500/40">
                  <div className="font-bold text-purple-400 pb-1 border-b border-slate-800">customers</div>
                  <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                    <div>* id (PK, UUID)</div>
                    <div>&rarr; company_id (FK)</div>
                    <div>· name (VARCHAR)</div>
                    <div>· tier (ENUM)</div>
                    <div>· points (INT)</div>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-rose-500/40">
                  <div className="font-bold text-rose-400 pb-1 border-b border-slate-800">pos_shifts</div>
                  <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                    <div>* id (PK, UUID)</div>
                    <div>&rarr; user_id (FK)</div>
                    <div>· initial_cash</div>
                    <div>· expected_cash</div>
                    <div>· actual_cash</div>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-indigo-500/40">
                  <div className="font-bold text-indigo-400 pb-1 border-b border-slate-800">transactions</div>
                  <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                    <div>* id (PK, UUID)</div>
                    <div>· invoice_no (UNIQUE)</div>
                    <div>&rarr; customer_id (FK)</div>
                    <div>&rarr; shift_id (FK)</div>
                    <div>· grand_total</div>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-cyan-500/40">
                  <div className="font-bold text-cyan-400 pb-1 border-b border-slate-800">transaction_items</div>
                  <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                    <div>* id (PK, UUID)</div>
                    <div>&rarr; transaction_id (FK)</div>
                    <div>&rarr; product_id (FK)</div>
                    <div>· qty, price, discount</div>
                    <div>· subtotal</div>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-teal-500/40">
                  <div className="font-bold text-teal-400 pb-1 border-b border-slate-800">payments</div>
                  <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                    <div>* id (PK, UUID)</div>
                    <div>&rarr; transaction_id (FK)</div>
                    <div>· method (ENUM)</div>
                    <div>· amount, trace_no</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table schema summary */}
            <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/80 space-y-2 text-xs">
              <h2 className="text-sm font-bold text-slate-200">Indeks dan Optimasi Kinerja PostgreSQL:</h2>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li><code>idx_products_barcode</code> ON <code>products(company_id, barcode)</code> untuk lookup barcode sub-millisecond.</li>
                <li><code>idx_transactions_invoice</code> ON <code>transactions(company_id, invoice_no)</code> untuk pencarian riwayat nota seketika.</li>
                <li><code>idx_transactions_date</code> ON <code>transactions(company_id, created_at)</code> untuk akselerasi laporan harian dan bulanan.</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 4: API DOCS & TESTER */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h1 className="text-xl font-bold text-white">4. API Documentation & Interactive REST Explorer</h1>
              <p className="text-xs text-slate-400 mt-1">
                Spesifikasi OpenAPI / REST endpoint yang digunakan oleh terminal kasir CATAT POS.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Endpoint List */}
              <div className="lg:col-span-5 space-y-2 text-xs">
                {[
                  {
                    method: 'POST',
                    url: '/api/v1/auth/login',
                    desc: 'Autentikasi login multi-tenant (Company ID: 99999, User: ADMIN)',
                    res: {
                      success: true,
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      user: { companyId: '99999', userId: 'ADMIN', role: 'ADMIN' },
                    },
                  },
                  {
                    method: 'GET',
                    url: '/api/v1/users',
                    desc: 'Daftar seluruh pengguna, kasir, supervisor, dan status aktif',
                    res: {
                      success: true,
                      count: 5,
                      users: [
                        { userId: 'ADMIN', name: 'Administrator', role: 'ADMIN', isActive: true },
                        { userId: 'KASIR1', name: 'Siti Aminah', role: 'KASIR', isActive: true },
                        { userId: 'SPV01', name: 'Hendra Wijaya', role: 'SUPERVISOR', isActive: true }
                      ]
                    },
                  },
                  {
                    method: 'POST',
                    url: '/api/v1/users',
                    desc: 'Tambah akun kasir baru beserta PIN dan hak otorisasi',
                    res: {
                      success: true,
                      message: 'User berhasil dibuat',
                      user: { userId: 'KASIR3', name: 'Dewi Lestari', role: 'KASIR', pin: '4567' }
                    },
                  },
                  {
                    method: 'GET',
                    url: '/api/v1/products',
                    desc: 'Ambil seluruh katalog produk beserta stok realtime',
                    res: {
                      success: true,
                      count: 20,
                      data: [
                        { code: 'MKN-001', name: 'Indomie Goreng', sellPrice: 3500 },
                        { code: 'MNM-001', name: 'Aqua 600ml', sellPrice: 4500 },
                      ],
                    },
                  },
                  {
                    method: 'POST',
                    url: '/api/v1/pos/checkout',
                    desc: 'Simpan transaksi penjualan baru & cetak nota instan',
                    res: {
                      success: true,
                      invoiceNo: 'PJ-202611-0001',
                      grandTotal: 185000,
                      status: 'LUNAS',
                      cashDrawerSignal: true,
                    },
                  },
                  {
                    method: 'POST',
                    url: '/api/v1/shifts/close',
                    desc: 'Tutup shift kasir, hitung uang fisik dan rekonsiliasi kas',
                    res: {
                      success: true,
                      shiftNumber: 1,
                      expectedCash: 1250000,
                      actualCash: 1250000,
                      cashDifference: 0,
                      status: 'CLOSED',
                    },
                  },
                  {
                    method: 'POST',
                    url: '/api/v1/pos/returns',
                    desc: 'Proses retur penjualan & refund kasir',
                    res: {
                      success: true,
                      returnNo: 'RET-20261106-102',
                      totalRefund: 35000,
                      refundProcessed: true,
                    },
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleTestApi(item.url, item.res)}
                    className="p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          item.method === 'POST' ? 'bg-emerald-900 text-emerald-300' : 'bg-blue-900 text-blue-300'
                        }`}
                      >
                        {item.method}
                      </span>
                      <span className="font-mono font-bold text-white text-[11px]">{item.url}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Live Request / Response Viewer */}
              <div className="lg:col-span-7 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-mono">
                    <span className="text-slate-400">Endpoint: <strong className="text-white">{apiEndpoint}</strong></span>
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[10px]">
                      HTTP 200 OK
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wide block mb-1 font-mono">
                      JSON Response Payload:
                    </span>
                    <pre className="p-3 bg-slate-900 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800 leading-relaxed">
                      {apiLoading ? 'Memproses request...' : apiResponse || JSON.stringify(
                        {
                          status: "success",
                          message: "Pilih endpoint di sebelah kiri untuk melihat simulasi response JSON API.",
                          endpoint: apiEndpoint,
                          serverTime: new Date().toISOString()
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
                  <span>Header: <code>Authorization: Bearer &lt;jwt_token&gt;</code></span>
                  <span className="text-emerald-400">REST Client Ready</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DATABASE MIGRATION SQL */}
        {activeTab === 'migrations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white">5. PostgreSQL Database Migration Script</h1>
                <p className="text-xs text-slate-400">
                  Script DDL lengkap untuk migrasi database PostgreSQL (12 tabel lengkap).
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(SQL_MIGRATION_SCRIPT, 'migration')}
                className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {copiedKey === 'migration' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'migration' ? 'Tersalin!' : 'Salin SQL Migration'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-200 font-mono text-xs rounded-xl border border-slate-800 overflow-x-auto max-h-[65vh] leading-relaxed">
              {SQL_MIGRATION_SCRIPT}
            </pre>
          </div>
        )}

        {/* TAB 6: SEED DATA SQL */}
        {activeTab === 'seeds' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white">6. Indonesian Retail Seed Data SQL</h1>
                <p className="text-xs text-slate-400">
                  Data awal (Company 99999, Akun ADMIN, Kategori, Produk Retail, Member) siap pakai.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(SQL_SEED_SCRIPT, 'seeds')}
                className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {copiedKey === 'seeds' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'seeds' ? 'Tersalin!' : 'Salin Seed SQL'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-200 font-mono text-xs rounded-xl border border-slate-800 overflow-x-auto max-h-[65vh] leading-relaxed">
              {SQL_SEED_SCRIPT}
            </pre>
          </div>
        )}

        {/* TAB 7: DOCKER DEPLOYMENT */}
        {activeTab === 'docker' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white">7. Docker & Deployment Configuration</h1>
                <p className="text-xs text-slate-400">
                  Dockerfile multi-stage dan docker-compose.yml (PostgreSQL 16, Node.js Express, & React Frontend).
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(DOCKER_COMPOSE_SCRIPT, 'docker')}
                className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {copiedKey === 'docker' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'docker' ? 'Tersalin!' : 'Salin Docker Compose'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-1">docker-compose.yml:</span>
                <pre className="p-3 bg-slate-950 text-slate-200 font-mono text-[11px] rounded-xl border border-slate-800 overflow-x-auto max-h-[55vh]">
                  {DOCKER_COMPOSE_SCRIPT}
                </pre>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-300 block mb-1">Dockerfile (Multi-Stage Node/React):</span>
                <pre className="p-3 bg-slate-950 text-slate-200 font-mono text-[11px] rounded-xl border border-slate-800 overflow-x-auto max-h-[55vh]">
                  {DOCKERFILE_SCRIPT}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: FOLDER STRUCTURE */}
        {activeTab === 'structure' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h1 className="text-xl font-bold text-white">8. Struktur Folder Lengkap Proyek</h1>
              <p className="text-xs text-slate-400">
                Arsitektur modular Clean Architecture untuk Fullstack Next.js/React + Express + PostgreSQL.
              </p>
            </div>

            <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 overflow-x-auto max-h-[65vh] leading-relaxed">
              {PROJECT_FOLDER_STRUCTURE}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

// Fallback icon
function LayoutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

// Scripts strings
const SQL_MIGRATION_SCRIPT = `-- =====================================================================
-- CATAT POS MIGRATION SCRIPT (PostgreSQL 14+)
-- Multi-Tenant Point of Sale Database Schema
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPANIES (Multi-Tenant Master)
CREATE TABLE companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255) DEFAULT 'Cabang Utama',
    phone VARCHAR(50),
    address TEXT,
    tax_enabled BOOLEAN DEFAULT FALSE,
    tax_rate NUMERIC(5,2) DEFAULT 11.00,
    receipt_header TEXT,
    receipt_footer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS (Kasir & Admin Authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'KASIR', -- 'ADMIN', 'KASIR', 'SUPERVISOR'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_company_userid UNIQUE (company_id, user_id)
);

-- 3. PRODUCT CATEGORIES
CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(100)
);

-- 4. PRODUCTS (Barang & Persediaan)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category_id VARCHAR(50) REFERENCES categories(id),
    unit VARCHAR(50) NOT NULL DEFAULT 'Pcs',
    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    sell_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    wholesale_price NUMERIC(15,2) DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_company_barcode UNIQUE (company_id, barcode),
    CONSTRAINT uq_company_code UNIQUE (company_id, code)
);

CREATE INDEX idx_products_barcode ON products(company_id, barcode);
CREATE INDEX idx_products_name ON products(company_id, name);

-- 5. CUSTOMERS & MEMBERS
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    tier VARCHAR(50) NOT NULL DEFAULT 'UMUM', -- 'UMUM', tier bawaan & tier kustom (mis. MEMBER_PLATINUM)
    discount_percent NUMERIC(5,2) DEFAULT 0,
    points INTEGER DEFAULT 0,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_code ON customers(company_id, code);

-- 5b. POIN PER PRODUK, MASA AKTIF & NILAI TUKAR
CREATE TABLE point_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    active_from DATE,
    active_until DATE,
    redeem_value NUMERIC(15,2) NOT NULL DEFAULT 0, -- Rupiah per 1 poin
    min_redeem_points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE product_points (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    points_per_unit INTEGER NOT NULL DEFAULT 0
);

-- 6. POS SHIFTS (Sesi Kasir & Buka-Tutup Laci)
CREATE TABLE pos_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shift_number INTEGER NOT NULL,
    cashier_id UUID NOT NULL REFERENCES users(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    initial_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_non_cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_cash_in NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_cash_out NUMERIC(15,2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(15,2),
    cash_difference NUMERIC(15,2),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
    notes TEXT
);

-- 7. CASH MOVEMENTS (Kas Operasional Masuk & Keluar)
CREATE TABLE cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES pos_shifts(id),
    type VARCHAR(20) NOT NULL, -- 'MASUK', 'KELUAR'
    amount NUMERIC(15,2) NOT NULL,
    reason TEXT NOT NULL,
    cashier_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TRANSACTIONS (Nota Penjualan POS)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_no VARCHAR(100) NOT NULL,
    shift_id UUID REFERENCES pos_shifts(id),
    cashier_id UUID REFERENCES users(id),
    cashier_name VARCHAR(100) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(255) NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL,
    discount_total NUMERIC(15,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(15,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15,2) NOT NULL,
    pay_amount NUMERIC(15,2) NOT NULL,
    change_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'LUNAS', -- 'LUNAS', 'PIUTANG', 'BATAL'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_company_invoice UNIQUE (company_id, invoice_no)
);

CREATE INDEX idx_transactions_invoice ON transactions(company_id, invoice_no);
CREATE INDEX idx_transactions_created ON transactions(company_id, created_at);

-- 9. TRANSACTION ITEMS
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    qty INTEGER NOT NULL,
    unit VARCHAR(50) NOT NULL,
    cost_price NUMERIC(15,2) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    discount_rp NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15,2) NOT NULL
);

-- 10. PAYMENTS (Multi Payment Support)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL, -- 'TUNAI', 'QRIS', 'DEBIT', 'KREDIT', 'TRANSFER', 'PIUTANG'
    amount NUMERIC(15,2) NOT NULL,
    bank_name VARCHAR(50),
    card_last_four VARCHAR(10),
    trace_number VARCHAR(100),
    qr_ref VARCHAR(100),
    due_date DATE
);

-- 11. HELD ORDERS (Tahan Transaksi / Park Bill)
CREATE TABLE held_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    hold_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    subtotal NUMERIC(15,2) NOT NULL,
    items_json JSONB NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. SALES RETURNS (Retur Penjualan)
CREATE TABLE sales_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    return_no VARCHAR(100) NOT NULL,
    invoice_no VARCHAR(100) NOT NULL,
    total_refund NUMERIC(15,2) NOT NULL,
    refund_method VARCHAR(50) NOT NULL,
    cashier_name VARCHAR(100) NOT NULL,
    items_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

const SQL_SEED_SCRIPT = `-- =====================================================================
-- CATAT POS SEED SCRIPT
-- Default Tenant, Admin Account & Indonesian Retail Inventory
-- =====================================================================

-- 1. Insert Company Tenant (ID 99999)
INSERT INTO companies (id, name, branch_name, phone, address, tax_enabled, tax_rate, receipt_header, receipt_footer)
VALUES (
    '99999',
    'TOKO BERKAH SEJAHTERA',
    'Cabang Utama Jakarta',
    '(021) 4589-1234',
    'Jl. Boulevard Raya Blok A2 No. 10, Kelapa Gading',
    FALSE,
    11.00,
    'Selamat Datang di Toko Berkah',
    'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.\\nTerima Kasih Atas Kunjungan Anda!'
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert User (ID: ADMIN, Password: 99999psfdv)
-- password_hash represents bcrypt hash of '99999psfdv'
INSERT INTO users (company_id, user_id, name, password_hash, role)
VALUES (
    '99999',
    'ADMIN',
    'ADMINISTRATOR',
    '$2a$10$e8T7O6m0o5Z0pTq/b1F5k.aK4tWbHwS29mSgA9u001Z9eF3P2lKeq',
    'ADMIN'
) ON CONFLICT ON CONSTRAINT uq_company_userid DO NOTHING;

-- 3. Categories
INSERT INTO categories (id, company_id, name) VALUES
('cat-makanan', '99999', 'Makanan Instan'),
('cat-minuman', '99999', 'Minuman Dingin & Panas'),
('cat-sembako', '99999', 'Sembako & Bumbu'),
('cat-snack', '99999', 'Snack & Biskuit'),
('cat-perawatan', '99999', 'Perawatan Tubuh'),
('cat-rokok', '99999', 'Rokok & Tembakau')
ON CONFLICT (id) DO NOTHING;

-- 4. Sample Products
INSERT INTO products (company_id, code, barcode, name, category_id, unit, cost_price, sell_price, wholesale_price, stock, min_stock) VALUES
('99999', 'MKN-001', '899999900101', 'Indomie Goreng Spesial 85g', 'cat-makanan', 'Bks', 2800, 3500, 3200, 140, 20),
('99999', 'MNM-001', '899999900201', 'Aqua Air Mineral Botol 600ml', 'cat-minuman', 'Btl', 3000, 4500, 3800, 180, 30),
('99999', 'SMB-001', '899999900301', 'Minyak Goreng Sania Pouch 2 Liter', 'cat-sembako', 'Pouch', 32000, 38000, 35500, 50, 10),
('99999', 'SNK-001', '899999900401', 'Chitato Sapi Panggang 68g', 'cat-snack', 'Bks', 9000, 12000, 10800, 35, 8),
('99999', 'PRW-001', '899999900501', 'Sabun Mandi Lifebuoy Total 10', 'cat-perawatan', 'Batang', 3800, 5000, 4400, 60, 12),
('99999', 'RKK-001', '899999900701', 'Sampoerna A Mild 16 Batang', 'cat-rokok', 'Bks', 33500, 36000, 35000, 80, 20)
ON CONFLICT ON CONSTRAINT uq_company_barcode DO NOTHING;

-- 5. Customers
INSERT INTO customers (company_id, code, name, phone, tier, discount_percent, points) VALUES
('99999', 'PLG-0000', 'Umum (Walk-in)', '-', 'UMUM', 0, 0),
('99999', 'PLG-0001', 'Budi Santoso', '081234567890', 'MEMBER_GOLD', 5.00, 350),
('99999', 'PLG-0002', 'Siti Rahmawati', '085678912345', 'MEMBER_SILVER', 2.00, 120),
('99999', 'PLG-0003', 'Toko Berkah Bersama (Mitra Grosir)', '081398765432', 'GROSIR', 8.00, 1250);`;

const DOCKER_COMPOSE_SCRIPT = `version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: ketoko_postgres
    restart: always
    environment:
      POSTGRES_DB: ketoko_pos_db
      POSTGRES_USER: ketoko_user
      POSTGRES_PASSWORD: ketoko_secure_password_99999
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ketoko_user -d ketoko_pos_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: docker/Dockerfile.backend
    container_name: ketoko_api
    restart: always
    environment:
      PORT: 4000
      DATABASE_URL: postgres://ketoko_user:ketoko_secure_password_99999@postgres:5432/ketoko_pos_db
      JWT_SECRET: ketoko_super_secret_jwt_key_2026
      NODE_ENV: production
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
    container_name: ketoko_web_pos
    restart: always
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
    driver: local`;

const DOCKERFILE_SCRIPT = `# Multi-Stage Build for React / Next.js POS Frontend & Express API
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;

const PROJECT_FOLDER_STRUCTURE = `ketoko-pos-fullstack/
├── db/
│   ├── migrations/
│   │   └── 001_initial_schema.sql       # 12 Tabel PostgreSQL & Index
│   └── seeds/
│       └── 001_indonesian_retail.sql   # Seed Data Retail Indonesia
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── docker-compose.yml              # PostgreSQL + Express + Nginx
│   └── nginx.conf
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts             # PostgreSQL Connection Pool (pg)
│   │   ├── controllers/
│   │   │   ├── authController.ts       # Login multi-tenant (Company 99999)
│   │   │   ├── posController.ts        # Transaksi penjualan & antrean hold
│   │   │   ├── productController.ts    # CRUD Produk & Barcode lookup
│   │   │   ├── shiftController.ts      # Buka / Tutup Kasir & Rekonsiliasi
│   │   │   └── reportController.ts     # Rekap Omset & Pembayaran
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts       # JWT Validation & Tenant Scope
│   │   │   └── validationMiddleware.ts # Zod Payload Validator
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── posRoutes.ts
│   │   │   ├── productRoutes.ts
│   │   │   └── shiftRoutes.ts
│   │   └── server.ts                   # Express Entrypoint (Port 4000)
│   └── package.json
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx          # Rail navigasi kiri (collapsible + drawer)
│   │   │   ├── TopBar.tsx              # Cabang, shift, jam, user, logout
│   │   │   └── PosShortcutStrip.tsx    # Strip shortcut F1-F12 terminal kasir
│   │   ├── pos/
│   │   │   ├── PosHeader.tsx           # Header lama (tidak dipakai, referensi)
│   │   │   ├── ProductCatalog.tsx      # Barcode scanner input & touch grid
│   │   │   ├── CartPanel.tsx           # Keranjang, Qty, LED Total Display
│   │   │   ├── PaymentModal.tsx        # Tunai, QRIS, Kartu, Piutang
│   │   │   ├── RedeemPointsModal.tsx   # Tukar Poin Member di Kasir
│   │   │   ├── ReceiptModal.tsx        # Thermal Receipt 58mm/80mm preview
│   │   │   ├── ShiftModal.tsx          # Buka/Tutup Kasir & Denominasi Fisik
│   │   │   ├── HoldOrdersModal.tsx     # Tahan/Pending Transaksi (F7)
│   │   │   ├── SalesHistoryModal.tsx   # Riwayat Nota & Cetak Ulang (F9)
│   │   │   └── ReturnModal.tsx         # Retur Penjualan & Refund Kasir
│   │   ├── master/
│   │   │   ├── MasterDataView.tsx      # Manajemen Produk & Pelanggan
│   │   │   ├── MasterBrandView.tsx     # Registri Brand & Identitas Outlet
│   │   │   ├── MasterMemberView.tsx    # Pengaturan Tier Member (Diskon & Poin)
│   │   │   ├── MasterPointView.tsx     # Poin per Produk, Masa Aktif & Tukar Poin
│   │   │   └── masterTabs.ts           # Definisi submenu Master Data
│   │   ├── reports/
│   │   │   ├── ReportsView.tsx         # Omset & Audit Shift Rekonsiliasi
│   │   │   └── reportTabs.ts           # Definisi submenu Laporan
│   │   └── docs/
│   │       └── ArchitectureDocsView.tsx# Analisis Sistem, ERD, API, Docker
│   ├── types/
│   │   └── pos.ts                      # TypeScript Interfaces
│   ├── services/
│   │   └── storageService.ts           # State & Web Audio Beeps
│   ├── App.tsx                         # Root Controller & Global Shortcuts
│   └── main.tsx
├── package.json
└── README.md`;
