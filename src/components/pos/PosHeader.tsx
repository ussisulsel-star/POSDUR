import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Clock, 
  Coins, 
  PauseCircle, 
  History, 
  RotateCcw, 
  HelpCircle, 
  LogOut, 
  FileText, 
  Boxes, 
  Layers, 
  CreditCard,
  Maximize2,
  Minimize2,
  UserCog,
  Store
} from 'lucide-react';
import { Shift, User as PosUser, Outlet } from '../../types/pos';
import { playBeep } from '../../services/storageService';
import {
  AppTab,
  canAccessMasterData,
  canAccessTab,
  canOpenDrawer,
  canReturn,
  canViewDocs,
  canViewReports,
  getPermittedOutlets,
} from '../../services/accessControl';

interface PosHeaderProps {
  user: PosUser;
  activeShift: Shift | null;
  heldCount: number;
  outlets: Outlet[];
  activeOutlet: Outlet;
  onSelectOutlet: (outlet: Outlet) => void;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onOpenShiftModal: () => void;
  onOpenHoldModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenReturnModal: () => void;
  onOpenShortcutsModal: () => void;
  onOpenCashMovementModal: () => void;
  onLogout: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({
  user,
  activeShift,
  heldCount,
  outlets,
  activeOutlet,
  onSelectOutlet,
  activeTab,
  setActiveTab,
  onOpenShiftModal,
  onOpenHoldModal,
  onOpenHistoryModal,
  onOpenReturnModal,
  onOpenShortcutsModal,
  onOpenCashMovementModal,
  onLogout,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleOpenCashDrawer = () => {
    playBeep('success');
    alert('Simulasi: Perintah Buka Laci Kasir (ESC/POS Drawer Kick Pulse 27,112,0,25,250) dikirim ke Printer!');
  };

  return (
    <header className="bg-slate-900 text-white select-none border-b border-slate-800 shadow-md">
      {/* Top Bar with brand & main sections */}
      <div className="flex items-center justify-between px-4 py-2.5 gap-4">
        {/* Brand & Multi-Tenant Info */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="font-extrabold tracking-wider text-base uppercase">CATAT</span>
            <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded font-mono font-bold tracking-tight">POS</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-md border border-slate-700/60">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-white">ID: {user.companyId || '99999'}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">Toko Berkah Sejahtera</span>
          </div>

          {/* Active Outlet Dropdown / Permission-Restricted Branch Selector */}
          {(() => {
            const permittedOutlets = getPermittedOutlets(user, outlets);
            const activeIsPermitted = permittedOutlets.some((o) => o.id === activeOutlet.id);
            const displayOutlet = activeIsPermitted ? activeOutlet : permittedOutlets[0];

            if (permittedOutlets.length === 0) {
              return (
                <div
                  className="hidden sm:flex items-center gap-1.5 text-xs text-rose-300 bg-rose-950/60 px-2.5 py-1.5 rounded-md border border-rose-800/60"
                  title="Akun ini tidak memiliki akses ke cabang mana pun"
                >
                  <Store className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="font-bold">Tidak ada akses cabang</span>
                </div>
              );
            }

            return (
              <div 
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-md border border-slate-700/60"
                title={permittedOutlets.length === 1 ? `Pengguna dibatasi hanya pada cabang: ${displayOutlet?.name}` : `Ganti Cabang Aktif (${permittedOutlets.length} cabang diizinkan)`}
              >
                <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {permittedOutlets.length > 1 ? (
                  <select
                    value={displayOutlet?.id || ''}
                    onChange={(e) => {
                      const found = permittedOutlets.find((o) => o.id === e.target.value);
                      if (found) {
                        playBeep('scan');
                        onSelectOutlet(found);
                      }
                    }}
                    title="Ganti Cabang Aktif"
                    className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer max-w-[170px] truncate"
                  >
                    {permittedOutlets.map((o) => (
                      <option key={o.id} value={o.id} className="bg-slate-900 text-white">
                        {o.brand ? `[${o.brand}] ` : ''}{o.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1 max-w-[180px] truncate">
                    <span className="font-bold text-white text-xs truncate">
                      {displayOutlet?.brand ? `[${displayOutlet.brand}] ` : ''}{displayOutlet?.name}
                    </span>
                    <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1 py-0.2 rounded font-mono">
                      Terkunci
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-1.5 text-xs bg-slate-800/80 px-2.5 py-1.5 rounded-md border border-slate-700/60 text-slate-300">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-white">{user.userId}</span>
            <span className="text-emerald-400 text-[10px] uppercase font-mono px-1 py-0.2 bg-emerald-950/80 border border-emerald-800/80 rounded">
              {user.role}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
          {canAccessTab(user, 'pos') && (
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'pos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Terminal Kasir</span>
            </button>
          )}

          {canAccessMasterData(user) && (
            <button
              onClick={() => setActiveTab('master')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'master'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Master Data</span>
            </button>
          )}

          {canViewReports(user) && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Laporan</span>
            </button>
          )}

          {canViewDocs(user) && (
            <button
              onClick={() => setActiveTab('docs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'docs'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-300 hover:text-white hover:bg-emerald-950/40 border border-emerald-500/30'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-300" />
              <span className="font-bold">Arsitektur & API Docs</span>
            </button>
          )}
        </nav>

        {/* Right Action Tools & Clock */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Real-time Clock */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-300 font-mono-numbers bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700/50">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{currentTime}</span>
          </div>

          {/* Shift Status Button */}
          {canAccessTab(user, 'pos') && (
            <button
              onClick={onOpenShiftModal}
              title="Kelola Shift & Kas"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-medium">Shift {activeShift?.shiftNumber || 1}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </button>
          )}

          {/* Hold Orders Button */}
          {canAccessTab(user, 'pos') && (
            <button
              onClick={onOpenHoldModal}
              title="Daftar Transaksi Tertahan (F7)"
              className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            >
              <PauseCircle className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden md:inline font-medium">Pending (F7)</span>
              {heldCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-orange-500 text-white rounded-full text-[10px] font-bold">
                  {heldCount}
                </span>
              )}
            </button>
          )}

          {/* History & Reprint Button */}
          {canAccessTab(user, 'pos') && (
            <button
              onClick={onOpenHistoryModal}
              title="Riwayat Nota & Cetak Ulang (F9)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline font-medium">Nota (F9)</span>
            </button>
          )}

          {/* Return Button */}
          {canReturn(user) && (
            <button
              onClick={onOpenReturnModal}
              title="Retur Penjualan"
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-medium">Retur</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title="Mode Layar Penuh"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Help Shortcuts Button */}
          <button
            onClick={onOpenShortcutsModal}
            title="Daftar Shortcut Keyboard (F12)"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Keluar Sesi Kasir"
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/70 transition-all ml-1 cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* POS Quick Function Keys Strip (Characteristic of Ketoko POS desktop & web terminals) */}
      {activeTab === 'pos' && (
        <div className="bg-slate-950 px-4 py-1.5 border-t border-slate-800 flex items-center justify-between text-[11px] overflow-x-auto whitespace-nowrap gap-4">
          <div className="flex items-center gap-4 text-slate-400 font-mono">
            <span><strong className="text-blue-400">[F1]</strong> Cari Barang</span>
            <span><strong className="text-blue-400">[F2]</strong> Ubah Qty</span>
            <span><strong className="text-blue-400">[F3]</strong> Diskon</span>
            <span><strong className="text-blue-400">[F4]</strong> Hapus Item</span>
            <span><strong className="text-amber-400">[F7]</strong> Tahan Transaksi</span>
            <span><strong className="text-emerald-400">[F8]</strong> Bayar / Checkout</span>
            <span><strong className="text-blue-400">[F9]</strong> Riwayat / Cetak Ulang</span>
            <span><strong className="text-blue-400">[F10]</strong> Kas Masuk/Keluar</span>
            <span><strong className="text-cyan-400">[F11]</strong> Laci Kasir</span>
            <span><strong className="text-rose-400">[ESC]</strong> Bersihkan Keranjang</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCashMovementModal}
              className="text-xs text-amber-300 hover:text-amber-200 underline font-medium"
            >
              + Kas Operasional
            </button>
            <span className="text-slate-600">|</span>
            {canOpenDrawer(user) ? (
              <button
                onClick={handleOpenCashDrawer}
                className="text-xs text-cyan-300 hover:text-cyan-200 underline font-medium"
              >
                Buka Laci
              </button>
            ) : (
              <span className="text-xs text-slate-600" title="Akun ini tidak berwenang membuka laci kasir">
                Buka Laci (terkunci)
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
