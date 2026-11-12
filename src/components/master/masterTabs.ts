import {
  Boxes,
  FolderTree,
  Package,
  Smartphone,
  Store,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  canManageOutlets,
  canManageUsers,
  isAdmin,
  isSupervisor,
} from '../../services/accessControl';
import { User as PosUser } from '../../types/pos';

/**
 * Subtab Master Data yang tampil sebagai submenu di sidebar.
 * Dipakai bersama oleh AppSidebar dan MasterDataView.
 */
export type MasterTab =
  | 'products'
  | 'packages'
  | 'categories'
  | 'brands'
  | 'outlets'
  | 'users'
  | 'emoney'
  | 'customers';

export interface MasterTabMeta {
  id: MasterTab;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  accent: string;
}

export const MASTER_TABS: MasterTabMeta[] = [
  {
    id: 'products',
    label: 'Master Produk',
    shortLabel: 'Master Produk',
    icon: Package,
    accent: 'text-blue-400',
  },
  {
    id: 'packages',
    label: 'Master Produk Paket & Bundling',
    shortLabel: 'Produk Paket',
    icon: Boxes,
    accent: 'text-amber-400',
  },
  {
    id: 'categories',
    label: 'Master Kategori',
    shortLabel: 'Master Kategori',
    icon: FolderTree,
    accent: 'text-cyan-400',
  },
  {
    id: 'brands',
    label: 'Master Brand',
    shortLabel: 'Master Brand',
    icon: Tags,
    accent: 'text-teal-400',
  },
  {
    id: 'outlets',
    label: 'Master Cabang',
    shortLabel: 'Master Cabang',
    icon: Store,
    accent: 'text-emerald-400',
  },
  {
    id: 'users',
    label: 'Master Pengguna',
    shortLabel: 'Master Pengguna',
    icon: UserCog,
    accent: 'text-indigo-400',
  },
  {
    id: 'emoney',
    label: 'Master E-Money & Dompet Digital',
    shortLabel: 'Master E-Money',
    icon: Smartphone,
    accent: 'text-fuchsia-400',
  },
  {
    id: 'customers',
    label: 'Master Pelanggan',
    shortLabel: 'Master Pelanggan',
    icon: Users,
    accent: 'text-rose-400',
  },
];

export function isMasterTabAllowed(
  user: PosUser | null | undefined,
  tab: MasterTab
): boolean {
  switch (tab) {
    case 'outlets':
      return canManageOutlets(user);
    case 'users':
      return canManageUsers(user);
    case 'emoney':
    case 'customers':
      return isAdmin(user) || isSupervisor(user);
    default:
      return true;
  }
}

export function getAllowedMasterTabs(
  user: PosUser | null | undefined
): MasterTabMeta[] {
  return MASTER_TABS.filter((tab) => isMasterTabAllowed(user, tab.id));
}
