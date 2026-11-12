import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Calendar, 
  User as UserIcon, 
  Building2, 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  Trash2, 
  Clock, 
  ShieldCheck, 
  CreditCard, 
  Coins, 
  Boxes, 
  Settings, 
  LogIn, 
  LogOut, 
  UserCog, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  FileText, 
  Layers, 
  X,
  Store,
  ChevronRight,
  TrendingUp,
  Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UserActivityLog, UserActivityCategory, UserActivityAction, User as PosUser, Outlet } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';

interface UserActivityLogViewProps {
  logs: UserActivityLog[];
  users: PosUser[];
  outlets: Outlet[];
  currentUser?: PosUser | null;
  onRefreshLogs?: () => void;
  onClearLogs?: () => void;
  onSelectUserFilter?: (userId: string) => void;
  initialUserIdFilter?: string;
}

export const UserActivityLogView: React.FC<UserActivityLogViewProps> = ({
  logs,
  users,
  outlets,
  currentUser,
  onRefreshLogs,
  onClearLogs,
  initialUserIdFilter,
}) => {
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>(initialUserIdFilter || 'ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH'>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [selectedLogDetail, setSelectedLogDetail] = useState<UserActivityLog | null>(null);

  // Helper for category visual styling
  const getCategoryBadge = (category: UserActivityCategory) => {
    switch (category) {
      case 'AUTH':
        return {
          label: 'Autentikasi & Sesi',
          bg: 'bg-indigo-100',
          text: 'text-indigo-800',
          border: 'border-indigo-300',
          icon: LogIn,
        };
      case 'TRANSACTION':
        return {
          label: 'Penjualan & Nota',
          bg: 'bg-emerald-100',
          text: 'text-emerald-800',
          border: 'border-emerald-300',
          icon: CreditCard,
        };
      case 'CASH':
        return {
          label: 'Kas & Shift',
          bg: 'bg-amber-100',
          text: 'text-amber-800',
          border: 'border-amber-300',
          icon: Coins,
        };
      case 'MASTER_DATA':
        return {
          label: 'Master Data',
          bg: 'bg-blue-100',
          text: 'text-blue-800',
          border: 'border-blue-300',
          icon: Boxes,
        };
      case 'SYSTEM':
        return {
          label: 'Sistem & User',
          bg: 'bg-purple-100',
          text: 'text-purple-800',
          border: 'border-purple-300',
          icon: UserCog,
        };
      default:
        return {
          label: category,
          bg: 'bg-slate-100',
          text: 'text-slate-800',
          border: 'border-slate-300',
          icon: Activity,
        };
    }
  };

  // Helper for action visual badge
  const getActionBadge = (action: UserActivityAction) => {
    switch (action) {
      case 'LOGIN':
        return { label: 'LOGIN', color: 'bg-emerald-600 text-white' };
      case 'LOGOUT':
        return { label: 'LOGOUT', color: 'bg-slate-600 text-white' };
      case 'SWITCH_USER':
        return { label: 'GANTI USER', color: 'bg-indigo-600 text-white' };
      case 'SWITCH_OUTLET':
        return { label: 'PINDAH CABANG', color: 'bg-cyan-600 text-white' };
      case 'TRANSACTION_CREATE':
        return { label: 'TRANSAKSI BARU', color: 'bg-emerald-700 text-white' };
      case 'TRANSACTION_HOLD':
        return { label: 'TAHAN TRANSAKSI', color: 'bg-orange-600 text-white' };
      case 'TRANSACTION_RESUME':
        return { label: 'BUKA TAHANAN', color: 'bg-blue-600 text-white' };
      case 'TRANSACTION_VOID':
        return { label: 'VOID TRANSAKSI', color: 'bg-rose-600 text-white' };
      case 'TRANSACTION_EDIT':
        return { label: 'KOREKSI NOTA', color: 'bg-amber-600 text-white' };
      case 'TRANSACTION_RETURN':
        return { label: 'RETUR PENJUALAN', color: 'bg-rose-700 text-white' };
      case 'SHIFT_OPEN':
        return { label: 'BUKA SHIFT', color: 'bg-teal-600 text-white' };
      case 'SHIFT_CLOSE':
        return { label: 'TUTUP SHIFT', color: 'bg-slate-700 text-white' };
      case 'CASH_MOVEMENT':
        return { label: 'KAS OPERASIONAL', color: 'bg-amber-700 text-white' };
      case 'DRAWER_OPEN':
        return { label: 'BUKA LACI', color: 'bg-cyan-700 text-white' };
      case 'PRODUCT_CREATE':
        return { label: '+ PRODUK', color: 'bg-blue-600 text-white' };
      case 'PRODUCT_UPDATE':
        return { label: 'EDIT PRODUK', color: 'bg-blue-700 text-white' };
      case 'PRODUCT_DELETE':
        return { label: 'HAPUS PRODUK', color: 'bg-rose-600 text-white' };
      case 'PACKAGE_CREATE':
        return { label: '+ PRODUK PAKET', color: 'bg-amber-600 text-white' };
      case 'PACKAGE_UPDATE':
        return { label: 'EDIT PAKET', color: 'bg-amber-700 text-white' };
      case 'PACKAGE_DELETE':
        return { label: 'HAPUS PAKET', color: 'bg-rose-600 text-white' };
      case 'EXCEL_IMPORT':
        return { label: 'UPLOAD EXCEL', color: 'bg-emerald-600 text-white' };
      case 'USER_CREATE':
        return { label: '+ USER', color: 'bg-purple-600 text-white' };
      case 'USER_UPDATE':
        return { label: 'EDIT USER', color: 'bg-purple-700 text-white' };
      case 'USER_DELETE':
        return { label: 'HAPUS USER', color: 'bg-rose-600 text-white' };
      case 'OUTLET_CREATE':
        return { label: '+ CABANG', color: 'bg-indigo-600 text-white' };
      case 'OUTLET_UPDATE':
        return { label: 'EDIT CABANG', color: 'bg-indigo-700 text-white' };
      case 'SETTINGS_UPDATE':
        return { label: 'PENGATURAN', color: 'bg-slate-700 text-white' };
      case 'DATABASE_RESET':
        return { label: 'RESET DB', color: 'bg-rose-900 text-white' };
      default:
        return { label: action, color: 'bg-slate-500 text-white' };
    }
  };

  // Date filtering logic
  const filteredLogs = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toLocaleDateString('en-CA');

    return logs.filter((log) => {
      // User filter
      if (selectedUserFilter !== 'ALL' && log.userId !== selectedUserFilter) {
        return false;
      }

      // Role filter
      if (selectedRoleFilter !== 'ALL' && log.userRole !== selectedRoleFilter) {
        return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'ALL' && log.category !== selectedCategoryFilter) {
        return false;
      }

      // Outlet filter
      if (selectedOutletFilter !== 'ALL' && log.outletId !== selectedOutletFilter) {
        return false;
      }

      // Date Range filter
      if (selectedDateRange === 'TODAY' && log.date !== todayStr) {
        return false;
      }
      if (selectedDateRange === 'YESTERDAY' && log.date !== yesterdayStr) {
        return false;
      }
      if (selectedDateRange === 'WEEK') {
        const logDate = new Date(log.timestamp || log.date);
        if (logDate < sevenDaysAgo) return false;
      }
      if (selectedDateRange === 'MONTH' && log.date < monthStartStr) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesUser =
          log.userName.toLowerCase().includes(q) ||
          log.userId.toLowerCase().includes(q) ||
          log.userRole.toLowerCase().includes(q);
        const matchesContent =
          log.title.toLowerCase().includes(q) ||
          log.description.toLowerCase().includes(q) ||
          (log.outletName && log.outletName.toLowerCase().includes(q));
        const matchesMeta =
          log.metadata &&
          JSON.stringify(log.metadata).toLowerCase().includes(q);

        if (!matchesUser && !matchesContent && !matchesMeta) {
          return false;
        }
      }

      return true;
    });
  }, [
    logs,
    selectedUserFilter,
    selectedRoleFilter,
    selectedCategoryFilter,
    selectedOutletFilter,
    selectedDateRange,
    searchTerm,
  ]);

  // KPI Statistics
  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayCount = logs.filter((l) => l.date === todayStr).length;
  const transactionCount = logs.filter((l) => l.category === 'TRANSACTION').length;
  const cashCount = logs.filter((l) => l.category === 'CASH').length;
  const systemMasterCount = logs.filter((l) => l.category === 'MASTER_DATA' || l.category === 'SYSTEM').length;

  // Export to Excel handler
  const handleExportToExcel = () => {
    try {
      if (filteredLogs.length === 0) {
        alert('Tidak ada data log yang cocok untuk diekspor ke Excel.');
        return;
      }

      const rows = filteredLogs.map((log, index) => {
        return {
          'No': index + 1,
          'ID Log': log.id,
          'Tanggal': log.date,
          'Waktu': log.time,
          'User ID': log.userId,
          'Nama Pengguna': log.userName,
          'Role': log.userRole,
          'Cabang / Outlet': log.outletName || '-',
          'Kategori': log.category,
          'Tipe Aksi': log.action,
          'Judul Aktivitas': log.title,
          'Detail Deskripsi': log.description,
          'Perangkat / IP': log.ipOrDevice || '-',
          'Metadata': log.metadata ? JSON.stringify(log.metadata) : '-',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 14 },  // ID Log
        { wch: 12 },  // Tanggal
        { wch: 10 },  // Waktu
        { wch: 12 },  // User ID
        { wch: 20 },  // Nama Pengguna
        { wch: 12 },  // Role
        { wch: 25 },  // Cabang
        { wch: 15 },  // Kategori
        { wch: 18 },  // Tipe Aksi
        { wch: 30 },  // Judul
        { wch: 45 },  // Deskripsi
        { wch: 25 },  // Perangkat
        { wch: 30 },  // Metadata
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Log_Aktivitas_User');
      XLSX.writeFile(wb, `audit_log_aktivitas_user_${todayStr}.xlsx`);
      playBeep('success');
    } catch (err) {
      console.error('Error exporting logs to excel:', err);
      alert('Gagal mengekspor log ke Excel.');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto p-4 sm:p-6 select-none">
      <div className="max-w-6xl w-full mx-auto space-y-5">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-purple-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                AUDIT TRAIL & LOG SISTEM
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {logs.length} Total Rekam Aktivitas
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Log History Aktivitas Pengguna (Audit Trail)
            </h1>
            <p className="text-xs text-slate-500">
              Mencatat seluruh tindakan operasional kasir, supervisor, dan admin (login, penjualan, tutup shift, buka laci, koreksi nota, dan perubahan data) secara akuntabel.
            </p>
          </div>

          {/* Action buttons (Export Excel, Refresh, Clear) */}
          <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Ekspor seluruh riwayat log yang terfilter ke format spreadsheet Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
              <span>Export Excel</span>
            </button>

            {onRefreshLogs && (
              <button
                onClick={() => {
                  onRefreshLogs();
                  playBeep('scan');
                }}
                className="flex items-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Muat ulang log aktivitas terbaru"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            {onClearLogs && currentUser?.role === 'ADMIN' && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      'Peringatan Keamanan: Apakah Anda yakin ingin mengosongkan riwayat log aktivitas pengguna? Tindakan ini tidak dapat dibatalkan.'
                    )
                  ) {
                    onClearLogs();
                    playBeep('delete');
                  }
                }}
                className="flex items-center gap-1.5 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Hanya Super Admin yang dapat membersihkan log"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Bersihkan Log</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Aktivitas
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {logs.length}
              </h3>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                <span>{todayCount} aktivitas hari ini</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Aktivitas Transaksi
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {transactionCount}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Nota, Hold, Void, Retur
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Kas & Shift Kasir
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {cashCount}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Buka/Tutup Shift, Laci Kasir
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Master & Konfigurasi
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {systemMasterCount}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Produk, Paket, User, Cabang
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter Toolbar Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          {/* Top Row: Search input + View mode toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama user, username, no. nota, judul aktivitas, atau detail..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                  title="Hapus pencarian"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tabel Rinci
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    viewMode === 'timeline'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Timeline Kronologis
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: Multi-Dropdown Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs">
            {/* 1. User Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Filter Pengguna:
              </label>
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="ALL">Semua Pengguna ({users.length})</option>
                {users.map((u) => (
                  <option key={u.id} value={u.userId}>
                    {u.name} ({u.userId}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Role Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Role Akses:
              </label>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="ALL">Semua Role</option>
                <option value="ADMIN">ADMIN / Owner</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="KASIR">KASIR</option>
                <option value="GUDANG">GUDANG</option>
              </select>
            </div>

            {/* 3. Category Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Kategori Aktivitas:
              </label>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="AUTH">🔑 Autentikasi & Sesi</option>
                <option value="TRANSACTION">💳 Penjualan & Nota</option>
                <option value="CASH">🪙 Kas & Shift Kasir</option>
                <option value="MASTER_DATA">📦 Master Data & Produk</option>
                <option value="SYSTEM">⚙️ Sistem & Pengguna</option>
              </select>
            </div>

            {/* 4. Outlet Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Cabang / Outlet:
              </label>
              <select
                value={selectedOutletFilter}
                onChange={(e) => setSelectedOutletFilter(e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="ALL">Semua Cabang ({outlets.length})</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    🏪 {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Date Range Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Periode Waktu:
              </label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value as any)}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="ALL">Semua Waktu</option>
                <option value="TODAY">Hari Ini</option>
                <option value="YESTERDAY">Kemarin</option>
                <option value="WEEK">7 Hari Terakhir</option>
                <option value="MONTH">Bulan Ini</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips / Reset */}
          {(selectedUserFilter !== 'ALL' ||
            selectedRoleFilter !== 'ALL' ||
            selectedCategoryFilter !== 'ALL' ||
            selectedOutletFilter !== 'ALL' ||
            selectedDateRange !== 'ALL' ||
            searchTerm) && (
            <div className="flex items-center gap-2 pt-2 text-xs flex-wrap">
              <span className="text-slate-500 font-medium">Filter Aktif:</span>
              {selectedUserFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                  User: {selectedUserFilter}
                  <button onClick={() => setSelectedUserFilter('ALL')}>✕</button>
                </span>
              )}
              {selectedRoleFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold">
                  Role: {selectedRoleFilter}
                  <button onClick={() => setSelectedRoleFilter('ALL')}>✕</button>
                </span>
              )}
              {selectedCategoryFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                  Kategori: {selectedCategoryFilter}
                  <button onClick={() => setSelectedCategoryFilter('ALL')}>✕</button>
                </span>
              )}
              {selectedOutletFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[11px] font-bold">
                  Outlet: {outlets.find((o) => o.id === selectedOutletFilter)?.name || selectedOutletFilter}
                  <button onClick={() => setSelectedOutletFilter('ALL')}>✕</button>
                </span>
              )}
              {selectedDateRange !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                  Periode: {selectedDateRange}
                  <button onClick={() => setSelectedDateRange('ALL')}>✕</button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                  Kata Kunci: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')}>✕</button>
                </span>
              )}
              <button
                onClick={() => {
                  setSelectedUserFilter('ALL');
                  setSelectedRoleFilter('ALL');
                  setSelectedCategoryFilter('ALL');
                  setSelectedOutletFilter('ALL');
                  setSelectedDateRange('ALL');
                  setSearchTerm('');
                }}
                className="text-[11px] text-blue-600 hover:text-blue-800 underline font-semibold ml-auto"
              >
                Reset Semua Filter
              </button>
            </div>
          )}
        </div>

        {/* Content View: Table or Timeline */}
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-1" />
            <h3 className="text-base font-bold text-slate-800">
              Tidak Ada Log Aktivitas yang Cocok
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Tidak ditemukan data riwayat aktivitas yang sesuai dengan kriteria pencarian dan filter yang dipilih. Coba reset filter atau ubah kata kunci.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* TABULAR AUDIT TABLE */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Menampilkan <strong>{filteredLogs.length}</strong> dari total {logs.length} catatan aktivitas
              </span>
              <span className="font-mono text-[11px]">
                Diurutkan berdasarkan waktu terbaru (Descending)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 w-36">Waktu & Tanggal</th>
                    <th className="py-2.5 px-3">Pengguna</th>
                    <th className="py-2.5 px-3">Cabang / Outlet</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Aksi</th>
                    <th className="py-2.5 px-4">Deskripsi Aktivitas</th>
                    <th className="py-2.5 px-3 text-center w-20">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    const catBadge = getCategoryBadge(log.category);
                    const actBadge = getActionBadge(log.action);
                    const CatIcon = catBadge.icon;

                    return (
                      <tr 
                        key={log.id} 
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => setSelectedLogDetail(log)}
                      >
                        {/* 1. Timestamp */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs">{log.time}</div>
                          <div className="text-[10px] text-slate-400">{log.date}</div>
                        </td>

                        {/* 2. User */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px] shrink-0 uppercase">
                              {log.userName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1">
                                <span>{log.userName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span className="font-mono">{log.userId}</span>
                                <span>·</span>
                                <span className="font-semibold text-slate-600">{log.userRole}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Outlet */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800 text-xs">
                            {log.outletName || 'Pusat (HQ)'}
                          </div>
                          {log.outletId && (
                            <div className="text-[10px] font-mono text-slate-400">
                              {log.outletId}
                            </div>
                          )}
                        </td>

                        {/* 4. Category */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}>
                            <CatIcon className="w-3 h-3" />
                            <span>{catBadge.label}</span>
                          </span>
                        </td>

                        {/* 5. Action Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-tight ${actBadge.color}`}>
                            {actBadge.label}
                          </span>
                        </td>

                        {/* 6. Title & Description */}
                        <td className="py-3 px-4 max-w-md">
                          <div className="font-bold text-slate-900 text-xs">
                            {log.title}
                          </div>
                          <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                            {log.description}
                          </div>
                          {log.metadata?.invoiceNo && (
                            <span className="inline-block mt-1 font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                              Nota: {log.metadata.invoiceNo}
                            </span>
                          )}
                        </td>

                        {/* 7. Action Button */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLogDetail(log);
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Detail Log"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TIMELINE KRONOLOGIS */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {filteredLogs.map((log) => {
                const catBadge = getCategoryBadge(log.category);
                const actBadge = getActionBadge(log.action);
                const CatIcon = catBadge.icon;

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline bullet dot */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-slate-400 group-hover:border-blue-600 flex items-center justify-center transition-colors">
                      <div className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-blue-600"></div>
                    </div>

                    <div 
                      onClick={() => setSelectedLogDetail(log)}
                      className="bg-slate-50 hover:bg-slate-100/80 p-4 rounded-xl border border-slate-200 transition-all cursor-pointer space-y-2"
                    >
                      {/* Top timeline row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}>
                            <CatIcon className="w-3 h-3" />
                            <span>{catBadge.label}</span>
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${actBadge.color}`}>
                            {actBadge.label}
                          </span>

                          <span className="font-bold text-slate-800">
                            {log.userName} ({log.userId})
                          </span>

                          <span className="text-slate-400">·</span>

                          <span className="text-slate-600">
                            {log.outletName || 'Cabang Pusat'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{log.date} {log.time}</span>
                        </div>
                      </div>

                      {/* Content row */}
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {log.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {log.description}
                        </p>
                      </div>

                      {/* Device & Metadata tags */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                        <span className="font-mono">
                          Terminal: {log.ipOrDevice || 'Web Client'}
                        </span>
                        <span className="text-blue-600 font-medium group-hover:underline flex items-center gap-0.5">
                          Detail Audit <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* POPUP MODAL: DETAIL AUDIT LOG */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold">Rincian Lengkap Audit Aktivitas</h3>
                  <p className="text-[10px] text-slate-400 font-mono">ID: {selectedLogDetail.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              {/* Main Badge & Title */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const catBadge = getCategoryBadge(selectedLogDetail.category);
                    const actBadge = getActionBadge(selectedLogDetail.action);
                    return (
                      <>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${actBadge.color}`}>
                          {actBadge.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}>
                          {catBadge.label}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  {selectedLogDetail.title}
                </h4>
                <p className="text-slate-700 leading-relaxed">
                  {selectedLogDetail.description}
                </p>
              </div>

              {/* User & Terminal Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Pelaku Aktivitas (User):
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedLogDetail.userName}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    User ID: {selectedLogDetail.userId}
                  </div>
                  <div className="mt-1">
                    <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded">
                      {selectedLogDetail.userRole}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Waktu & Tanggal:
                  </span>
                  <div className="font-bold text-slate-900 text-sm font-mono">
                    {selectedLogDetail.time} WIB
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {selectedLogDetail.date}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1 truncate" title={selectedLogDetail.timestamp}>
                    ISO: {selectedLogDetail.timestamp}
                  </div>
                </div>
              </div>

              {/* Outlet and Terminal device */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Cabang / Outlet:</span>
                  <span className="font-bold text-slate-900">
                    {selectedLogDetail.outletName || 'Cabang Utama / Pusat'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Terminal / Perangkat:</span>
                  <span className="font-mono text-slate-800 text-[11px]">
                    {selectedLogDetail.ipOrDevice || 'Terminal Kasir Web POS'}
                  </span>
                </div>
              </div>

              {/* Metadata JSON if present */}
              {selectedLogDetail.metadata && Object.keys(selectedLogDetail.metadata).length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Parameter Teknis / Metadata:
                  </span>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLogDetail.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="py-1.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
