import React from 'react';
import { canOpenDrawer } from '../../services/accessControl';
import { playBeep } from '../../services/storageService';
import { User as PosUser } from '../../types/pos';

interface PosShortcutStripProps {
  user: PosUser;
  onOpenCashMovementModal: () => void;
}

const SHORTCUTS: { keys: string; label: string; color: string }[] = [
  { keys: 'F1', label: 'Cari Barang', color: 'text-blue-400' },
  { keys: 'F2', label: 'Ubah Qty', color: 'text-blue-400' },
  { keys: 'F3', label: 'Diskon', color: 'text-blue-400' },
  { keys: 'F4', label: 'Hapus Item', color: 'text-blue-400' },
  { keys: 'F7', label: 'Tahan Transaksi', color: 'text-amber-400' },
  { keys: 'F8', label: 'Bayar / Checkout', color: 'text-emerald-400' },
  { keys: 'F9', label: 'Riwayat / Cetak Ulang', color: 'text-blue-400' },
  { keys: 'F10', label: 'Kas Masuk/Keluar', color: 'text-blue-400' },
  { keys: 'F11', label: 'Laci Kasir', color: 'text-cyan-400' },
  { keys: 'ESC', label: 'Bersihkan Keranjang', color: 'text-rose-400' },
];

export const PosShortcutStrip: React.FC<PosShortcutStripProps> = ({
  user,
  onOpenCashMovementModal,
}) => {
  const handleOpenCashDrawer = () => {
    playBeep('success');
    alert(
      'Simulasi: Perintah Buka Laci Kasir (ESC/POS Drawer Kick) dikirim ke Printer!'
    );
  };

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 overflow-x-auto whitespace-nowrap border-t border-slate-800 bg-slate-950 px-4 py-1.5 text-[11px]">
      <div className="flex items-center gap-4 font-mono text-slate-400">
        {SHORTCUTS.map((shortcut) => (
          <span key={shortcut.keys} className="flex items-center gap-1">
            <strong className={shortcut.color}>[{shortcut.keys}]</strong>
            <span>{shortcut.label}</span>
          </span>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenCashMovementModal}
          className="text-xs font-medium text-amber-300 underline hover:text-amber-200"
        >
          + Kas Operasional
        </button>
        <span className="text-slate-600">|</span>
        {canOpenDrawer(user) ? (
          <button
            type="button"
            onClick={handleOpenCashDrawer}
            className="text-xs font-medium text-cyan-300 underline hover:text-cyan-200"
          >
            Buka Laci
          </button>
        ) : (
          <span
            className="text-xs text-slate-600"
            title="Akun ini tidak berwenang membuka laci kasir"
          >
            Buka Laci (terkunci)
          </span>
        )}
      </div>
    </div>
  );
};
