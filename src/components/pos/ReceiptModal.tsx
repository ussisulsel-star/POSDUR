import React from 'react';
import { X, Printer, CheckCircle, ArrowRight } from 'lucide-react';
import { Transaction } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onNewTransaction: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onNewTransaction,
}) => {
  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    playBeep('scan');
    window.print();
  };

  const handleOpenDrawer = () => {
    playBeep('success');
    alert('Simulasi: Laci kasir dibuka via signal ESC/POS printer.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold">Transaksi Sukses & Nota</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Preview Area (Simulating ESC/POS Thermal Paper 80mm) */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
          <div
            id="thermal-receipt-printable"
            className="w-full max-w-[320px] bg-white p-4 shadow-sm border border-slate-200 font-mono text-[11px] leading-tight text-slate-900 select-text"
          >
            {/* Store Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-0.5">
              <div className="font-extrabold text-xs uppercase tracking-wider">
                TOKO BERKAH SEJAHTERA
              </div>
              <div className="text-[10px] text-slate-600">
                ID Perusahaan: 99999 · Cabang Utama
              </div>
              <div className="text-[10px] text-slate-600">
                Jl. Boulevard Raya Blok A2 No. 10
              </div>
              <div className="text-[10px] text-slate-600">
                Telp: (021) 4589-1234
              </div>
            </div>

            {/* Transaction Metadata */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>No. Nota :</span>
                <span className="font-bold">{transaction.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal  :</span>
                <span>{new Date(transaction.date).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir    :</span>
                <span>{transaction.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span>{transaction.customerName}</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-2">
              {transaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold text-slate-900 flex items-center justify-between">
                    <span>{item.product.name}</span>
                    {item.product.isPackage && (
                      <span className="text-[9px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-sans uppercase">
                        Paket
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>
                      {item.qty} {item.product.unit} x {formatRupiah(item.unitPrice)}
                    </span>
                    <span className="font-bold">{formatRupiah(item.subtotal)}</span>
                  </div>

                  {/* Detail Rincian Barang Paket (Tanpa Harga karena sudah termasuk di harga paket) */}
                  {item.product.isPackage && item.product.packageItems && item.product.packageItems.length > 0 && (
                    <div className="pl-2.5 py-1 my-0.5 space-y-0.5 text-[10px] text-slate-600 bg-slate-50/70 border-l-2 border-dotted border-slate-400">
                      <div className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">
                        Rincian Isi Paket:
                      </div>
                      {item.product.packageItems.map((pkg, pIdx) => (
                        <div key={pIdx} className="text-slate-800">
                          - {pkg.qty * item.qty}x {pkg.productName}
                        </div>
                      ))}
                    </div>
                  )}

                  {item.discountRp > 0 && (
                    <div className="text-[9px] text-rose-600 text-right">
                      (Potongan: -{formatRupiah(item.discountRp * item.qty)})
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Total Item / Qty :</span>
                <span>{transaction.items.length} / {transaction.totalQty}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal         :</span>
                <span>{formatRupiah(transaction.subtotal)}</span>
              </div>
              {transaction.discountTotal - (transaction.pointDiscount || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Total Diskon     :</span>
                  <span>
                    -
                    {formatRupiah(
                      transaction.discountTotal - (transaction.pointDiscount || 0)
                    )}
                  </span>
                </div>
              )}
              {(transaction.pointsRedeemed || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Tukar Poin ({transaction.pointsRedeemed}) :</span>
                  <span>-{formatRupiah(transaction.pointDiscount || 0)}</span>
                </div>
              )}
              {(transaction.pointsEarned || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Poin Didapat     :</span>
                  <span>+{transaction.pointsEarned} poin</span>
                </div>
              )}
              {transaction.taxTotal > 0 && (
                <div className="flex justify-between">
                  <span>PPN 11%          :</span>
                  <span>+{formatRupiah(transaction.taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-extrabold pt-1 border-t border-slate-300">
                <span>GRAND TOTAL      :</span>
                <span>{formatRupiah(transaction.grandTotal)}</span>
              </div>
            </div>

            {/* Payment & Change */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Metode Bayar     :</span>
                <span className="font-bold">
                  {transaction.payments
                    .map((p) => (p.emoneyName ? `${p.method} (${p.emoneyName})` : p.method))
                    .join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Jumlah Bayar     :</span>
                <span>{formatRupiah(transaction.payAmount)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Kembalian        :</span>
                <span>{formatRupiah(transaction.changeAmount)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-3 space-y-1 text-[10px] text-slate-600">
              <p>Terima Kasih Atas Kunjungan Anda</p>
              <p className="text-[9px]">Barang yang sudah dibeli tidak dapat ditukar/dikembalikan kecuali ada perjanjian.</p>
              <div className="pt-2 font-mono text-[9px] tracking-widest text-slate-400">
                * * * CATAT CLOUD POS * * *
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak (Print)</span>
            </button>

            <button
              onClick={handleOpenDrawer}
              className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              title="Buka Laci Uang"
            >
              Buka Laci
            </button>
          </div>

          <button
            onClick={() => {
              onNewTransaction();
              onClose();
            }}
            className="flex items-center gap-1 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <span>Transaksi Baru</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
