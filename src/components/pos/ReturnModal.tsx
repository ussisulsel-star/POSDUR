import React, { useState } from 'react';
import { X, RotateCcw, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { Transaction, SalesReturn } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onProcessReturn: (ret: SalesReturn) => Promise<boolean> | boolean | void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  transactions,
  onProcessReturn,
}) => {
  const [invoiceQuery, setInvoiceQuery] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [returnQtys, setReturnQtys] = useState<{ [productId: string]: number }>({});
  const [returnReasons, setReturnReasons] = useState<{ [productId: string]: string }>({});
  const [refundMethod, setRefundMethod] = useState<'TUNAI' | 'POTONG_PIUTANG' | 'GANTI_BARANG'>('TUNAI');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSearchInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const query = invoiceQuery.trim();
    if (!query) return;

    const found = transactions.find(
      (t) => t.invoiceNo.toLowerCase() === query.toLowerCase()
    );

    if (found) {
      setSelectedTx(found);
      const qtys: { [key: string]: number } = {};
      const reasons: { [key: string]: string } = {};
      found.items.forEach((item) => {
        qtys[item.product.id] = 0;
        reasons[item.product.id] = 'Kemasan Rusak / Cacat Pabrik';
      });
      setReturnQtys(qtys);
      setReturnReasons(reasons);
    } else {
      playBeep('error');
      alert(`Nota dengan nomor "${query}" tidak ditemukan.`);
    }
  };

  // Calculate total refund
  const totalRefund = selectedTx
    ? selectedTx.items.reduce((sum, item) => {
        const qty = returnQtys[item.product.id] || 0;
        return sum + qty * item.unitPrice;
      }, 0)
    : 0;

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx || isSubmitting) return;

    const returnItems = selectedTx.items
      .filter((item) => (returnQtys[item.product.id] || 0) > 0)
      .map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        qty: returnQtys[item.product.id],
        price: item.unitPrice,
        subtotal: returnQtys[item.product.id] * item.unitPrice,
        reason: returnReasons[item.product.id] || 'Retur Pelanggan',
      }));

    if (returnItems.length === 0) {
      playBeep('error');
      alert('Pilih minimal 1 item barang yang akan diretur!');
      return;
    }

    const retObj: SalesReturn = {
      id: 'ret-' + Date.now(),
      returnNo: 'RET-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900),
      invoiceNo: selectedTx.invoiceNo,
      date: new Date().toISOString(),
      cashierName: 'ADMIN',
      customerName: selectedTx.customerName,
      items: returnItems,
      totalRefund,
      refundMethod,
    };

    setIsSubmitting(true);
    try {
      const saved = await onProcessReturn(retObj);
      if (saved === false) return;
      playBeep('success');
      alert(`Retur Penjualan ${retObj.returnNo} berhasil diproses.`);
      onClose();
    } catch (error) {
      playBeep('error');
      alert(
        `Retur belum tersimpan: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-400" />
            <h2 className="text-sm font-bold">Retur Penjualan Barang</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Invoice search input */}
          <form onSubmit={handleSearchInvoice} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                placeholder="Masukkan Nomor Nota (misal: PJ-202611-0001)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors"
            >
              Cari Nota
            </button>
          </form>

          {selectedTx ? (
            <form onSubmit={handleSubmitReturn} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-100 rounded-xl space-y-1 text-slate-700">
                <div className="flex justify-between font-semibold">
                  <span>No. Nota: <strong className="font-mono text-slate-900">{selectedTx.invoiceNo}</strong></span>
                  <span>Pelanggan: <strong>{selectedTx.customerName}</strong></span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Tanggal Transaksi: {new Date(selectedTx.date).toLocaleString('id-ID')}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <span className="font-bold text-slate-700 block mb-1">
                  Pilih Item yang Diretur:
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedTx.items.map((item) => (
                    <div key={item.product.id} className="p-3 flex items-center justify-between gap-3 bg-white">
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{item.product.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Beli: {item.qty} {item.product.unit} @ {formatRupiah(item.unitPrice)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Qty Retur:</label>
                          <input
                            type="number"
                            min="0"
                            max={item.qty}
                            value={returnQtys[item.product.id] || 0}
                            onChange={(e) =>
                              setReturnQtys({
                                ...returnQtys,
                                [item.product.id]: Math.min(item.qty, Math.max(0, parseInt(e.target.value) || 0)),
                              })
                            }
                            className="w-16 p-1 border border-slate-300 rounded text-center font-bold font-mono"
                          />
                        </div>

                        <div className="w-32">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Alasan:</label>
                          <select
                            value={returnReasons[item.product.id] || ''}
                            onChange={(e) =>
                              setReturnReasons({
                                ...returnReasons,
                                [item.product.id]: e.target.value,
                              })
                            }
                            className="w-full p-1 border border-slate-300 rounded text-[11px]"
                          >
                            <option value="Kemasan Rusak / Cacat">Rusak / Cacat</option>
                            <option value="Kadaluarsa / Expired">Kadaluarsa</option>
                            <option value="Salah Beli">Salah Beli</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refund Method & Total */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300">Total Pengembalian Dana (Refund):</span>
                  <span className="text-xl font-extrabold text-rose-400 font-mono-numbers">
                    {formatRupiah(totalRefund)}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span>Metode Pengembalian:</span>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as 'TUNAI' | 'POTONG_PIUTANG' | 'GANTI_BARANG')}
                    className="p-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="TUNAI">Pengembalian Uang Tunai (Kas Kasir)</option>
                    <option value="GANTI_BARANG">Tukar Barang Sejenis</option>
                    <option value="POTONG_PIUTANG">Potong Piutang Pelanggan</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={totalRefund <= 0 || isSubmitting}
                  className="py-2 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-40"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Proses Retur Penjualan'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
              <p className="text-xs">
                Masukkan nomor nota penjualan yang valid di atas untuk memulai proses retur.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
