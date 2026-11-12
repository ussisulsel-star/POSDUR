import React from 'react';
import { X, Play, Trash2, Clock, PauseCircle, ShoppingBag } from 'lucide-react';
import { HeldTransaction } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';

interface HoldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldOrders: HeldTransaction[];
  onResumeHold: (held: HeldTransaction) => void;
  onDeleteHold: (id: string) => void;
}

export const HoldOrdersModal: React.FC<HoldOrdersModalProps> = ({
  isOpen,
  onClose,
  heldOrders,
  onResumeHold,
  onDeleteHold,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-orange-400" />
            <h2 className="text-sm font-bold">Daftar Transaksi Tertahan (Pending Orders - F7)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Held Bills */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {heldOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
              <p className="text-sm font-medium text-slate-600">Tidak ada transaksi yang ditahan</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Tekan tombol Tahan (F7) di terminal kasir saat pelanggan ingin mengambil barang tambahan.
              </p>
            </div>
          ) : (
            heldOrders.map((held) => (
              <div
                key={held.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-400 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 font-mono">
                      {held.holdNumber}
                    </span>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.2 rounded font-medium">
                      {held.customer.name}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(held.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    {held.items.length} item ({held.items.reduce((s, i) => s + i.qty, 0)} pcs)
                    {held.note && ` · Catatan: "${held.note}"`}
                  </div>

                  <div className="text-xs font-bold text-blue-700 font-mono-numbers mt-0.5">
                    {formatRupiah(held.subtotal)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      playBeep('success');
                      onResumeHold(held);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Lanjutkan</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Hapus transaksi tertahan ini?')) {
                        playBeep('delete');
                        onDeleteHold(held.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
