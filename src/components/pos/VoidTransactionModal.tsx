import React, { useState } from 'react';
import { X, Trash2, AlertOctagon, ShieldAlert, KeyRound } from 'lucide-react';
import { Transaction, User as PosUser } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';
import { canVoid } from '../../services/accessControl';

interface VoidTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  onConfirmVoid: (
    transactionId: string,
    password: string,
    reason: string
  ) => void | Promise<void>;
  currentUser?: PosUser | null;
}

export const VoidTransactionModal: React.FC<VoidTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onConfirmVoid,
  currentUser,
}) => {
  const [voidReason, setVoidReason] = useState<string>('Pelanggan batal belanja & salah scan ganda');
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!voidReason.trim()) {
      setErrorMsg('Alasan pembatalan/void harus diisi.');
      return;
    }

    // Wajib punya kewenangan void.
    if (!canVoid(currentUser)) {
      playBeep('error');
      setErrorMsg('Akun Anda tidak memiliki kewenangan untuk void / hapus transaksi.');
      return;
    }

    if (!supervisorPin.trim()) {
      playBeep('error');
      setErrorMsg('Password otorisasi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmVoid(transaction.id, supervisorPin, voidReason);
      playBeep('success');
      onClose();
    } catch (error) {
      playBeep('error');
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Void transaksi gagal diproses oleh server.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5" />
            <div>
              <h2 className="text-sm font-bold">Otorisasi Void / Hapus Transaksi</h2>
              <p className="text-[11px] text-rose-100">
                Peringatan: Tindakan ini akan membatalkan nota kasir secara permanen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-rose-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Target Transaction Details Box */}
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-950">
            <div className="flex justify-between items-center">
              <span className="font-mono font-bold text-sm text-rose-900">
                {transaction.invoiceNo}
              </span>
              <span className="font-mono text-base font-extrabold text-rose-700">
                {formatRupiah(transaction.grandTotal)}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 divide-y divide-rose-200/60">
              <div className="pb-1 flex justify-between">
                <span>Pelanggan:</span>
                <strong className="text-slate-800">{transaction.customerName}</strong>
              </div>
              <div className="py-1 flex justify-between">
                <span>Kasir & Outlet:</span>
                <span>{transaction.cashierName} · {transaction.outletName}</span>
              </div>
              <div className="pt-1 flex justify-between">
                <span>Metode Pembayaran:</span>
                <span className="font-bold">
                  {transaction.payments.map((p) => (p.emoneyName ? `${p.method} (${p.emoneyName})` : p.method)).join(', ')}
                </span>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Alasan Pembatalan / Void Transaksi:
            </label>
            <textarea
              rows={2}
              value={voidReason}
              onChange={(e) => {
                setVoidReason(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Contoh: Kesalahan scan item barang / salah nominal / pelanggan batal bayar"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          {/* PIN Input */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Password Otorisasi Akun Anda:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Diverifikasi Server</span>
            </label>
            <input
              type="password"
              maxLength={200}
              value={supervisorPin}
              onChange={(e) => {
                setSupervisorPin(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Masukkan password login akun Anda"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-center font-mono font-bold tracking-widest text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Void dicatat ke server beserta nama pengguna dan alasan pembatalan.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-100 border border-rose-300 text-rose-800 rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Memproses...' : 'Konfirmasi Hapus / Void'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
