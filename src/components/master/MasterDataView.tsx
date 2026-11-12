import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Save, 
  CheckCircle,
  CheckCircle2,
  Tag,
  FolderTree,
  Smartphone,
  Boxes,
  QrCode,
  ShieldCheck,
  Check,
  AlertCircle,
  UserPlus,
  FileSpreadsheet,
  Building2,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  Product, 
  Customer, 
  Category, 
  Outlet, 
  User as PosUser, 
  EMoney, 
  PackageItem,
  Brand,
  BrandName,
  AVAILABLE_BRANDS,
  BRAND_CONFIGS,
  getBrandConfig
} from '../../types/pos';
import { formatRupiah, playBeep, StorageService } from '../../services/storageService';
import {
  canEditCategories,
  canEditCustomers,
  canEditEMoney,
  canEditProducts,
  canManageOutlets,
  canManageUsers,
  canResetDatabase,
  isAdmin,
  isSupervisor,
} from '../../services/accessControl';
import { OutletManagementView } from '../outlets/OutletManagementView';
import { UserManagementView } from '../users/UserManagementView';
import { ExcelProductUploadModal } from './ExcelProductUploadModal';
import { PackageProductModal } from './PackageProductModal';
import { MasterBrandView } from './MasterBrandView';
import { MasterMemberView } from './MasterMemberView';
import {
  MASTER_TABS,
  getAllowedMasterTabs,
  type MasterTab,
} from './masterTabs';

interface MasterDataViewProps {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  outlets: Outlet[];
  activeOutlet: Outlet;
  users: PosUser[];
  currentUser: PosUser;
  emoneyList: EMoney[];
  brands: Brand[];
  masterTab?: MasterTab;
  onMasterTabChange?: (tab: MasterTab) => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateCategories: (categories: Category[]) => void;
  onUpdateCustomers: (customers: Customer[]) => void;
  onUpdateOutlets: (outlets: Outlet[]) => void;
  onSelectActiveOutlet: (outlet: Outlet) => void;
  onUpdateUsers: (users: PosUser[]) => void;
  onSwitchUser: (user: PosUser) => void;
  onUpdateEMoney: (emoney: EMoney[]) => void;
  onUpdateBrands: (brands: Brand[]) => void;
  onResetDatabase: () => void;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  products,
  categories,
  customers,
  outlets,
  activeOutlet,
  users,
  currentUser,
  emoneyList,
  brands,
  masterTab: controlledMasterTab,
  onMasterTabChange,
  onUpdateProducts,
  onUpdateCategories,
  onUpdateCustomers,
  onUpdateOutlets,
  onSelectActiveOutlet,
  onUpdateUsers,
  onSwitchUser,
  onUpdateEMoney,
  onUpdateBrands,
  onResetDatabase,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<MasterTab>('products');
  const activeSubTab = controlledMasterTab ?? internalSubTab;
  const selectSubTab = (tab: MasterTab) => {
    if (controlledMasterTab === undefined) {
      setInternalSubTab(tab);
    }
    onMasterTabChange?.(tab);
    setSearchQuery('');
  };

  const activeSubTabMeta =
    MASTER_TABS.find((tab) => tab.id === activeSubTab) ?? MASTER_TABS[0];
  const ActiveSubTabIcon = activeSubTabMeta.icon;
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');

  // Kewenangan per bagian master data
  const canEditProductsSection = canEditProducts(currentUser);
  const canEditCategoriesSection = canEditCategories(currentUser);
  const canEditEMoneySection = canEditEMoney(currentUser);
  const canEditCustomersSection = canEditCustomers(currentUser);
  const canManageUsersSection = canManageUsers(currentUser);
  const canManageOutletsSection = canManageOutlets(currentUser);
  const canResetSection = canResetDatabase(currentUser);
  const canViewEMoneySection = isAdmin(currentUser) || isSupervisor(currentUser);
  const canViewCustomersSection = isAdmin(currentUser) || isSupervisor(currentUser);
  const memberTierConfigs = StorageService.getMemberTiers();

