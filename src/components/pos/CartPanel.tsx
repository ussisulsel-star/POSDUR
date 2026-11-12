import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Trash2, 
  Plus, 
  Minus, 
  UserCheck, 
  Percent, 
  Receipt, 
  CreditCard, 
  PauseCircle, 
  RotateCcw,
  Tag,
  Check,
  ChevronDown,
  X
} from 'lucide-react';
import { CartItem, Customer } from '../../types/pos';
import { formatRupiah, playBeep, StorageService } from '../../services/storageService';

interface CartPanelProps {
  cart: CartItem[];
  customers: Customer[];
  selectedCustomer: Customer;
  onSelectCustomer: (customer: Customer) => void;
  onUpdateQty: (productId: string, newQty: number) => void;
  onUpdateItemDiscount: (productId: string, discountRp: number, discountPercent: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onHoldOrder: () => void;
  onOpenPayment: () => void;
  invoiceNo: string;
  invoiceDiscountPercent: number;
  setInvoiceDiscountPercent: (percent: number) => void;
  taxEnabled: boolean;
  setTaxEnabled: (enabled: boolean) => void;
  onOpenNewCustomerModal: () => void;
  canDiscount: boolean;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onHoldOrder,
  onOpenPayment,
  invoiceNo,
  invoiceDiscountPercent,
  setInvoiceDiscountPercent,
  taxEnabled,
  setTaxEnabled,
  onOpenNewCustomerModal,
  canDiscount,
}) => {
  // Compute financial totals
  const rawSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const itemsDiscountTotal = cart.reduce((sum, item) => sum + item.discountRp * item.qty, 0);
  const subtotalAfterItemDiscounts = rawSubtotal - itemsDiscountTotal;
  
  // Invoice-level discount
  const invoiceDiscountAmount = Math.round((subtotalAfterItemDiscounts * invoiceDiscountPercent) / 100);
  const afterInvoiceDiscount = Math.max(0, subtotalAfterItemDiscounts - invoiceDiscountAmount);

  // Tax (PPN 11%)
  const taxAmount = taxEnabled ? Math.round(afterInvoiceDiscount * 0.11) : 0;
  const grandTotal = afterInvoiceDiscount + taxAmount;
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

  // Pencarian pelanggan cepat (nama / nomor HP / kode member)
  const [customerQuery, setCustomerQuery] = useState<string>('');
  const [customerOpen, setCustomerOpen] = useState<boolean>(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState<number>(0);
  const customerBoxRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const customerOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const defaultCustomer = customers.find((c) => c.id === 'cust-umum') || customers[0];

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers;

    const digits = customerQuery.replace(/\D/g, '');
    return customers.filter((customer) => {
      const phoneDigits = customer.phone.replace(/\D/g, '');
      return (
        customer.name.toLowerCase().includes(query) ||
        customer.code.toLowerCase().includes(query) ||
        (digits.length > 0 && phoneDigits.includes(digits))
      );
    });
  }, [customers, customerQuery]);

  const memberTierLabels = useMemo(
    () =>
      new Map(
        StorageService.getMemberTiers().map((tier) => [tier.tier, tier.label])
      ),
    [customers]
  );

  const tierLabel = (customer: Customer) => {
    if (customer.tier === 'UMUM') return 'Reguler';
    return memberTierLabels.get(customer.tier) ?? customer.tier;
  };

  useEffect(() => {
    setActiveCustomerIndex(0);
  }, [customerQuery]);

  useEffect(() => {
    if (!customerOpen) return;
    customerOptionRefs.current[activeCustomerIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeCustomerIndex, customerOpen]);

  useEffect(() => {
    if (!customerOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        customerBoxRef.current &&
        !customerBoxRef.current.contains(event.target as Node)
      ) {
        setCustomerOpen(false);
        setCustomerQuery('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [customerOpen]);

  const handleSelectCustomer = (customer: Customer) => {
    onSelectCustomer(customer);
    playBeep('success');
    setCustomerOpen(false);
    setCustomerQuery('');
    setActiveCustomerIndex(0);
    customerInputRef.current?.blur();
  };

  const closeCustomerSearch = () => {
    setCustomerOpen(false);
    setCustomerQuery('');
    setActiveCustomerIndex(0);
  };

  const handleCustomerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!customerOpen) {
        setCustomerOpen(true);
        setCustomerQuery('');
        return;
      }
      setActiveCustomerIndex((index) =>
        Math.min(index + 1, filteredCustomers.length - 1)
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!customerOpen) {
        setCustomerOpen(true);
        setCustomerQuery('');
        return;
      }
      setActiveCustomerIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      if (!customerOpen) {
        event.preventDefault();
        setCustomerOpen(true);
        setCustomerQuery('');
        return;
      }
      event.preventDefault();
      const customer = filteredCustomers[activeCustomerIndex];
      if (customer) handleSelectCustomer(customer);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeCustomerSearch();
      customerInputRef.current?.blur();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Top Customer & Invoice Bar */}
      <div className="p-3 bg-slate-900 text-white border-b border-slate-800">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1.5 font-mono">
            <Receipt className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-300">No. Nota:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {invoiceNo}
            </span>
          </div>

          <div className="text-xs text-slate-300">
            <span>Item: <strong>{cart.length}</strong> | Qty: <strong>{totalQty}</strong></span>
          </div>
        </div>

        {/* Customer Selector — ketik untuk mencari nama / nomor HP */}
        <div className="flex items-center gap-2">
          <div ref={customerBoxRef} className="relative flex-1">
            <UserCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <input
              ref={customerInputRef}
              type="text"
              role="combobox"
              aria-label="Cari dan pilih pelanggan"
              aria-expanded={customerOpen}
              aria-controls="customer-search-options"
              aria-autocomplete="list"
              aria-activedescendant={
                customerOpen && filteredCustomers[activeCustomerIndex]
                  ? `customer-option-${filteredCustomers[activeCustomerIndex].id}`
                  : undefined
              }
              value={customerOpen ? customerQuery : selectedCustomer.name}
              onChange={(event) => {
                setCustomerQuery(event.target.value);
                setCustomerOpen(true);
              }}
              onFocus={() => {
                setCustomerQuery('');
                setCustomerOpen(true);
              }}
              onKeyDown={handleCustomerKeyDown}
              placeholder="Cari nama atau no. HP pelanggan..."
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-8 pr-14 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {customerOpen && customerQuery ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setCustomerQuery('');
                  setActiveCustomerIndex(0);
                  customerInputRef.current?.focus();
                }}
                className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                title="Hapus pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : !customerOpen && defaultCustomer && selectedCustomer.id !== defaultCustomer.id ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelectCustomer(defaultCustomer)}
                className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                title="Kembali ke Umum (Walk-in)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}

            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

            {customerOpen && (
              <div
                id="customer-search-options"
                role="listbox"
                aria-label="Hasil pencarian pelanggan"
                className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-2xl"
              >
                {filteredCustomers.length === 0 ? (
                  <div className="px-3 py-5 text-center">
                    <p className="text-xs font-semibold text-slate-200">
                      Pelanggan tidak ditemukan
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tidak ada nama atau nomor HP yang cocok dengan
                      &ldquo;{customerQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        closeCustomerSearch();
                        onOpenNewCustomerModal();
                      }}
                      className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      + Tambah Pelanggan Baru
                    </button>
                  </div>
                ) : (
                  filteredCustomers.map((customer, index) => {
                    const isActive = index === activeCustomerIndex;
                    const isSelected = customer.id === selectedCustomer.id;

                    return (
                      <button
                        key={customer.id}
                        ref={(element) => {
                          customerOptionRefs.current[index] = element;
                        }}
                        id={`customer-option-${customer.id}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveCustomerIndex(index)}
                        onClick={() => handleSelectCustomer(customer)}
                        className={`flex w-full flex-col px-2.5 py-2 text-left transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <span className="flex w-full items-center gap-2">
                          <span className="truncate text-xs font-semibold">
                            {customer.name}
                          </span>
                          {isSelected && (
                            <Check
                              className={`ml-auto h-3.5 w-3.5 shrink-0 ${
                                isActive ? 'text-white' : 'text-blue-400'
                              }`}
                            />
                          )}
                        </span>
                        <span
                          className={`mt-0.5 w-full truncate font-mono text-[10px] ${
                            isActive ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {customer.phone || '-'} · {tierLabel(customer)}
                          {customer.discountPercent > 0
                            ? ` · Diskon ${customer.discountPercent}%`
                            : ''}
                          {customer.points > 0 ? ` · ${customer.points} pts` : ''}
                        </span>
                      </button>
                    );
                  })
                )}

                {filteredCustomers.length > 0 && (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-400">
                    <span>{filteredCustomers.length} pelanggan</span>
                    <span>↑↓ pilih · Enter pilih · Esc tutup</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onOpenNewCustomerModal}
            title="Tambah Pelanggan Baru"
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shrink-0 transition-colors"
          >
            + Member
          </button>
        </div>

        {/* Customer Discount Alert if applicable */}
        {selectedCustomer.discountPercent > 0 && (
          <div className="mt-2 px-2 py-1 bg-emerald-950/70 border border-emerald-800/80 rounded text-[11px] text-emerald-300 flex items-center justify-between">
            <span>Benefit: Diskon Pelanggan <strong>{selectedCustomer.discountPercent}%</strong></span>
            <span>Poin: {selectedCustomer.points} pts</span>
          </div>
        )}
      </div>

      {/* Cart Items Table */}
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-slate-400 text-center">
            <Receipt className="w-12 h-12 mb-3 text-slate-300 stroke-1" />
            <p className="text-sm font-semibold text-slate-600">Keranjang Masih Kosong</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Silakan scan barcode barang atau pilih produk dari katalog di sebelah kiri.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-2 px-2.5 font-semibold">Produk</th>
                <th className="py-2 px-2 font-semibold text-center w-28">Qty</th>
                <th className="py-2 px-2 font-semibold text-right">Harga</th>
                <th className="py-2 px-2 font-semibold text-right">Subtotal</th>
                <th className="py-2 px-1 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((item) => (
                <tr key={item.product.id} className="hover:bg-slate-50 transition-colors">
                  {/* Product description */}
                  <td className="py-2.5 px-2.5">
                    <div className="font-semibold text-slate-900 leading-tight flex items-center gap-1.5 flex-wrap">
                      <span>{item.product.name}</span>
                      {item.product.isPackage && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold uppercase border border-amber-200">
                          Paket
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {item.product.code} · {item.product.unit}
                    </div>

                    {/* Breakdown isi paket (tanpa harga terpisah) */}
                    {item.product.isPackage && item.product.packageItems && item.product.packageItems.length > 0 && (
                      <div className="mt-1.5 pl-2 py-1 bg-amber-50/70 border-l-2 border-amber-400 rounded-r text-[10px] text-amber-900 space-y-0.5">
                        <div className="font-bold text-[9px] uppercase tracking-wider text-amber-800">
                          Rincian Isi Paket:
                        </div>
                        {item.product.packageItems.map((pkg, pIdx) => (
                          <div key={pIdx} className="text-slate-700 italic">
                            • {pkg.qty * item.qty}x {pkg.productName}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.discountRp > 0 && (
                      <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                        Disc: -{formatRupiah(item.discountRp)}
                      </div>
                    )}
                  </td>

                  {/* Quantity Controller */}
                  <td className="py-2.5 px-2 text-center">
                    <div className="inline-flex items-center border border-slate-300 rounded-md bg-white overflow-hidden shadow-2xs">
                      <button
                        onClick={() => {
                          if (item.qty <= 1) {
                            playBeep('delete');
                            onRemoveItem(item.product.id);
                          } else {
                            onUpdateQty(item.product.id, item.qty - 1);
                          }
                        }}
                        className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200"
                        title="Kurangi Qty"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          onUpdateQty(item.product.id, Math.max(1, val));
                        }}
                        className="w-10 text-center text-xs font-bold text-slate-900 focus:outline-none font-mono"
                      />

                      <button
                        onClick={() => {
                          onUpdateQty(item.product.id, item.qty + 1);
                        }}
                        className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200"
                        title="Tambah Qty"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>

                  {/* Unit Price */}
                  <td className="py-2.5 px-2 text-right font-mono-numbers text-slate-600">
                    {formatRupiah(item.unitPrice)}
                  </td>

                  {/* Subtotal */}
                  <td className="py-2.5 px-2 text-right font-mono-numbers font-bold text-slate-900">
                    {formatRupiah(item.subtotal)}
                  </td>

                  {/* Delete Item */}
                  <td className="py-2.5 px-1 text-center">
                    <button
                      onClick={() => {
                        playBeep('delete');
                        onRemoveItem(item.product.id);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                      title="Hapus dari Keranjang"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary & Digital LED Total Display */}
      <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-col gap-2.5">
        {/* Subtotal & Diskon adjustments */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Subtotal Barang:</span>
            <span className="font-mono-numbers font-medium">{formatRupiah(rawSubtotal)}</span>
          </div>

          {itemsDiscountTotal > 0 && (
            <div className="flex items-center justify-between text-rose-600">
              <span>Total Diskon Item / Member:</span>
              <span className="font-mono-numbers font-medium">-{formatRupiah(itemsDiscountTotal)}</span>
            </div>
          )}

          {/* Additional Invoice Discount Input */}
          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Diskon Tambahan Faktur:</span>
              {canDiscount ? (
                <div className="flex items-center border border-slate-300 rounded px-1.5 py-0.5 bg-white">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={invoiceDiscountPercent}
                    onChange={(e) => setInvoiceDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="w-8 text-center text-xs font-mono font-bold focus:outline-none"
                  />
                  <Percent className="w-3 h-3 text-slate-400 ml-0.5" />
                </div>
              ) : (
                <span
                  className="text-[10px] font-semibold text-slate-400 bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5"
                  title="Akun Anda tidak berwenang memberikan diskon tambahan"
                >
                  Tidak berwenang
                </span>
              )}
            </div>
            {invoiceDiscountAmount > 0 && (
              <span className="font-mono-numbers text-rose-600 font-medium">
                -{formatRupiah(invoiceDiscountAmount)}
              </span>
            )}
          </div>

          {/* PPN 11% Toggle */}
          <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/80">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-[11px]">PPN 11% (Pajak Pertambahan Nilai)</span>
            </label>
            {taxEnabled && (
              <span className="font-mono-numbers font-medium text-slate-700">
                +{formatRupiah(taxAmount)}
              </span>
            )}
          </div>
        </div>

        {/* Big LED Total Display Screen (Signature Ketoko POS look) */}
        <div className="bg-slate-950 rounded-xl p-3 text-white border border-slate-800 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-mono">
            <span>TOTAL TAGIHAN KASIR</span>
            <span className="text-emerald-400 font-semibold">{totalQty} ITEMS</span>
          </div>

          <div className="text-right text-2xl lg:text-3xl font-extrabold text-emerald-400 font-mono-numbers tracking-tight mt-1">
            {formatRupiah(grandTotal)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* Clear Cart */}
          <button
            onClick={() => {
              if (cart.length > 0 && confirm('Kosongkan keranjang saat ini?')) {
                onClearCart();
              }
            }}
            disabled={cart.length === 0}
            className="flex items-center justify-center gap-1 py-2 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Bersihkan Keranjang (Esc)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Batal (Esc)</span>
          </button>

          {/* Hold / Pending */}
          <button
            onClick={onHoldOrder}
            disabled={cart.length === 0}
            className="flex items-center justify-center gap-1 py-2 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Tahan Transaksi (F7)"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>Tahan (F7)</span>
          </button>

          {/* Pay / Checkout */}
          <button
            onClick={onOpenPayment}
            disabled={cart.length === 0}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Bayar / Checkout (F8)"
          >
            <CreditCard className="w-4 h-4" />
            <span>BAYAR (F8)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
