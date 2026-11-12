import { Product, Customer, Transaction, Shift, CashMovement, HeldTransaction, SalesReturn, User, Outlet, StockTransfer, Category, EMoney, UserActivityLog, Brand, DEFAULT_BRANDS, MemberTierConfig, DEFAULT_MEMBER_TIER_CONFIGS, getEligibleMemberTier, sortMemberTiers, syncBrandRegistry, PointSettings, getDefaultPointSettings, calculateEarnedPoints, getPointDiscountAmount } from '../types/pos';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_USERS, INITIAL_OUTLETS, INITIAL_CONSOLIDATED_TRANSACTIONS, INITIAL_CATEGORIES, INITIAL_EMONEY, INITIAL_ACTIVITY_LOGS } from '../data/seedData';

const STORAGE_KEYS = {
  USER: 'ketoko_pos_user',
  TOKEN: 'ketoko_pos_jwt_token',
  USERS: 'ketoko_pos_users',
  OUTLETS: 'ketoko_pos_outlets',
  OUTLET_SEED_VERSION: 'ketoko_pos_outlet_seed_version',
  ACTIVE_OUTLET: 'ketoko_pos_active_outlet',
  TRANSFERS: 'ketoko_pos_transfers',
  PRODUCTS: 'ketoko_pos_products',
  CATEGORIES: 'ketoko_pos_categories',
  BRANDS: 'ketoko_pos_brands',
  PRODUCT_SEED_VERSION: 'ketoko_pos_product_seed_version',
  EMONEY: 'ketoko_pos_emoney',
  CUSTOMERS: 'ketoko_pos_customers',
  MEMBER_TIERS: 'ketoko_pos_member_tiers',
  POINT_SETTINGS: 'ketoko_pos_point_settings',
  ACTIVE_SHIFT: 'ketoko_pos_active_shift',
  SHIFT_HISTORY: 'ketoko_pos_shift_history',
  TRANSACTIONS: 'ketoko_pos_transactions',
  HELD_ORDERS: 'ketoko_pos_held_orders',
  CASH_MOVEMENTS: 'ketoko_pos_cash_movements',
  RETURNS: 'ketoko_pos_returns',
  SETTINGS: 'ketoko_pos_settings',
  ACTIVITY_LOGS: 'ketoko_pos_activity_logs',
};

// Naikkan versi ini setiap kali daftar outlet master berubah,
// agar data outlet lama di localStorage ikut dimigrasi.
const OUTLET_SEED_VERSION = '2026-11-makassar-12';

// Naikkan versi ini setiap kali daftar produk/kategori master berubah,
// agar data lama di localStorage ikut diganti dengan dataset terbaru.
const PRODUCT_SEED_VERSION = '2026-11-pattiro-230';

export interface StoreSettings {
  companyId: string;
  storeName: string;
  branchName: string;
  address: string;
  phone: string;
  receiptHeader: string;
  receiptFooter: string;
  taxEnabled: boolean;
  taxRate: number; // e.g. 11%
}

const normalizePointSettings = (
  source?: Partial<PointSettings> | null
): PointSettings => {
  const defaults = getDefaultPointSettings();
  const productPoints: Record<string, number> = {};

  if (source?.productPoints && typeof source.productPoints === 'object') {
    Object.entries(source.productPoints).forEach(([productId, value]) => {
      const points = Math.max(0, Math.floor(Number(value) || 0));
      if (productId && points > 0) productPoints[productId] = points;
    });
  }

  return {
    enabled: source?.enabled ?? defaults.enabled,
    activeFrom:
      typeof source?.activeFrom === 'string'
        ? source.activeFrom
        : defaults.activeFrom,
    activeUntil:
      typeof source?.activeUntil === 'string'
        ? source.activeUntil
        : defaults.activeUntil,
    redeemValue: Math.max(
      0,
      Math.floor(Number(source?.redeemValue ?? defaults.redeemValue) || 0)
    ),
    minRedeemPoints: Math.max(
      0,
      Math.floor(Number(source?.minRedeemPoints ?? defaults.minRedeemPoints) || 0)
    ),
    productPoints,
  };
};

