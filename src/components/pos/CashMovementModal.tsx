import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, CheckCircle } from 'lucide-react';
import { playBeep } from '../../services/storageService';

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMovement: (type: 'MASUK' | 'KELUAR', amount: number, reason: string) => void;
}

export const CashMovementModal: React.FC<CashMovementModalProps> = ({
  isOpen,
  onClose,
  onAddMovement,
}) => {
  const [type, setType] = useState<'MASUK' | 'KELUAR'>('KELUAR');
  const [amount, setAmount] = useState<number>(50000);
  const [reason, setReason] = useState<string>('Beli perlengkapan toko (plastik kresek)');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !reason.trim()) {
      alert('Masukkan jumlah uang dan alasan yang valid.');
      return;
    }

    playBeep('success');
    onAddMovement(type, amount, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-bold">Catat Kas Operasional Laci (F10)</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Movement Type Radio */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('KELUAR')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-colors ${
                type === 'KELUAR'
                  ? 'bg-rose-50 border-rose-500 text-rose-800 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <ArrowDownRight className="w-5 h-5 text-rose-600" />
              <span>Kas Keluar (Biaya)</span>
            </button>

            <button
              type="button"
              onClick={() => setType('MASUK')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-colors ${
                type === 'MASUK'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <ArrowUpRight className="w-5 h-5 text-emerald-600" />
              <span>Kas Masuk (Tambah Kas)</span>
            </button>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jumlah Uang (Rp):</label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Keterangan / Keperluan:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Beli token listrik, bayar kurir..."
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Simpan Catatan Kas</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
