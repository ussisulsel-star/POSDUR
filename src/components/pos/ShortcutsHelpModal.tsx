import React from 'react';
import { X, Keyboard, Sparkles } from 'lucide-react';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Enter', desc: 'Proses input barcode atau submit form kasir' },
    { key: 'F1', desc: 'Fokus ke Barcode Scanner / Pencarian Cepat Produk' },
    { key: 'F2', desc: 'Ubah Quantity item terakhir di keranjang' },
    { key: 'F3', desc: 'Beri Diskon Faktur / Diskon Member' },
    { key: 'F4', desc: 'Hapus item terpilih dari keranjang' },
    { key: 'F7', desc: 'Tahan Transaksi / Buka antrean nota yang diparking' },
    { key: 'F8', desc: 'Buka Jendela Pembayaran (Checkout Kasir)' },
    { key: 'F9', desc: 'Buka Riwayat Penjualan & Cetak Ulang Nota' },
    { key: 'F10', desc: 'Catat Kas Masuk / Kas Keluar Operasional' },
    { key: 'F11', desc: 'Kirim Perintah Buka Laci Kasir (Cash Drawer)' },
    { key: 'F12', desc: 'Buka Panduan Shortcut Keyboard ini' },
    { key: 'Esc', desc: 'Batalkan aksi / Tutup modal yang sedang terbuka' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold">Panduan Tombol Pintas POS (Keyboard Shortcuts)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[75vh]">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mb-3 flex items-start gap-2 text-xs text-blue-900">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Catat POS dirancang agar kasir dapat bertransaksi 100% cepat hanya menggunakan keyboard dan barcode scanner tanpa perlu menyentuh mouse.
            </p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {shortcuts.map((s, idx) => (
              <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                <span className="text-slate-700">{s.desc}</span>
                <kbd className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-800 text-[11px] shadow-2xs">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Mengerti (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
