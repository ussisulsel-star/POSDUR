export interface UserPermissions {
  canDiscount: boolean;
  canVoid: boolean;
  canReturn: boolean;
  canOpenDrawer: boolean;
  canViewReports: boolean;
  canEditPrice: boolean;
}

export type BrandName = 'Del Mango' | 'Es Teler Pattiro' | 'Donat Halus' | 'Es Tes Koala';

export type BrandColorKey =
  | 'amber'
  | 'emerald'
  | 'pink'
  | 'cyan'
  | 'blue'
  | 'violet'
  | 'rose'
  | 'orange'
  | 'teal'
  | 'indigo';

export interface BrandColorPreset {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconBg: string;
}

/** Palet warna brand. Class Tailwind ditulis statis agar ikut ter-scan saat build. */
export const BRAND_COLOR_PRESETS: Record<BrandColorKey, BrandColorPreset> = {
  amber: {
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    badgeBorder: 'border-amber-300',
    iconBg: 'bg-amber-500',
  },
  emerald: {
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-300',
    iconBg: 'bg-emerald-500',
  },
  pink: {
    badgeBg: 'bg-pink-100',
    badgeText: 'text-pink-900',
    badgeBorder: 'border-pink-300',
    iconBg: 'bg-pink-500',
  },
  cyan: {
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-900',
    badgeBorder: 'border-cyan-300',
    iconBg: 'bg-cyan-500',
  },
  blue: {
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900',
    badgeBorder: 'border-blue-300',
    iconBg: 'bg-blue-500',
  },
  violet: {
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-900',
    badgeBorder: 'border-violet-300',
    iconBg: 'bg-violet-500',
  },
  rose: {
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900',
    badgeBorder: 'border-rose-300',
    iconBg: 'bg-rose-500',
  },
  orange: {
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-900',
    badgeBorder: 'border-orange-300',
    iconBg: 'bg-orange-500',
  },
  teal: {
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-900',
    badgeBorder: 'border-teal-300',
    iconBg: 'bg-teal-500',
  },
  indigo: {
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-900',
    badgeBorder: 'border-indigo-300',
    iconBg: 'bg-indigo-500',
  },
};

export interface BrandConfig extends BrandColorPreset {
  name: string;
  tagline: string;
  emoji: string;
}

export interface Brand {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  colorKey: BrandColorKey;
  isActive: boolean;
  createdAt: string;
}

