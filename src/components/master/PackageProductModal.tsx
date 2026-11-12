import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Package, 
  Boxes, 
  Tag, 
  Sparkles, 
  AlertCircle, 
  Check, 
  ArrowRight,
  Building2,
  Info
} from 'lucide-react';
import { Product, Category, PackageItem, BrandName, AVAILABLE_BRANDS, getBrandConfig } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';

interface PackageProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePackage: (packageProduct: Product) => void;
  initialProduct?: Product | null;
  allProducts: Product[];
  categories: Category[];
}

export const PackageProductModal: React.FC<PackageProductModalProps> = ({
  isOpen,
  onClose,
  onSavePackage,
  initialProduct,
  allProducts,
  categories,
}) => {
  // Kategori default untuk paket: kategori pertama selain "Semua".
  const defaultCategoryId =
    categories.find((category) => category.id !== 'cat-all')?.id || categories[0]?.id || 'cat-all';

  // Available non-package products to bundle
  const regularProducts = allProducts.filter((p) => !p.isPackage);

  const [code, setCode] = useState<string>('');
  const [barcode, setBarcode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [brand, setBrand] = useState<BrandName | string>('Del Mango');
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId);
  const [unit, setUnit] = useState<string>('Paket');
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [sellPriceMall, setSellPriceMall] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number>(0);
  const [packageItems, setPackageItems] = useState<PackageItem[]>([]);

  // Item Picker State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedItemQty, setSelectedItemQty] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (initialProduct) {
      setCode(initialProduct.code);
      setBarcode(initialProduct.barcode);
      setName(initialProduct.name);
      setBrand(initialProduct.brand || 'Del Mango');
      setCategoryId(initialProduct.categoryId || defaultCategoryId);
      setUnit(initialProduct.unit || 'Paket');
      setSellPrice(initialProduct.sellPrice);
      setSellPriceMall(initialProduct.sellPriceMall || initialProduct.sellPrice);
      setCostPrice(initialProduct.costPrice || 0);
      setWholesalePrice(initialProduct.wholesalePrice || 0);
      setPackageItems(initialProduct.packageItems ? [...initialProduct.packageItems] : []);
    } else {
      const randNum = Math.floor(100 + Math.random() * 900);
      setCode(`PKT-${randNum}`);
      setBarcode(`8999999088${randNum}`);
      setName('');
      setBrand('Del Mango');
      setCategoryId(defaultCategoryId);
      setUnit('Paket');
      setSellPrice(0);
      setSellPriceMall(0);
      setCostPrice(0);
      setWholesalePrice(0);
      setPackageItems([]);
    }
    setErrorMsg('');
  }, [initialProduct, isOpen]);

  // Set default selected product when list is available
  useEffect(() => {
    if (regularProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(regularProducts[0].id);
    }
  }, [regularProducts, selectedProductId]);

  if (!isOpen) return null;

  // Calculate sum of standard selling prices and cost prices of items in package
  const standardSum = packageItems.reduce((acc, item) => {
    const orig = regularProducts.find((p) => p.id === item.productId);
    const unitP = orig ? orig.sellPrice : item.standardPrice || 0;
    return acc + unitP * item.qty;
  }, 0);

  const standardCostSum = packageItems.reduce((acc, item) => {
    const orig = regularProducts.find((p) => p.id === item.productId);
    const costP = orig ? orig.costPrice : 0;
    return acc + costP * item.qty;
  }, 0);

  // Add an item to package list
  const handleAddItemToPackage = () => {
    if (!selectedProductId) return;
    const targetProduct = regularProducts.find((p) => p.id === selectedProductId);
    if (!targetProduct) return;

    if (selectedItemQty <= 0) {
      alert('Jumlah item harus lebih dari 0.');
      return;
    }

    setPackageItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === selectedProductId);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].qty += selectedItemQty;
        return updated;
      } else {
        const newItem: PackageItem = {
          productId: targetProduct.id,
          productCode: targetProduct.code,
          productName: targetProduct.name,
          qty: selectedItemQty,
          unit: targetProduct.unit,
          standardPrice: targetProduct.sellPrice,
        };
        return [...prev, newItem];
      }
    });

    // Auto-suggest cost price if not yet set
    const addedCost = targetProduct.costPrice * selectedItemQty;
    setCostPrice((prev) => (prev > 0 ? prev + addedCost : addedCost));

    // Auto-suggest sell price if 0 (e.g., 90% of standard sum as promo package)
    if (sellPrice === 0) {
      const suggested = Math.round((targetProduct.sellPrice * selectedItemQty * 0.9) / 500) * 500;
      setSellPrice(suggested);
      setSellPriceMall(Math.round((suggested * 1.2) / 500) * 500);
    }

    setSelectedItemQty(1);
    playBeep('scan');
  };

  // Remove item from package
  const handleRemovePackageItem = (index: number) => {
    setPackageItems((prev) => prev.filter((_, idx) => idx !== index));
    playBeep('delete');
  };

  // Update item qty in table
  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setPackageItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], qty: newQty };
      return updated;
    });
  };

  // Save Package Product
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMsg('Nama paket tidak boleh kosong.');
      return;
    }

    if (!code.trim()) {
      setErrorMsg('Kode paket tidak boleh kosong.');
      return;
    }

    if (packageItems.length === 0) {
      setErrorMsg('Paket harus memiliki minimal 1 rincian item barang.');
      return;
    }

    if (sellPrice <= 0) {
      setErrorMsg('Harga jual paket outlet harus lebih dari Rp 0.');
      return;
    }

    const cat = categories.find((c) => c.id === categoryId) || categories[0] || {
      id: 'cat-all',
      name: 'Semua',
    };

    const finalProduct: Product = {
      id: initialProduct?.id || `prod-pkt-${Date.now()}`,
      code: code.trim().toUpperCase(),
      barcode: barcode.trim() || `899${Math.floor(100000000 + Math.random() * 900000000)}`,
      name: name.trim(),
      brand: brand || 'Del Mango',
      categoryId: cat.id,
      categoryName: cat.name,
      unit: unit.trim() || 'Paket',
      costPrice: costPrice > 0 ? costPrice : standardCostSum,
      sellPrice: sellPrice,
      sellPriceMall: sellPriceMall > 0 ? sellPriceMall : sellPrice,
      wholesalePrice: wholesalePrice > 0 ? wholesalePrice : sellPrice,
      stock: 50,
      minStock: 5,
      isPackage: true,
      packageItems: [...packageItems],
    };

    onSavePackage(finalProduct);
    playBeep('success');
    onClose();
  };

  const discountDiff = standardSum - sellPrice;
  const discountPercent = standardSum > 0 ? Math.round((discountDiff / standardSum) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-5">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-amber-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-orange-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl border border-white/20">
              <Boxes className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>{initialProduct ? 'Edit Master Produk Paket' : 'Tambah Master Produk Paket Baru'}</span>
                <span className="text-[11px] bg-amber-400/20 text-amber-200 border border-amber-300/30 px-2 py-0.5 rounded-full font-mono">
                  Paket Bundling / Combo
                </span>
              </h2>
              <p className="text-xs text-amber-100 mt-0.5">
                Kelola paket hemat / bundling. Rincian isi paket otomatis tercetak di struk nota tanpa harga satuan.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Info */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-900 flex items-center gap-2 shrink-0">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Aturan Cetak Struk:</strong> Saat paket ini terjual, nota kasir mencetak nama paket beserta total harga paket, diikuti rincian barang di dalamnya <strong>tanpa harga terpisah</strong>.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Header Information of Package */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>Informasi Pokok Produk Paket</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Paket:</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: PKT-001"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Barcode Paket:</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Barcode untuk scan kasir"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Satuan Paket:</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Paket, Porsi, Box, Hampers..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nama Produk Paket:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Paket Hemat Kenyang 1 (Indomie + Aqua 600ml)"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Brand:</label>
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value as BrandName)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                >
                  {AVAILABLE_BRANDS.map((b) => {
                    const cfg = getBrandConfig(b);
                    return (
                      <option key={b} value={b}>
                        {cfg.emoji} {b}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori:</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Composition / Package Contents Builder */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-amber-950 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Boxes className="w-4 h-4 text-amber-700" />
                <span>Rincian Barang di Dalam Paket ({packageItems.length} Komponen)</span>
              </h3>
              <span className="text-[11px] text-amber-800 font-medium">
                Pilih produk biasa yang digabungkan ke paket ini
              </span>
            </div>

            {/* Picker Form */}
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2.5 rounded-xl border border-amber-200">
              <div className="flex-1 w-full sm:w-auto">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                >
                  {regularProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name} ({formatRupiah(p.sellPrice)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1 w-28">
                  <span className="text-slate-500 whitespace-nowrap">Qty:</span>
                  <input
                    type="number"
                    min="1"
                    value={selectedItemQty}
                    onChange={(e) => setSelectedItemQty(Math.max(1, Number(e.target.value)))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddItemToPackage}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambahkan Item</span>
                </button>
              </div>
            </div>

            {/* Items Table in Package */}
            {packageItems.length === 0 ? (
              <div className="bg-white/80 border border-dashed border-amber-300 rounded-xl p-5 text-center text-amber-800 text-xs">
                Belum ada rincian barang. Silakan pilih produk di atas dan klik <strong>"Tambahkan Item"</strong>.
              </div>
            ) : (
              <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-100/60 text-amber-900 border-b border-amber-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-10 text-center">#</th>
                      <th className="py-2.5 px-3 font-semibold">Kode Barang</th>
                      <th className="py-2.5 px-3 font-semibold">Nama Item Barang</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-24">Jumlah (Qty)</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Harga Normal</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Normal</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-12">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {packageItems.map((item, idx) => {
                      const orig = regularProducts.find((p) => p.id === item.productId);
                      const unitP = orig ? orig.sellPrice : item.standardPrice || 0;
                      const sub = unitP * item.qty;

                      return (
                        <tr key={item.productId} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">
                            {item.productCode || orig?.code || '-'}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                              className="w-16 p-1 bg-slate-50 border border-slate-300 rounded text-center font-bold font-mono"
                            />
                            <span className="ml-1 text-slate-500 text-[10px]">{item.unit || orig?.unit || 'Pcs'}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono-numbers text-slate-500">
                            {formatRupiah(unitP)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-numbers font-bold text-slate-700">
                            {formatRupiah(sub)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePackageItem(idx)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Hapus dari paket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-amber-50 text-amber-950 font-bold border-t border-amber-200">
                    <tr>
                      <td colSpan={5} className="py-2 px-3 text-right">
                        Total Nilai Normal Rincian Item:
                      </td>
                      <td className="py-2 px-3 text-right font-mono-numbers text-sm text-slate-900">
                        {formatRupiah(standardSum)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* 3. Pricing Tier for Package (Outlet vs Mall) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Harga Jual Paket (Multi-Tier Outlet vs Mall)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  <span>Harga Jual Outlet:</span>
                  <span className="text-[10px] text-slate-500 font-normal ml-1">(Luar Mall)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(Number(e.target.value))}
                  placeholder="Harga jual paket standar"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-blue-700 text-sm"
                  required
                />
                {standardSum > 0 && sellPrice > 0 && (
                  <div className="text-[10px] text-emerald-600 mt-1 font-semibold">
                    {discountDiff > 0
                      ? `Pelanggan hemat ${formatRupiah(discountDiff)} (${discountPercent}%)`
                      : 'Harga paket sama dengan harga reguler'}
                  </div>
                )}
              </div>

              <div className="bg-amber-100/40 p-2.5 rounded-xl border border-amber-200">
                <label className="block font-semibold text-amber-900 mb-1 flex items-center justify-between">
                  <span>Harga Jual Mall:</span>
                  <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded font-bold font-mono">
                    🏬 Mall Tier
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={sellPriceMall}
                  onChange={(e) => setSellPriceMall(Number(e.target.value))}
                  placeholder="Harga paket di cabang mall"
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg font-mono font-bold text-amber-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
                <p className="text-[10px] text-amber-700 mt-1">
                  Otomatis digunakan saat transaksi kasir di outlet Mall.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimasi Harga Modal (HPP):</label>
                <input
                  type="number"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  placeholder="Modal barang dalam paket"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Total modal item: {formatRupiah(standardCostSum)}
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {packageItems.length > 0 && (
              <span>
                Paket berisi <strong className="text-slate-800">{packageItems.length}</strong> jenis item barang.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 cursor-pointer transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{initialProduct ? 'Simpan Perubahan Paket' : 'Simpan Master Produk Paket'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
