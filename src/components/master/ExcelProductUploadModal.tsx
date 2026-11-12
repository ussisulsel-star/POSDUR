import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Layers, 
  Check, 
  Building2,
  RefreshCw,
  ShoppingBag,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product, Category, BrandName, getBrandConfig } from '../../types/pos';
import { formatRupiah, playBeep } from '../../services/storageService';

interface ExcelProductUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  existingCategories: Category[];
  onImportProducts: (newProducts: Product[], newCategories: Category[]) => void;
}

interface ParsedProductRow {
  rowNum: number;
  code: string;
  name: string;
  brand: string;
  categoryName: string;
  costPrice: number;
  sellPrice: number;
  sellPriceMall: number;
  barcode: string;
  unit: string;
  stock: number;
  isExisting: boolean;
  isValid: boolean;
  validationError?: string;
}

export const ExcelProductUploadModal: React.FC<ExcelProductUploadModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  existingCategories,
  onImportProducts,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [duplicateAction, setDuplicateAction] = useState<'update' | 'skip'>('update');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Generate and Download Excel Template
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          kode: 'MNM-DM01',
          nama: 'Mangga Smoothie Jumbo Del Mango',
          brand: 'Del Mango',
          kategori: 'Minuman Dingin & Panas',
          harga_pokok: 10000,
          harga_jual_outlet: 18000,
          harga_jual_mall: 24000,
          barcode: '899999911001',
          satuan: 'Cup',
          stok: 100,
        },
        {
          kode: 'MNM-ET01',
          nama: 'Es Teler Pattiro Komplit Spesial',
          brand: 'Es Teler Pattiro',
          kategori: 'Minuman Dingin & Panas',
          harga_pokok: 11000,
          harga_jual_outlet: 20000,
          harga_jual_mall: 26000,
          barcode: '899999922001',
          satuan: 'Mangkok',
          stok: 80,
        },
        {
          kode: 'MKN-DH01',
          nama: 'Donat Halus Meises Coklat Klasik',
          brand: 'Donat Halus',
          kategori: 'Makanan Instan',
          harga_pokok: 4500,
          harga_jual_outlet: 9000,
          harga_jual_mall: 12000,
          barcode: '899999933001',
          satuan: 'Pcs',
          stok: 120,
        },
        {
          kode: 'MNM-TK01',
          nama: 'Es Teh Koala Original Jasmine Cup',
          brand: 'Es Tes Koala',
          kategori: 'Minuman Dingin & Panas',
          harga_pokok: 3500,
          harga_jual_outlet: 8000,
          harga_jual_mall: 12000,
          barcode: '899999944001',
          satuan: 'Cup',
          stok: 150,
        },
        {
          kode: 'SBK-001',
          nama: 'Minyak Goreng Bimoli Pouch 2L',
          brand: 'Es Teler Pattiro',
          kategori: 'Sembako & Bumbu',
          harga_pokok: 32000,
          harga_jual_outlet: 38000,
          harga_jual_mall: 43000,
          barcode: '899999900301',
          satuan: 'Pch',
          stok: 40,
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);

      // Set column widths for nice appearance
      ws['!cols'] = [
        { wch: 14 }, // kode
        { wch: 35 }, // nama
        { wch: 18 }, // brand
        { wch: 22 }, // kategori
        { wch: 14 }, // harga_pokok
        { wch: 18 }, // harga_jual_outlet
        { wch: 16 }, // harga_jual_mall
        { wch: 18 }, // barcode
        { wch: 10 }, // satuan
        { wch: 10 }, // stok
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Master_Produk');
      XLSX.writeFile(wb, 'template_upload_item_barang_catat_pos.xlsx');
      playBeep('success');
    } catch (err) {
      console.error('Error generating template:', err);
      alert('Gagal mendownload template Excel.');
    }
  };

  // Helper to normalize object keys (remove underscores, spaces, lowercase)
  const normalizeKey = (key: string): string => {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Parse uploaded file
  const processExcelFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setErrorMsg('');
    setFile(selectedFile);
    setFileName(selectedFile.name);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        throw new Error('File Excel kosong atau tidak memiliki baris data.');
      }

      const existingCodes = new Set(existingProducts.map((p) => p.code.toLowerCase().trim()));

      const parsed: ParsedProductRow[] = rawJson.map((row, index) => {
        // Map keys loosely to support variations (kode, kode_barang, nama, nama_barang, etc.)
        const normalizedRow: Record<string, any> = {};
        Object.entries(row).forEach(([k, v]) => {
          normalizedRow[normalizeKey(k)] = v;
        });

        const code = String(
          normalizedRow['kode'] ||
          normalizedRow['kodebarang'] ||
          normalizedRow['kodeitem'] ||
          normalizedRow['code'] ||
          normalizedRow['itemcode'] ||
          `BRG-${Math.floor(1000 + Math.random() * 9000)}`
        ).trim();

        const name = String(
          normalizedRow['nama'] ||
          normalizedRow['namabarang'] ||
          normalizedRow['namaproduk'] ||
          normalizedRow['namaitem'] ||
          normalizedRow['name'] ||
          normalizedRow['itemname'] ||
          ''
        ).trim();

        const brand = String(
          normalizedRow['brand'] ||
          normalizedRow['namabrand'] ||
          normalizedRow['merek'] ||
          normalizedRow['namamerek'] ||
          'Del Mango'
        ).trim() || 'Del Mango';

        const categoryName = String(
          normalizedRow['kategori'] ||
          normalizedRow['namakategori'] ||
          normalizedRow['category'] ||
          normalizedRow['categoryname'] ||
          'Umum'
        ).trim();

        const costPrice = Math.max(
          0,
          Number(
            normalizedRow['hargapokok'] ||
            normalizedRow['hpp'] ||
            normalizedRow['modal'] ||
            normalizedRow['costprice'] ||
            0
          ) || 0
        );

        // Regular outlet selling price
        const sellPrice = Math.max(
          0,
          Number(
            normalizedRow['hargajualoutlet'] ||
            normalizedRow['hargajual'] ||
            normalizedRow['hargaoutlet'] ||
            normalizedRow['hargareguler'] ||
            normalizedRow['sellprice'] ||
            0
          ) || 0
        );

        // Mall selling price
        const rawMallPrice = Number(
          normalizedRow['hargajualmall'] ||
          normalizedRow['hargamall'] ||
          normalizedRow['sellpricemall'] ||
          0
        );
        // If Mall price is omitted or 0, fallback to regular sellPrice
        const sellPriceMall = rawMallPrice > 0 ? rawMallPrice : sellPrice;

        const barcode = String(
          normalizedRow['barcode'] ||
          normalizedRow['barcodeproduk'] ||
          normalizedRow['kodebarcode'] ||
          `899${Math.floor(100000000 + Math.random() * 900000000)}`
        ).trim();

        const unit = String(
          normalizedRow['satuan'] ||
          normalizedRow['unit'] ||
          'Pcs'
        ).trim() || 'Pcs';

        const stock = Math.max(
          0,
          Number(
            normalizedRow['stok'] ||
            normalizedRow['stock'] ||
            normalizedRow['stokawal'] ||
            50
          ) || 50
        );

        let isValid = true;
        let validationError = '';

        if (!name) {
          isValid = false;
          validationError = 'Nama barang kosong';
        } else if (sellPrice <= 0) {
          isValid = false;
          validationError = 'Harga jual outlet harus > 0';
        }

        const isExisting = existingCodes.has(code.toLowerCase());

        return {
          rowNum: index + 2, // Excel 1-based, plus header row
          code,
          name,
          brand,
          categoryName: categoryName || 'Umum',
          costPrice,
          sellPrice,
          sellPriceMall,
          barcode,
          unit,
          stock,
          isExisting,
          isValid,
          validationError,
        };
      });

      setParsedRows(parsed);
      playBeep('scan');
    } catch (err: any) {
      console.error('Error parsing excel:', err);
      setErrorMsg(err.message || 'Gagal membaca format file Excel.');
      playBeep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processExcelFile(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processExcelFile(droppedFile);
    }
  };

  // Execute Import
  const handleConfirmImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('Tidak ada baris data produk yang valid untuk diimpor.');
      return;
    }

    // Identify and create categories that don't exist yet
    const currentCategories = [...existingCategories];
    const categoryMap = new Map<string, Category>();
    currentCategories.forEach((c) => {
      categoryMap.set(c.name.toLowerCase().trim(), c);
      categoryMap.set(c.id.toLowerCase().trim(), c);
    });

    const newCategoriesToAdd: Category[] = [];

    validRows.forEach((row) => {
      const catKey = row.categoryName.toLowerCase().trim();
      if (!categoryMap.has(catKey) && catKey !== 'semua') {
        const generatedCatId = 'cat-' + catKey.replace(/[^a-z0-9]/g, '-');
        const newCat: Category = {
          id: generatedCatId,
          name: row.categoryName,
        };
        categoryMap.set(catKey, newCat);
        newCategoriesToAdd.push(newCat);
      }
    });

    const updatedCategories = [...currentCategories, ...newCategoriesToAdd];

    // Merge or update products
    const productMap = new Map<string, Product>();
    existingProducts.forEach((p) => {
      productMap.set(p.code.toLowerCase().trim(), p);
    });

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    validRows.forEach((row) => {
      const codeKey = row.code.toLowerCase().trim();
      const existingProduct = productMap.get(codeKey);

      // Find matching category
      const catMatch = categoryMap.get(row.categoryName.toLowerCase().trim()) || {
        id: 'cat-umum',
        name: row.categoryName || 'Umum',
      };

      if (existingProduct) {
        if (duplicateAction === 'update') {
          const updated: Product = {
            ...existingProduct,
            name: row.name,
            brand: row.brand || existingProduct.brand || 'Del Mango',
            categoryId: catMatch.id,
            categoryName: catMatch.name,
            costPrice: row.costPrice,
            sellPrice: row.sellPrice,
            sellPriceMall: row.sellPriceMall,
            unit: row.unit || existingProduct.unit,
            barcode: row.barcode || existingProduct.barcode,
            stock: row.stock !== undefined ? row.stock : existingProduct.stock,
          };
          productMap.set(codeKey, updated);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        const newProduct: Product = {
          id: 'prod-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900),
          barcode: row.barcode,
          code: row.code,
          name: row.name,
          brand: row.brand || 'Del Mango',
          categoryId: catMatch.id,
          categoryName: catMatch.name,
          unit: row.unit,
          costPrice: row.costPrice,
          sellPrice: row.sellPrice,
          sellPriceMall: row.sellPriceMall,
          stock: row.stock,
          minStock: 10,
        };
        productMap.set(codeKey, newProduct);
        insertedCount++;
      }
    });

    const finalProductList = Array.from(productMap.values());

    onImportProducts(finalProductList, updatedCategories);
    playBeep('success');

    alert(
      `Sukses Mengimpor Data Produk!\n\n` +
      `• Produk Baru Ditambahkan: ${insertedCount}\n` +
      `• Produk Diperbarui: ${updatedCount}\n` +
      `• Produk Dilewati: ${skippedCount}\n` +
      `• Kategori Baru Terdaftar: ${newCategoriesToAdd.length}`
    );

    onClose();
  };

  const validRowCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowCount = parsedRows.filter((r) => !r.isValid).length;
  const existingCount = parsedRows.filter((r) => r.isValid && r.isExisting).length;
  const newCount = parsedRows.filter((r) => r.isValid && !r.isExisting).length;

  const filteredPreview = parsedRows.filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.categoryName.toLowerCase().includes(q) ||
      r.barcode.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-5">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Upload Item Barang via Excel (.xlsx / .csv)</span>
                <span className="text-[11px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                  Multi-Tier Pricing
                </span>
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Impor massal data produk lengkap: kode, nama, kategori, harga pokok, harga jual outlet, dan harga jual mall.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold border border-white/20 transition-colors cursor-pointer"
              title="Download contoh file Excel dengan format kolom yang benar"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>Download Template Excel</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informative Mall vs Outlet Explanation Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Penjelasan Harga Jual:</strong> <strong>Harga Jual Outlet</strong> adalah harga standar untuk outlet reguler / luar mall. <strong>Harga Jual Mall</strong> otomatis dipakai saat transaksi dilakukan di outlet yang berada di mall (karena sewa/biaya mall lebih tinggi).
            </span>
          </div>
          <span className="text-[11px] bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded font-semibold font-mono whitespace-nowrap hidden sm:inline-block">
            Auto-Sync Kategori
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* File Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50 scale-[0.99]'
                : file
                ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/60'
                : 'border-slate-300 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-400'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 shadow-2xs">
                {file ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {file ? `File Terpilih: ${fileName}` : 'Klik atau Tarik File Excel (.xlsx / .csv) ke Sini'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                {file
                  ? 'Klik kembali jika ingin memilih file spreadsheet lain'
                  : 'Sistem membaca kolom: kode, nama, kategori, harga_pokok, harga_jual_outlet, harga_jual_mall'}
              </p>
            </div>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Section if data is parsed */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Toolbar & Summary stats */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-100 p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-700">Ringkasan Validasi:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3" /> {validRowCount} Valid
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-200">
                    {newCount} Produk Baru
                  </span>
                  {existingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-200">
                      {existingCount} Kode Sudah Ada
                    </span>
                  )}
                  {invalidRowCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold border border-rose-200">
                      {invalidRowCount} Tidak Lengkap
                    </span>
                  )}
                </div>

                {/* Duplicate Action & Filter */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                    <span className="font-medium whitespace-nowrap">Jika Kode Sama:</span>
                    <select
                      value={duplicateAction}
                      onChange={(e) => setDuplicateAction(e.target.value as 'update' | 'skip')}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="update">Perbarui Data (Update)</option>
                      <option value="skip">Lewati (Abaikan)</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Saring pratinjau..."
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs w-36 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-10 text-center">#</th>
                      <th className="py-2.5 px-3 font-semibold">Kode</th>
                      <th className="py-2.5 px-3 font-semibold">Nama Produk</th>
                      <th className="py-2.5 px-3 font-semibold">Brand</th>
                      <th className="py-2.5 px-3 font-semibold">Kategori</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Satuan</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Harga Pokok</th>
                      <th className="py-2.5 px-3 font-semibold text-right text-blue-700">Harga Outlet</th>
                      <th className="py-2.5 px-3 font-semibold text-right text-amber-700">Harga Mall</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreview.map((row) => {
                      const brandCfg = getBrandConfig(row.brand);
                      return (
                        <tr
                          key={row.rowNum}
                          className={`hover:bg-slate-50 transition-colors ${
                            !row.isValid ? 'bg-rose-50/50' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {row.rowNum}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {row.code}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 max-w-xs truncate">
                            {row.name || <span className="text-rose-500 italic">Nama Kosong</span>}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${brandCfg.badgeBg} ${brandCfg.badgeText} ${brandCfg.badgeBorder}`}>
                              <span>{brandCfg.emoji}</span>
                              <span>{row.brand}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                              {row.categoryName}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600">
                            {row.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-numbers text-slate-500">
                            {formatRupiah(row.costPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-numbers font-bold text-blue-700">
                            {formatRupiah(row.sellPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-numbers font-bold text-amber-700">
                            {formatRupiah(row.sellPriceMall)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {!row.isValid ? (
                              <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                                {row.validationError}
                              </span>
                            ) : row.isExisting ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                                {duplicateAction === 'update' ? 'Akan Diupdate' : 'Akan Dilewati'}
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                                Item Baru
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span>
                Total <strong className="text-slate-800">{validRowCount}</strong> produk valid siap diproses ke database.
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
              disabled={validRowCount === 0 || isProcessing}
              onClick={handleConfirmImport}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                validRowCount === 0 || isProcessing
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 cursor-pointer'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Sedang Memproses...'
                  : `Proses Import (${validRowCount} Item)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