export const DEFAULT_BRANDS: Brand[] = [
  {
    id: 'brand-del-mango',
    name: 'Del Mango',
    tagline: 'Olahan Mangga Segar, Smoothie & Dessert',
    emoji: '🥭',
    colorKey: 'amber',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'brand-es-teler-pattiro',
    name: 'Es Teler Pattiro',
    tagline: 'Es Teler Tradisional & Minuman Nusantara',
    emoji: '🍧',
    colorKey: 'emerald',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'brand-donat-halus',
    name: 'Donat Halus',
    tagline: 'Donat Lembut Artisan & Pastry Kekinian',
    emoji: '🍩',
    colorKey: 'pink',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'brand-es-tes-koala',
    name: 'Es Tes Koala',
    tagline: 'Signature Teh Racikan Segar & Fusion Brews',
    emoji: '🐨',
    colorKey: 'cyan',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export function toBrandConfig(brand: Brand): BrandConfig {
  const preset = BRAND_COLOR_PRESETS[brand.colorKey] ?? BRAND_COLOR_PRESETS.blue;
  return {
    name: brand.name,
    tagline: brand.tagline,
    emoji: brand.emoji,
    ...preset,
  };
}

/**
 * Sinkronkan registry brand runtime dengan data master yang tersimpan.
 * Array/objek yang sama dipakai oleh seluruh komponen (dropdown & katalog),
 * sehingga brand baru langsung tersedia tanpa perlu reload.
 */
export function syncBrandRegistry(brands: Brand[]): void {
  Object.keys(BRAND_CONFIGS).forEach((key) => delete BRAND_CONFIGS[key]);
  AVAILABLE_BRANDS.splice(0, AVAILABLE_BRANDS.length);
  brands.forEach((brand) => {
    BRAND_CONFIGS[brand.name] = toBrandConfig(brand);
    AVAILABLE_BRANDS.push(brand.name);
  });
}

export const AVAILABLE_BRANDS: string[] = DEFAULT_BRANDS.map((brand) => brand.name);

export const BRAND_CONFIGS: Record<string, BrandConfig> = Object.fromEntries(
  DEFAULT_BRANDS.map((brand) => [brand.name, toBrandConfig(brand)])
);


export const getBrandConfig = (brandName?: string) => {
  if (brandName && BRAND_CONFIGS[brandName]) {
    return BRAND_CONFIGS[brandName];
  }
  return {
    name: brandName || 'Brand Khusus',
    tagline: 'Unit Bisnis Retail',
    emoji: '🏷️',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900',
    badgeBorder: 'border-blue-300',
    iconBg: 'bg-blue-500',
  };
};

export interface Outlet {
  id: string;
  code: string;
  name: string;
  brand?: BrandName | string; // Identitas brand cabang (Del Mango, Es Teler Pattiro, Donat Halus, Es Tes Koala)
  address: string;
  phone: string;
  city: string;
  isHQ: boolean;
  isActive: boolean;
  isMall?: boolean; // True jika outlet berlokasi di Mall (menggunakan harga jual mall)
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  date: string;
  fromOutletId: string;
  fromOutletName: string;
  toOutletId: string;
  toOutletName: string;
  items: {
    productId: string;
    productName: string;
    qty: number;
    unit: string;
  }[];
  status: 'SELESAI' | 'DALAM_PENGIRIMAN';
  notes?: string;
}

export interface User {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  role: 'ADMIN' | 'KASIR' | 'SUPERVISOR' | 'GUDANG';
  outletId?: string; // Default primary outlet
  allowedOutletIds?: string[]; // IDs of outlets the user is permitted to open/access
  canAccessAllOutlets?: boolean; // If true, can access all current and future outlets
  pin?: string;
  password?: string;
  phone?: string;
  isActive?: boolean;
  lastLogin?: string;
  permissions?: UserPermissions;
  token?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface EMoney {
  id: string;
  code: string;
  name: string;
  provider: string;
  accountNumber?: string; // Merchant ID / No Rek Penampung
  mdrFeePercent: number; // e.g. 0.7 for standard Indonesian QRIS / e-wallet
  isQRISSupported?: boolean;
  isActive: boolean;
  color?: string;
  notes?: string;
}

export interface PackageItem {
  productId: string;
  productCode?: string;
  productName: string;
  qty: number;
  unit?: string;
  standardPrice?: number;
}

export interface Product {
  id: string;
  barcode: string;
  code: string;
  name: string;
  brand?: BrandName | string; // Brand produk (Del Mango, Es Teler Pattiro, Donat Halus, Es Tes Koala)
  categoryId: string;
  categoryName: string;
  unit: string;
  costPrice: number;
  sellPrice: number; // Harga jual outlet biasa / non-mall
  sellPriceMall?: number; // Harga jual outlet di mall (biasanya lebih tinggi)
  wholesalePrice?: number;
  stock?: number;
  minStock?: number;
  outletStocks?: Record<string, number>;
  image?: string;
  isPackage?: boolean; // True jika merupakan produk paket / bundling
  packageItems?: PackageItem[]; // Daftar rincian barang dalam paket (muncul di struk tanpa harga)
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  tier: 'UMUM' | 'MEMBER_SILVER' | 'MEMBER_GOLD' | 'GROSIR';
  discountPercent: number;
  points: number;
  address?: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  unitPrice: number;
  discountRp: number;
  discountPercent: number;
  subtotal: number;
  note?: string;
}

export type PaymentMethodType = 'TUNAI' | 'QRIS' | 'DEBIT' | 'KREDIT' | 'TRANSFER' | 'PIUTANG';

export interface PaymentDetail {
  method: PaymentMethodType;
  amount: number;
  bankName?: string;
  emoneyName?: string; // e.g. OVO, GoPay, ShopeePay
  cardLastFour?: string;
  traceNumber?: string;
  qrRef?: string;
  dueDate?: string; // For Piutang
}

export interface Transaction {
  id: string;
  invoiceNo: string;
  companyId: string;
  outletId: string;
  outletName: string;
  cashierId: string;
  cashierName: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerTier: string;
  date: string;
  items: CartItem[];
  itemCount: number;
  totalQty: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  payAmount: number;
  changeAmount: number;
  payments: PaymentDetail[];
  status: 'LUNAS' | 'PIUTANG' | 'BATAL' | 'RETUR';
  shiftId: string;
  notes?: string;
}

export interface HeldTransaction {
  id: string;
  holdNumber: string;
  outletId?: string;
  timestamp: string;
  customer: Customer;
  items: CartItem[];
  subtotal: number;
  note: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  outletId?: string;
  type: 'MASUK' | 'KELUAR';
  amount: number;
  reason: string;
  timestamp: string;
  cashierName: string;
}

export interface Shift {
  id: string;
  shiftNumber: number;
  outletId?: string;
  outletName?: string;
  cashierId: string;
  cashierName: string;
  companyId: string;
  startTime: string;
  endTime?: string;
  initialCash: number;
  totalCashSales: number;
  totalNonCashSales: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}

export interface SalesReturnItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  subtotal: number;
  reason: string;
}

export interface SalesReturn {
  id: string;
  returnNo: string;
  invoiceNo: string;
  date: string;
  cashierName: string;
  customerName: string;
  items: SalesReturnItem[];
  totalRefund: number;
  refundMethod: 'TUNAI' | 'POTONG_PIUTANG' | 'GANTI_BARANG';
}

export type UserActivityAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SWITCH_USER'
  | 'SWITCH_OUTLET'
  | 'TRANSACTION_CREATE'
  | 'TRANSACTION_HOLD'
  | 'TRANSACTION_RESUME'
  | 'TRANSACTION_DELETE_HOLD'
  | 'TRANSACTION_VOID'
  | 'TRANSACTION_EDIT'
  | 'TRANSACTION_RETURN'
  | 'SHIFT_OPEN'
  | 'SHIFT_CLOSE'
  | 'CASH_MOVEMENT'
  | 'DRAWER_OPEN'
  | 'PRODUCT_CREATE'
  | 'PRODUCT_UPDATE'
  | 'PRODUCT_DELETE'
  | 'PACKAGE_CREATE'
  | 'PACKAGE_UPDATE'
  | 'PACKAGE_DELETE'
  | 'EXCEL_IMPORT'
  | 'CATEGORY_CREATE'
  | 'CATEGORY_UPDATE'
  | 'CATEGORY_DELETE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'OUTLET_CREATE'
  | 'OUTLET_UPDATE'
  | 'SETTINGS_UPDATE'
  | 'DATABASE_RESET';

export type UserActivityCategory =
  | 'AUTH'          // Login, logout, switch user, switch outlet
  | 'TRANSACTION'   // Penjualan, hold, void, edit, retur
  | 'CASH'          // Shift, modal awal, kas masuk/keluar, buka laci
  | 'MASTER_DATA'   // Produk, paket, kategori, excel
  | 'SYSTEM';       // User, cabang, pengaturan toko, reset database

export interface UserActivityLog {
  id: string;
  timestamp: string; // ISO string e.g. "2026-11-11T10:15:30.000Z"
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm:ss
  userId: string;
  userName: string;
  userRole: 'ADMIN' | 'KASIR' | 'SUPERVISOR' | 'GUDANG' | string;
  outletId?: string;
  outletName?: string;
  action: UserActivityAction;
  category: UserActivityCategory;
  title: string;       // Ringkasan aktivitas
  description: string; // Deskripsi detail
  ipOrDevice?: string; // Terminal POS / IP / Device
  metadata?: Record<string, any>;
}