  // Pastikan subtab aktif selalu diizinkan untuk user saat ini (fail-closed).
  useEffect(() => {
    const allowed = getAllowedMasterTabs(currentUser);
    if (!allowed.some((tab) => tab.id === activeSubTab)) {
      selectSubTab(allowed[0]?.id ?? 'products');
    }
    // selectSubTab sengaja tidak dimasukkan agar tidak memicu render berulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, activeSubTab]);

  const denyEdit = (label: string) => {
    playBeep('error');
    alert(`Akun Anda tidak memiliki kewenangan untuk ${label}.`);
  };

  
  // Product modals state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);
  const [excelUploadModalOpen, setExcelUploadModalOpen] = useState<boolean>(false);

  // Package products state
  const [editingPackageProduct, setEditingPackageProduct] = useState<Product | null>(null);
  const [isAddingPackage, setIsAddingPackage] = useState<boolean>(false);

  // Helper to export products to Excel
  const handleExportProductsToExcel = () => {
    try {
      const exportData = products.map((p) => ({
        kode: p.code,
        nama: p.name,
        brand: p.brand || 'Del Mango',
        kategori: p.categoryName,
        harga_pokok: p.costPrice,
        harga_jual_outlet: p.sellPrice,
        harga_jual_mall: p.sellPriceMall || p.sellPrice,
        barcode: p.barcode,
        satuan: p.unit,
        stok: p.stock || 0,
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 14 },
        { wch: 35 },
        { wch: 18 },
        { wch: 22 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Master_Produk');
      XLSX.writeFile(wb, `master_produk_catat_pos_${new Date().toISOString().slice(0, 10)}.xlsx`);
      playBeep('success');
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengekspor data produk ke Excel.');
    }
  };

  // Category modals state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [syncCategoryToProducts, setSyncCategoryToProducts] = useState<boolean>(true);

  // E-Money modals state
  const [editingEMoney, setEditingEMoney] = useState<EMoney | null>(null);
  const [isAddingEMoney, setIsAddingEMoney] = useState<boolean>(false);

  // Customer modals state
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState<boolean>(false);

  // Split products into regular products and packages
  const packageProducts = products.filter((p) => p.isPackage);
  const regularProducts = products.filter((p) => !p.isPackage);

  // Filter products (regular or all) with Brand filter support
  const filteredProducts = products.filter((p) => {
    const matchesBrand = selectedBrandFilter === 'all' || p.brand === selectedBrandFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.barcode.includes(searchQuery) ||
      p.categoryName.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q));
    return matchesBrand && matchesSearch;
  });

  // Filter package products
  const filteredPackages = packageProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.packageItems && p.packageItems.some((item) => item.productName.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  // PACKAGE CRUD
  const handleSavePackageProduct = (pkgProduct: Product) => {
    if (!canEditProductsSection) {
      denyEdit('mengubah produk paket');
      return;
    }
    if (isAddingPackage) {
      const updated = [pkgProduct, ...products];
      onUpdateProducts(updated);
      alert(`Produk Paket "${pkgProduct.name}" berhasil ditambahkan!`);
    } else {
      const updated = products.map((p) => (p.id === pkgProduct.id ? pkgProduct : p));
      onUpdateProducts(updated);
      alert(`Produk Paket "${pkgProduct.name}" berhasil diperbarui!`);
    }
    setEditingPackageProduct(null);
    setIsAddingPackage(false);
  };

  const handleDeletePackageProduct = (id: string) => {
    if (!canEditProductsSection) {
      denyEdit('menghapus produk paket');
      return;
    }
    if (confirm('Yakin ingin menghapus produk paket ini?')) {
      playBeep('delete');
      const updated = products.filter((p) => p.id !== id);
      onUpdateProducts(updated);
    }
  };

  // Filter categories
  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter E-Money
  const filteredEMoney = emoneyList.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.accountNumber && e.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filter customers
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  // PRODUCT CRUD
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProductsSection) {
      denyEdit('mengubah data produk');
      return;
    }
    if (!editingProduct) return;

    if (isAddingProduct) {
      const updated = [editingProduct, ...products];
      onUpdateProducts(updated);
      alert('Produk baru berhasil ditambahkan!');
    } else {
      const updated = products.map((p) => (p.id === editingProduct.id ? editingProduct : p));
      onUpdateProducts(updated);
      alert('Perubahan data produk berhasil disimpan!');
    }

    setEditingProduct(null);
    setIsAddingProduct(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (!canEditProductsSection) {
      denyEdit('menghapus produk');
      return;
    }
    if (confirm('Yakin ingin menghapus produk ini dari database?')) {
      playBeep('delete');
      const updated = products.filter((p) => p.id !== id);
      onUpdateProducts(updated);
    }
  };

  // CATEGORY CRUD
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCategoriesSection) {
      denyEdit('mengubah kategori');
      return;
    }
    if (!editingCategory) return;

    const trimmedName = editingCategory.name.trim();
    if (!trimmedName) {
      alert('Nama Kategori tidak boleh kosong.');
      return;
    }

    let categoryId = editingCategory.id.trim();
    if (!categoryId) {
      categoryId = 'cat-' + trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    const payload: Category = {
      ...editingCategory,
      id: categoryId,
      name: trimmedName,
    };

    if (isAddingCategory) {
      if (categories.some((c) => c.id === payload.id)) {
        alert(`ID Kategori "${payload.id}" sudah digunakan. Gunakan ID atau Nama lain.`);
        return;
      }
      const updated = [...categories, payload];
      onUpdateCategories(updated);
      playBeep('success');
      alert(`Kategori "${payload.name}" berhasil ditambahkan!`);
    } else {
      const oldCat = categories.find((c) => c.id === editingCategory.id);
      const updatedCats = categories.map((c) => (c.id === editingCategory.id ? payload : c));
      onUpdateCategories(updatedCats);

      if (syncCategoryToProducts && oldCat) {
        let affectedCount = 0;
        const updatedProducts = products.map((p) => {
          if (p.categoryId === oldCat.id) {
            affectedCount++;
            return {
              ...p,
              categoryId: payload.id,
              categoryName: payload.name,
            };
          }
          return p;
        });

        if (affectedCount > 0) {
          onUpdateProducts(updatedProducts);
        }
      }

      playBeep('success');
      alert(`Perubahan kategori "${payload.name}" berhasil disimpan!`);
    }

    setEditingCategory(null);
    setIsAddingCategory(false);
  };

  const handleDeleteCategory = (catId: string) => {
    if (!canEditCategoriesSection) {
      denyEdit('menghapus kategori');
      return;
    }
    if (catId === 'cat-all') {
      alert('Kategori "Semua" adalah kategori bawaan sistem dan tidak dapat dihapus.');
      return;
    }

    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    const linkedProducts = products.filter((p) => p.categoryId === catId);
    if (linkedProducts.length > 0) {
      if (
        !confirm(
          `Peringatan: Terdapat ${linkedProducts.length} produk dalam kategori "${cat.name}".\n\nJika kategori ini dihapus, produk-produk tersebut akan dipindahkan ke kategori "Semua (Umum)". Lanjutkan?`
        )
      ) {
        return;
      }
      const reassigned = products.map((p) => {
        if (p.categoryId === catId) {
          return {
            ...p,
            categoryId: 'cat-all',
            categoryName: 'Semua',
          };
        }
        return p;
      });
      onUpdateProducts(reassigned);
    } else {
      if (!confirm(`Hapus kategori "${cat.name}"?`)) {
        return;
      }
    }

    playBeep('delete');
    const updated = categories.filter((c) => c.id !== catId);
    onUpdateCategories(updated);
    alert(`Kategori "${cat.name}" berhasil dihapus.`);
  };

  // E-MONEY CRUD
  const handleSaveEMoney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditEMoneySection) {
      denyEdit('mengubah data e-money');
      return;
    }
    if (!editingEMoney) return;

    if (!editingEMoney.name.trim() || !editingEMoney.code.trim()) {
      alert('Kode dan Nama E-Money wajib diisi.');
      return;
    }

    if (isAddingEMoney) {
      if (emoneyList.some((em) => em.code.toUpperCase() === editingEMoney.code.toUpperCase())) {
        alert(`Kode E-Money "${editingEMoney.code}" sudah ada.`);
        return;
      }
      const updated = [...emoneyList, editingEMoney];
      onUpdateEMoney(updated);
      playBeep('success');
      alert(`Channel E-Money "${editingEMoney.name}" berhasil ditambahkan!`);
    } else {
      const updated = emoneyList.map((em) => (em.id === editingEMoney.id ? editingEMoney : em));
      onUpdateEMoney(updated);
      playBeep('success');
      alert(`Informasi E-Money "${editingEMoney.name}" berhasil diperbarui!`);
    }

    setEditingEMoney(null);
    setIsAddingEMoney(false);
  };

