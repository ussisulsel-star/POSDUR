import React, { useState } from 'react';
import { X, Search, History, Printer, Eye, Calendar, Edit3, Trash2, ShieldAlert } from 'lucide-react';
import { Transaction, User as PosUser, EMoney, CartItem } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';
import { EditTransactionModal } from './EditTransactionModal';
import { VoidTransactionModal } from './VoidTransactionModal';

interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onSelectTransactionForPrint: (t: Transaction) => void;
  onUpdateTransaction?: (updatedTx: Transaction) => void;
  onDeleteTransaction?: (txId: string) => void;
  currentUser?: PosUser | null;
  emoneyList?: EMoney[];
  canVoid?: boolean;
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({
  isOpen,
  onClose,
  transactions,
  onSelectTransactionForPrint,
  onUpdateTransaction,
  onDeleteTransaction,
  currentUser,
  emoneyList = [],
  canVoid = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);

  if (!isOpen) return null;

  const filtered = transactions.filter(
    (t) =>
      t.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.cashierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold">Riwayat Nota Penjualan & Cetak Ulang (F9)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan No. Nota, Nama Pelanggan, atau Kasir..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <span className="text-xs text-slate-500 shrink-0 font-medium">
            Total Transaksi: <strong>{filtered.length}</strong>
          </span>
        </div>

        {/* Body Split View */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Left Table */}
          <div className="md:col-span-7 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada data transaksi yang tercatat.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">No. Nota</th>
                    <th className="py-2 px-2 font-semibold">Pelanggan</th>
                    <th className="py-2 px-2 font-semibold text-right">Total</th>
                    <th className="py-2 px-2 font-semibold text-center">Metode</th>
                    <th className="py-2 px-2 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTx(t)}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                        selectedTx?.id === t.id ? 'bg-blue-50 font-medium' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">
                        {t.invoiceNo}
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {new Date(t.date).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-slate-700">
                        {t.customerName}
                        <div className="text-[10px] text-slate-400">{t.items.length} item</div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono-numbers font-bold text-blue-700">
                        {formatRupiah(t.grandTotal)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                          {t.payments.map((p) => p.method).join(', ')}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playBeep('scan');
                              onSelectTransactionForPrint(t);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                            title="Cetak Ulang Struk"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {canVoid && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playBeep('scan');
                                setEditingTx(t);
                              }}
                              className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded"
                              title="Koreksi Transaksi (SPV)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canVoid && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playBeep('scan');
                                setVoidingTx(t);
                              }}
                              className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded"
                              title="Hapus / Void Transaksi (SPV)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right Detail Pane */}
          <div className="md:col-span-5 p-4 bg-slate-50 overflow-y-auto flex flex-col justify-between text-xs">
            {selectedTx ? (
              <div className="space-y-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {selectedTx.invoiceNo}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                      {selectedTx.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(selectedTx.date).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                    Kasir: <strong>{selectedTx.cashierName}</strong> · Pelanggan: <strong>{selectedTx.customerName}</strong>
                  </div>
                </div>

                {/* Items breakdown */}
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Daftar Barang:</span>
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                    {selectedTx.items.map((i: CartItem, idx: number) => (
                      <div key={idx} className="p-2 space-y-1 text-[11px]">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>{i.product.name}</span>
                              {i.product.isPackage && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                                  Paket
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 font-mono text-[10px]">
                              {i.qty} x {formatRupiah(i.unitPrice)}
                            </div>
                          </div>
                          <span className="font-mono-numbers font-bold text-slate-900">
                            {formatRupiah(i.subtotal)}
                          </span>
                        </div>

                        {/* Detail Rincian Paket tanpa harga satuan */}
                        {i.product.isPackage && i.product.packageItems && i.product.packageItems.length > 0 && (
                          <div className="pl-2 py-0.5 border-l-2 border-amber-300 text-[10px] text-amber-900 bg-amber-50/60 rounded-r">
                            <span className="font-bold text-amber-800">Isi Paket: </span>
                            <span className="text-slate-600">
                              {i.product.packageItems.map((pkg) => `${pkg.qty * i.qty}x ${pkg.productName}`).join(' · ')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Totals */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono-numbers">{formatRupiah(selectedTx.subtotal)}</span>
                  </div>
                  {selectedTx.discountTotal > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Diskon:</span>
                      <span className="font-mono-numbers">-{formatRupiah(selectedTx.discountTotal)}</span>
                    </div>
                  )}
                  {selectedTx.taxTotal > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>PPN 11%:</span>
                      <span className="font-mono-numbers">+{formatRupiah(selectedTx.taxTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-blue-700 pt-1 border-t border-slate-100">
                    <span>Grand Total:</span>
                    <span className="font-mono-numbers">{formatRupiah(selectedTx.grandTotal)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => {
                      playBeep('scan');
                      onSelectTransactionForPrint(selectedTx);
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Ulang Struk (Thermal 80mm)</span>
                  </button>

                  {canVoid && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => {
                          playBeep('scan');
                          setEditingTx(selectedTx);
                        }}
                        className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Koreksi / Edit (SPV)</span>
                      </button>

                      <button
                        onClick={() => {
                          playBeep('scan');
                          setVoidingTx(selectedTx);
                        }}
                        className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus / Void</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-10">
                <Eye className="w-8 h-8 mb-2 stroke-1" />
                <p>Pilih salah satu transaksi dari daftar untuk melihat detail.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <EditTransactionModal
          isOpen={true}
          onClose={() => setEditingTx(null)}
          transaction={editingTx}
          onSaveTransaction={(updatedTx) => {
            if (onUpdateTransaction) onUpdateTransaction(updatedTx);
            setSelectedTx(updatedTx);
            setEditingTx(null);
          }}
          currentUser={currentUser}
          emoneyList={emoneyList}
        />
      )}

      {/* Void Transaction Modal */}
      {voidingTx && (
        <VoidTransactionModal
          isOpen={true}
          onClose={() => setVoidingTx(null)}
          transaction={voidingTx}
          onConfirmVoid={(txId, reason) => {
            if (onDeleteTransaction) onDeleteTransaction(txId);
            if (selectedTx?.id === txId) setSelectedTx(null);
            setVoidingTx(null);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
