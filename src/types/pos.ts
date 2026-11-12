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

export type BaseMemberTier = 'MEMBER_SILVER' | 'MEMBER_GOLD' | 'GROSIR';
export type MemberTier = BaseMemberTier | (string & {});
export type CustomerTier = 'UMUM' | MemberTier;

export const BASE_MEMBER_TIER_CODES: BaseMemberTier[] = [
  'MEMBER_SILVER',
  'MEMBER_GOLD',
  'GROSIR',
];

export const isBaseMemberTier = (tier: string): tier is BaseMemberTier =>
  (BASE_MEMBER_TIER_CODES as string[]).includes(tier);

export interface MemberTierConfig {
  tier: MemberTier;
  label: string;
  discountPercent: number;
  minPoints: number;
}

export const DEFAULT_MEMBER_TIER_CONFIGS: MemberTierConfig[] = [
  {
    tier: 'MEMBER_SILVER',
    label: 'Silver',
    discountPercent: 2,
    minPoints: 0,
  },
  {
    tier: 'MEMBER_GOLD',
    label: 'Gold',
    discountPercent: 5,
    minPoints: 250,
  },
  {
    tier: 'GROSIR',
    label: 'Grosir',
    discountPercent: 8,
    minPoints: 1000,
  },
];

/** Urutkan tier dari ambang poin terendah ke tertinggi. */
export const sortMemberTiers = (
  configs: MemberTierConfig[]
): MemberTierConfig[] =>
  [...configs].sort(
    (a, b) => a.minPoints - b.minPoints || a.label.localeCompare(b.label)
  );

/** Tier tertinggi yang sudah memenuhi ambang poin. */
export const getEligibleMemberTier = (
  points: number,
  configs: MemberTierConfig[]
): MemberTierConfig | undefined =>
  [...configs]
    .sort((a, b) => b.minPoints - a.minPoints)
    .find((config) => points >= config.minPoints);

export interface PointSettings {
  enabled: boolean;
  activeFrom: string; // YYYY-MM-DD (inklusif)
  activeUntil: string; // YYYY-MM-DD (inklusif, kosong = tanpa batas)
  redeemValue: number; // Nilai tukar Rupiah untuk 1 poin
  minRedeemPoints: number; // Minimal poin yang boleh ditukar
  productPoints: Record<string, number>; // productId -> poin per unit
}

export type PointProgramStatus = 'AKTIF' | 'BELUM_MULAI' | 'BERAKHIR' | 'NONAKTIF';

export const getDefaultPointSettings = (): PointSettings => {
  const year = new Date().getFullYear();
  return {
    enabled: true,
    activeFrom: `${year}-01-01`,
    activeUntil: `${year}-12-31`,
    redeemValue: 100,
    minRedeemPoints: 10,
    productPoints: {},
  };
};

const parsePointDate = (value: string, endOfDay = false): Date | null => {
  if (!value) return null;
  const parsed = new Date(
    `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Status program poin berdasarkan tanggal aktif dan tanggal berakhir. */
export const getPointProgramStatus = (
  settings: PointSettings,
  now: Date = new Date()
): PointProgramStatus => {
  if (!settings.enabled) return 'NONAKTIF';

  const start = parsePointDate(settings.activeFrom);
  const end = parsePointDate(settings.activeUntil, true);

  if (start && now.getTime() < start.getTime()) return 'BELUM_MULAI';
  if (end && now.getTime() > end.getTime()) return 'BERAKHIR';
  return 'AKTIF';
};

export const isPointProgramActive = (
  settings: PointSettings,
  now: Date = new Date()
): boolean => getPointProgramStatus(settings, now) === 'AKTIF';

/** Poin per unit untuk satu produk. */
export const getProductPointValue = (
  productId: string,
  settings: PointSettings
): number =>
  Math.max(0, Math.floor(Number(settings.productPoints?.[productId] ?? 0) || 0));

/** Total poin yang didapat dari isi keranjang saat program sedang aktif. */
export const calculateEarnedPoints = (
  items: Array<{ product: { id: string }; qty: number }>,
  settings: PointSettings,
  now: Date = new Date()
): number => {
  if (!isPointProgramActive(settings, now)) return 0;

  return items.reduce(
    (total, item) =>
      total +
      getProductPointValue(item.product.id, settings) *
        Math.max(0, Math.floor(item.qty)),
    0
  );
};

/** Konversi poin yang ditukar menjadi potongan Rupiah. */
export const getPointDiscountAmount = (
  points: number,
  settings: PointSettings
): number =>
  Math.max(0, Math.floor(points)) *
  Math.max(0, Math.floor(settings.redeemValue || 0));

/** Poin maksimal yang boleh ditukar pada nilai tagihan tertentu. */
export const getMaxRedeemablePoints = (
  availablePoints: number,
  payableAmount: number,
  settings: PointSettings,
  now: Date = new Date()
): number => {
  if (!isPointProgramActive(settings, now)) return 0;

  const value = Math.max(0, Math.floor(settings.redeemValue || 0));
  const available = Math.max(0, Math.floor(availablePoints || 0));
  const minPoints = Math.max(0, Math.floor(settings.minRedeemPoints || 0));

  if (value <= 0 || available <= 0) return 0;

  const byAmount = Math.floor(Math.max(0, payableAmount) / value);
  const maxPoints = Math.min(available, byAmount);

  // Tukar poin harus memenuhi minimal poin.
  return maxPoints < minPoints ? 0 : maxPoints;
};

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  tier: CustomerTier;
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
  pointsEarned?: number;
  pointsRedeemed?: number;
  pointDiscount?: number;
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
