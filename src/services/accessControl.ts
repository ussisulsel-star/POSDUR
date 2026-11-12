import { Outlet, User as PosUser, UserPermissions } from '../types/pos';

/**
 * Pusat kebijakan kewenangan (RBAC) Catat POS.
 *
 * Aturan utama:
 * - ADMIN      : seluruh fitur
 * - SUPERVISOR : POS + Master Data (baca saja) + Laporan
 * - KASIR      : POS saja
 * - GUDANG     : Master produk/paket/kategori saja (tanpa POS & laporan)
 *
 * Permission granular (diskon, void, retur, laci, lihat laporan, ubah harga)
 * diambil dari `user.permissions`, dengan fallback ke default per role.
 */

export type AppTab = 'pos' | 'master' | 'outlets' | 'reports' | 'users' | 'docs';

const DENY_ALL: UserPermissions = {
  canDiscount: false,
  canVoid: false,
  canReturn: false,
  canOpenDrawer: false,
  canViewReports: false,
  canEditPrice: false,
};

export const ROLE_DEFAULT_PERMISSIONS: Record<PosUser['role'], UserPermissions> = {
  ADMIN: {
    canDiscount: true,
    canVoid: true,
    canReturn: true,
    canOpenDrawer: true,
    canViewReports: true,
    canEditPrice: true,
  },
  SUPERVISOR: {
    canDiscount: true,
    canVoid: true,
    canReturn: true,
    canOpenDrawer: true,
    canViewReports: true,
    canEditPrice: false,
  },
  KASIR: {
    canDiscount: false,
    canVoid: false,
    canReturn: false,
    canOpenDrawer: true,
    canViewReports: false,
    canEditPrice: false,
  },
  GUDANG: {
    canDiscount: false,
    canVoid: false,
    canReturn: false,
    canOpenDrawer: false,
    canViewReports: false,
    canEditPrice: true,
  },
};

export function getEffectivePermissions(user?: PosUser | null): UserPermissions {
  if (!user) return { ...DENY_ALL };
  const defaults = ROLE_DEFAULT_PERMISSIONS[user.role] || DENY_ALL;
  return { ...defaults, ...(user.permissions || {}) };
}

export const isAdmin = (user?: PosUser | null): boolean => user?.role === 'ADMIN';
export const isSupervisor = (user?: PosUser | null): boolean => user?.role === 'SUPERVISOR';
export const isWarehouse = (user?: PosUser | null): boolean => user?.role === 'GUDANG';

// ---- Permission granular ----
export const canDiscount = (user?: PosUser | null): boolean => getEffectivePermissions(user).canDiscount;
export const canVoid = (user?: PosUser | null): boolean => getEffectivePermissions(user).canVoid;
export const canReturn = (user?: PosUser | null): boolean => getEffectivePermissions(user).canReturn;
export const canOpenDrawer = (user?: PosUser | null): boolean => getEffectivePermissions(user).canOpenDrawer;
export const canEditPrice = (user?: PosUser | null): boolean => getEffectivePermissions(user).canEditPrice;

// ---- Akses modul ----
export const canViewReports = (user?: PosUser | null): boolean =>
  isAdmin(user) || getEffectivePermissions(user).canViewReports;

export const canAccessMasterData = (user?: PosUser | null): boolean =>
  isAdmin(user) || isSupervisor(user) || isWarehouse(user);

export const canManageUsers = (user?: PosUser | null): boolean => isAdmin(user);
export const canResetDatabase = (user?: PosUser | null): boolean => isAdmin(user);
export const canViewDocs = (user?: PosUser | null): boolean => isAdmin(user);
export const canManageOutlets = (user?: PosUser | null): boolean => isAdmin(user);
export const canViewActivityLogs = (user?: PosUser | null): boolean =>
  isAdmin(user) || isSupervisor(user);

// ---- Edit master data (SUPERVISOR bersifat baca saja) ----
export const canEditProducts = (user?: PosUser | null): boolean =>
  isAdmin(user) || isWarehouse(user);
export const canEditCategories = (user?: PosUser | null): boolean =>
  isAdmin(user) || isWarehouse(user);
export const canEditEMoney = (user?: PosUser | null): boolean => isAdmin(user);
export const canEditCustomers = (user?: PosUser | null): boolean => isAdmin(user);

// ---- Navigasi ----
export function getAllowedTabs(user?: PosUser | null): AppTab[] {
  if (!user) return [];
  const tabs: AppTab[] = [];
  if (!isWarehouse(user)) tabs.push('pos');
  if (canAccessMasterData(user)) tabs.push('master');
  if (canViewReports(user)) tabs.push('reports');
  if (canViewDocs(user)) tabs.push('docs');
  return tabs;
}

export function canAccessTab(user: PosUser | null | undefined, tab: AppTab): boolean {
  return getAllowedTabs(user).includes(tab);
}

export function getDefaultTab(user?: PosUser | null): AppTab {
  const tabs = getAllowedTabs(user);
  return tabs.includes('pos') ? 'pos' : tabs[0] || 'pos';
}

// ---- Outlet (fail-closed) ----
/**
 * Mengembalikan daftar outlet yang boleh diakses user.
 * Bila user tidak punya daftar izin, HANYA outlet utamanya yang diizinkan
 * (bukan semua outlet seperti perilaku sebelumnya).
 */
export function getPermittedOutlets(user: PosUser | null | undefined, outlets: Outlet[]): Outlet[] {
  if (!user) return [];
  if (isAdmin(user) || user.canAccessAllOutlets) return outlets;

  const allowed = new Set(user.allowedOutletIds || []);
  if (allowed.size === 0 && user.outletId) {
    allowed.add(user.outletId);
  }
  if (allowed.size === 0) return [];

  return outlets.filter((o) => allowed.has(o.id));
}

export function canAccessOutlet(
  user: PosUser | null | undefined,
  outletId: string | undefined,
  outlets: Outlet[]
): boolean {
  if (!outletId) return false;
  return getPermittedOutlets(user, outlets).some((o) => o.id === outletId);
}