const DEFAULT_SETTINGS: StoreSettings = {  companyId: '99999',
  storeName: 'DEL USAHA RASA GRUP',
  branchName: 'Cabang Utama - Jakarta',
  address: 'Jl. Boulevard Raya Blok A2 No. 10, Kelapa Gading',
  phone: '(021) 4589-1234 / 0812-9999-9999',
  receiptHeader: 'Selamat Datang di DEL USAHA RASA GRUP',
  receiptFooter: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.\nTerima Kasih Atas Kunjungan Anda!',
  taxEnabled: false,
  taxRate: 11,
};

// Safe Web Audio API sound generator (no external audio files needed)
export function playBeep(type: 'scan' | 'success' | 'delete' | 'error') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'scan') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === 'delete') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Ignore audio context errors in quiet mode
  }
}

export const StorageService = {
  // Authentication
  getUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setUser(user: User | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      // Store dummy simulated JWT token
      const dummyJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(
        JSON.stringify({
          sub: user.id,
          companyId: user.companyId,
          userId: user.userId,
          role: user.role,
          exp: Math.floor(Date.now() / 1000) + 86400,
        })
      )}.ketoko_signature_99999`;
      localStorage.setItem(STORAGE_KEYS.TOKEN, dummyJwt);
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
  },

  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  // User Management
  getUsers(): User[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
        return INITIAL_USERS;
      }
      const list: User[] = JSON.parse(data);
      let hasChanges = false;
      const normalized = list.map((u) => {
        let changed = false;
        let canAccessAllOutlets = u.canAccessAllOutlets;
        let allowedOutletIds = u.allowedOutletIds;
        let outletId = u.outletId || 'out-001';
        let password = u.password;

        // Migrasi keamanan: hapus password universal pada akun non-ADMIN.
        // Akun tersebut tetap bisa login dengan PIN masing-masing.
        if (u.role !== 'ADMIN' && password === '99999psfdv') {
          changed = true;
          password = u.pin || undefined;
        }

        if (canAccessAllOutlets === undefined) {
          changed = true;
          canAccessAllOutlets = u.role === 'ADMIN';
        }

        if (!allowedOutletIds || allowedOutletIds.length === 0) {
          changed = true;
          // Fail-closed: tanpa daftar izin, pengguna hanya boleh outlet utamanya.
          allowedOutletIds = canAccessAllOutlets
            ? ['out-001', 'out-002', 'out-003', 'out-004']
            : [outletId];
        }

        if (changed) {
          hasChanges = true;
          return { ...u, outletId, canAccessAllOutlets, allowedOutletIds, password };
        }
        return u;
      });

      if (hasChanges) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      return INITIAL_USERS;
    }
  },

  saveUsers(users: User[]) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  addUser(user: User): User[] {
    const list = this.getUsers();
    const updated = [user, ...list];
    this.saveUsers(updated);
    return updated;
  },

  updateUser(user: User): User[] {
    const list = this.getUsers();
    const updated = list.map((u) => (u.id === user.id ? user : u));
    this.saveUsers(updated);
    // If the updated user is currently logged in, sync current user too
    const currentUser = this.getUser();
    if (currentUser && currentUser.id === user.id) {
      this.setUser({ ...currentUser, ...user });
    }
    return updated;
  },

  deleteUser(userId: string): User[] {
    const list = this.getUsers();
    const updated = list.filter((u) => u.id !== userId);
    this.saveUsers(updated);
    return updated;
  },

  // Outlets & Branches (Multi-Outlet)
  getOutlets(): Outlet[] {
    try {
      const storedVersion = localStorage.getItem(STORAGE_KEYS.OUTLET_SEED_VERSION);

      // Migrasi daftar cabang ke dataset terbaru (Makassar/Gowa).
      if (storedVersion !== OUTLET_SEED_VERSION) {
        localStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(INITIAL_OUTLETS));
        localStorage.setItem(STORAGE_KEYS.OUTLET_SEED_VERSION, OUTLET_SEED_VERSION);
        const hq = INITIAL_OUTLETS.find((o) => o.isHQ) || INITIAL_OUTLETS[0];
        localStorage.setItem(STORAGE_KEYS.ACTIVE_OUTLET, JSON.stringify(hq));
        return INITIAL_OUTLETS;
      }

      const data = localStorage.getItem(STORAGE_KEYS.OUTLETS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(INITIAL_OUTLETS));
        return INITIAL_OUTLETS;
      }
      const parsed: Outlet[] = JSON.parse(data);
      const defaultBrands = ['Del Mango', 'Es Teler Pattiro', 'Donat Halus', 'Es Tes Koala'];
      let needsUpdate = false;
      parsed.forEach((o, idx) => {
        if (!o.brand) {
          const matchInitial = INITIAL_OUTLETS.find((io) => io.id === o.id);
          o.brand = matchInitial?.brand || defaultBrands[idx % defaultBrands.length];
          needsUpdate = true;
        }
      });
      if (needsUpdate) {
        localStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return INITIAL_OUTLETS;
    }
  },

  saveOutlets(outlets: Outlet[]) {
    localStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(outlets));
  },

  getActiveOutlet(): Outlet {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_OUTLET);
      if (data) return JSON.parse(data);
      const outlets = this.getOutlets();
      const hq = outlets.find((o) => o.isHQ) || outlets[0];
      this.setActiveOutlet(hq);
      return hq;
    } catch {
      return INITIAL_OUTLETS[0];
    }
  },

  setActiveOutlet(outlet: Outlet) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_OUTLET, JSON.stringify(outlet));
  },

  // Stock Transfers between outlets
  getTransfers(): StockTransfer[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSFERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveTransfers(transfers: StockTransfer[]) {
    localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(transfers));
  },

  createTransfer(transfer: StockTransfer) {
    const list = this.getTransfers();
    list.unshift(transfer);
    this.saveTransfers(list);

    // Adjust outlet stocks for the transferred items
    const products = this.getProducts();
    const updated = products.map((prod) => {
      const item = transfer.items.find((i) => i.productId === prod.id);
      if (!item) return prod;

      const stocks = { ...(prod.outletStocks || {}) };
      // Deduct from source outlet
      const srcCurrent = stocks[transfer.fromOutletId] ?? prod.stock;
      stocks[transfer.fromOutletId] = Math.max(0, srcCurrent - item.qty);

      // Add to destination outlet
      const dstCurrent = stocks[transfer.toOutletId] ?? 0;
      stocks[transfer.toOutletId] = dstCurrent + item.qty;

      return {
        ...prod,
        outletStocks: stocks,
      };
    });

    this.saveProducts(updated);
  },

  // Settings
  getSettings(): StoreSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: StoreSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Products
  getProducts(): Product[] {
    try {
      const storedVersion = localStorage.getItem(STORAGE_KEYS.PRODUCT_SEED_VERSION);

      // Migrasi produk & kategori ke dataset terbaru (Pattiro/Makassar).
      if (storedVersion !== PRODUCT_SEED_VERSION) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
        localStorage.setItem(STORAGE_KEYS.PRODUCT_SEED_VERSION, PRODUCT_SEED_VERSION);
        return INITIAL_PRODUCTS;
      }

      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
        return INITIAL_PRODUCTS;
      }
      let parsed: Product[] = JSON.parse(data);
      let hasChanges = false;

      // Samakan brand lama dengan nama brand resmi agar relasi brand tetap valid.
      const legacyBrandAliases: Record<string, string> = {
        Pattiro: 'Es Teler Pattiro',
      };
      parsed = parsed.map((p) => {
        const canonicalBrand = p.brand ? legacyBrandAliases[p.brand] : undefined;
        if (canonicalBrand) {
          hasChanges = true;
          return { ...p, brand: canonicalBrand };
        }
        return p;
      });

      // Seed map to lookup brand by product code
      const seedBrandMap = new Map<string, string>();
      INITIAL_PRODUCTS.forEach((ip) => {
        if (ip.brand) seedBrandMap.set(ip.code, ip.brand);
        if (ip.brand) seedBrandMap.set(ip.id, ip.brand);
      });

      // Ensure every existing product has a brand
      parsed = parsed.map((p, idx) => {
        if (!p.brand) {
          hasChanges = true;
          const assignedBrand = seedBrandMap.get(p.code) || seedBrandMap.get(p.id) || (
            idx % 4 === 0 ? 'Del Mango' :
            idx % 4 === 1 ? 'Es Teler Pattiro' :
            idx % 4 === 2 ? 'Donat Halus' : 'Es Tes Koala'
          );
          return { ...p, brand: assignedBrand };
        }
        return p;
      });

      // Ensure signature brand products and package items exist for instant user testing
      const existingCodes = new Set(parsed.map((p) => p.code));
      INITIAL_PRODUCTS.forEach((ip) => {
        if (!existingCodes.has(ip.code)) {
          parsed.push(ip);
          existingCodes.add(ip.code);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return INITIAL_PRODUCTS;
    }
  },

  saveProducts(products: Product[]) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },

  updateProductStock(productId: string, deltaStock: number, outletId?: string) {
    return this.getProducts();
  },

  // Brands
  getBrands(): Brand[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BRANDS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(DEFAULT_BRANDS));
        syncBrandRegistry(DEFAULT_BRANDS);
        return DEFAULT_BRANDS;
      }

      const parsed: Brand[] = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(DEFAULT_BRANDS));
        syncBrandRegistry(DEFAULT_BRANDS);
        return DEFAULT_BRANDS;
      }

      // Pastikan brand lama yang belum punya properti baru tetap valid.
      const normalized = parsed.map((brand, index) => ({
        ...brand,
        id: brand.id || `brand-${index}`,
        tagline: brand.tagline || '',
        emoji: brand.emoji || '🏷️',
        colorKey: brand.colorKey || 'blue',
        isActive: brand.isActive !== false,
        createdAt: brand.createdAt || new Date().toISOString(),
      }));

      syncBrandRegistry(normalized);
      return normalized;
    } catch {
      syncBrandRegistry(DEFAULT_BRANDS);
      return DEFAULT_BRANDS;
    }
  },

  saveBrands(brands: Brand[]) {
    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(brands));
    syncBrandRegistry(brands);
  },

  // Categories
  getCategories(): Category[] {
    try {
      const storedVersion = localStorage.getItem(STORAGE_KEYS.PRODUCT_SEED_VERSION);

      // Pastikan produk & kategori selalu sinkron dengan dataset terbaru.
      if (storedVersion !== PRODUCT_SEED_VERSION) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
        localStorage.setItem(STORAGE_KEYS.PRODUCT_SEED_VERSION, PRODUCT_SEED_VERSION);
        return INITIAL_CATEGORIES;
      }

      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
        return INITIAL_CATEGORIES;
      }
      const parsed: Category[] = JSON.parse(data);
      if (!parsed.some((c) => c.id === 'cat-all')) {
        parsed.unshift({ id: 'cat-all', name: 'Semua' });
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return INITIAL_CATEGORIES;
    }
  },

  saveCategories(categories: Category[]) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  },

  // E-Money / Dompet Digital (OVO, GoPay, ShopeePay, DANA, LinkAja)
  getEMoney(): EMoney[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EMONEY);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.EMONEY, JSON.stringify(INITIAL_EMONEY));
        return INITIAL_EMONEY;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_EMONEY;
    }
  },

  saveEMoney(emoney: EMoney[]) {
    localStorage.setItem(STORAGE_KEYS.EMONEY, JSON.stringify(emoney));
  },

  // Customers
  getCustomers(): Customer[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
        return INITIAL_CUSTOMERS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_CUSTOMERS;
    }
  },

  saveCustomers(customers: Customer[]) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  // Member tier settings (discount & minimum points)
  getMemberTiers(): MemberTierConfig[] {
    const normalizeTier = (
      item: Partial<MemberTierConfig> | null | undefined,
      fallback?: MemberTierConfig
    ): MemberTierConfig | null => {
      const tier =
        typeof item?.tier === 'string' && item.tier.trim()
          ? item.tier.trim()
          : fallback?.tier;
      if (!tier) return null;

      return {
        tier,
        label:
          (typeof item?.label === 'string' && item.label.trim()) ||
          fallback?.label ||
          tier,
        discountPercent: Math.max(
          0,
          Math.min(
            100,
            Math.round(
              Number(item?.discountPercent ?? fallback?.discountPercent ?? 0)
            )
          )
        ),
        minPoints:
          tier === 'MEMBER_SILVER'
            ? 0
            : Math.max(
                0,
                Math.floor(Number(item?.minPoints ?? fallback?.minPoints ?? 0))
              ),
      };
    };

    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMBER_TIERS);
      if (!data) {
        localStorage.setItem(
          STORAGE_KEYS.MEMBER_TIERS,
          JSON.stringify(DEFAULT_MEMBER_TIER_CONFIGS)
        );
        return DEFAULT_MEMBER_TIER_CONFIGS.map((tier) => ({ ...tier }));
      }

      const parsed: unknown = JSON.parse(data);
      const source = Array.isArray(parsed)
        ? (parsed as Partial<MemberTierConfig>[])
        : [];

      const normalized: MemberTierConfig[] = [];

      // Tiga tier bawaan selalu tersedia agar data member lama tetap valid.
      DEFAULT_MEMBER_TIER_CONFIGS.forEach((fallback) => {
        const stored = source.find(
          (item) => item && item.tier === fallback.tier
        );
        const config = normalizeTier(stored, fallback);
        if (config) normalized.push(config);
      });

      // Tier tambahan buatan pengguna.
      source.forEach((item) => {
        if (!item || typeof item.tier !== 'string') return;
        const tier = item.tier.trim();
        if (!tier || normalized.some((config) => config.tier === tier)) return;
        const config = normalizeTier(item);
        if (config) normalized.push(config);
      });

      const sorted = sortMemberTiers(normalized);
      localStorage.setItem(STORAGE_KEYS.MEMBER_TIERS, JSON.stringify(sorted));
      return sorted;
    } catch {
      localStorage.setItem(
        STORAGE_KEYS.MEMBER_TIERS,
        JSON.stringify(DEFAULT_MEMBER_TIER_CONFIGS)
      );
      return DEFAULT_MEMBER_TIER_CONFIGS.map((tier) => ({ ...tier }));
    }
  },

  saveMemberTiers(tiers: MemberTierConfig[]) {
    localStorage.setItem(
      STORAGE_KEYS.MEMBER_TIERS,
      JSON.stringify(sortMemberTiers(tiers))
    );
  },

  // Point program settings (earning per product, active period, redemption)
  getPointSettings(): PointSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.POINT_SETTINGS);
      if (!data) {
        const defaults = getDefaultPointSettings();
        localStorage.setItem(
          STORAGE_KEYS.POINT_SETTINGS,
          JSON.stringify(defaults)
        );
        return defaults;
      }

      const parsed = JSON.parse(data) as Partial<PointSettings>;
      const normalized = normalizePointSettings(parsed);
      localStorage.setItem(
        STORAGE_KEYS.POINT_SETTINGS,
        JSON.stringify(normalized)
      );
      return normalized;
    } catch {
      const defaults = getDefaultPointSettings();
      localStorage.setItem(
        STORAGE_KEYS.POINT_SETTINGS,
        JSON.stringify(defaults)
      );
      return defaults;
    }
  },

  savePointSettings(settings: PointSettings): PointSettings {
    const normalized = normalizePointSettings(settings);
    localStorage.setItem(
      STORAGE_KEYS.POINT_SETTINGS,
      JSON.stringify(normalized)
    );
    return normalized;
  },

  resetPointSettings(): PointSettings {
    const defaults = getDefaultPointSettings();
    localStorage.setItem(
      STORAGE_KEYS.POINT_SETTINGS,
      JSON.stringify(defaults)
    );
    return defaults;
  },

  // Shift Management
  getActiveShift(): Shift | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT);
      if (!data) {
        // Create initial default shift for quick smooth cashier experience
        const activeOutlet = this.getActiveOutlet();
        const defaultShift: Shift = {
          id: 'shift-' + Date.now(),
          shiftNumber: 1,
          outletId: activeOutlet.id,
          outletName: activeOutlet.name,
          cashierId: 'ADMIN',
          cashierName: 'ADMINISTRATOR',
          companyId: '99999',
          startTime: new Date().toISOString(),
          initialCash: 500000,
          totalCashSales: 0,
          totalNonCashSales: 0,
          totalCashIn: 0,
          totalCashOut: 0,
          expectedCash: 500000,
          status: 'OPEN',
          notes: `Shift Pagi Awal [${activeOutlet.code}]`,
        };
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(defaultShift));
        return defaultShift;
      }
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  saveActiveShift(shift: Shift | null) {
    if (shift) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(shift));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
    }
  },

  closeCurrentShift(actualCash: number, notes: string): Shift | null {
    const active = this.getActiveShift();
    if (!active) return null;

    const diff = actualCash - active.expectedCash;
    const closedShift: Shift = {
      ...active,
      endTime: new Date().toISOString(),
      actualCash,
      cashDifference: diff,
      status: 'CLOSED',
      notes,
    };

    // Save to shift history
    const history = this.getShiftHistory();
    history.unshift(closedShift);
    localStorage.setItem(STORAGE_KEYS.SHIFT_HISTORY, JSON.stringify(history));

    // Clear active shift
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
    return closedShift;
  },

  getShiftHistory(): Shift[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SHIFT_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Cash In / Cash Out Movements
  getCashMovements(): CashMovement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CASH_MOVEMENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addCashMovement(type: 'MASUK' | 'KELUAR', amount: number, reason: string, cashierName: string) {
    const activeShift = this.getActiveShift();
    const movement: CashMovement = {
      id: 'cm-' + Date.now(),
      shiftId: activeShift ? activeShift.id : 'no-shift',
      type,
      amount,
      reason,
      timestamp: new Date().toISOString(),
      cashierName,
    };

    const list = this.getCashMovements();
    list.unshift(movement);
    localStorage.setItem(STORAGE_KEYS.CASH_MOVEMENTS, JSON.stringify(list));

    // Update active shift expected cash
    if (activeShift) {
      if (type === 'MASUK') {
        activeShift.totalCashIn += amount;
        activeShift.expectedCash += amount;
      } else {
        activeShift.totalCashOut += amount;
        activeShift.expectedCash -= amount;
      }
      this.saveActiveShift(activeShift);
    }

    return movement;
  },

  // Transactions
  getTransactions(): Transaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(INITIAL_CONSOLIDATED_TRANSACTIONS));
        return INITIAL_CONSOLIDATED_TRANSACTIONS;
      }
      const list: Transaction[] = JSON.parse(data);
      // Ensure any legacy seed or existing QRIS transaction has proper emoneyName tag
      let hasChanges = false;
      const normalized = list.map((t) => {
        let changed = false;
        let outletId = t.outletId;
        let outletName = t.outletName;
        if (!outletId) {
          outletId = 'out-001';
          changed = true;
        }
        if (!outletName) {
          outletName = 'DEL USAHA RASA GRUP (Pusat & HQ)';
          changed = true;
        }
        const payments = (t.payments || []).map((p) => {
          if (p.method === 'QRIS' && !p.emoneyName) {
            changed = true;
            if (t.id === 'tx-seed-002') return { ...p, emoneyName: 'GoPay' };
            if (t.id === 'tx-seed-006') return { ...p, emoneyName: 'OVO' };
            return { ...p, emoneyName: 'QRIS Dinamis' };
          }
          return p;
        });
        if (changed) {
          hasChanges = true;
          return { ...t, outletId, outletName, payments };
        }
        return t;
      });

      if (hasChanges) {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      return INITIAL_CONSOLIDATED_TRANSACTIONS;
    }
  },

  saveTransaction(transaction: Transaction) {
    const list = this.getTransactions();
    list.unshift(transaction);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));

    // Update active shift financial numbers
    const activeShift = this.getActiveShift();
    if (activeShift) {
      let cashPaid = 0;
      let nonCashPaid = 0;

      transaction.payments.forEach((p) => {
        if (p.method === 'TUNAI') {
          // Cash portion contributed to drawer is amount minus change (or net cash received)
          cashPaid += Math.max(0, p.amount - transaction.changeAmount);
        } else {
          nonCashPaid += p.amount;
        }
      });

      activeShift.totalCashSales += cashPaid;
      activeShift.totalNonCashSales += nonCashPaid;
      activeShift.expectedCash += cashPaid;
      this.saveActiveShift(activeShift);
    }

    // Award loyalty points to customer if member
    if (transaction.customerId && transaction.customerId !== 'cust-umum') {
      const customers = this.getCustomers();
      const tierConfigs = this.getMemberTiers();
      const pointSettings = this.getPointSettings();

      // Poin didapat dari konfigurasi per produk, bukan nominal belanja global.
      const earned =
        transaction.pointsEarned ??
        calculateEarnedPoints(transaction.items, pointSettings);
      const redeemed = Math.max(
        0,
        Math.floor(transaction.pointsRedeemed ?? 0)
      );

      // Simpan rincian poin pada transaksi agar struk & laporan konsisten.
      transaction.pointsEarned = earned;
      transaction.pointsRedeemed = redeemed;
      transaction.pointDiscount =
        transaction.pointDiscount ??
        getPointDiscountAmount(redeemed, pointSettings);

      const updated = customers.map((c) => {
        if (c.id === transaction.customerId) {
          // Poin ditukar dipotong lebih dulu, lalu poin belanja ditambahkan.
          const nextPoints = Math.max(0, c.points - redeemed + earned);
          const eligibleTier = getEligibleMemberTier(nextPoints, tierConfigs);
          const currentConfig = tierConfigs.find(
            (config) => config.tier === c.tier
          );

          // Naik tier otomatis saat poin mencapai ambang; tidak pernah turun otomatis.
          const shouldUpgrade =
            eligibleTier !== undefined &&
            (!currentConfig ||
              eligibleTier.minPoints > currentConfig.minPoints);

          if (eligibleTier && shouldUpgrade) {
            return {
              ...c,
              points: nextPoints,
              tier: eligibleTier.tier,
              discountPercent: eligibleTier.discountPercent,
            };
          }

          return { ...c, points: nextPoints };
        }
        return c;
      });
      this.saveCustomers(updated);
    }

    return transaction;
  },

  updateTransaction(updatedTx: Transaction): Transaction {
    const list = this.getTransactions();
    const index = list.findIndex((t) => t.id === updatedTx.id);
    if (index !== -1) {
      list[index] = updatedTx;
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
    }
    return updatedTx;
  },

  deleteTransaction(txId: string): Transaction[] {
    const list = this.getTransactions();
    const filtered = list.filter((t) => t.id !== txId);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filtered));
    return filtered;
  },

  // Held Orders (Tahan Transaksi / Pending)
  getHeldOrders(): HeldTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HELD_ORDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveHeldOrders(orders: HeldTransaction[]) {
    localStorage.setItem(STORAGE_KEYS.HELD_ORDERS, JSON.stringify(orders));
  },

  holdOrder(held: HeldTransaction) {
    const orders = this.getHeldOrders();
    orders.unshift(held);
    this.saveHeldOrders(orders);
  },

  removeHeldOrder(id: string) {
    const orders = this.getHeldOrders().filter((o) => o.id !== id);
    this.saveHeldOrders(orders);
    return orders;
  },

  // Returns
  getReturns(): SalesReturn[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RETURNS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveReturn(salesReturn: SalesReturn) {
    const list = this.getReturns();
    list.unshift(salesReturn);
    localStorage.setItem(STORAGE_KEYS.RETURNS, JSON.stringify(list));

    // If refund was cash, deduct from shift expected cash
    if (salesReturn.refundMethod === 'TUNAI') {
      const activeShift = this.getActiveShift();
      if (activeShift) {
        activeShift.expectedCash -= salesReturn.totalRefund;
        this.saveActiveShift(activeShift);
      }
    }

    return salesReturn;
  },

  // User Activity Audit Logs
  getActivityLogs(): UserActivityLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(INITIAL_ACTIVITY_LOGS));
        return INITIAL_ACTIVITY_LOGS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_ACTIVITY_LOGS;
    }
  },

  saveActivityLogs(logs: UserActivityLog[]) {
    // Keep max 500 most recent logs to prevent localStorage quota overflow
    const trimmed = logs.slice(0, 500);
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(trimmed));
  },

  logUserActivity(
    entry: Omit<UserActivityLog, 'id' | 'timestamp' | 'date' | 'time'> &
      Partial<Pick<UserActivityLog, 'id' | 'timestamp' | 'date' | 'time'>>
  ): UserActivityLog {
    const now = new Date();
    const timestamp = entry.timestamp || now.toISOString();
    const date =
      entry.date ||
      now.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    const time =
      entry.time ||
      now.toLocaleTimeString('id-ID', { hour12: false });
    const id = entry.id || `act-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const fullLog: UserActivityLog = {
      id,
      timestamp,
      date,
      time,
      userId: entry.userId || 'SYSTEM',
      userName: entry.userName || 'Sistem POS',
      userRole: entry.userRole || 'USER',
      outletId: entry.outletId,
      outletName: entry.outletName,
      action: entry.action,
      category: entry.category,
      title: entry.title,
      description: entry.description,
      ipOrDevice: entry.ipOrDevice || 'Terminal POS Web Client',
      metadata: entry.metadata,
    };

    const currentLogs = this.getActivityLogs();
    const updated = [fullLog, ...currentLogs];
    this.saveActivityLogs(updated);

    return fullLog;
  },

  clearActivityLogs() {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify([]));
  },

  // Reset to initial sample data
  resetDatabase() {
    localStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(INITIAL_OUTLETS));
    localStorage.setItem(STORAGE_KEYS.OUTLET_SEED_VERSION, OUTLET_SEED_VERSION);
    const hq = INITIAL_OUTLETS.find((o) => o.isHQ) || INITIAL_OUTLETS[0];
    localStorage.setItem(STORAGE_KEYS.ACTIVE_OUTLET, JSON.stringify(hq));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(DEFAULT_BRANDS));
    syncBrandRegistry(DEFAULT_BRANDS);
    localStorage.setItem(STORAGE_KEYS.PRODUCT_SEED_VERSION, PRODUCT_SEED_VERSION);
    localStorage.setItem(STORAGE_KEYS.EMONEY, JSON.stringify(INITIAL_EMONEY));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
    localStorage.setItem(
      STORAGE_KEYS.MEMBER_TIERS,
      JSON.stringify(DEFAULT_MEMBER_TIER_CONFIGS)
    );
    localStorage.setItem(
      STORAGE_KEYS.POINT_SETTINGS,
      JSON.stringify(getDefaultPointSettings())
    );
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(INITIAL_CONSOLIDATED_TRANSACTIONS));
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(INITIAL_ACTIVITY_LOGS));
    localStorage.removeItem(STORAGE_KEYS.TRANSFERS);
    localStorage.removeItem(STORAGE_KEYS.HELD_ORDERS);
    localStorage.removeItem(STORAGE_KEYS.CASH_MOVEMENTS);
    localStorage.removeItem(STORAGE_KEYS.RETURNS);
    localStorage.removeItem(STORAGE_KEYS.SHIFT_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  },
};

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount);
}
