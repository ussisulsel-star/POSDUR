import React, { useState } from 'react';
import { 
  X, 
  Banknote, 
  QrCode, 
  CreditCard, 
  Building, 
  CalendarClock, 
  CheckCircle2, 
  Printer, 
  AlertCircle 
} from 'lucide-react';
import { PaymentMethodType, Customer, PaymentDetail, EMoney } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  customer: Customer;
  emoneyList?: EMoney[];
  onProcessPayment: (payments: PaymentDetail[], payAmount: number, changeAmount: number, shouldPrint: boolean) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  customer,
  emoneyList = [],
  onProcessPayment,
}) => {
  const [method, setMethod] = useState<PaymentMethodType>('TUNAI');
  const [cashTendered, setCashTendered] = useState<number>(totalAmount);
  const [shouldPrint, setShouldPrint] = useState<boolean>(true);

  // E-Money / QRIS state
  const activeEMoney = emoneyList.filter((em) => em.isActive);
  const [selectedEMoneyId, setSelectedEMoneyId] = useState<string>(
    activeEMoney.length > 0 ? activeEMoney[0].id : ''
  );

  // Non-cash form states
  const [selectedBank, setSelectedBank] = useState<string>('BCA');
  const [cardLastFour, setCardLastFour] = useState<string>('8892');
  const [traceNumber, setTraceNumber] = useState<string>(Math.floor(100000 + Math.random() * 900000).toString());
  const [qrisPaid, setQrisPaid] = useState<boolean>(false);
  const [qrisRef, setQrisRef] = useState<string>('NMID-' + Date.now().toString().slice(-8));
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  if (!isOpen) return null;

  // Compute change for cash
  const changeAmount = method === 'TUNAI' ? Math.max(0, cashTendered - totalAmount) : 0;
  const isCashInsufficient = method === 'TUNAI' && cashTendered < totalAmount;

  // Handle Complete
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (method === 'TUNAI' && isCashInsufficient) {
      playBeep('error');
      alert('Uang yang dibayarkan kurang dari total tagihan!');
      return;
    }

    if (method === 'PIUTANG' && customer.tier === 'UMUM') {
      playBeep('error');
      alert('Pembayaran Piutang / Tempo hanya diperbolehkan untuk Pelanggan Terdaftar (Member / Mitra).');
      return;
    }

    const payments: PaymentDetail[] = [];

    if (method === 'TUNAI') {
      payments.push({
        method: 'TUNAI',
        amount: cashTendered,
      });
    } else if (method === 'QRIS') {
      const selectedEMoney = activeEMoney.find((em) => em.id === selectedEMoneyId);
      payments.push({
        method: 'QRIS',
        amount: totalAmount,
        qrRef: qrisRef,
        emoneyName: selectedEMoney ? selectedEMoney.name : 'QRIS Dinamis',
      });
    } else if (method === 'DEBIT' || method === 'KREDIT') {
      payments.push({
        method,
        amount: totalAmount,
        bankName: selectedBank,
        cardLastFour,
        traceNumber,
      });
    } else if (method === 'TRANSFER') {
      payments.push({
        method: 'TRANSFER',
        amount: totalAmount,
        bankName: selectedBank,
        traceNumber,
      });
    } else if (method === 'PIUTANG') {
      payments.push({
        method: 'PIUTANG',
        amount: totalAmount,
        dueDate,
      });
    }

    playBeep('success');
    onProcessPayment(payments, method === 'TUNAI' ? cashTendered : totalAmount, changeAmount, shouldPrint);
  };

  // Quick cash presets
  const handleQuickCash = (amount: number) => {
    setCashTendered(amount);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Pembayaran Kasir (F8)</h2>
            <p className="text-xs text-slate-400">
              Pelanggan: <strong className="text-white">{customer.name}</strong> ({customer.tier})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Banner */}
        <div className="bg-blue-50 px-5 py-3 border-b border-blue-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
            TOTAL TAGIHAN:
          </span>
          <span className="text-2xl font-extrabold text-blue-700 font-mono-numbers">
            {formatRupiah(totalAmount)}
          </span>
        </div>

        {/* Payment Methods Nav */}
        <div className="px-5 pt-3 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMethod('TUNAI')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              method === 'TUNAI'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Tunai (Cash)</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('QRIS')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              method === 'QRIS'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QRIS</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('DEBIT')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              method === 'DEBIT'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Kartu Debit (EDC)</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('TRANSFER')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              method === 'TRANSFER'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Transfer Bank</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('PIUTANG')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              method === 'PIUTANG'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>Piutang / Tempo</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Method: TUNAI */}
          {method === 'TUNAI' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jumlah Uang Diterima:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(Number(e.target.value))}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-lg font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Tombol Cepat Uang Pas & Pecahan:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickCash(totalAmount)}
                    className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
                  >
                    Uang Pas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(50000)}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold font-mono"
                  >
                    50.000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(100000)}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold font-mono"
                  >
                    100.000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(150000)}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold font-mono"
                  >
                    150.000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(200000)}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold font-mono"
                  >
                    200.000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(500000)}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold font-mono"
                  >
                    500.000
                  </button>
                </div>
              </div>

              {/* Kembalian Display Box */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isCashInsufficient
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider block">
                    {isCashInsufficient ? 'Uang Kurang:' : 'Uang Kembalian:'}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {isCashInsufficient
                      ? 'Harap terima uang senilai minimal tagihan'
                      : 'Kembalikan uang fisik kepada pelanggan'}
                  </span>
                </div>
                <div className="text-2xl font-extrabold font-mono-numbers">
                  {isCashInsufficient
                    ? `-${formatRupiah(totalAmount - cashTendered)}`
                    : formatRupiah(changeAmount)}
                </div>
              </div>
            </div>
          )}

          {/* Method: QRIS & E-MONEY */}
          {method === 'QRIS' && (
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
              <div className="text-center">
                <span className="font-bold text-sm text-slate-900 block">QRIS & E-Money Standar Nasional</span>
                <span className="text-xs text-slate-500 font-mono">NMID: ID1020009999901 · Toko Berkah POS</span>
              </div>

              {/* E-Money Channel Picker */}
              {activeEMoney.length > 0 && (
                <div className="w-full">
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1.5 text-center">
                    Pilih Channel E-Money / Dompet Digital:
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {activeEMoney.map((em) => {
                      const isSelected = selectedEMoneyId === em.id;
                      return (
                        <button
                          key={em.id}
                          type="button"
                          onClick={() => setSelectedEMoneyId(em.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            isSelected
                              ? 'text-white shadow-sm ring-2 ring-offset-1 ring-blue-500'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                          style={{
                            backgroundColor: isSelected ? em.color || '#3b82f6' : undefined,
                            borderColor: isSelected ? em.color || '#3b82f6' : undefined,
                          }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: isSelected ? '#ffffff' : em.color || '#3b82f6' }}
                          />
                          <span>{em.name}</span>
                          {em.mdrFeePercent > 0 && (
                            <span className="text-[10px] opacity-75 font-normal">
                              ({em.mdrFeePercent}%)
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic QR Code graphic */}
              <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex flex-col items-center">
                <div className="w-44 h-44 bg-slate-900 rounded-lg p-2 flex items-center justify-center text-white text-center font-mono text-xs">
                  <div className="border-4 border-dashed border-white/60 p-3 rounded flex flex-col items-center gap-2">
                    <QrCode className="w-16 h-16 text-cyan-400 animate-pulse" />
                    <span className="text-[10px] text-cyan-200">{qrisRef}</span>
                    <span className="text-[11px] font-bold text-emerald-400 font-mono-numbers">
                      {formatRupiah(totalAmount)}
                    </span>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    {activeEMoney.find((em) => em.id === selectedEMoneyId)?.name || 'QRIS Dinamis'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Scan via OVO, GoPay, ShopeePay, DANA, LinkAja, atau m-Banking
                  </span>
                </div>
              </div>

              {/* QRIS Status & Simulation Button */}
              <div className="w-full max-w-sm flex flex-col items-center gap-2">
                {qrisPaid ? (
                  <div className="w-full p-2.5 bg-emerald-100 border border-emerald-300 rounded-lg flex items-center justify-center gap-2 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Pembayaran QRIS / E-Money Dikonfirmasi Sukses!</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      playBeep('success');
                      setQrisPaid(true);
                    }}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    Simulasi: Pelanggan Scan & Bayar Sukses
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Method: DEBIT / KREDIT */}
          {(method === 'DEBIT' || method === 'KREDIT') && (
            <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Mesin EDC / Bank:</label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-md font-semibold text-slate-800 focus:outline-none"
                  >
                    <option value="BCA">EDC BCA</option>
                    <option value="Mandiri">EDC Mandiri</option>
                    <option value="BRI">EDC BRI</option>
                    <option value="BNI">EDC BNI</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">4 Digit Terakhir Kartu:</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={cardLastFour}
                    onChange={(e) => setCardLastFour(e.target.value)}
                    placeholder="Contoh: 1234"
                    className="w-full p-2 bg-white border border-slate-300 rounded-md font-mono text-center font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Approval / Trace No. EDC:</label>
                <input
                  type="text"
                  value={traceNumber}
                  onChange={(e) => setTraceNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-md font-mono text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Method: TRANSFER */}
          {method === 'TRANSFER' && (
            <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
                <span className="font-bold block">Rekening Resmi Toko Berkah:</span>
                <div>BCA: <strong className="font-mono">8830-1928-10</strong> a.n Toko Berkah Sejahtera</div>
                <div>Mandiri: <strong className="font-mono">137-00-1928-301</strong> a.n Toko Berkah Sejahtera</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Referensi Transfer / Ref Bank:</label>
                <input
                  type="text"
                  value={traceNumber}
                  onChange={(e) => setTraceNumber(e.target.value)}
                  placeholder="TRX-19283719"
                  className="w-full p-2 bg-white border border-slate-300 rounded-md font-mono text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Method: PIUTANG / TEMPO */}
          {method === 'PIUTANG' && (
            <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl text-xs">
              {customer.tier === 'UMUM' ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Pelanggan Umum Tidak Bisa Piutang!</strong>
                    <span>Harap ganti pelanggan dengan Member Terdaftar atau Toko Mitra sebelum memproses piutang.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                    Pelanggan: <strong>{customer.name}</strong> ({customer.phone})
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Jatuh Tempo Pembayaran:</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-md font-mono text-slate-800 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Print Struk Checkbox */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={shouldPrint}
                onChange={(e) => setShouldPrint(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Cetak Struk Thermal (58mm / 80mm) Setelah Transaksi</span>
            </label>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={method === 'TUNAI' && isCashInsufficient}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selesaikan Transaksi (Enter)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
