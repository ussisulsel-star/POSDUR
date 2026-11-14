import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  CreditCard, 
  Receipt, 
  AlertTriangle, 
  Banknote, 
  QrCode, 
  Building,
  CheckCircle2
} from 'lucide-react';
import { Transaction, CartItem, PaymentMethodType, PaymentDetail, EMoney, User as PosUser } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';
import { canVoid } from '../../services/accessControl';
import type { TransactionCorrectionInput } from '../../services/posApi';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  onSaveTransaction: (input: TransactionCorrectionInput) => Promise<void>;
  emoneyList?: EMoney[];
  currentUser?: PosUser | null;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSaveTransaction,
  emoneyList = [],
  currentUser,
}) => {
  const [customerName, setCustomerName] = useState<string>(transaction.customerName);
  const [customerPhone, setCustomerPhone] = useState<string>(transaction.customerPhone || '');
  const [items, setItems] = useState<CartItem[]>([...transaction.items]);
  const [correctionReason, setCorrectionReason] = useState<string>('Koreksi jumlah barang oleh Supervisor');
  const [password, setPassword] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Payment method state
  const currentFirstPay = transaction.payments[0] || { method: 'TUNAI', amount: transaction.grandTotal };
  const [payMethod, setPayMethod] = useState<PaymentMethodType>(currentFirstPay.method);
  const [selectedEMoney, setSelectedEMoney] = useState<string>(currentFirstPay.emoneyName || 'GoPay');
  const [selectedBank, setSelectedBank] = useState<string>(currentFirstPay.bankName || 'BCA');

  if (!isOpen) return null;

  // Handle Qty change
  const handleQtyChange = (index: number, delta: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = Math.max(1, item.qty + delta);
      const discountRp = item.discountRp || 0;
      const subtotal = (item.unitPrice - discountRp) * newQty;
      updated[index] = { ...item, qty: newQty, subtotal };
      return updated;
    });
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('Transaksi harus memiliki minimal 1 item barang. Jika ingin membatalkan seluruh transaksi, gunakan tombol Void / Hapus Transaksi.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Recalculate totals (mengikuti rumus server: diskon item + diskon faktur +
  // nilai tukar poin yang sudah tercatat pada nota).
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const itemDiscounts = items.reduce((sum, item) => sum + item.discountRp * item.qty, 0);
  const previousItemDiscounts = transaction.items.reduce(
    (sum, item) => sum + item.discountRp * item.qty,
    0
  );
  const pointDiscount = Math.max(0, transaction.pointDiscount || 0);
  const invoiceDiscount = Math.max(
    0,
    (transaction.discountTotal || 0) - previousItemDiscounts - pointDiscount
  );
  const taxTotal = Math.max(0, transaction.taxTotal || 0);
  const grandTotal = Math.max(
    0,
    subtotal - itemDiscounts - invoiceDiscount - pointDiscount + taxTotal
  );
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canVoid(currentUser)) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan mengoreksi transaksi.');
      return;
    }

    if (!customerName.trim()) {
      alert('Nama pelanggan tidak boleh kosong.');
      return;
    }

    if (items.length === 0) {
      alert('Minimal harus ada 1 item barang dalam transaksi.');
      return;
    }

    if (!password.trim()) {
      alert('Masukkan password akun supervisor/admin untuk otorisasi koreksi.');
      return;
    }

    if (grandTotal < 0) {
      alert('Grand total hasil koreksi tidak boleh negatif.');
      return;
    }

    // Reconstruct payments array
    const updatedPayments: PaymentDetail[] = [];
    if (payMethod === 'TUNAI') {
      updatedPayments.push({
        method: 'TUNAI',
        amount: grandTotal,
      });
    } else if (payMethod === 'QRIS') {
      updatedPayments.push({
        method: 'QRIS',
        amount: grandTotal,
        qrRef: currentFirstPay.qrRef || 'NMID-CORRECTED',
        emoneyName: selectedEMoney,
      });
    } else if (payMethod === 'DEBIT' || payMethod === 'KREDIT') {
      updatedPayments.push({
        method: payMethod,
        amount: grandTotal,
        bankName: selectedBank,
        cardLastFour: currentFirstPay.cardLastFour || '9999',
      });
    } else if (payMethod === 'TRANSFER') {
      updatedPayments.push({
        method: 'TRANSFER',
        amount: grandTotal,
        bankName: selectedBank,
      });
    } else {
      updatedPayments.push({
        method: 'PIUTANG',
        amount: grandTotal,
      });
    }

    setSaving(true);
    setErrorMessage('');

    try {
      await onSaveTransaction({
        password: password.trim(),
        reason: correctionReason.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        taxTotal,
        items: items.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountRp: item.discountRp,
        })),
        payments: updatedPayments,
      });
      playBeep('success');
      onClose();
    } catch (error) {
      playBeep('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Koreksi transaksi gagal disimpan.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <span>Koreksi Transaksi Nota: {transaction.invoiceNo}</span>
                <span className="bg-amber-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded uppercase">
                  Supervisor Override
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Kasir: {transaction.cashierName} · Outlet: {transaction.outletName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Warning Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Perhatian Supervisor:</span>
              <span>
                Mengoreksi transaksi akan memperbarui data nilai penjualan, rincian pembayaran, dan total penerimaan kasir pada laporan tutup kasir dan struk.
              </span>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
              1. Identitas Pelanggan
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Nama Pelanggan:</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">No. Telepon / WhatsApp:</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0812xxxxxxxx"
                />
              </div>
            </div>
          </div>

          {/* Items List Editor */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                2. Koreksi Barang & Kuantitas ({items.length} Item · {totalQty} Unit)
              </span>
            </div>

            <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate flex items-center gap-1.5 flex-wrap">
                      <span>{item.product.name}</span>
                      {item.product.isPackage && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold uppercase">
                          Paket
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      @ {formatRupiah(item.unitPrice)}
                      {item.discountRp > 0 && ` (Potongan: -${formatRupiah(item.discountRp)})`}
                    </div>
                    {item.product.isPackage && item.product.packageItems && item.product.packageItems.length > 0 && (
                      <div className="text-[10px] text-amber-800 bg-amber-50 p-1 rounded mt-0.5">
                        Isi: {item.product.packageItems.map((pkg) => `${pkg.qty * item.qty}x ${pkg.productName}`).join(' · ')}
                      </div>
                    )}
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(idx, -1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors"
                      title="Kurangi Qty"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-slate-900">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQtyChange(idx, 1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors"
                      title="Tambah Qty"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="w-24 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(item.subtotal)}
                  </div>

                  {/* Delete Item */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Hapus Barang Ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="pt-2 flex justify-between items-center text-xs font-bold border-t border-slate-200">
              <span className="text-slate-600 uppercase">Grand Total Setelah Koreksi:</span>
              <span className="text-base text-blue-700 font-mono-numbers">
                {formatRupiah(grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment Method Correction */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
              3. Koreksi Metode Pembayaran
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPayMethod('TUNAI')}
                className={`py-2 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  payMethod === 'TUNAI'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Tunai</span>
              </button>

              <button
                type="button"
                onClick={() => setPayMethod('QRIS')}
                className={`py-2 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  payMethod === 'QRIS'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QRIS / E-Money</span>
              </button>

              <button
                type="button"
                onClick={() => setPayMethod('DEBIT')}
                className={`py-2 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  payMethod === 'DEBIT'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Debit EDC</span>
              </button>

              <button
                type="button"
                onClick={() => setPayMethod('TRANSFER')}
                className={`py-2 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  payMethod === 'TRANSFER'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setPayMethod('PIUTANG')}
                className={`py-2 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  payMethod === 'PIUTANG'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Piutang</span>
              </button>
            </div>

            {/* If QRIS selected, pick specific E-Money */}
            {payMethod === 'QRIS' && (
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Pilih Kanal E-Money yang Benar:
                </label>
                <select
                  value={selectedEMoney}
                  onChange={(e) => setSelectedEMoney(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="GoPay">GoPay (QRIS)</option>
                  <option value="OVO">OVO (QRIS)</option>
                  <option value="ShopeePay">ShopeePay (QRIS)</option>
                  <option value="DANA">DANA (QRIS)</option>
                  <option value="LinkAja">LinkAja (QRIS)</option>
                  <option value="QRIS Standar">QRIS Standar / M-Banking</option>
                </select>
              </div>
            )}

            {/* If DEBIT selected, pick bank */}
            {payMethod === 'DEBIT' && (
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Pilih Mesin EDC Bank:
                </label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="BCA">EDC BCA</option>
                  <option value="Mandiri">EDC Mandiri</option>
                  <option value="BRI">EDC BRI</option>
                  <option value="BNI">EDC BNI</option>
                </select>
              </div>
            )}
          </div>

          {/* Reason for correction */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Alasan Koreksi / Catatan Audit SPV:
            </label>
            <input
              type="text"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Contoh: Kasir salah input kuantitas barang / salah pilih metode bayar"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Password re-authentication */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Password Otorisasi (akun Anda):
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password supervisor / admin"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Server memverifikasi ulang password sebelum koreksi diterapkan.
            </p>
          </div>

          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Koreksi Transaksi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
