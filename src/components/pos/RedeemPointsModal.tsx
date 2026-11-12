import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Coins,
  Gift,
  UserCheck,
  X,
} from 'lucide-react';
import {
  Customer,
  PointSettings,
  getMaxRedeemablePoints,
  getPointDiscountAmount,
  getPointProgramStatus,
} from '../../types/pos';
import { formatRupiah } from '../../services/storageService';

interface RedeemPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  settings: PointSettings;
  payableAmount: number;
  appliedPoints: number;
  onApply: (points: number) => void;
}

export const RedeemPointsModal: React.FC<RedeemPointsModalProps> = ({
  isOpen,
  onClose,
  customer,
  settings,
  payableAmount,
  appliedPoints,
  onApply,
}) => {
  const [pointsInput, setPointsInput] = useState<number>(appliedPoints);

  useEffect(() => {
    if (isOpen) setPointsInput(appliedPoints);
  }, [isOpen, appliedPoints]);

  const status = getPointProgramStatus(settings);
  const isMember = customer.id !== 'cust-umum' && customer.tier !== 'UMUM';
  const maxRedeemable = useMemo(
    () => getMaxRedeemablePoints(customer.points, payableAmount, settings),
    [customer.points, payableAmount, settings]
  );
  const minPoints = Math.max(0, Math.floor(settings.minRedeemPoints || 0));
  const valuePerPoint = Math.max(0, Math.floor(settings.redeemValue || 0));
  const normalizedPoints = Math.max(0, Math.floor(Number(pointsInput) || 0));
  const discountAmount = getPointDiscountAmount(normalizedPoints, settings);
  const remainingPoints = Math.max(0, customer.points - normalizedPoints);

  const isOverBalance = normalizedPoints > customer.points;
  const isOverBill = discountAmount > payableAmount;
  const isBelowMinimum =
    normalizedPoints > 0 && normalizedPoints < minPoints;
  const canApply =
    status === 'AKTIF' &&
    isMember &&
    !isOverBalance &&
    !isOverBill &&
    !isBelowMinimum &&
    normalizedPoints <= maxRedeemable &&
    valuePerPoint > 0;

  const statusMessage =
    status === 'NONAKTIF'
      ? 'Program poin sedang nonaktif. Tukar poin tidak dapat dilakukan.'
      : status === 'BELUM_MULAI'
      ? 'Program poin belum dimulai sesuai tanggal aktif di Master Point.'
      : status === 'BERAKHIR'
      ? 'Masa berlaku poin sudah berakhir. Tukar poin tidak dapat dilakukan.'
      : !isMember
      ? 'Pilih pelanggan member terlebih dahulu untuk menukar poin.'
      : maxRedeemable === 0
      ? customer.points < minPoints
        ? `Poin member belum mencapai minimal ${minPoints.toLocaleString(
            'id-ID'
          )} poin.`
        : 'Nilai tagihan belum mencukupi untuk penukaran poin.'
      : '';

  if (!isOpen) return null;

  const handleApply = () => {
    if (!isMember) {
      alert('Pilih pelanggan member terlebih dahulu.');
      return;
    }
    if (status !== 'AKTIF') {
      alert(statusMessage || 'Program poin tidak aktif.');
      return;
    }
    if (normalizedPoints === 0) {
      onApply(0);
      onClose();
      return;
    }
    if (isBelowMinimum) {
      alert(`Minimal penukaran adalah ${minPoints.toLocaleString('id-ID')} poin.`);
      return;
    }
    if (isOverBalance) {
      alert('Poin yang ditukar melebihi poin member.');
      return;
    }
    if (!canApply) {
      alert('Jumlah poin tidak dapat ditukar pada transaksi ini.');
      return;
    }

    onApply(normalizedPoints);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="animate-fadeIn w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-lime-400" />
            <h3 className="text-sm font-bold">Tukar Poin Member</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-white"
            title="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[82vh] space-y-4 overflow-y-auto p-5 text-xs">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <UserCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">
                  {customer.name}
                </p>
                <p className="font-mono text-[10px] text-slate-500">
                  {customer.code} · {isMember ? customer.tier : 'Reguler'}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Poin Member
              </p>
              <p className="font-mono text-lg font-extrabold text-amber-600">
                {customer.points.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                <Gift className="h-3 w-3" />
                Nilai Tukar
              </p>
              <p className="mt-1 font-mono text-sm font-extrabold text-emerald-700">
                {formatRupiah(valuePerPoint)}
                <span className="ml-0.5 text-[10px] font-semibold">/ poin</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <ArrowRightLeft className="h-3 w-3" />
                Maksimal Tukar
              </p>
              <p className="mt-1 font-mono text-sm font-extrabold text-slate-800">
                {maxRedeemable.toLocaleString('id-ID')} poin
              </p>
            </div>
          </div>

          {statusMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-relaxed">{statusMessage}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Jumlah Poin yang Ditukar:
            </label>
            <input
              type="number"
              min="0"
              max={Math.max(0, maxRedeemable)}
              step="1"
              value={normalizedPoints}
              onChange={(event) => setPointsInput(Number(event.target.value))}
              disabled={!isMember || status !== 'AKTIF'}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-lg font-extrabold text-amber-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              autoFocus
            />

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPointsInput(minPoints)}
                disabled={!isMember || maxRedeemable === 0}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Minimal ({minPoints.toLocaleString('id-ID')})
              </button>
              <button
                type="button"
                onClick={() => setPointsInput(maxRedeemable)}
                disabled={!isMember || maxRedeemable === 0}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Maksimal ({maxRedeemable.toLocaleString('id-ID')})
              </button>
              <button
                type="button"
                onClick={() => setPointsInput(0)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Potongan Tagihan</span>
              <span className="font-mono text-base font-extrabold text-rose-600">
                -{formatRupiah(discountAmount)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5 text-[11px]">
              <span className="text-slate-500">Sisa poin setelah tukar</span>
              <span className="font-mono font-bold text-slate-700">
                {remainingPoints.toLocaleString('id-ID')} poin
              </span>
            </div>
          </div>

          {normalizedPoints > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-[11px] text-blue-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-relaxed">
                Poin dipotong dari member setelah pembayaran berhasil. Poin
                belanja dari transaksi ini tetap ditambahkan sesuai poin per
                produk.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            {appliedPoints > 0 && (
              <button
                type="button"
                onClick={() => {
                  onApply(0);
                  onClose();
                }}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-semibold text-rose-700 hover:bg-rose-100"
              >
                Batalkan Tukar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply && normalizedPoints > 0}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Coins className="h-4 w-4" />
              Gunakan Poin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
