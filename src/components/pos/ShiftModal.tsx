import React, { useState } from 'react';
import { X, Coins, CheckCircle, Calculator, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { Shift } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: Shift | null;
  onCloseShift: (actualCash: number, notes: string) => void;
  onOpenNewShift: (initialCash: number, cashierName: string) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  onCloseShift,
  onOpenNewShift,
}) => {
  const [mode, setMode] = useState<'VIEW' | 'CLOSE_FORM' | 'OPEN_FORM'>('VIEW');
  const [initialCashInput, setInitialCashInput] = useState<number>(500000);
  const [closeNotes, setCloseNotes] = useState<string>('');

  // Cash Denominations Counter for cash drawer audit
  const [c100k, setC100k] = useState<number>(0);
  const [c50k, setC50k] = useState<number>(0);
  const [c20k, setC20k] = useState<number>(0);
  const [c10k, setC10k] = useState<number>(0);
  const [c5k, setC5k] = useState<number>(0);
  const [c2k, setC2k] = useState<number>(0);
  const [c1k, setC1k] = useState<number>(0);
  const [cCoin, setCCoin] = useState<number>(0);

  if (!isOpen) return null;

  const totalPhysicalCash =
    c100k * 100000 +
    c50k * 50000 +
    c20k * 20000 +
    c10k * 10000 +
    c5k * 5000 +
    c2k * 2000 +
    c1k * 1000 +
    cCoin;

  const expectedCash = activeShift ? activeShift.expectedCash : 0;
  const cashDiff = totalPhysicalCash - expectedCash;

  const handleConfirmClose = (e: React.FormEvent) => {
    e.preventDefault();
    playBeep('success');
    onCloseShift(totalPhysicalCash, closeNotes);
    setMode('VIEW');
    onClose();
  };

  const handleConfirmOpen = (e: React.FormEvent) => {
    e.preventDefault();
    playBeep('success');
    onOpenNewShift(initialCashInput, 'ADMINISTRATOR');
    setMode('VIEW');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold">Manajemen Shift & Kas Kasir</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {mode === 'VIEW' && activeShift && (
            <div className="space-y-4 text-xs">
              {/* Shift info strip */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-blue-900">
                    Shift #{activeShift.shiftNumber} (Sedang Berjalan)
                  </div>
                  <div className="text-slate-500 flex items-center gap-1 mt-0.5 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Mulai: {new Date(activeShift.startTime).toLocaleTimeString('id-ID')}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-md text-[11px]">
                  STATUS: AKTIF
                </span>
              </div>

              {/* Financial Breakdown Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-2.5 flex justify-between bg-slate-50 font-semibold text-slate-700">
                  <span>Modal Awal Kasir:</span>
                  <span className="font-mono-numbers">{formatRupiah(activeShift.initialCash)}</span>
                </div>
                <div className="p-2.5 flex justify-between text-slate-700">
                  <span>Total Penjualan Tunai:</span>
                  <span className="font-mono-numbers font-medium text-emerald-700">
                    +{formatRupiah(activeShift.totalCashSales)}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between text-slate-700">
                  <span>Total Penjualan Non-Tunai:</span>
                  <span className="font-mono-numbers font-medium text-blue-700">
                    +{formatRupiah(activeShift.totalNonCashSales)}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between text-slate-700">
                  <span>Kas Masuk Operasional (+):</span>
                  <span className="font-mono-numbers font-medium text-emerald-700">
                    +{formatRupiah(activeShift.totalCashIn)}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between text-slate-700">
                  <span>Kas Keluar Operasional (-):</span>
                  <span className="font-mono-numbers font-medium text-rose-700">
                    -{formatRupiah(activeShift.totalCashOut)}
                  </span>
                </div>
                <div className="p-3 flex justify-between bg-slate-900 text-white font-bold text-sm">
                  <span>Total Kas Fisik Sistem (Di Laci):</span>
                  <span className="font-mono-numbers text-amber-400">
                    {formatRupiah(activeShift.expectedCash)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setMode('CLOSE_FORM')}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Coins className="w-4 h-4" />
                  <span>Tutup Shift Kasir (Closing Cash)</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'VIEW' && !activeShift && (
            <div className="text-center py-8 space-y-3">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="font-bold text-slate-800 text-sm">Tidak ada shift yang aktif</div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Silakan buka shift baru dan masukkan modal awal kasir untuk mulai bertransaksi.
              </p>
              <button
                onClick={() => setMode('OPEN_FORM')}
                className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                + Buka Shift Baru
              </button>
            </div>
          )}

          {/* Form Closing Shift with Denomination Calculator */}
          {mode === 'CLOSE_FORM' && (
            <form onSubmit={handleConfirmClose} className="space-y-4 text-xs">
              <div className="p-2.5 bg-slate-100 rounded-lg flex items-center justify-between">
                <span className="font-semibold text-slate-700">Target Kas Sistem:</span>
                <span className="font-bold text-slate-900 font-mono-numbers">
                  {formatRupiah(expectedCash)}
                </span>
              </div>

              {/* Denominations */}
              <div>
                <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-2">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  <span>Hitung Uang Fisik di Laci Kasir (Lembar / Keping):</span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-600">Rp 100.000:</span>
                    <input
                      type="number"
                      min="0"
                      value={c100k || ''}
                      onChange={(e) => setC100k(Number(e.target.value))}
                      placeholder="0"
                      className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-600">Rp 50.000:</span>
                    <input
                      type="number"
                      min="0"
                      value={c50k || ''}
                      onChange={(e) => setC50k(Number(e.target.value))}
                      placeholder="0"
                      className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-600">Rp 20.000:</span>
                    <input
                      type="number"
                      min="0"
                      value={c20k || ''}
                      onChange={(e) => setC20k(Number(e.target.value))}
                      placeholder="0"
                      className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-600">Rp 10.000:</span>
                    <input
                      type="number"
                      min="0"
                      value={c10k || ''}
                      onChange={(e) => setC10k(Number(e.target.value))}
                      placeholder="0"
                      className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-600">Rp 5.000:</span>
                    <input
                      type="number"
                      min="0"
                      value={c5k || ''}
                      onChange={(e) => setC5k(Number(e.target.value))}
                      placeholder="0"
                      className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-600">Rp 2.000:</span>
                    <input
                      type="number"
                      min="0"
                      value={c2k || ''}
                      onChange={(e) => setC2k(Number(e.target.value))}
                      placeholder="0"
                      className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-600">Rp 1.000:</span>
                    <input
                      type="number"
                      min="0"
                      value={c1k || ''}
                      onChange={(e) => setC1k(Number(e.target.value))}
                      placeholder="0"
                      className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-600">Koin/Lain:</span>
                    <input
                      type="number"
                      min="0"
                      value={cCoin || ''}
                      onChange={(e) => setCCoin(Number(e.target.value))}
                      placeholder="0"
                      className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Physical cash total vs difference */}
              <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span>Total Uang Fisik Dihitung:</span>
                  <span className="font-bold text-sm font-mono-numbers text-emerald-400">
                    {formatRupiah(totalPhysicalCash)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                  <span>Selisih Kas (Fisik - Sistem):</span>
                  <span
                    className={`font-bold font-mono-numbers ${
                      cashDiff === 0
                        ? 'text-emerald-400'
                        : cashDiff > 0
                        ? 'text-cyan-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {cashDiff === 0
                      ? 'PAS (Rp 0)'
                      : cashDiff > 0
                      ? `+${formatRupiah(cashDiff)} (Lebih)`
                      : `${formatRupiah(cashDiff)} (Kurang)`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Catatan Tutup Shift:
                </label>
                <textarea
                  rows={2}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Keterangan penyerahan kas ke supervisor / shift berikutnya..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('VIEW')}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Konfirmasi Tutup Shift</span>
                </button>
              </div>
            </form>
          )}

          {/* Form Open New Shift */}
          {mode === 'OPEN_FORM' && (
            <form onSubmit={handleConfirmOpen} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Modal Awal Kasir (Cash Drawer Float):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={initialCashInput}
                    onChange={(e) => setInitialCashInput(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold font-mono focus:outline-none"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Uang pecahan untuk modal kembalian awal di laci kasir.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('VIEW')}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1"
                >
                  <span>Mulai Shift</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
