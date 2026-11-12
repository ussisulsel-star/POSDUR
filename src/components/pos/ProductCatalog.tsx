import React, { useState } from 'react';
import { Search, ScanLine, Tag, AlertTriangle, Plus, Store, Sparkles } from 'lucide-react';
import { Product, Category, Outlet, getBrandConfig } from '../../types/pos';
import { INITIAL_CATEGORIES } from '../../data/seedData';
import { formatRupiah, playBeep } from '../../services/storageService';

interface ProductCatalogProps {
  products: Product[];
  categories?: Category[];
  activeOutlet?: Outlet;
  onAddToCart: (product: Product) => void;
  barcodeInputRef: React.RefObject<HTMLInputElement | null>;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  categories,
  activeOutlet,
  onAddToCart,
  barcodeInputRef,
}) => {
  const categoryList = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
  const [selectedCategory, setSelectedCategory] = useState<string>('cat-all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const activeBrand = activeOutlet?.brand;
  const brandConfig = getBrandConfig(activeBrand);

  // Filter products by active outlet's brand
  // Only products matching activeOutlet.brand are shown
  const brandProducts = products.filter((product) => {
    if (!activeBrand) return true;
    return product.brand === activeBrand;
  });

  // Handle barcode submission (Enter key)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    // Search by exact barcode or item code across all products
    const matchedInAll = products.find(
      (p) => p.barcode === query || p.code.toLowerCase() === query.toLowerCase()
    ) || products.find((p) => p.name.toLowerCase().includes(query.toLowerCase()));

    if (matchedInAll) {
      // Validate brand isolation
      if (activeBrand && matchedInAll.brand && matchedInAll.brand !== activeBrand) {
        playBeep('error');
        setScanMessage(`Produk "${matchedInAll.name}" milik brand [${matchedInAll.brand}]. Cabang ini hanya melayani [${activeBrand}]!`);
        setTimeout(() => setScanMessage(null), 4500);
        return;
      }

      playBeep('scan');
      onAddToCart(matchedInAll);
      setScanMessage(`Berhasil scan: ${matchedInAll.name}`);
      setTimeout(() => setScanMessage(null), 2000);
      setBarcodeInput('');
    } else {
      playBeep('error');
      setScanMessage(`Barang dengan kode/barcode "${query}" tidak ditemukan!`);
      setTimeout(() => setScanMessage(null), 3500);
    }
  };

  const filteredProducts = brandProducts.filter((product) => {
    const matchesCat =
      selectedCategory === 'cat-all' || product.categoryId === selectedCategory;
    const matchesQuery =
      searchQuery === '' ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Brand Identity Banner */}
      {activeBrand && (
        <div className={`px-3 py-2 border-b flex items-center justify-between text-xs ${brandConfig.badgeBg} ${brandConfig.badgeBorder}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl shrink-0">{brandConfig.emoji}</span>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-bold ${brandConfig.badgeText} text-xs tracking-wide`}>
                  BRAND: {brandConfig.name}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-700 font-medium text-[11px]">
                  {activeOutlet?.name}
                </span>
                {activeOutlet?.isMall && (
                  <span className="bg-amber-500 text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded shadow-2xs">
                    MALL OUTLET
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 hidden sm:block">
                {brandConfig.tagline}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 ${brandConfig.badgeText} border ${brandConfig.badgeBorder} shadow-2xs`}>
              {brandProducts.length} Produk Brand
            </span>
          </div>
        </div>
      )}

      {/* Top Search & Barcode Bar */}
      <div className="p-3 bg-white border-b border-slate-200 shadow-xs flex flex-col sm:flex-row gap-2">
        {/* Real Barcode Scanner Input */}
        <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder={`Scan Barcode / Kode Produk ${activeBrand || ''}...`}
              className="w-full pl-9 pr-20 py-2 bg-blue-50/50 border border-blue-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Enter
            </button>
          </div>
        </form>

        {/* Name / Keyword Filter */}
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter menu..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Barcode scanner test simulator shortcuts */}
      <div className="px-3 py-1.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-blue-900 font-medium">
          <ScanLine className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Quick Scan Demo:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {brandProducts.slice(0, 3).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setBarcodeInput(item.barcode);
                playBeep('scan');
                onAddToCart(item);
              }}
              className="px-2 py-0.5 bg-white border border-blue-200 hover:bg-blue-100 text-blue-800 rounded text-[11px] font-mono truncate max-w-[120px]"
              title={`${item.name} (${item.barcode})`}
            >
              {item.name.split(' ')[0]} ({item.barcode.slice(-4)})
            </button>
          ))}
        </div>
      </div>

      {/* Temporary Scan Message Toast */}
      {scanMessage && (
        <div
          className={`mx-3 mt-2 p-2 rounded text-xs font-semibold flex items-center gap-2 ${
            scanMessage.includes('tidak ditemukan') || scanMessage.includes('habis')
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {scanMessage.includes('tidak ditemukan') || scanMessage.includes('habis') ? (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Tag className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Category Tabs (Clean Segmented / Pill-Free Buttons) */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
        {categoryList.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
              selectedCategory === category.id
                ? 'bg-slate-900 text-white shadow-xs font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredProducts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
            <Search className="w-10 h-10 mb-2 stroke-1" />
            <p className="text-sm font-medium">Tidak ada produk yang cocok</p>
            <p className="text-xs text-slate-400">Coba kata kunci lain atau pilih kategori Semua</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filteredProducts.map((product) => {
              return (
                <button
                  key={product.id}
                  onClick={() => {
                    playBeep('scan');
                    onAddToCart(product);
                  }}
                  className="flex flex-col justify-between p-3 rounded-xl border text-left transition-all bg-white border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer active:scale-[0.98]"
                >
                  <div>
                    {/* Header: Code & Unit */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                      <div className="flex items-center gap-1.5">
                        <span>{product.code}</span>
                        {product.isPackage && (
                          <span className="bg-amber-100 text-amber-800 font-sans font-bold px-1.5 py-0.2 rounded text-[9px] uppercase border border-amber-300">
                            🎁 Paket
                          </span>
                        )}
                      </div>
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-sans text-[10px]">
                        {product.unit}
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight mb-1">
                      {product.name}
                    </h3>

                    {/* Package contents summary if package */}
                    {product.isPackage && product.packageItems && product.packageItems.length > 0 && (
                      <div className="text-[10px] text-amber-800 bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200/80 line-clamp-1 mb-2">
                        {product.packageItems.map((p) => `${p.qty}x ${p.productName}`).join(' + ')}
                      </div>
                    )}
                  </div>

                  {/* Footer: Price */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {activeOutlet?.isMall ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-amber-700 font-mono-numbers">
                              {formatRupiah(product.sellPriceMall || product.sellPrice)}
                            </span>
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                              Mall
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <span>Reg: {formatRupiah(product.sellPrice)}</span>
                            <span>·</span>
                            <span>{product.barcode}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-extrabold text-blue-700 font-mono-numbers">
                            {formatRupiah(product.sellPrice)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {product.barcode}
                            {product.sellPriceMall && product.sellPriceMall !== product.sellPrice && (
                              <span className="ml-1 text-slate-400">(Mall: {formatRupiah(product.sellPriceMall)})</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Catalog Footer Info */}
      <div className="px-3 py-2 bg-white border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Menampilkan <strong>{filteredProducts.length}</strong> produk</span>
        {activeOutlet?.isMall ? (
          <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
            🏬 Mode Harga Outlet Mall Aktif
          </span>
        ) : (
          <span className="font-mono">Barcode Scanner Mode Aktif</span>
        )}
      </div>
    </div>
  );
};
