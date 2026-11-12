import {
  Activity,
  BarChart3,
  Coins,
  CreditCard,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

/**
 * Tab laporan yang tampil sebagai submenu "Laporan" di sidebar.
 * Dipakai bersama oleh AppSidebar dan ReportsView agar label & urutan konsisten.
 */
export type ReportTab =
  | 'closing'
  | 'transactions'
  | 'payments'
  | 'consolidated'
  | 'products'
  | 'shifts'
  | 'traffic'
  | 'activity';

export interface ReportTabMeta {
  id: ReportTab;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  accent: string;
}

export const REPORT_TABS: ReportTabMeta[] = [
  {
    id: 'closing',
    label: 'Laporan Tutup Kasir (End of Day)',
    shortLabel: 'Tutup Kasir (EoD)',
    icon: FileCheck,
    accent: 'text-amber-400',
  },
  {
    id: 'transactions',
    label: 'Koreksi & Void Transaksi (Khusus SPV)',
    shortLabel: 'Koreksi & Void',
    icon: ShieldAlert,
    accent: 'text-amber-500',
  },
  {
    id: 'payments',
    label: 'Rincian Pembayaran & E-Money QRIS',
    shortLabel: 'Rincian Pembayaran',
    icon: CreditCard,
    accent: 'text-blue-400',
  },
  {
    id: 'consolidated',
    label: 'Matriks Konsolidasi Antar Cabang',
    shortLabel: 'Matriks Konsolidasi',
    icon: BarChart3,
    accent: 'text-emerald-400',
  },
  {
    id: 'products',
    label: 'Produk Terlaris',
    shortLabel: 'Produk Terlaris',
    icon: TrendingUp,
    accent: 'text-emerald-400',
  },
  {
    id: 'shifts',
    label: 'Audit Shift Kasir',
    shortLabel: 'Audit Shift Kasir',
    icon: Coins,
    accent: 'text-amber-400',
  },
  {
    id: 'traffic',
    label: 'Laporan Traffic Penjualan & Jam Sibuk',
    shortLabel: 'Traffic & Jam Sibuk',
    icon: Activity,
    accent: 'text-cyan-400',
  },
  {
    id: 'activity',
    label: 'Log Aktivitas User (Audit Trail)',
    shortLabel: 'Log Aktivitas',
    icon: ShieldCheck,
    accent: 'text-indigo-400',
  },
];