  const handleToggleEMoneyActive = (emoneyId: string) => {
    if (!canEditEMoneySection) {
      denyEdit('mengubah status e-money');
      return;
    }
    const updated = emoneyList.map((em) => {
      if (em.id === emoneyId) {
        return { ...em, isActive: !em.isActive };
      }
      return em;
    });
    onUpdateEMoney(updated);
  };

  const handleDeleteEMoney = (emoneyId: string) => {
    if (!canEditEMoneySection) {
      denyEdit('menghapus e-money');
      return;
    }
    const target = emoneyList.find((em) => em.id === emoneyId);
    if (!target) return;
    if (confirm(`Yakin ingin menghapus channel E-Money "${target.name}"?`)) {
      playBeep('delete');
      const updated = emoneyList.filter((em) => em.id !== emoneyId);
      onUpdateEMoney(updated);
      alert(`Channel E-Money "${target.name}" telah dihapus.`);
    }
  };

  // CUSTOMER CRUD
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCustomersSection) {
      denyEdit('mengubah data pelanggan');
      return;
    }
    if (!editingCustomer) return;

    if (!editingCustomer.name.trim()) {
      alert('Nama pelanggan wajib diisi.');
      return;
    }

    if (isAddingCustomer) {
      const updated = [editingCustomer, ...customers];
      onUpdateCustomers(updated);
      playBeep('success');
      alert(`Pelanggan baru "${editingCustomer.name}" berhasil ditambahkan!`);
    } else {
      const updated = customers.map((c) => (c.id === editingCustomer.id ? editingCustomer : c));
      onUpdateCustomers(updated);
      playBeep('success');
      alert(`Data pelanggan "${editingCustomer.name}" berhasil diperbarui!`);
    }

    setEditingCustomer(null);
    setIsAddingCustomer(false);
  };

  const handleDeleteCustomer = (id: string) => {
    if (!canEditCustomersSection) {
      denyEdit('menghapus pelanggan');
      return;
    }
    const cust = customers.find((c) => c.id === id);
    if (!cust) return;

    if (cust.id === 'cust-umum' || cust.code === 'PLG-0000') {
      alert('Pelanggan default "Umum (Walk-in)" adalah data sistem dan tidak dapat dihapus.');
      return;
    }

    if (confirm(`Yakin ingin menghapus data pelanggan "${cust.name}"?`)) {
      playBeep('delete');
      const updated = customers.filter((c) => c.id !== id);
      onUpdateCustomers(updated);
      alert(`Pelanggan "${cust.name}" telah dihapus.`);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
      {/* Header ringkas; navigasi subtab ada di submenu "Master Data" pada sidebar */}
      <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-sm font-bold text-slate-900">Master Data</h1>
          <span className="text-slate-300">/</span>
          <span
            title={activeSubTabMeta.label}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            <ActiveSubTabIcon
              className={`h-3.5 w-3.5 ${activeSubTabMeta.accent}`}
            />
            <span>{activeSubTabMeta.label}</span>
            <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              {activeSubTab === 'products'
                ? regularProducts.length
                : activeSubTab === 'packages'
                ? packageProducts.length
                : activeSubTab === 'categories'
                ? categories.length
                : activeSubTab === 'brands'
                ? brands.length
                : activeSubTab === 'outlets'
                ? outlets.length
                : activeSubTab === 'users'
                ? users.length
                : activeSubTab === 'emoney'
                ? emoneyList.length
                : activeSubTab === 'members'
                ? memberTierConfigs.length
                : customers.length}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canResetSection && (
            <button
              onClick={() => {
                if (confirm('Kembalikan seluruh database ke data awal (Indonesian Retail Demo Seed)? Transaksi kasir saat ini akan dibersihkan.')) {
                  onResetDatabase();
                }
              }}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
              title="Reset ke Sample Data Awal"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Demo Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {/* 1. MASTER BRAND */}
      {activeSubTab === 'brands' && (
        <MasterBrandView
          brands={brands}
          products={products}
          outlets={outlets}
          currentUser={currentUser}
          onUpdateBrands={onUpdateBrands}
        />
      )}

      {/* 2. MASTER CABANG (EMBEDDED) */}
      {activeSubTab === 'outlets' && canManageOutletsSection && (
        <div className="flex-1 overflow-y-auto">
          <OutletManagementView
            outlets={outlets}
            activeOutlet={activeOutlet}
            onSelectActiveOutlet={onSelectActiveOutlet}
            onUpdateOutlets={onUpdateOutlets}
          />
        </div>
      )}

      {/* 3. MASTER PENGGUNA (EMBEDDED) */}
      {activeSubTab === 'users' && canManageUsersSection && (
        <div className="flex-1 overflow-y-auto">
          <UserManagementView
            currentUser={currentUser}
            users={users}
            outlets={outlets}
            onUpdateUsers={onUpdateUsers}
            onSwitchUser={onSwitchUser}
          />
        </div>
      )}

      {/* 3b. MASTER MEMBER & LOYALITAS */}
      {activeSubTab === 'members' && (
        <MasterMemberView
          customers={customers}
          currentUser={currentUser}
          onUpdateCustomers={onUpdateCustomers}
        />
      )}

      {/* 4. MASTER PRODUK, KATEGORI, E-MONEY, DAN PELANGGAN */}
      {activeSubTab !== 'brands' &&
        activeSubTab !== 'members' &&
        activeSubTab !== 'outlets' &&
        activeSubTab !== 'users' &&
        (activeSubTab !== 'emoney' || canViewEMoneySection) &&
        (activeSubTab !== 'customers' || canViewCustomersSection) && (
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {/* Lowered Action Toolbar (Search, Data Count & Dedicated Tambah Buttons) */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs shrink-0">
            {/* Search Input & Count */}
            <div className="flex items-center gap-3 flex-1 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Cari di master ${
                    activeSubTab === 'products'
                      ? 'produk (nama, kode, barcode)...'
                      : activeSubTab === 'packages'
                      ? 'produk paket (nama paket, isi barang, kode)...'
                      : activeSubTab === 'categories'
                      ? 'kategori...'
                      : activeSubTab === 'emoney'
                      ? 'e-money (OVO, GoPay, Shopee)...'
                      : 'pelanggan (nama, kontak, kode)...'
                  }`}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                    title="Hapus pencarian"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-500 whitespace-nowrap hidden lg:block">
                Total <strong className="text-slate-800">{activeSubTab === 'products' ? filteredProducts.length : activeSubTab === 'packages' ? filteredPackages.length : activeSubTab === 'categories' ? filteredCategories.length : activeSubTab === 'emoney' ? filteredEMoney.length : filteredCustomers.length}</strong> data
              </div>
            </div>

            {/* Lowered Tambah Action Buttons (Separated from top subtabs to prevent overlapping) */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {activeSubTab === 'packages' && canEditProductsSection && (
                <button
                  onClick={() => {
                    setEditingPackageProduct(null);
                    setIsAddingPackage(true);
                  }}
                  className="flex items-center gap-2 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Produk Paket Baru</span>
                </button>
              )}
              {activeSubTab === 'products' && (
                <>
                  {canEditProductsSection && (
                  <button
                    onClick={() => setExcelUploadModalOpen(true)}
                    className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                    title="Upload file Excel (.xlsx / .csv) berisi kode, nama, kategori, harga pokok, harga jual outlet, harga jual mall"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                    <span>Upload Excel</span>
                  </button>
                  )}

                  <button
                    onClick={handleExportProductsToExcel}
                    className="flex items-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
                    title="Download / Ekspor seluruh data master produk saat ini ke file Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline">Export Excel</span>
                  </button>

                  {canEditProductsSection && (
                  <button
                    onClick={() => {
                      const defaultCat = categories.find((c) => c.id !== 'cat-all') || categories[0] || { id: 'cat-all', name: 'Semua' };
                      const newP: Product = {
                        id: 'prod-' + Date.now(),
                        barcode: '89999990' + Math.floor(1000 + Math.random() * 9000),
                        code: 'BRG-' + Math.floor(100 + Math.random() * 900),
                        name: '',
                        brand: (selectedBrandFilter !== 'all' ? selectedBrandFilter : activeOutlet?.brand || 'Del Mango') as BrandName,
                        categoryId: defaultCat.id,
                        categoryName: defaultCat.name,
                        unit: 'Pcs',
                        costPrice: 5000,
                        sellPrice: 7000,
                        sellPriceMall: 9000,
                        wholesalePrice: 6500,
                      };
                      setEditingProduct(newP);
                      setIsAddingProduct(true);
                    }}
                    className="flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Produk Baru</span>
                  </button>
                  )}
                </>
              )}

              {activeSubTab === 'categories' && canEditCategoriesSection && (
                <button
                  onClick={() => {
                    const newCat: Category = {
                      id: 'cat-' + Math.floor(100 + Math.random() * 900),
                      name: '',
                    };
                    setEditingCategory(newCat);
                    setIsAddingCategory(true);
                    setSyncCategoryToProducts(true);
                  }}
                  className="flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kategori Baru</span>
                </button>
              )}

              {activeSubTab === 'emoney' && canEditEMoneySection && (
                <button
                  onClick={() => {
                    const newEM: EMoney = {
                      id: 'emoney-' + Date.now(),
                      code: '',
                      name: '',
                      provider: '',
                      accountNumber: 'MID-99999-',
                      mdrFeePercent: 0.7,
                      isQRISSupported: true,
                      isActive: true,
                      color: '#4C3494',
                      notes: 'Integrasi Dompet Digital / QRIS',
                    };
                    setEditingEMoney(newEM);
                    setIsAddingEMoney(true);
                  }}
                  className="flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah E-Money Baru</span>
                </button>
              )}

              {activeSubTab === 'customers' && canEditCustomersSection && (
                <button
                  onClick={() => {
                    const silverConfig =
                      memberTierConfigs.find(
                        (config) => config.tier === 'MEMBER_SILVER'
                      ) ?? memberTierConfigs[0];
                    const newC: Customer = {
                      id: 'cust-' + Date.now(),
                      code: 'PLG-' + Math.floor(1000 + Math.random() * 9000),
                      name: '',
                      phone: '',
                      tier: 'MEMBER_SILVER',
                      discountPercent: silverConfig?.discountPercent ?? 0,
                      points: 50,
                      address: '',
                    };
                    setEditingCustomer(newC);
                    setIsAddingCustomer(true);
                  }}
                  className="flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Tambah Pelanggan Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* SUBTAB 1: PRODUCTS TABLE */}
          {activeSubTab === 'products' && (
            <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
              {/* Brand Filter Bar for Master Produk */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 overflow-x-auto">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
                    Filter Brand:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBrandFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedBrandFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Semua Brand ({products.length})
                  </button>
                  {AVAILABLE_BRANDS.map((b) => {
                    const cfg = getBrandConfig(b);
                    const count = products.filter((p) => p.brand === b).length;
                    const isSelected = selectedBrandFilter === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBrandFilter(b)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                          isSelected
                            ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} shadow-xs ring-2 ring-offset-1 ring-blue-500 font-extrabold`
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{cfg.emoji}</span>
                        <span>{b}</span>
                        <span className="text-[10px] opacity-75 font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap shrink-0 hidden md:block">
                  Menampilkan <strong>{filteredProducts.length}</strong> produk
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Kode / Barcode</th>
                      <th className="py-2.5 px-3 font-semibold">Nama Produk</th>
                      <th className="py-2.5 px-3 font-semibold">Brand</th>
                      <th className="py-2.5 px-3 font-semibold">Kategori</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Satuan</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Harga Pokok</th>
                      <th className="py-2.5 px-3 font-semibold text-right text-blue-700">Harga Outlet</th>
                      <th className="py-2.5 px-3 font-semibold text-right text-amber-700">Harga Mall</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => {
                      const brandCfg = getBrandConfig(p.brand);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 font-mono">
                            <div className="font-bold text-slate-900">{p.code}</div>
                            <div className="text-[10px] text-slate-400">{p.barcode}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {p.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs whitespace-nowrap ${brandCfg.badgeBg} ${brandCfg.badgeText} ${brandCfg.badgeBorder}`}>
                              <span>{brandCfg.emoji}</span>
                              <span>{p.brand || 'Del Mango'}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-100">
                              <Tag className="w-2.5 h-2.5" />
                              {p.categoryName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                              {p.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-500">
                            {formatRupiah(p.costPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-blue-700">
                            {formatRupiah(p.sellPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-amber-700">
                            {formatRupiah(p.sellPriceMall || p.sellPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canEditProductsSection && (
                                <>
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setIsAddingProduct(false);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Produk"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                                title="Hapus Produk"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBTAB 2: MASTER PRODUK PAKET (BUNDLING / COMBO) */}
          {activeSubTab === 'packages' && (
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              {/* Info banner */}
              <div className="bg-gradient-to-r from-amber-800 to-orange-800 text-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
                    <Boxes className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Master Produk Paket & Bundling Promosi</h3>
                    <p className="text-xs text-amber-200 mt-0.5">
                      Kelola produk combo/paket hemat. Rincian isi paket otomatis tampil di struk belanja tanpa memunculkan harga satuan barang.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-white/10 text-white rounded-lg text-xs font-bold border border-white/20 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-300" />
                    <span>{packageProducts.length} Paket Terdaftar</span>
                  </span>
                </div>
              </div>

              {/* Packages Table */}
              <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-50/70 text-slate-800 sticky top-0 border-b border-amber-200">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Kode / Barcode Paket</th>
                        <th className="py-2.5 px-3 font-semibold">Nama Produk Paket</th>
                        <th className="py-2.5 px-3 font-semibold">Brand</th>
                        <th className="py-2.5 px-3 font-semibold">Komposisi / Rincian Isi Paket</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Satuan</th>
                        <th className="py-2.5 px-3 font-semibold text-right text-blue-700">Harga Jual Outlet</th>
                        <th className="py-2.5 px-3 font-semibold text-right text-amber-700">Harga Jual Mall</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPackages.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="font-medium text-slate-600">Belum ada produk paket terdaftar.</p>
                            <p className="text-[11px] mt-0.5 text-slate-400">
                              Klik tombol "+ Tambah Produk Paket Baru" di atas untuk membuat paket combo/bundling hemat.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredPackages.map((pkg) => {
                          const brandCfg = getBrandConfig(pkg.brand);
                          return (
                            <tr key={pkg.id} className="hover:bg-amber-50/30 transition-colors">
                              <td className="py-3 px-4 font-mono">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{pkg.code}</span>
                                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded font-sans font-bold">
                                    PAKET
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">{pkg.barcode}</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 text-sm">{pkg.name}</div>
                                <span className="inline-block mt-0.5 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  {pkg.categoryName}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs whitespace-nowrap ${brandCfg.badgeBg} ${brandCfg.badgeText} ${brandCfg.badgeBorder}`}>
                                  <span>{brandCfg.emoji}</span>
                                  <span>{pkg.brand || 'Del Mango'}</span>
                                </span>
                              </td>
                            <td className="py-3 px-3">
                              {pkg.packageItems && pkg.packageItems.length > 0 ? (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1">
                                    {pkg.packageItems.map((item, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-medium"
                                      >
                                        <span className="font-bold text-amber-800 font-mono">{item.qty}x</span>
                                        <span>{item.productName}</span>
                                      </span>
                                    ))}
                                  </div>
                                  <div className="text-[10px] text-slate-400 italic">
                                    *Tercetak otomatis di struk tanpa harga satuan
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Tidak ada item</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
                                {pkg.unit}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-blue-700 text-sm">
                              {formatRupiah(pkg.sellPrice)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-amber-700 text-sm">
                              {formatRupiah(pkg.sellPriceMall || pkg.sellPrice)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {canEditProductsSection && (
                                  <>
                                <button
                                  onClick={() => {
                                    setEditingPackageProduct(pkg);
                                    setIsAddingPackage(false);
                                  }}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                  title="Edit Komposisi & Harga Paket"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePackageProduct(pkg.id)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                  title="Hapus Produk Paket"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 3: CATEGORIES TABLE */}
          {activeSubTab === 'categories' && (
            <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold w-48">ID / Slug Kategori</th>
                      <th className="py-3 px-4 font-semibold">Nama Kategori</th>
                      <th className="py-3 px-4 font-semibold text-center">Jumlah Produk Terdaftar</th>
                      <th className="py-3 px-4 font-semibold text-center">Status di Kasir</th>
                      <th className="py-3 px-4 font-semibold text-center w-32">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategories.map((cat) => {
                      const linkedCount = products.filter((p) => p.categoryId === cat.id).length;
                      const isSystemDefault = cat.id === 'cat-all';

                      return (
                        <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {cat.id}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                <Tag className="w-3.5 h-3.5" />
                              </span>
                              <span>{cat.name}</span>
                              {isSystemDefault && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                  Bawaan Sistem
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`font-semibold px-2.5 py-1 rounded-full text-xs font-mono ${
                                linkedCount > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {linkedCount} Produk
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                              <CheckCircle className="w-3 h-3 text-blue-600" />
                              Tampil di Tab POS
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {canEditCategoriesSection && (
                                <>
                              <button
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setIsAddingCategory(false);
                                  setSyncCategoryToProducts(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md border border-blue-200 transition-colors cursor-pointer"
                                title="Edit Nama & Data Kategori"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {!isSystemDefault && (
                                <button
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md border border-rose-200 transition-colors cursor-pointer"
                                  title="Hapus Kategori"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBTAB 3: MASTER E-MONEY TABLE (OVO, GOPAY, SHOPEE, DANA, LINKAJA) */}
          {activeSubTab === 'emoney' && (
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              {/* Quick Info Banner for E-Money */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
                    <Smartphone className="w-6 h-6 text-cyan-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Master Integrasi E-Money & Dompet Digital</h3>
                    <p className="text-xs text-blue-200 mt-0.5">
                      Kelola channel pembayaran non-tunai OVO, GoPay, ShopeePay, DANA, dan QRIS Nasional untuk kasir.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-white/10 text-white rounded-lg text-xs font-mono font-semibold border border-white/20 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>MDR Standar 0.7%</span>
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold">
                    {emoneyList.filter((e) => e.isActive).length} Channel Aktif
                  </span>
                </div>
              </div>

              {/* E-Money Table */}
              <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 font-semibold w-48">Channel E-Money</th>
                        <th className="py-3 px-4 font-semibold">Perusahaan Penerbit / Provider</th>
                        <th className="py-3 px-4 font-semibold font-mono">Merchant ID (MID)</th>
                        <th className="py-3 px-4 font-semibold text-center">Biaya MDR (%)</th>
                        <th className="py-3 px-4 font-semibold text-center">Standar QRIS</th>
                        <th className="py-3 px-4 font-semibold text-center">Status Terminal</th>
                        <th className="py-3 px-4 font-semibold text-center w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEMoney.map((emoney) => {
                        return (
                          <tr key={emoney.id} className="hover:bg-slate-50 transition-colors">
                            {/* Brand & Name */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-2xs font-mono shrink-0"
                                  style={{ backgroundColor: emoney.color || '#00AED6' }}
                                >
                                  {emoney.code.slice(0, 3)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                    <span>{emoney.name}</span>
                                    <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                      {emoney.code}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                    {emoney.notes || 'Pembayaran dompet digital'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Provider */}
                            <td className="py-3 px-4 text-slate-700 font-medium">
                              {emoney.provider}
                            </td>

                            {/* Merchant ID */}
                            <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                              {emoney.accountNumber || '-'}
                            </td>

                            {/* MDR Fee */}
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-100 text-slate-800">
                                {emoney.mdrFeePercent}%
                              </span>
                            </td>

                            {/* QRIS Supported */}
                            <td className="py-3 px-4 text-center">
                              {emoney.isQRISSupported ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  QRIS Siap
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Manual EDC</span>
                              )}
                            </td>

                            {/* Status Active / Inactive */}
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleToggleEMoneyActive(emoney.id)}
                                disabled={!canEditEMoneySection}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                                  emoney.isActive
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                                } ${canEditEMoneySection ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                                title={canEditEMoneySection ? 'Klik untuk ubah status aktif di kasir' : 'Hanya Administrator yang dapat mengubah status e-money'}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    emoney.isActive ? 'bg-emerald-600' : 'bg-slate-400'
                                  }`}
                                ></span>
                                <span>{emoney.isActive ? 'Aktif di POS' : 'Nonaktif'}</span>
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {canEditEMoneySection && (
                                  <>
                                <button
                                  onClick={() => {
                                    setEditingEMoney(emoney);
                                    setIsAddingEMoney(false);
                                  }}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                  title="Edit E-Money"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEMoney(emoney.id)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                  title="Hapus E-Money"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 4: CUSTOMERS TABLE */}
          {activeSubTab === 'customers' && (
            <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Kode Member</th>
                      <th className="py-2.5 px-3 font-semibold">Nama Pelanggan</th>
                      <th className="py-2.5 px-3 font-semibold">Nomor Kontak</th>
                      <th className="py-2.5 px-3 font-semibold">Tingkat (Tier)</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Diskon Member</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Poin Belanja</th>
                      <th className="py-2.5 px-3 font-semibold">Alamat</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{c.code}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{c.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{c.phone}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded text-[10px]">
                            {c.tier === 'UMUM'
                              ? 'Umum'
                              : memberTierConfigs.find(
                                  (config) => config.tier === c.tier
                                )?.label ?? c.tier}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-600 font-mono">
                          {c.discountPercent}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-amber-600">
                          {c.points} pts
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs">{c.address || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canEditCustomersSection && (
                              <>
                            <button
                              onClick={() => {
                                setEditingCustomer(c);
                                setIsAddingCustomer(false);
                              }}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                              title="Edit Data Pelanggan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {c.id !== 'cust-umum' && c.code !== 'PLG-0000' && (
                              <button
                                onClick={() => handleDeleteCustomer(c.id)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                title="Hapus Pelanggan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: EDIT / ADD PRODUCT */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold">
                {isAddingProduct ? 'Tambah Produk Baru' : `Edit Produk: ${editingProduct.name}`}
              </h2>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Barang:</label>
                  <input
                    type="text"
                    value={editingProduct.code}
                    onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Barcode:</label>
                  <input
                    type="text"
                    value={editingProduct.barcode}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Produk:</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    <span>Brand Produk:</span>
                  </label>
                  <select
                    value={editingProduct.brand || 'Del Mango'}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        brand: e.target.value as BrandName,
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={editingProduct.categoryId}
                    onChange={(e) => {
                      const selectedCat = categories.find((c) => c.id === e.target.value);
                      setEditingProduct({
                        ...editingProduct,
                        categoryId: e.target.value,
                        categoryName: selectedCat ? selectedCat.name : 'Umum',
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                  >
                    {categories.filter((c) => c.id !== 'cat-all').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan Produk:</label>
                  <input
                    type="text"
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    placeholder="Pcs, Botol, Porsi, Box..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Pokok (Modal):</label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.costPrice}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, costPrice: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    <span>Harga Jual Outlet:</span>
                    <span className="text-[10px] text-slate-500 font-normal ml-1">(Luar Mall)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.sellPrice}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sellPrice: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-blue-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                  <label className="block font-semibold text-amber-900 mb-1 flex items-center justify-between">
                    <span>Harga Jual Mall:</span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.2 rounded font-mono font-bold">
                      🏬 Mall Tier
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.sellPriceMall ?? editingProduct.sellPrice}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sellPriceMall: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-white border border-amber-300 rounded font-mono font-bold text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Harga untuk outlet di dalam mall"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">
                    Digunakan otomatis saat kasir bertransaksi di cabang/outlet yang berlokasi di Mall.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Grosir / Reseller (Opsional):</label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.wholesalePrice || 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, wholesalePrice: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Dikenakan otomatis jika pelanggan berkategori member Grosir.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Produk</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT / ADD CATEGORY */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold">
                  {isAddingCategory ? 'Tambah Kategori Baru' : `Edit Kategori: ${editingCategory.name}`}
                </h2>
              </div>
              <button
                onClick={() => setEditingCategory(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Kategori:
                </label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const autoId = isAddingCategory 
                      ? 'cat-' + val.toLowerCase().replace(/[^a-z0-9]/g, '-')
                      : editingCategory.id;
                    setEditingCategory({
                      ...editingCategory,
                      name: val,
                      id: isAddingCategory ? autoId : editingCategory.id,
                    });
                  }}
                  placeholder="Contoh: Makanan Instan, Minuman Dingin, ATK..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ID / Slug Kategori (Unik):
                </label>
                <input
                  type="text"
                  value={editingCategory.id}
                  disabled={editingCategory.id === 'cat-all'}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
                    })
                  }
                  placeholder="Contoh: cat-makanan"
                  className={`w-full p-2.5 border rounded-lg font-mono text-xs ${
                    editingCategory.id === 'cat-all'
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-slate-50 text-slate-800 border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  }`}
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Digunakan sebagai identitas teknis dan pengelompokan barcode.
                </p>
              </div>

              {/* Sync category option if editing existing category */}
              {!isAddingCategory && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncCategoryToProducts}
                      onChange={(e) => setSyncCategoryToProducts(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded mt-0.5"
                    />
                    <div>
                      <span className="font-semibold text-blue-900 text-xs">
                        Perbarui otomatis pada seluruh produk terkait
                      </span>
                      <p className="text-[11px] text-blue-700 leading-tight mt-0.5">
                        Menyesuaikan nama kategori baru ke setiap produk yang saat ini terdaftar di bawah kategori ini.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Kategori</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT / ADD E-MONEY (OVO, GOPAY, SHOPEE, DANA, LINKAJA) */}
      {editingEMoney && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold">
                  {isAddingEMoney ? 'Tambah Channel E-Money Baru' : `Edit E-Money: ${editingEMoney.name}`}
                </h2>
              </div>
              <button
                onClick={() => setEditingEMoney(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEMoney} className="p-5 space-y-3.5 text-xs">
              {/* Quick Preset Buttons for Top E-Wallets */}
              {isAddingEMoney && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    Isi Cepat Template Provider Populer:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEMoney({
                          ...editingEMoney,
                          code: 'OVO',
                          name: 'OVO',
                          provider: 'PT Visionet Internasional (Lippo Group)',
                          accountNumber: 'MID-99999-OVO' + Math.floor(1000 + Math.random() * 9000),
                          color: '#4C3494',
                          mdrFeePercent: 0.7,
                          isQRISSupported: true,
                          notes: 'OVO Cash & QRIS Dinamis',
                        });
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-2xs hover:opacity-90"
                      style={{ backgroundColor: '#4C3494' }}
                    >
                      OVO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEMoney({
                          ...editingEMoney,
                          code: 'GOPAY',
                          name: 'GoPay',
                          provider: 'PT Dompet Anak Bangsa (GoTo Financial)',
                          accountNumber: 'MID-99999-GPY' + Math.floor(1000 + Math.random() * 9000),
                          color: '#00AED6',
                          mdrFeePercent: 0.7,
                          isQRISSupported: true,
                          notes: 'GoPay & QRIS GoBiz Terintegrasi',
                        });
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-2xs hover:opacity-90"
                      style={{ backgroundColor: '#00AED6' }}
                    >
                      GoPay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEMoney({
                          ...editingEMoney,
                          code: 'SHOPEE',
                          name: 'ShopeePay',
                          provider: 'PT AirPay International Indonesia (Sea Group)',
                          accountNumber: 'MID-99999-SHP' + Math.floor(1000 + Math.random() * 9000),
                          color: '#EE4D2D',
                          mdrFeePercent: 0.7,
                          isQRISSupported: true,
                          notes: 'ShopeePay QRIS & Promo Cashback',
                        });
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-2xs hover:opacity-90"
                      style={{ backgroundColor: '#EE4D2D' }}
                    >
                      ShopeePay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEMoney({
                          ...editingEMoney,
                          code: 'DANA',
                          name: 'DANA',
                          provider: 'PT Espay Debit Indonesia Koe',
                          accountNumber: 'MID-99999-DNA' + Math.floor(1000 + Math.random() * 9000),
                          color: '#118EEA',
                          mdrFeePercent: 0.7,
                          isQRISSupported: true,
                          notes: 'DANA Bisnis QRIS',
                        });
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-2xs hover:opacity-90"
                      style={{ backgroundColor: '#118EEA' }}
                    >
                      DANA
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEMoney({
                          ...editingEMoney,
                          code: 'LINKAJA',
                          name: 'LinkAja',
                          provider: 'PT Fintek Karya Nusantara (BUMN)',
                          accountNumber: 'MID-99999-LKA' + Math.floor(1000 + Math.random() * 9000),
                          color: '#ED1C24',
                          mdrFeePercent: 0.7,
                          isQRISSupported: true,
                          notes: 'LinkAja Ekosistem BUMN',
                        });
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-2xs hover:opacity-90"
                      style={{ backgroundColor: '#ED1C24' }}
                    >
                      LinkAja
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode E-Money:</label>
                  <input
                    type="text"
                    value={editingEMoney.code}
                    onChange={(e) => setEditingEMoney({ ...editingEMoney, code: e.target.value.toUpperCase() })}
                    placeholder="Contoh: OVO, GOPAY, SHOPEE"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Tampilan Kasir:</label>
                  <input
                    type="text"
                    value={editingEMoney.name}
                    onChange={(e) => setEditingEMoney({ ...editingEMoney, name: e.target.value })}
                    placeholder="Contoh: OVO, GoPay, ShopeePay"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Perusahaan Provider / Penerbit:</label>
                <input
                  type="text"
                  value={editingEMoney.provider}
                  onChange={(e) => setEditingEMoney({ ...editingEMoney, provider: e.target.value })}
                  placeholder="Contoh: PT Visionet Internasional (Lippo Group)"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Merchant ID (MID) / No. Rek Penampung:</label>
                  <input
                    type="text"
                    value={editingEMoney.accountNumber || ''}
                    onChange={(e) => setEditingEMoney({ ...editingEMoney, accountNumber: e.target.value })}
                    placeholder="MID-99999-XXXX"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-blue-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Biaya MDR Merchant (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={editingEMoney.mdrFeePercent}
                    onChange={(e) => setEditingEMoney({ ...editingEMoney, mdrFeePercent: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                    required
                  />
                </div>
              </div>

              {/* Brand Accent Color */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Warna Badge Brand:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingEMoney.color || '#00AED6'}
                    onChange={(e) => setEditingEMoney({ ...editingEMoney, color: e.target.value })}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editingEMoney.color || '#00AED6'}
                    onChange={(e) => setEditingEMoney({ ...editingEMoney, color: e.target.value })}
                    className="w-28 p-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs uppercase"
                  />
                  <span className="text-slate-500 text-[11px]">Badge preview:</span>
                  <div
                    className="px-3 py-1 rounded text-white font-bold text-xs"
                    style={{ backgroundColor: editingEMoney.color || '#00AED6' }}
                  >
                    {editingEMoney.name || 'Preview'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Keterangan:</label>
                <input
                  type="text"
                  value={editingEMoney.notes || ''}
                  onChange={(e) => setEditingEMoney({ ...editingEMoney, notes: e.target.value })}
                  placeholder="Keterangan integrasi atau promosi..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded"
                />
              </div>

              {/* Checkboxes */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEMoney.isQRISSupported ?? true}
                    onChange={(e) => setEditingEMoney({ ...editingEMoney, isQRISSupported: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-slate-700">Mendukung Standar QRIS Dinamis Bank Indonesia / ASPI</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEMoney.isActive}
                    onChange={(e) => setEditingEMoney({ ...editingEMoney, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-slate-700">Status Aktif (Tampil sebagai metode di Terminal Kasir)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingEMoney(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan E-Money</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT / ADD CUSTOMER */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold">
                  {isAddingCustomer ? 'Tambah Pelanggan Baru' : `Edit Pelanggan: ${editingCustomer.name}`}
                </h2>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Member:</label>
                  <input
                    type="text"
                    value={editingCustomer.code}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, code: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon / WA:</label>
                  <input
                    type="text"
                    value={editingCustomer.phone}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    placeholder="Contoh: 08123456789"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Pelanggan:</label>
                <input
                  type="text"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  placeholder="Nama pelanggan atau nama toko..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tingkat / Tier Member:</label>
                  <select
                    value={editingCustomer.tier}
                    onChange={(e) => {
                      const tier = e.target.value as Customer['tier'];
                      const tierConfig = memberTierConfigs.find(
                        (config) => config.tier === tier
                      );
                      setEditingCustomer({
                        ...editingCustomer,
                        tier,
                        discountPercent: tierConfig
                          ? tierConfig.discountPercent
                          : 0,
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold cursor-pointer"
                  >
                    <option value="UMUM">UMUM (Walk-in)</option>
                    {memberTierConfigs.map((config) => (
                      <option key={config.tier} value={config.tier}>
                        {config.label.toUpperCase()} ({config.discountPercent}% · min{' '}
                        {config.minPoints} poin)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Diskon Member (%):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingCustomer.discountPercent}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, discountPercent: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Poin Loyalitas Belanja:</label>
                <input
                  type="number"
                  min="0"
                  value={editingCustomer.points}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, points: Number(e.target.value) })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-amber-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap:</label>
                <textarea
                  rows={2}
                  value={editingCustomer.address || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  placeholder="Alamat domisili atau pengiriman..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Pelanggan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: UPLOAD PRODUK VIA EXCEL */}
      <ExcelProductUploadModal
        isOpen={excelUploadModalOpen}
        onClose={() => setExcelUploadModalOpen(false)}
        existingProducts={products}
        existingCategories={categories}
        onImportProducts={(newProducts, newCategories) => {
          if (!canEditProductsSection) {
            denyEdit('mengimpor produk dari Excel');
            return;
          }
          onUpdateCategories(newCategories);
          onUpdateProducts(newProducts);
        }}
      />

      {/* MODAL 6: MASTER PRODUK PAKET (TAMBAH / EDIT) */}
      <PackageProductModal
        isOpen={isAddingPackage || editingPackageProduct !== null}
        onClose={() => {
          setIsAddingPackage(false);
          setEditingPackageProduct(null);
        }}
        initialProduct={editingPackageProduct}
        allProducts={products}
        categories={categories}
        onSavePackage={handleSavePackageProduct}
      />
    </div>
  );
};
