import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  CreditCard, 
  Coins, 
  FileText,
  DollarSign,
  Building,
  Store,
  PieChart,
  CheckCircle2,
  Printer,
  QrCode,
  Wallet,
  Smartphone,
  Filter,
  ArrowUpRight,
  Percent,
  ShieldCheck,
  Edit3,
  Trash2,
  ShieldAlert,
  Search,
  Receipt,
  Calendar,
  RotateCcw,
  X,
  Users,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction, Shift, Outlet, EMoney, User as PosUser, UserActivityLog } from '../../types/pos';
import { formatRupiah, formatNumber, playBeep, StorageService } from '../../services/storageService';
import { ClosingShiftReportView } from './ClosingShiftReportView';
import { TrafficReportView } from './TrafficReportView';
import { UserActivityLogView } from '../audit/UserActivityLogView';
import { VoidTransactionModal } from '../pos/VoidTransactionModal';
import { canVoid, getPermittedOutlets, isAdmin } from '../../services/accessControl';
import { REPORT_TABS, type ReportTab } from './reportTabs';

interface ReportsViewProps {
  transactions: Transaction[];
  shiftHistory: Shift[];
  activeShift?: Shift | null;
  outlets: Outlet[];
  activeOutlet?: Outlet;
  emoneyList?: EMoney[];
  users?: PosUser[];
  currentUser?: PosUser | null;
  activityLogs?: UserActivityLog[];
  onRefreshLogs?: () => void;
  onClearLogs?: () => void;
  reportTab?: ReportTab;
  onReportTabChange?: (tab: ReportTab) => void;
  onDeleteTransaction?: (
    txId: string,
    password: string,
    reason: string
  ) => void | Promise<void>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions: allTransactions,
  shiftHistory: allShiftHistory,
  activeShift = null,
  outlets: allOutlets,
  activeOutlet,
  emoneyList = [],
  users: allUsers = [],
  currentUser = null,
  activityLogs,
  onRefreshLogs,
  onClearLogs,
  reportTab: controlledReportTab,
  onReportTabChange,
  onDeleteTransaction,
}) => {
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('ALL');
  const [internalReportTab, setInternalReportTab] = useState<ReportTab>('closing');
  const activeReportTab = controlledReportTab ?? internalReportTab;
  const selectReportTab = (tab: ReportTab) => {
    if (controlledReportTab === undefined) {
      setInternalReportTab(tab);
    }
    onReportTabChange?.(tab);
  };

  const activeReportTabMeta =
    REPORT_TABS.find((tab) => tab.id === activeReportTab) ?? REPORT_TABS[0];
  const ActiveReportIcon = activeReportTabMeta.icon;

  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('ALL');
  const [spvSearchTerm, setSpvSearchTerm] = useState<string>('');
  const [spvOutletFilter, setSpvOutletFilter] = useState<string>('ALL');
  const [spvCashierFilter, setSpvCashierFilter] = useState<string>('ALL');
  const [spvShiftFilter, setSpvShiftFilter] = useState<string>('ALL');
  const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);

  const handleRequestEdit = () => {
    playBeep('error');
    alert(
      'Koreksi/edit transaksi belum didukung oleh server.\n\n' +
        'Silakan void transaksi yang salah, lalu buat transaksi baru agar stok, poin, dan rekap shift tetap konsisten.'
    );
  };

  // Batasi data laporan pada outlet yang berhak diakses user (fail-closed)
  const outlets = useMemo(
    () => getPermittedOutlets(currentUser, allOutlets),
    [currentUser, allOutlets]
  );
  const permittedOutletIds = useMemo(() => new Set(outlets.map((o) => o.id)), [outlets]);
  const transactions = useMemo(
    () => allTransactions.filter((t) => permittedOutletIds.has(t.outletId)),
    [allTransactions, permittedOutletIds]
  );
  const shiftHistory = useMemo(() => {
    // ADMIN / akses semua outlet: tampilkan semua shift (termasuk data lama tanpa outletId).
    // Role terbatas: fail-closed, hanya shift dengan outlet yang diizinkan.
    if (isAdmin(currentUser) || currentUser?.canAccessAllOutlets) return allShiftHistory;
    return allShiftHistory.filter((s) => !!s.outletId && permittedOutletIds.has(s.outletId));
  }, [allShiftHistory, currentUser, permittedOutletIds]);
  const users = useMemo(() => allUsers, [allUsers]);
  const canVoidTransaction = canVoid(currentUser);

  // Map shift ID to friendly label
  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>();
    if (activeShift) {
      map.set(activeShift.id, activeShift);
    }
    shiftHistory.forEach((s) => {
      map.set(s.id, s);
    });
    return map;
  }, [activeShift, shiftHistory]);

  const getShiftLabel = (shiftId?: string) => {
    if (!shiftId) return 'Tanpa Shift';
    const s = shiftMap.get(shiftId);
    if (s) {
      return `Shift #${s.shiftNumber}`;
    }
    const match = shiftId.match(/shift[_-]?(\d+)/i);
    if (match) {
      return `Shift #${match[1]}`;
    }
    return `Shift ${shiftId.slice(0, 8)}`;
  };

  // SPV Shift options for filtering
  const spvShiftOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [];
    const seen = new Set<string>();

    if (activeShift) {
      options.push({
        id: activeShift.id,
        label: `[Aktif] Shift #${activeShift.shiftNumber} - ${activeShift.cashierName}`,
      });
      seen.add(activeShift.id);
      seen.add(String(activeShift.shiftNumber));
    }

    shiftHistory.forEach((s) => {
      if (!seen.has(s.id)) {
        options.push({
          id: s.id,
          label: `Shift #${s.shiftNumber} - ${s.cashierName}`,
        });
        seen.add(s.id);
        seen.add(String(s.shiftNumber));
      }
    });

    // Also collect any unique shiftId from transactions not already in options
    transactions.forEach((t) => {
      if (t.shiftId && !seen.has(t.shiftId)) {
        options.push({
          id: t.shiftId,
          label: getShiftLabel(t.shiftId),
        });
        seen.add(t.shiftId);
      }
    });

    return options;
  }, [activeShift, shiftHistory, transactions, shiftMap]);

  // SPV Cashier options
  const spvCashierOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.cashierName) set.add(t.cashierName);
    });
    users.forEach((u) => {
      if (u.name) set.add(u.name);
    });
    return Array.from(set).sort();
  }, [transactions, users]);

  // Date Filter States for Reports & Consolidated Matrix
  const [dateFilterPreset, setDateFilterPreset] = useState<'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showConsolidatedPrintModal, setShowConsolidatedPrintModal] = useState<boolean>(false);

  // Helper function to check if a transaction date falls into the filter range
  const isDateInRange = (dateStr: string) => {
    if (dateFilterPreset === 'ALL') return true;
    if (!dateStr) return false;

    const txDate = new Date(dateStr);
    if (isNaN(txDate.getTime())) return true;
    
    // YYYY-MM-DD format
    const year = txDate.getFullYear();
    const month = String(txDate.getMonth() + 1).padStart(2, '0');
    const day = String(txDate.getDate()).padStart(2, '0');
    const txDateStr = `${year}-${month}-${day}`;

    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
    const nowDay = String(now.getDate()).padStart(2, '0');
    const todayStr = `${nowYear}-${nowMonth}-${nowDay}`;

    if (dateFilterPreset === 'TODAY') {
      return txDateStr === todayStr;
    }
    if (dateFilterPreset === '7DAYS') {
      const past = new Date(now);
      past.setDate(now.getDate() - 7);
      const pastYear = past.getFullYear();
      const pastMonth = String(past.getMonth() + 1).padStart(2, '0');
      const pastDay = String(past.getDate()).padStart(2, '0');
      const pastStr = `${pastYear}-${pastMonth}-${pastDay}`;
      return txDateStr >= pastStr && txDateStr <= todayStr;
    }
    if (dateFilterPreset === 'THIS_MONTH') {
      return txDateStr.startsWith(`${nowYear}-${nowMonth}`);
    }
    if (dateFilterPreset === 'LAST_MONTH') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmYear = lastMonthDate.getFullYear();
      const lmMonth = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
      return txDateStr.startsWith(`${lmYear}-${lmMonth}`);
    }
    if (dateFilterPreset === 'CUSTOM') {
      if (startDate && txDateStr < startDate) return false;
      if (endDate && txDateStr > endDate) return false;
      return true;
    }
    return true;
  };

  const getPeriodLabel = () => {
    if (dateFilterPreset === 'ALL') return 'Semua Waktu (All Time)';
    if (dateFilterPreset === 'TODAY') return `Hari Ini (${new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' })})`;
    if (dateFilterPreset === '7DAYS') return '7 Hari Terakhir';
    if (dateFilterPreset === 'THIS_MONTH') return `Bulan Ini (${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`;
    if (dateFilterPreset === 'LAST_MONTH') return 'Bulan Lalu';
    if (dateFilterPreset === 'CUSTOM') {
      if (startDate && endDate) return `${startDate} s/d ${endDate}`;
      if (startDate) return `Mulai ${startDate}`;
      if (endDate) return `Sampai ${endDate}`;
      return 'Kustom Tanggal';
    }
    return 'Semua Waktu';
  };

  // Transactions filtered by selected date range
  const dateFilteredTransactions = useMemo(() => {
    return transactions.filter((t) => isDateInRange(t.date));
  }, [transactions, dateFilterPreset, startDate, endDate]);

  // Filter transactions based on selected outlet AND date
  const filteredTransactions = useMemo(() => {
    return dateFilteredTransactions.filter((t) => {
      if (selectedOutletFilter === 'ALL') return true;
      return t.outletId === selectedOutletFilter;
    });
  }, [dateFilteredTransactions, selectedOutletFilter]);

  // SPV Tab Transactions with specific filters (Outlet, Cashier, Shift, Search)
  const spvFilteredTransactions = useMemo(() => {
    return dateFilteredTransactions.filter((t) => {
      // 1. Filter Cabang SPV
      const targetOutlet = spvOutletFilter !== 'ALL' ? spvOutletFilter : selectedOutletFilter;
      if (targetOutlet !== 'ALL' && t.outletId !== targetOutlet) {
        return false;
      }
      // 2. Filter Kasir SPV
      if (spvCashierFilter !== 'ALL' && t.cashierName !== spvCashierFilter) {
        return false;
      }
      // 3. Filter Shift SPV
      if (spvShiftFilter !== 'ALL') {
        const matchesId = t.shiftId === spvShiftFilter;
        const shiftObj = shiftMap.get(spvShiftFilter);
        const matchesNumber = shiftObj && (t.shiftId === `shift-${shiftObj.shiftNumber}` || t.shiftId === String(shiftObj.shiftNumber));
        if (!matchesId && !matchesNumber) {
          return false;
        }
      }
      // 4. Search Term
      if (spvSearchTerm) {
        const term = spvSearchTerm.toLowerCase();
        const matches =
          t.invoiceNo.toLowerCase().includes(term) ||
          t.customerName.toLowerCase().includes(term) ||
          t.cashierName.toLowerCase().includes(term) ||
          (t.outletName && t.outletName.toLowerCase().includes(term)) ||
          t.items.some((i) => i.product.name.toLowerCase().includes(term));
        if (!matches) return false;
      }
      return true;
    });
  }, [dateFilteredTransactions, spvOutletFilter, selectedOutletFilter, spvCashierFilter, spvShiftFilter, spvSearchTerm, shiftMap]);

  // Export SPV Transactions to Excel
  const handleExportSpvTransactionsToExcel = () => {
    try {
      if (spvFilteredTransactions.length === 0) {
        alert('Tidak ada transaksi yang cocok untuk diekspor ke Excel.');
        return;
      }

      const rows = spvFilteredTransactions.map((t, idx) => {
        const dateObj = new Date(t.date);
        const formattedDate = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : t.date;
        const formattedTime = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-';

        const itemsDetail = t.items
          .map((i) => `${i.product.name} (${i.qty}x)`)
          .join('; ');

        const paymentMethods = t.payments
          .map((p) => {
            if (p.method === 'QRIS' && p.emoneyName) {
              return `QRIS (${p.emoneyName})`;
            }
            return p.method;
          })
          .join(', ');

        return {
          'No': idx + 1,
          'No. Nota': t.invoiceNo,
          'Tanggal': formattedDate,
          'Jam': formattedTime,
          'Outlet': t.outletName || 'Cabang Utama',
          'Kasir': t.cashierName,
          'Shift': getShiftLabel(t.shiftId),
          'Pelanggan': t.customerName || 'Pelanggan Umum',
          'Item Belanja': itemsDetail,
          'Jumlah Item': t.totalQty,
          'Metode Bayar': paymentMethods || 'TUNAI',
          'Diskon (Rp)': t.discountTotal || 0,
          'Grand Total (Rp)': t.grandTotal,
          'Status': t.status,
          'Keterangan': t.notes || '-',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      ws['!cols'] = [
        { wch: 5 },  // No
        { wch: 18 }, // No. Nota
        { wch: 14 }, // Tanggal
        { wch: 10 }, // Jam
        { wch: 22 }, // Outlet
        { wch: 16 }, // Kasir
        { wch: 14 }, // Shift
        { wch: 18 }, // Pelanggan
        { wch: 45 }, // Item Belanja
        { wch: 12 }, // Jumlah Item
        { wch: 18 }, // Metode Bayar
        { wch: 14 }, // Diskon (Rp)
        { wch: 16 }, // Grand Total (Rp)
        { wch: 10 }, // Status
        { wch: 25 }, // Keterangan
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transaksi_SPV');
      const filename = `transaksi_kasir_spv_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      playBeep('success');
    } catch (err) {
      console.error('Export Excel error:', err);
      alert('Gagal mengekspor data transaksi ke Excel.');
    }
  };

  // Consolidated Metrics
  const totalOmset = filteredTransactions.reduce((sum, t) => sum + t.grandTotal, 0);
  const totalItemsSold = filteredTransactions.reduce((sum, t) => sum + t.totalQty, 0);
  const totalTransactionsCount = filteredTransactions.length;
  const averageBasket = totalTransactionsCount > 0 ? Math.round(totalOmset / totalTransactionsCount) : 0;

  // Multi-Outlet Comparative Data (calculated from dateFilteredTransactions)
  const outletPerformance = useMemo(() => {
    const globalTotalOmset = dateFilteredTransactions.reduce((sum, t) => sum + t.grandTotal, 0);

    return outlets.map((outlet) => {
      const txs = dateFilteredTransactions.filter((t) => t.outletId === outlet.id);
      const omset = txs.reduce((sum, t) => sum + t.grandTotal, 0);
      const totalQty = txs.reduce((sum, t) => sum + t.totalQty, 0);
      const cashSales = txs.reduce((sum, t) => {
        const cashPay = t.payments.find((p) => p.method === 'TUNAI');
        return sum + (cashPay ? cashPay.amount - t.changeAmount : 0);
      }, 0);
      const nonCashSales = omset - cashSales;
      
      // Profit estimation (around 22% margin)
      const estimatedProfit = Math.round(omset * 0.22);
      const contributionPercent = globalTotalOmset > 0 ? ((omset / globalTotalOmset) * 100).toFixed(1) : '0';

      // QRIS breakdown for this outlet
      let outletQRISTotal = 0;
      const outletEMoneyBreakdown: Record<string, number> = {};

      txs.forEach((t) => {
        t.payments.forEach((p) => {
          if (p.method === 'QRIS') {
            outletQRISTotal += p.amount;
            const emName = p.emoneyName || 'QRIS Standar';
            outletEMoneyBreakdown[emName] = (outletEMoneyBreakdown[emName] || 0) + p.amount;
          }
        });
      });

      return {
        outlet,
        transactionsCount: txs.length,
        totalQty,
        cashSales,
        nonCashSales,
        totalOmset: omset,
        contributionPercent: parseFloat(contributionPercent),
        estimatedProfit,
        averageOrder: txs.length > 0 ? Math.round(omset / txs.length) : 0,
        qrisTotal: outletQRISTotal,
        emoneyBreakdown: outletEMoneyBreakdown,
      };
    }).sort((a, b) => b.totalOmset - a.totalOmset);
  }, [outlets, dateFilteredTransactions]);

  const topPerformingOutlet = outletPerformance[0];

  // Global Payment Method Aggregation
  const paymentBreakdown: { [method: string]: number } = {
    TUNAI: 0,
    QRIS: 0,
    DEBIT: 0,
    KREDIT: 0,
    TRANSFER: 0,
    PIUTANG: 0,
  };

  filteredTransactions.forEach((t) => {
    t.payments.forEach((p) => {
      paymentBreakdown[p.method] = (paymentBreakdown[p.method] || 0) + p.amount;
    });
  });

  // --------------------------------------------------------------------------
  // QRIS & E-MONEY SEPARATION CALCULATIONS
  // --------------------------------------------------------------------------
  // Group all QRIS transactions by their specific e-money name
  interface EMoneyStat {
    name: string;
    code: string;
    amount: number;
    count: number;
    provider: string;
    accountNumber: string;
    mdrFeePercent: number;
    color: string;
    mdrAmount: number;
    netSettlement: number;
    avgAmount: number;
    percentOfQRIS: number;
    percentOfTotal: number;
  }

  const emoneyMap: Record<string, { amount: number; count: number }> = {};

  filteredTransactions.forEach((t) => {
    t.payments.forEach((p) => {
      if (p.method === 'QRIS') {
        const key = p.emoneyName ? p.emoneyName.trim() : 'QRIS Standar';
        if (!emoneyMap[key]) {
          emoneyMap[key] = { amount: 0, count: 0 };
        }
        emoneyMap[key].amount += p.amount;
        emoneyMap[key].count += 1;
      }
    });
  });

  // Helper to find configured metadata from Master E-Money
  const getEMoneyMeta = (name: string) => {
    const found = emoneyList.find(
      (em) => em.name.toLowerCase() === name.toLowerCase() || em.code.toLowerCase() === name.toLowerCase()
    );
    if (found) return found;

    // Fallbacks for standard Indonesian providers
    const lower = name.toLowerCase();
    if (lower.includes('ovo')) {
      return {
        code: 'OVO',
        name: 'OVO',
        provider: 'PT Visionet Internasional (Lippo Group)',
        accountNumber: 'MID-99999-OVO8821',
        mdrFeePercent: 0.7,
        color: '#4C3494',
        isActive: true,
      };
    }
    if (lower.includes('gopay')) {
      return {
        code: 'GOPAY',
        name: 'GoPay',
        provider: 'PT Dompet Anak Bangsa (GoTo Financial)',
        accountNumber: 'MID-99999-GPY7712',
        mdrFeePercent: 0.7,
        color: '#00AED6',
        isActive: true,
      };
    }
    if (lower.includes('shopee')) {
      return {
        code: 'SHOPEE',
        name: 'ShopeePay',
        provider: 'PT AirPay International Indonesia (Sea Group)',
        accountNumber: 'MID-99999-SHP5543',
        mdrFeePercent: 0.7,
        color: '#EE4D2D',
        isActive: true,
      };
    }
    if (lower.includes('dana')) {
      return {
        code: 'DANA',
        name: 'DANA',
        provider: 'PT Espay Debit Indonesia Koe',
        accountNumber: 'MID-99999-DNA3319',
        mdrFeePercent: 0.7,
        color: '#118EEA',
        isActive: true,
      };
    }
    if (lower.includes('linkaja')) {
      return {
        code: 'LINKAJA',
        name: 'LinkAja',
        provider: 'PT Fintek Karya Nusantara (BUMN/Telkomsel)',
        accountNumber: 'MID-99999-LKA1184',
        mdrFeePercent: 0.7,
        color: '#ED1C24',
        isActive: true,
      };
    }
    return {
      code: 'QRIS',
      name: name,
      provider: 'National QRIS Switching (Bank Indonesia / ASPI)',
      accountNumber: 'NMID-ID1020009999901',
      mdrFeePercent: 0.7,
      color: '#0284c7',
      isActive: true,
    };
  };

  const totalQRISAmount = paymentBreakdown.QRIS || 0;
  const totalQRISCount = Object.values(emoneyMap).reduce((sum, item) => sum + item.count, 0);

  const emoneyStats: EMoneyStat[] = Object.entries(emoneyMap).map(([name, data]) => {
    const meta = getEMoneyMeta(name);
    const mdrFeePercent = meta.mdrFeePercent ?? 0.7;
    const mdrAmount = Math.round(data.amount * (mdrFeePercent / 100));
    const netSettlement = data.amount - mdrAmount;
    const avgAmount = data.count > 0 ? Math.round(data.amount / data.count) : 0;
    const percentOfQRIS = totalQRISAmount > 0 ? parseFloat(((data.amount / totalQRISAmount) * 100).toFixed(1)) : 0;
    const percentOfTotal = totalOmset > 0 ? parseFloat(((data.amount / totalOmset) * 100).toFixed(1)) : 0;

    return {
      name,
      code: meta.code || name.toUpperCase(),
      amount: data.amount,
      count: data.count,
      provider: meta.provider || 'Penyelenggara Jasa Pembayaran',
      accountNumber: meta.accountNumber || '-',
      mdrFeePercent,
      color: meta.color || '#3b82f6',
      mdrAmount,
      netSettlement,
      avgAmount,
      percentOfQRIS,
      percentOfTotal,
    };
  }).sort((a, b) => b.amount - a.amount);

  const totalQRISMDR = emoneyStats.reduce((sum, s) => sum + s.mdrAmount, 0);
  const totalQRISNet = totalQRISAmount - totalQRISMDR;
  const topEMoney = emoneyStats[0];

  // Filter transactions for table display in Payments tab
  const transactionsInPaymentTab = filteredTransactions.filter((t) => {
    if (selectedPaymentFilter === 'ALL') return true;
    if (selectedPaymentFilter === 'QRIS_ALL') {
      return t.payments.some((p) => p.method === 'QRIS');
    }
    if (selectedPaymentFilter.startsWith('EMONEY:')) {
      const targetEMoney = selectedPaymentFilter.replace('EMONEY:', '');
      return t.payments.some((p) => p.method === 'QRIS' && (p.emoneyName || 'QRIS Standar') === targetEMoney);
    }
    return t.payments.some((p) => p.method === selectedPaymentFilter);
  });

  // Top products
  const productAgg: { [name: string]: { qty: number; total: number } } = {};
  filteredTransactions.forEach((t) => {
    t.items.forEach((item) => {
      if (!productAgg[item.product.name]) {
        productAgg[item.product.name] = { qty: 0, total: 0 };
      }
      productAgg[item.product.name].qty += item.qty;
      productAgg[item.product.name].total += item.subtotal;
    });
  });

  const topProducts = Object.entries(productAgg)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 6);

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto p-4 sm:p-6 select-none">
      <div className="max-w-6xl w-full mx-auto space-y-5">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                MULTI-OUTLET KONSOLIDASI
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {outlets.length} Cabang Terhubung
              </span>
              <span
                title={activeReportTabMeta.label}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs"
              >
                <ActiveReportIcon className={`w-3 h-3 ${activeReportTabMeta.accent}`} />
                <span>{activeReportTabMeta.shortLabel}</span>
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Laporan Penjualan & Konsolidasi Outlet
            </h1>
            <p className="text-xs text-slate-500">
              Laporan performa multi-cabang, pemisahan transaksi QRIS per jenis E-Money (OVO, GoPay, ShopeePay), dan audit kasir.
            </p>
          </div>

          {/* Scope & Branch Filter */}
          <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
            {/* Outlet Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedOutletFilter}
                onChange={(e) => setSelectedOutletFilter(e.target.value)}
                className="pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="ALL">🏢 Semua Cabang (Konsolidasi Pusat)</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    🏪 {o.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                if (activeReportTab === 'consolidated') {
                  setShowConsolidatedPrintModal(true);
                } else {
                  window.print();
                }
              }}
              className="flex items-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Cetak Laporan"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Tab laporan dipindahkan ke submenu "Laporan" di sidebar */}

        {/* Executive KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {selectedOutletFilter === 'ALL' ? 'Total Omset Konsolidasi' : 'Omset Cabang Terpilih'}
              </span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono-numbers">
              {formatRupiah(totalOmset)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">
              Dari {totalTransactionsCount} struk transaksi kasir
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                Total QRIS & Dompet Digital
              </span>
              <QrCode className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="text-xl font-extrabold text-cyan-700 font-mono-numbers">
              {formatRupiah(totalQRISAmount)}
            </div>
            <div className="text-[11px] text-cyan-700 font-medium mt-1">
              {totalOmset > 0 ? ((totalQRISAmount / totalOmset) * 100).toFixed(1) : 0}% omset ({totalQRISCount} nota)
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                Top E-Money Terbanyak
              </span>
              <Smartphone className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-base font-bold text-slate-900 truncate flex items-center gap-1.5">
              {topEMoney ? (
                <>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: topEMoney.color }}
                  />
                  <span>{topEMoney.name}</span>
                </>
              ) : (
                'Belum Ada Transaksi'
              )}
            </div>
            <div className="text-[11px] text-purple-700 font-medium mt-1">
              {topEMoney ? `${formatRupiah(topEMoney.amount)} (${topEMoney.percentOfQRIS}% QRIS)` : '-'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                Net Settlement QRIS Bersih
              </span>
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl font-extrabold text-indigo-700 font-mono-numbers">
              {formatRupiah(totalQRISNet)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Biaya MDR: -{formatRupiah(totalQRISMDR)} (0.7% avg)
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB 0: LAPORAN TUTUP KASIR & BERITA ACARA SERAH TERIMA            */}
        {/* ================================================================= */}
        {activeReportTab === 'closing' && (
          <ClosingShiftReportView
            transactions={filteredTransactions}
            activeShift={activeShift}
            shiftHistory={shiftHistory}
            outlets={outlets}
            selectedOutletFilter={selectedOutletFilter}
            emoneyList={emoneyList}
            users={users}
            currentUser={currentUser}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 0.5: DAFTAR TRANSAKSI KASIR, KOREKSI & VOID (KHUSUS SPV)      */}
        {/* ================================================================= */}
        {activeReportTab === 'transactions' && (
          <div className="space-y-5">
            {/* SPV Control Banner */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>Pusat Otorisasi & Koreksi Transaksi Kasir (SPV)</span>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        Supervisor Override
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Supervisor / Admin dapat meninjau seluruh transaksi kasir, mengoreksi item belanja/pembayaran, atau membatalkan nota transaksi yang salah.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
                  <div className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-2 shadow-2xs">
                    <span>Hasil Filter:</span>
                    <span className="text-amber-700 font-extrabold">{spvFilteredTransactions.length}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-600 font-semibold">{filteredTransactions.length} Transaksi</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportSpvTransactionsToExcel}
                    className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    title="Export daftar transaksi yang difilter ke file Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Export ke Excel</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar: Cabang, Kasir, Shift & Kata Kunci */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                {/* Baris 1: Pencarian Cepat Teks */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={spvSearchTerm}
                    onChange={(e) => setSpvSearchTerm(e.target.value)}
                    placeholder="Pencarian cepat: Ketik No. Nota, Kasir, Nama Pelanggan, atau Nama Produk..."
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono shadow-2xs"
                  />
                  {spvSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setSpvSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title="Hapus pencarian"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Baris 2: 3 Kolom Filter (Cabang, Kasir, Shift) & Tombol Reset */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs items-end">
                  {/* Filter 1: Cabang / Outlet */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5 text-xs">
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      <span>Filter Cabang:</span>
                    </label>
                    <select
                      value={spvOutletFilter}
                      onChange={(e) => setSpvOutletFilter(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                    >
                      <option value="ALL">🏢 Semua Cabang</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} {o.isMall ? '(Mall)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter 2: Kasir */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5 text-xs">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Filter Kasir:</span>
                    </label>
                    <select
                      value={spvCashierFilter}
                      onChange={(e) => setSpvCashierFilter(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                    >
                      <option value="ALL">👤 Semua Kasir</option>
                      {spvCashierOptions.map((cashier) => (
                        <option key={cashier} value={cashier}>
                          {cashier}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter 3: Shift */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5 text-xs">
                      <Coins className="w-3.5 h-3.5 text-purple-600" />
                      <span>Filter Shift:</span>
                    </label>
                    <select
                      value={spvShiftFilter}
                      onChange={(e) => setSpvShiftFilter(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                    >
                      <option value="ALL">⏱️ Semua Shift</option>
                      {spvShiftOptions.map((shiftOpt) => (
                        <option key={shiftOpt.id} value={shiftOpt.id}>
                          {shiftOpt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tombol Reset Filter */}
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setSpvOutletFilter('ALL');
                        setSpvCashierFilter('ALL');
                        setSpvShiftFilter('ALL');
                        setSpvSearchTerm('');
                      }}
                      disabled={spvOutletFilter === 'ALL' && spvCashierFilter === 'ALL' && spvShiftFilter === 'ALL' && !spvSearchTerm}
                      className={`w-full h-10 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl transition-colors border ${
                        spvOutletFilter !== 'ALL' || spvCashierFilter !== 'ALL' || spvShiftFilter !== 'ALL' || spvSearchTerm
                          ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 cursor-pointer shadow-2xs'
                          : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed opacity-60'
                      }`}
                      title="Reset semua filter pencarian"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Filter</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SPV Transactions Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">No. Nota / Jam</th>
                      <th className="py-2.5 px-3">Outlet Cabang</th>
                      <th className="py-2.5 px-3">Kasir & Shift</th>
                      <th className="py-2.5 px-3">Pelanggan</th>
                      <th className="py-2.5 px-3">Item Belanja</th>
                      <th className="py-2.5 px-3">Metode Bayar</th>
                      <th className="py-2.5 px-3 text-right">Grand Total</th>
                      <th className="py-2.5 px-3 text-center">Aksi Supervisor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {spvFilteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="font-bold text-slate-700 text-sm">Tidak ada transaksi yang cocok</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Tidak ditemukan transaksi yang sesuai dengan filter Cabang, Kasir, Shift, atau kata kunci pencarian.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSpvOutletFilter('ALL');
                              setSpvCashierFilter('ALL');
                              setSpvShiftFilter('ALL');
                              setSpvSearchTerm('');
                            }}
                            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Kembalikan Semua Filter</span>
                          </button>
                        </td>
                      </tr>
                    ) : (
                      spvFilteredTransactions.map((t) => {
                        const dateFormatted = new Date(t.date).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            {/* Invoice No & Date */}
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-slate-900 block">
                                {t.invoiceNo}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {dateFormatted}
                              </span>
                            </td>

                            {/* Outlet */}
                            <td className="py-2.5 px-3 font-medium text-slate-700">
                              {t.outletName
                                ? t.outletName.replace(/^(Toko Berkah|DEL USAHA RASA GRUP)\s+/, '') || t.outletName
                                : 'Cabang Utama'}
                            </td>

                            {/* Cashier & Shift */}
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 block">
                                {t.cashierName}
                              </span>
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                {getShiftLabel(t.shiftId)}
                              </span>
                            </td>

                            {/* Customer */}
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 block">
                                {t.customerName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {t.customerTier}
                              </span>
                            </td>

                            {/* Items preview */}
                            <td className="py-2.5 px-3 max-w-xs">
                              <div className="truncate text-slate-700">
                                {t.items.map((i) => `${i.product.name} (${i.qty})`).join(', ')}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {t.items.length} jenis · {t.totalQty} pcs
                              </span>
                            </td>

                            {/* Payment Method Badges */}
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1">
                                {t.payments.map((p, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200"
                                  >
                                    <span>{p.method}</span>
                                    {p.emoneyName && <span className="text-cyan-700">({p.emoneyName})</span>}
                                    {p.bankName && <span className="text-blue-700">({p.bankName})</span>}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Grand Total */}
                            <td className="py-2.5 px-3 text-right font-mono-numbers font-extrabold text-blue-700">
                              {formatRupiah(t.grandTotal)}
                            </td>

                            {/* Supervisor Actions */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {canVoidTransaction ? (
                                  <>
                                <button
                                  type="button"
                                  onClick={handleRequestEdit}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                  title="Koreksi Transaksi (Edit Item, Qty, Metode Bayar)"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Koreksi</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setVoidingTx(t)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                  title="Hapus / Void Transaksi Salah"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Hapus</span>
                                </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold" title="Akun Anda tidak berwenang mengoreksi / void transaksi">
                                    Tidak berwenang
                                  </span>
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

        {/* ================================================================= */}
        {/* TAB 1: RINCIAN PEMBAYARAN & PEMISAHAN QRIS BERDASARKAN E-MONEY    */}
        {/* ================================================================= */}
        {activeReportTab === 'payments' && (
          <div className="space-y-5">
            {/* FEATURE BANNER: PEMISAHAN QRIS BERDASARKAN JENIS E-MONEY */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Pemisahan Transaksi QRIS Berdasarkan Jenis E-Money</span>
                      <span className="bg-cyan-100 text-cyan-800 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        {emoneyStats.length} Provider Terdeteksi
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Rincian omset spesifik untuk <strong>OVO</strong>, <strong>GoPay</strong>, <strong>ShopeePay</strong>, <strong>DANA</strong>, dan dompet digital lainnya.
                    </p>
                  </div>
                </div>

                <div className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
                  Total QRIS: <span className="text-blue-700 font-extrabold">{formatRupiah(totalQRISAmount)}</span>
                </div>
              </div>

              {/* Multi-Color Share Bar for E-Money */}
              {totalQRISAmount > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                    <span>Proporsi Pangsa Pasar Dompet Digital (Market Share E-Wallet):</span>
                    <span className="font-mono">{totalQRISCount} Transaksi Scan QRIS</span>
                  </div>
                  
                  {/* Visual Segmented Bar */}
                  <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 p-0.5 border border-slate-200">
                    {emoneyStats.map((em) => (
                      <div
                        key={em.name}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all relative group cursor-pointer"
                        style={{
                          width: `${Math.max(em.percentOfQRIS, 2)}%`,
                          backgroundColor: em.color,
                        }}
                        title={`${em.name}: ${formatRupiah(em.amount)} (${em.percentOfQRIS}%)`}
                      />
                    ))}
                  </div>

                  {/* Legend Strip */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                    {emoneyStats.map((em) => (
                      <div key={em.name} className="flex items-center gap-1.5 font-medium text-slate-700">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: em.color }}
                        />
                        <span className="font-bold">{em.name}</span>
                        <span className="text-slate-400 font-mono">({em.percentOfQRIS}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  Belum ada transaksi dengan metode pembayaran QRIS / E-Money.
                </div>
              )}

              {/* Cards Grid: Per Jenis E-Money (OVO, GoPay, ShopeePay, DANA, LinkAja) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                {emoneyStats.map((em) => (
                  <div
                    key={em.name}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3 relative overflow-hidden"
                  >
                    {/* Top colored indicator bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: em.color }}
                    />

                    {/* Header: Name & Provider */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: em.color }}
                        />
                        <div>
                          <span className="text-sm font-bold text-slate-900 block leading-tight">
                            {em.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium truncate block max-w-[190px]">
                            {em.provider}
                          </span>
                        </div>
                      </div>

                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded text-white shadow-2xs"
                        style={{ backgroundColor: em.color }}
                      >
                        {em.percentOfQRIS}% QRIS
                      </span>
                    </div>

                    {/* Financial Figures */}
                    <div className="space-y-1 py-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                        Volume Transaksi (Bruto):
                      </span>
                      <div className="text-lg font-extrabold text-slate-900 font-mono-numbers">
                        {formatRupiah(em.amount)}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>Frekuensi: <strong>{em.count} Nota</strong></span>
                        <span>Rata-rata: <strong>{formatRupiah(em.avgAmount)}</strong></span>
                      </div>
                    </div>

                    {/* Settlement & MDR Breakdown */}
                    <div className="pt-2 border-t border-slate-200/80 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Biaya MDR ({em.mdrFeePercent}%):</span>
                        <span className="font-mono text-rose-600 font-semibold">
                          -{formatRupiah(em.mdrAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 pt-0.5 border-t border-dashed border-slate-200">
                        <span className="text-emerald-800">Net Settlement Toko:</span>
                        <span className="font-mono text-emerald-700">
                          {formatRupiah(em.netSettlement)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detailed Settlement & Reconciliation Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tabel Rekonsiliasi & Settlement Merchant E-Money</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Sinkron dengan MDR Bank Indonesia (0.7%)
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Jenis E-Money</th>
                        <th className="py-2.5 px-3">Penyelenggara Jasa (PJP)</th>
                        <th className="py-2.5 px-3 text-center">Qty Struk</th>
                        <th className="py-2.5 px-3 text-right">Nominal Bruto</th>
                        <th className="py-2.5 px-3 text-center">Tarif MDR</th>
                        <th className="py-2.5 px-3 text-right">Potongan MDR</th>
                        <th className="py-2.5 px-3 text-right text-emerald-700 font-bold">Net Cair Toko</th>
                        <th className="py-2.5 px-3 text-center">Porsi %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {emoneyStats.map((em) => (
                        <tr key={em.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: em.color }}
                              />
                              <span className="font-bold text-slate-900">{em.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {em.provider}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono-numbers">
                            {em.count}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers font-semibold text-slate-900">
                            {formatRupiah(em.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                            {em.mdrFeePercent}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers text-rose-600 text-[11px]">
                            -{formatRupiah(em.mdrAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-emerald-700">
                            {formatRupiah(em.netSettlement)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] font-semibold text-blue-600">
                            {em.percentOfQRIS}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-bold border-t border-slate-800 text-xs">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider text-[11px]">
                          TOTAL SETTLEMENT QRIS & E-MONEY
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-numbers">
                          {totalQRISCount} Nota
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-numbers text-amber-300">
                          {formatRupiah(totalQRISAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-300">
                          0.7% Avg
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-numbers text-rose-300">
                          -{formatRupiah(totalQRISMDR)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-numbers text-emerald-300 font-extrabold">
                          {formatRupiah(totalQRISNet)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-cyan-300">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* RINGKASAN SEMUA METODE PEMBAYARAN KASIR */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Ringkasan Keseluruhan Metode Pembayaran Toko</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                {Object.entries(paymentBreakdown).map(([method, amount]) => {
                  const percent = totalOmset > 0 ? ((amount / totalOmset) * 100).toFixed(1) : '0';
                  const isQRIS = method === 'QRIS';

                  return (
                    <div
                      key={method}
                      className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                        isQRIS
                          ? 'bg-cyan-50/60 border-cyan-200 text-cyan-900'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-1.5">
                          {method === 'TUNAI' && '💵 Tunai (Cash)'}
                          {method === 'QRIS' && '📱 QRIS (E-Money & Bank)'}
                          {method === 'DEBIT' && '💳 Kartu Debit (EDC)'}
                          {method === 'KREDIT' && '💳 Kartu Kredit'}
                          {method === 'TRANSFER' && '🏦 Transfer Bank'}
                          {method === 'PIUTANG' && '⏳ Piutang / Tempo'}
                        </span>
                        <span className="font-mono-numbers font-bold text-slate-900 text-sm">
                          {formatRupiah(amount)}
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isQRIS ? 'bg-cyan-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>Porsi: {percent}% omset</span>
                        {isQRIS && (
                          <span className="text-cyan-700 font-bold">
                            {emoneyStats.length} Dompet Digital
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TABEL TRANSAKSI KASIR DENGAN FILTER SPESIFIK E-MONEY */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-600" />
                    <span>Daftar Transaksi Kasir Berdasarkan Kanal Pembayaran</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filter transaksi kasir spesifik untuk audit QRIS (OVO, GoPay, ShopeePay) atau tunai.
                  </p>
                </div>

                {/* Filter Selector Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setSelectedPaymentFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      selectedPaymentFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Semua ({filteredTransactions.length})
                  </button>

                  <button
                    onClick={() => setSelectedPaymentFilter('QRIS_ALL')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      selectedPaymentFilter === 'QRIS_ALL'
                        ? 'bg-cyan-600 text-white shadow-2xs'
                        : 'bg-white text-cyan-700 border border-cyan-200 hover:bg-cyan-50'
                    }`}
                  >
                    Semua QRIS ({totalQRISCount})
                  </button>

                  {/* Individual E-Money Filters */}
                  {emoneyStats.map((em) => (
                    <button
                      key={em.name}
                      onClick={() => setSelectedPaymentFilter(`EMONEY:${em.name}`)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                        selectedPaymentFilter === `EMONEY:${em.name}`
                          ? 'text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                      style={{
                        backgroundColor: selectedPaymentFilter === `EMONEY:${em.name}` ? em.color : undefined,
                        borderColor: selectedPaymentFilter === `EMONEY:${em.name}` ? em.color : undefined,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: selectedPaymentFilter === `EMONEY:${em.name}` ? '#ffffff' : em.color,
                        }}
                      />
                      <span>{em.name}</span>
                      <span className="font-mono text-[10px] opacity-75">({em.count})</span>
                    </button>
                  ))}

                  <button
                    onClick={() => setSelectedPaymentFilter('TUNAI')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      selectedPaymentFilter === 'TUNAI'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    Tunai
                  </button>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">No. Nota / Waktu</th>
                      <th className="py-2.5 px-3">Outlet</th>
                      <th className="py-2.5 px-3">Kasir</th>
                      <th className="py-2.5 px-3">Pelanggan</th>
                      <th className="py-2.5 px-3">Metode & Kanal E-Money</th>
                      <th className="py-2.5 px-3 text-right">Total Transaksi</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {transactionsInPaymentTab.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Tidak ditemukan transaksi dengan filter pembayaran ini.
                        </td>
                      </tr>
                    ) : (
                      transactionsInPaymentTab.map((t) => {
                        const dateFormatted = new Date(t.date).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            {/* Invoice No & Date */}
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-slate-900 block">
                                {t.invoiceNo}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {dateFormatted}
                              </span>
                            </td>

                            {/* Outlet */}
                            <td className="py-2.5 px-3 font-medium text-slate-700">
                              {t.outletName
                                ? t.outletName.replace(/^(Toko Berkah|DEL USAHA RASA GRUP)\s+/, '') || t.outletName
                                : 'Cabang Utama'}
                            </td>

                            {/* Cashier */}
                            <td className="py-2.5 px-3 text-slate-600">
                              {t.cashierName}
                            </td>

                            {/* Customer */}
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 block">
                                {t.customerName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {t.customerTier}
                              </span>
                            </td>

                            {/* Payment Method Badges with E-Money separation */}
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1">
                                {t.payments.map((p, pIdx) => {
                                  if (p.method === 'QRIS') {
                                    const emName = p.emoneyName || 'QRIS Dinamis';
                                    const meta = getEMoneyMeta(emName);
                                    return (
                                      <span
                                        key={pIdx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                                        style={{ backgroundColor: meta.color }}
                                      >
                                        <QrCode className="w-3 h-3" />
                                        <span>QRIS ({emName})</span>
                                      </span>
                                    );
                                  }

                                  return (
                                    <span
                                      key={pIdx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200"
                                    >
                                      <span>{p.method}</span>
                                      {p.bankName && <span className="font-mono font-bold">({p.bankName})</span>}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Total Amount */}
                            <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-slate-900">
                              {formatRupiah(t.grandTotal)}
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                {t.status}
                              </span>
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

        {/* ================================================================= */}
        {/* TAB 2: MATRIKS KONSOLIDASI ANTAR CABANG                           */}
        {/* ================================================================= */}
        {activeReportTab === 'consolidated' && (
          <div className="space-y-5">
            {/* DATE FILTER & EXECUTIVE ACTION BAR */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Filter Tanggal & Periode Konsolidasi
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {getPeriodLabel()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pilih rentang tanggal untuk menghitung omset, kontribusi, dan rekap E-Money seluruh cabang.
                    </p>
                  </div>
                </div>

                {/* Print Report Button & Quick Actions */}
                <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
                  <button
                    onClick={() => setShowConsolidatedPrintModal(true)}
                    className="flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
                    title="Buka Dokumen Cetak Laporan Konsolidasi A4"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    <span>Cetak Laporan Konsolidasi</span>
                  </button>
                </div>
              </div>

              {/* Filter Preset Buttons & Custom Date Pickers */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'ALL', label: 'Semua Waktu' },
                    { id: 'TODAY', label: 'Hari Ini' },
                    { id: '7DAYS', label: '7 Hari Terakhir' },
                    { id: 'THIS_MONTH', label: 'Bulan Ini' },
                    { id: 'LAST_MONTH', label: 'Bulan Lalu' },
                    { id: 'CUSTOM', label: 'Kustom Tanggal' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setDateFilterPreset(preset.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        dateFilterPreset === preset.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Inputs */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Dari:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setDateFilterPreset('CUSTOM');
                      }}
                      className="bg-transparent text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Sampai:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDateFilterPreset('CUSTOM');
                      }}
                      className="bg-transparent text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>
                  {(dateFilterPreset !== 'ALL' || startDate || endDate) && (
                    <button
                      onClick={() => {
                        setDateFilterPreset('ALL');
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="flex items-center gap-1 py-1 px-2.5 text-[11px] font-semibold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      title="Reset Filter Tanggal"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status info row */}
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between pt-1 gap-2 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Menampilkan <strong>{dateFilteredTransactions.length} transaksi</strong> pada periode <strong>{getPeriodLabel()}</strong></span>
                </div>
                <span className="font-mono text-slate-600">
                  Total Omset Konsolidasi: <strong className="text-blue-700">{formatRupiah(dateFilteredTransactions.reduce((s, t) => s + t.grandTotal, 0))}</strong>
                </span>
              </div>
            </div>

            {/* Comparative Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Tabel Perbandingan Kinerja Seluruh Outlet (Consolidated Breakdown)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Analisis transaksi, penjualan tunai vs non-tunai, dan pangsa kontribusi setiap cabang.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                  Konsolidasi 100% Sinkron
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Outlet / Cabang</th>
                      <th className="py-3 px-3">Kota</th>
                      <th className="py-3 px-3 text-center">Transaksi</th>
                      <th className="py-3 px-3 text-center">Item Terjual</th>
                      <th className="py-3 px-3 text-right">Penjualan Tunai</th>
                      <th className="py-3 px-3 text-right">Non-Tunai (QRIS/EDC)</th>
                      <th className="py-3 px-3 text-right font-bold text-blue-700">Total Omset</th>
                      <th className="py-3 px-4 text-center w-36">Kontribusi %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {outletPerformance.map((row, idx) => (
                      <tr key={row.outlet.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Outlet Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{row.outlet.name}</span>
                                {row.outlet.isHQ && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                                    HQ
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {row.outlet.code} · {row.outlet.phone}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* City */}
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {row.outlet.city}
                        </td>

                        {/* Transactions Count */}
                        <td className="py-3 px-3 text-center font-mono-numbers font-semibold">
                          {row.transactionsCount} Nota
                        </td>

                        {/* Items Sold */}
                        <td className="py-3 px-3 text-center font-mono-numbers">
                          {row.totalQty} pcs
                        </td>

                        {/* Cash Sales */}
                        <td className="py-3 px-3 text-right font-mono-numbers text-slate-700">
                          {formatRupiah(row.cashSales)}
                        </td>

                        {/* Non Cash Sales */}
                        <td className="py-3 px-3 text-right font-mono-numbers text-indigo-700">
                          {formatRupiah(row.nonCashSales)}
                        </td>

                        {/* Grand Total */}
                        <td className="py-3 px-3 text-right font-mono-numbers font-extrabold text-blue-700 text-sm">
                          {formatRupiah(row.totalOmset)}
                        </td>

                        {/* Contribution Bar */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-mono font-bold text-slate-700">
                              <span>{row.contributionPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, row.contributionPercent)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary Footer Row */}
                  <tfoot className="bg-slate-900 text-white font-bold border-t border-slate-800">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 uppercase text-xs tracking-wider">
                        TOTAL KONSOLIDASI SELURUH CABANG
                      </td>
                      <td className="py-3 px-3 text-center font-mono-numbers text-xs">
                        {dateFilteredTransactions.length} Nota
                      </td>
                      <td className="py-3 px-3 text-center font-mono-numbers text-xs">
                        {dateFilteredTransactions.reduce((s, t) => s + t.totalQty, 0)} pcs
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers text-xs text-emerald-400">
                        {formatRupiah(
                          outletPerformance.reduce((sum, r) => sum + r.cashSales, 0)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers text-xs text-cyan-400">
                        {formatRupiah(
                          outletPerformance.reduce((sum, r) => sum + r.nonCashSales, 0)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers text-sm text-amber-400">
                        {formatRupiah(
                          dateFilteredTransactions.reduce((s, t) => s + t.grandTotal, 0)
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs text-emerald-400">
                        100.0%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* KOMPARASI ADOPSI QRIS & E-MONEY ANTAR CABANG */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-cyan-600" />
                    <span>Distribusi Penerimaan QRIS & E-Money per Cabang Outlet</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbandingan penetrasi transaksi GoPay, OVO, ShopeePay, dan QRIS di masing-masing lokasi toko.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Cabang Outlet</th>
                      <th className="py-2.5 px-3 text-right font-bold text-cyan-800">Total QRIS</th>
                      <th className="py-2.5 px-3 text-right">GoPay</th>
                      <th className="py-2.5 px-3 text-right">OVO</th>
                      <th className="py-2.5 px-3 text-right">ShopeePay</th>
                      <th className="py-2.5 px-3 text-right">DANA / Lainnya</th>
                      <th className="py-2.5 px-3 text-right text-rose-600">Est. Potongan MDR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {outletPerformance.map((row) => {
                      const gopayVal = row.emoneyBreakdown['GoPay'] || 0;
                      const ovoVal = row.emoneyBreakdown['OVO'] || 0;
                      const shopeeVal = row.emoneyBreakdown['ShopeePay'] || 0;
                      const otherVal = row.qrisTotal - (gopayVal + ovoVal + shopeeVal);
                      const mdrVal = Math.round(row.qrisTotal * 0.007);

                      return (
                        <tr key={row.outlet.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">{row.outlet.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{row.outlet.city}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers font-extrabold text-cyan-700">
                            {formatRupiah(row.qrisTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers">
                            {gopayVal > 0 ? (
                              <span className="text-cyan-600 font-semibold">{formatRupiah(gopayVal)}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers">
                            {ovoVal > 0 ? (
                              <span className="text-purple-600 font-semibold">{formatRupiah(ovoVal)}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers">
                            {shopeeVal > 0 ? (
                              <span className="text-orange-600 font-semibold">{formatRupiah(shopeeVal)}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-600">
                            {otherVal > 0 ? formatRupiah(otherVal) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers text-rose-600 text-[11px]">
                            {mdrVal > 0 ? `-${formatRupiah(mdrVal)}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visual Market Share Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-blue-600" />
                  <span>Pangsa Pasar Penjualan Antar Cabang (Market Share)</span>
                </h3>

                <div className="space-y-3 text-xs">
                  {outletPerformance.map((row) => (
                    <div key={row.outlet.id} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">{row.outlet.name}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900">{formatRupiah(row.totalOmset)}</span>
                          <span className="text-blue-600 font-bold w-12 text-right">
                            {row.contributionPercent}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all"
                          style={{ width: `${row.contributionPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-600" />
                    <span>Rata-Rata Nilai Belanja (AOV) per Cabang</span>
                  </h3>

                  <div className="divide-y divide-slate-100 text-xs">
                    {outletPerformance.map((row) => (
                      <div key={row.outlet.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">{row.outlet.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Kota: {row.outlet.city} · {row.transactionsCount} Nota
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono-numbers font-bold text-slate-900">
                            {formatRupiah(row.averageOrder)}
                          </div>
                          <div className="text-[10px] text-slate-400">per transaksi</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Data konsolidasi di-update secara realtime setiap kasir menyelesaikan transaksi.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: PRODUK TERLARIS                                            */}
        {/* ================================================================= */}
        {activeReportTab === 'products' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Produk Terlaris {selectedOutletFilter === 'ALL' ? 'Secara Konsolidasi Nasional' : 'di Cabang Ini'}</span>
            </h2>

            <div className="divide-y divide-slate-100 text-xs">
              {topProducts.map(([name, stat], idx) => (
                <div key={name} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs font-mono">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{name}</div>
                      <div className="text-[11px] text-slate-400">Volume Penjualan: {stat.qty} pcs</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono-numbers font-bold text-slate-900 text-sm">
                      {formatRupiah(stat.total)}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-medium">Omset Produk</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: SHIFT AUDIT                                                */}
        {/* ================================================================= */}
        {activeReportTab === 'shifts' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>Audit Penutupan Shift Kasir & Rekonsiliasi Kas</span>
            </h2>

            {shiftHistory.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Belum ada rekaman penutupan shift kasir.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Shift #</th>
                      <th className="py-2.5 px-3">Kasir</th>
                      <th className="py-2.5 px-3">Waktu Kerja</th>
                      <th className="py-2.5 px-3 text-right">Modal Awal</th>
                      <th className="py-2.5 px-3 text-right">Penjualan Tunai</th>
                      <th className="py-2.5 px-3 text-right">Kas Sistem</th>
                      <th className="py-2.5 px-3 text-right">Kas Fisik</th>
                      <th className="py-2.5 px-3 text-center">Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shiftHistory.map((s) => {
                      const diff = s.cashDifference || 0;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold">#{s.shiftNumber}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{s.cashierName}</td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 font-mono">
                            {new Date(s.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {s.endTime ? new Date(s.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers">{formatRupiah(s.initialCash)}</td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers text-emerald-700">
                            {formatRupiah(s.totalCashSales)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers">{formatRupiah(s.expectedCash)}</td>
                          <td className="py-2.5 px-3 text-right font-mono-numbers font-bold">
                            {s.actualCash !== undefined ? formatRupiah(s.actualCash) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono-numbers font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                diff === 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : diff > 0
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {diff === 0 ? 'PAS (0)' : diff > 0 ? `+${formatRupiah(diff)}` : formatRupiah(diff)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: LAPORAN TRAFFIC PENJUALAN (JAM, HARI, TANGGAL & KOMPARASI) */}
        {/* ================================================================= */}
        {activeReportTab === 'traffic' && (
          <TrafficReportView
            transactions={transactions}
            outlets={outlets}
            activeOutlet={activeOutlet}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 7: LOG AKTIVITAS USER (AUDIT TRAIL & RIWAYAT PENGGUNA)       */}
        {/* ================================================================= */}
        {activeReportTab === 'activity' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
            <UserActivityLogView
              logs={activityLogs || []}
              users={users}
              outlets={outlets}
              currentUser={currentUser}
              onRefreshLogs={onRefreshLogs}
              onClearLogs={onClearLogs}
            />
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* MODAL PRINT PREVIEW LAPORAN MATRIKS KONSOLIDASI ANTAR CABANG      */}
      {/* ================================================================= */}
      {showConsolidatedPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header Toolbar (No Print) */}
            <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Printer className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    Cetak Laporan Matriks Konsolidasi Seluruh Cabang
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    DOC-KONSOLIDASI/{new Date().toISOString().slice(0, 10).replace(/-/g, '')}/ALL · Periode: {getPeriodLabel()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Dokumen (Ctrl+P)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowConsolidatedPrintModal(false)}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Document Body (Print View A4 Ready) */}
            <div id="consolidated-matrix-printable" className="p-8 overflow-y-auto font-sans text-slate-900 space-y-6 printable-document bg-white">
              {/* Kop Surat Dokumen Konsolidasi */}
              <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                <h1 className="text-lg font-black tracking-wide uppercase">
                  DEL USAHA RASA GRUP INDONESIA
                </h1>
                <p className="text-xs font-semibold text-slate-700">
                  KANTOR PUSAT & MANAGEMENT MULTI-OUTLET NASIONAL
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Sistem POS Cloud Catat POS · ID Perusahaan: 99999 · Dokumen Resmi Konsolidasi Keuangan Antar Cabang
                </p>
                <div className="inline-block bg-slate-900 text-white font-bold text-xs px-3.5 py-1 rounded mt-2 uppercase tracking-widest font-mono">
                  LAPORAN MATRIKS KONSOLIDASI PENJUALAN ANTAR CABANG
                </div>
              </div>

              {/* Meta Dokumen Konsolidasi */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="space-y-1">
                  <div>Nomor Dokumen : <strong className="font-mono">DOC-KONSOLIDASI/{new Date().toISOString().slice(0, 10).replace(/-/g, '')}/ALL</strong></div>
                  <div>Periode Laporan : <strong>{getPeriodLabel()}</strong></div>
                  <div>Status Konsolidasi : <strong className="text-emerald-700">100% Sinkron Real-Time</strong></div>
                </div>
                <div className="space-y-1">
                  <div>Dicetak Oleh : <strong className="text-slate-900">{currentUser?.name || 'ADMINISTRATOR'} ({currentUser?.role || 'PUSAT'})</strong></div>
                  <div>Waktu Cetak : <span className="font-mono">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</span></div>
                  <div>Total Cabang : <strong>{outlets.length} Cabang Aktif Terkoneksi</strong></div>
                </div>
              </div>

              {/* Ringkasan Finansial Eksekutif Konsolidasi */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Omset Konsolidasi</div>
                  <div className="text-sm font-extrabold text-blue-700 font-mono-numbers mt-0.5">
                    {formatRupiah(dateFilteredTransactions.reduce((s, t) => s + t.grandTotal, 0))}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Transaksi</div>
                  <div className="text-sm font-extrabold text-slate-900 font-mono-numbers mt-0.5">
                    {dateFilteredTransactions.length} Nota
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Penjualan Tunai</div>
                  <div className="text-sm font-extrabold text-emerald-700 font-mono-numbers mt-0.5">
                    {formatRupiah(outletPerformance.reduce((s, r) => s + r.cashSales, 0))}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Non-Tunai & QRIS</div>
                  <div className="text-sm font-extrabold text-indigo-700 font-mono-numbers mt-0.5">
                    {formatRupiah(outletPerformance.reduce((s, r) => s + r.nonCashSales, 0))}
                  </div>
                </div>
              </div>

              {/* TABEL 1: Matriks Performa Penjualan Seluruh Cabang */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
                  <span>I. Matriks Perbandingan Kinerja Seluruh Outlet</span>
                  <span className="font-mono text-[11px] font-normal text-slate-500">{outlets.length} Cabang Terhubung</span>
                </h4>

                <table className="w-full text-left text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">No</th>
                      <th className="py-2 px-3">Nama Outlet / Cabang</th>
                      <th className="py-2 px-2.5">Kota</th>
                      <th className="py-2 px-2.5 text-center">Nota</th>
                      <th className="py-2 px-2.5 text-center">Item</th>
                      <th className="py-2 px-3 text-right">Penjualan Tunai</th>
                      <th className="py-2 px-3 text-right">Non-Tunai / QRIS</th>
                      <th className="py-2 px-3 text-right">Total Omset</th>
                      <th className="py-2 px-3 text-center">Kontribusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {outletPerformance.map((row, idx) => (
                      <tr key={row.outlet.id}>
                        <td className="py-2 px-2 text-center font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {row.outlet.name} {row.outlet.isHQ ? '(HQ)' : ''}
                        </td>
                        <td className="py-2 px-2.5 text-slate-600">{row.outlet.city}</td>
                        <td className="py-2 px-2.5 text-center font-mono">{row.transactionsCount}</td>
                        <td className="py-2 px-2.5 text-center font-mono">{row.totalQty}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatRupiah(row.cashSales)}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatRupiah(row.nonCashSales)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(row.totalOmset)}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{row.contributionPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 uppercase text-slate-900">
                        TOTAL KONSOLIDASI
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono">
                        {dateFilteredTransactions.length}
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono">
                        {dateFilteredTransactions.reduce((s, t) => s + t.totalQty, 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-800">
                        {formatRupiah(outletPerformance.reduce((s, r) => s + r.cashSales, 0))}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-indigo-800">
                        {formatRupiah(outletPerformance.reduce((s, r) => s + r.nonCashSales, 0))}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-blue-900">
                        {formatRupiah(dateFilteredTransactions.reduce((s, t) => s + t.grandTotal, 0))}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* TABEL 2: Rincian E-Money QRIS per Cabang */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
                  <span>II. Distribusi Penerimaan E-Money & QRIS per Cabang</span>
                  <span className="font-mono text-[11px] font-normal text-slate-500">MDR Standar BI 0.7%</span>
                </h4>

                <table className="w-full text-left text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3">Cabang Outlet</th>
                      <th className="py-2 px-3 text-right">Total QRIS</th>
                      <th className="py-2 px-2.5 text-right">GoPay</th>
                      <th className="py-2 px-2.5 text-right">OVO</th>
                      <th className="py-2 px-2.5 text-right">ShopeePay</th>
                      <th className="py-2 px-2.5 text-right">Lainnya</th>
                      <th className="py-2 px-3 text-right text-rose-700">Est. Fee MDR</th>
                      <th className="py-2 px-3 text-right text-emerald-800">Settlement Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {outletPerformance.map((row) => {
                      const gopayVal = row.emoneyBreakdown['GoPay'] || 0;
                      const ovoVal = row.emoneyBreakdown['OVO'] || 0;
                      const shopeeVal = row.emoneyBreakdown['ShopeePay'] || 0;
                      const otherVal = row.qrisTotal - (gopayVal + ovoVal + shopeeVal);
                      const mdrVal = Math.round(row.qrisTotal * 0.007);
                      const netSettlement = row.qrisTotal - mdrVal;

                      return (
                        <tr key={row.outlet.id}>
                          <td className="py-2 px-3 font-semibold text-slate-900">{row.outlet.name}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(row.qrisTotal)}</td>
                          <td className="py-2 px-2.5 text-right font-mono">{gopayVal > 0 ? formatRupiah(gopayVal) : '-'}</td>
                          <td className="py-2 px-2.5 text-right font-mono">{ovoVal > 0 ? formatRupiah(ovoVal) : '-'}</td>
                          <td className="py-2 px-2.5 text-right font-mono">{shopeeVal > 0 ? formatRupiah(shopeeVal) : '-'}</td>
                          <td className="py-2 px-2.5 text-right font-mono">{otherVal > 0 ? formatRupiah(otherVal) : '-'}</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-700">-{formatRupiah(mdrVal)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">{formatRupiah(netSettlement)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* KOLOM TANDA TANGAN RESMI KONSOLIDASI 3 PIHAK */}
              <div className="pt-6 border-t-2 border-slate-300">
                <div className="text-center font-bold text-xs text-slate-800 uppercase tracking-wider mb-4">
                  LEMBAR PENGESAHAN LAPORAN KONSOLIDASI KEUANGAN OUTLET
                </div>
                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  {/* Pihak 1: Finance Kasir Pusat */}
                  <div className="space-y-16">
                    <div>
                      <p className="font-semibold text-slate-600">Dibuat Oleh,</p>
                      <p className="text-[11px] text-slate-400">Finance & Kasir Konsolidasi Pusat</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1.5 mx-4">
                      <p className="font-bold text-slate-900">{currentUser?.name || 'ADMINISTRATOR'}</p>
                      <p className="text-[10px] text-slate-500 font-mono">NIP: ADM-9901 / Accounting</p>
                    </div>
                  </div>

                  {/* Pihak 2: Supervisor / Audit */}
                  <div className="space-y-16">
                    <div>
                      <p className="font-semibold text-slate-600">Diverifikasi & Diperiksa,</p>
                      <p className="text-[11px] text-slate-400">Koordinator Supervisor Wilayah</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1.5 mx-4">
                      <p className="font-bold text-slate-900">Budi Santoso, S.E.</p>
                      <p className="text-[10px] text-slate-500 font-mono">NIP: SPV-8802 / Operasional</p>
                    </div>
                  </div>

                  {/* Pihak 3: Direktur / Owner */}
                  <div className="space-y-16">
                    <div>
                      <p className="font-semibold text-slate-600">Disetujui & Diterima,</p>
                      <p className="text-[11px] text-slate-400">Direktur Operasional / Owner</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1.5 mx-4">
                      <p className="font-bold text-slate-900">H. Hendra Pratama, M.M.</p>
                      <p className="text-[10px] text-slate-500 font-mono">Direksi DEL USAHA RASA GRUP</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="pt-4 text-[10px] text-slate-400 text-center font-mono border-t border-slate-200">
                Dokumen ini dicetak secara otomatis melalui Sistem Cloud Catat POS Multi-Outlet. Sah dan mengikat untuk keperluan pelaporan internal perusahaan.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL VOID / HAPUS TRANSAKSI (SPV)                                */}
      {/* ================================================================= */}
      {voidingTx && canVoidTransaction && (
        <VoidTransactionModal
          isOpen={true}
          onClose={() => setVoidingTx(null)}
          transaction={voidingTx}
          onConfirmVoid={async (txId, password, reason) => {
            if (onDeleteTransaction) {
              await onDeleteTransaction(txId, password, reason);
            }
            setVoidingTx(null);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
