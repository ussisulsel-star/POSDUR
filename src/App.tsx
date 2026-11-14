import React, { useState, useEffect, useRef } from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import { 
  User as PosUser, 
  Product, 
  Customer, 
  CartItem, 
  Shift, 
  HeldTransaction, 
  Transaction, 
  PaymentDetail,
  SalesReturn,
  Category,
  EMoney,
  Brand,
  PointSettings,
  calculateEarnedPoints,
  getMaxRedeemablePoints,
  getPointDiscountAmount,
} from './types/pos';
import { StorageService, playBeep } from './services/storageService';
import {
  addCashMovementWithApi,
  checkoutWithApi,
  closeShiftWithApi,
  createCustomer,
  deleteCustomer,
  loadCorePosData,
  loadCustomers,
  loadShiftHistory,
  openShiftWithApi,
  returnWithApi,
  updateCustomer,
  voidTransactionWithApi,
} from './services/posApi';
import type { CustomerInput } from './services/posApi';
import { ApiError } from './services/apiService';
import {
  AppTab,
  canAccessMasterData,
  canAccessTab,
  canAccessOutlet,
  canDiscount,
  canOpenDrawer,
  canReturn,
  canVoid,
  canViewDocs,
  canViewReports,
  getDefaultTab,
  getPermittedOutlets,
  isAdmin,
} from './services/accessControl';
import { LoginPage } from './components/auth/LoginPage';
import { AppSidebar } from './components/layout/AppSidebar';
import { TopBar } from './components/layout/TopBar';
import { PosShortcutStrip } from './components/layout/PosShortcutStrip';
import { ProductCatalog } from './components/pos/ProductCatalog';
import { CartPanel } from './components/pos/CartPanel';
import { PaymentModal } from './components/pos/PaymentModal';
import { RedeemPointsModal } from './components/pos/RedeemPointsModal';
import { ReceiptModal } from './components/pos/ReceiptModal';
import { ShiftModal } from './components/pos/ShiftModal';
import { HoldOrdersModal } from './components/pos/HoldOrdersModal';
import { SalesHistoryModal } from './components/pos/SalesHistoryModal';
import { ReturnModal } from './components/pos/ReturnModal';
import { CashMovementModal } from './components/pos/CashMovementModal';
import { ShortcutsHelpModal } from './components/pos/ShortcutsHelpModal';
import { NewCustomerModal } from './components/pos/NewCustomerModal';
import { MasterDataView } from './components/master/MasterDataView';
import type { MasterTab } from './components/master/masterTabs';
import { ReportsView } from './components/reports/ReportsView';
import type { ReportTab } from './components/reports/reportTabs';
import { ArchitectureDocsView } from './components/docs/ArchitectureDocsView';
import { Outlet, StockTransfer } from './types/pos';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isPersistedCustomerId = (id: string): boolean => UUID_PATTERN.test(id);

const WALK_IN_CUSTOMER: Customer = {
  id: 'cust-umum',
  code: 'PLG-0000',
  name: 'Umum (Walk-in)',
  phone: '-',
  tier: 'UMUM',
  discountPercent: 0,
  points: 0,
};

export default function App() {
  // Authentication & session
  const [user, setUser] = useState<PosUser | null>(() => StorageService.getUser());

  // Multi-Outlet & Branch states
  const [outlets, setOutlets] = useState<Outlet[]>(() => StorageService.getOutlets());
  const [activeOutlet, setActiveOutlet] = useState<Outlet>(() => StorageService.getActiveOutlet());
  const [transfers, setTransfers] = useState<StockTransfer[]>(() => StorageService.getTransfers());

  // View tabs
  const [activeTab, setActiveTab] = useState<AppTab>('pos');
  const [masterTab, setMasterTab] = useState<MasterTab>('products');
  const [reportTab, setReportTab] = useState<ReportTab>('closing');
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState<boolean>(false);

  // Master & Transactional states
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [categories, setCategories] = useState<Category[]>(() => StorageService.getCategories());
  const [brands, setBrands] = useState<Brand[]>(() => StorageService.getBrands());
  const [emoneyList, setEMoneyList] = useState<EMoney[]>(() => StorageService.getEMoney());
  const [customers, setCustomers] = useState<Customer[]>(() => StorageService.getCustomers());
  const [pointSettings, setPointSettings] = useState<PointSettings>(() => StorageService.getPointSettings());
  const [users, setUsers] = useState<PosUser[]>(() => StorageService.getUsers());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(() => {
    const list = StorageService.getCustomers();
    return list.find((customer) => customer.tier === 'UMUM') || WALK_IN_CUSTOMER;
  });

  // Cart & Pricing states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceNo, setInvoiceNo] = useState<string>(() => generateInvoiceNo());
  const [invoiceDiscountPercent, setInvoiceDiscountPercent] = useState<number>(0);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(false);

  // Shift & Held orders states
  const [activeShift, setActiveShift] = useState<Shift | null>(() => StorageService.getActiveShift());
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldTransaction[]>(() => StorageService.getHeldOrders());
  const [transactions, setTransactions] = useState<Transaction[]>(() => StorageService.getTransactions());

  // Modals visibility
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [activeReceiptTransaction, setActiveReceiptTransaction] = useState<Transaction | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState<boolean>(false);
  const [holdOrdersModalOpen, setHoldOrdersModalOpen] = useState<boolean>(false);
  const [salesHistoryModalOpen, setSalesHistoryModalOpen] = useState<boolean>(false);
  const [returnModalOpen, setReturnModalOpen] = useState<boolean>(false);
  const [cashMovementModalOpen, setCashMovementModalOpen] = useState<boolean>(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState<boolean>(false);
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState<boolean>(false);
  const [redeemModalOpen, setRedeemModalOpen] = useState<boolean>(false);
  const [redeemPoints, setRedeemPoints] = useState<number>(0);
  const [logoutModalOpen, setLogoutModalOpen] = useState<boolean>(false);
  const [loginPrefill, setLoginPrefill] = useState<{ companyId: string; userId: string } | null>(
    null
  );

  // Barcode input ref for keyboard focus
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  // Menandai sesi user yang datanya sudah dimuat dari API (hindari fetch ganda)
  const hydratedUserIdRef = useRef<string | null>(null);

  // Helper to generate Invoice ID: PJ-202611-XXXX
  function generateInvoiceNo(): string {
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PJ-${yearMonth}-${rand}`;
  }

  // Bersihkan state sementara POS saat sesi berakhir / berganti pengguna.
  const resetTransientPosState = () => {
    setCart([]);
    setRedeemPoints(0);
    setInvoiceDiscountPercent(0);
    setSelectedCustomer(WALK_IN_CUSTOMER);
    setInvoiceNo(generateInvoiceNo());
  };

  // Keyboard shortcut event listener (F1 - F12, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input field (except for F-keys and Escape)
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT';

      // Akun tanpa akses terminal kasir tidak boleh memicu shortcut POS (F1-F11)
      if (user && !canAccessTab(user, 'pos') && e.key !== 'F12' && /^F([1-9]|1[01])$/.test(e.key)) {
        e.preventDefault();
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          const newQtyStr = prompt(`Ubah Jumlah (Qty) untuk ${lastItem.product.name}:`, lastItem.qty.toString());
          if (newQtyStr) {
            const val = parseInt(newQtyStr);
            if (val > 0) {
              handleUpdateQty(lastItem.product.id, val);
            }
          }
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (!canDiscount(user)) {
          playBeep('error');
          alert('Akun Anda tidak memiliki kewenangan memberikan diskon tambahan.');
          return;
        }
        const discStr = prompt('Masukkan Diskon Tambahan Faktur (%):', invoiceDiscountPercent.toString());
        if (discStr) {
          const val = parseFloat(discStr);
          if (!isNaN(val) && val >= 0 && val <= 100) {
            setInvoiceDiscountPercent(val);
          }
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          playBeep('delete');
          handleRemoveCartItem(lastItem.product.id);
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (cart.length > 0) {
          handleHoldOrder();
        } else {
          setHoldOrdersModalOpen(true);
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          setPaymentModalOpen(true);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        setSalesHistoryModalOpen(true);
      } else if (e.key === 'F10') {
        e.preventDefault();
        setCashMovementModalOpen(true);
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (!canOpenDrawer(user)) {
          playBeep('error');
          alert('Akun Anda tidak memiliki kewenangan membuka laci kasir.');
          return;
        }
        playBeep('success');
        alert('Simulasi: Perintah Buka Laci Kasir (ESC/POS Drawer Kick) dikirim!');
      } else if (e.key === 'F12') {
        e.preventDefault();
        setShortcutsModalOpen(true);
      } else if (e.key === 'Escape') {
        // Close modals if open, else clear cart
        if (
          paymentModalOpen ||
          receiptModalOpen ||
          shiftModalOpen ||
          holdOrdersModalOpen ||
          salesHistoryModalOpen ||
          returnModalOpen ||
          cashMovementModalOpen ||
          shortcutsModalOpen ||
          newCustomerModalOpen
        ) {
          setPaymentModalOpen(false);
          setReceiptModalOpen(false);
          setShiftModalOpen(false);
          setHoldOrdersModalOpen(false);
          setSalesHistoryModalOpen(false);
          setReturnModalOpen(false);
          setCashMovementModalOpen(false);
          setShortcutsModalOpen(false);
          setNewCustomerModalOpen(false);
        } else if (cart.length > 0 && !isInput) {
          if (confirm('Kosongkan keranjang saat ini (Esc)?')) {
            handleClearCart();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart,
    invoiceDiscountPercent,
    paymentModalOpen,
    receiptModalOpen,
    shiftModalOpen,
    holdOrdersModalOpen,
    salesHistoryModalOpen,
    returnModalOpen,
    cashMovementModalOpen,
    shortcutsModalOpen,
    newCustomerModalOpen,
    user,
  ]);

  // Sinkronkan pelanggan terpilih saat data member berubah (tier/diskon/poin)
  useEffect(() => {
    setSelectedCustomer((previous) => {
      const latest = customers.find((customer) => customer.id === previous.id);
      return latest ?? previous;
    });
  }, [customers]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) => {
          if (item.product.id === product.id) {
            const newQty = item.qty + 1;
            const subtotal = newQty * (item.unitPrice - item.discountRp);
            return { ...item, qty: newQty, subtotal };
          }
          return item;
        });
      }

      // Member discount deduction if member
      const memberDiscPercent = selectedCustomer.discountPercent || 0;
      // If outlet is in a Mall and product has sellPriceMall, use sellPriceMall
      const baseSellPrice = (activeOutlet?.isMall && product.sellPriceMall)
        ? product.sellPriceMall
        : product.sellPrice;
      const unitPrice =
        selectedCustomer.tier === 'GROSIR' && product.wholesalePrice
          ? product.wholesalePrice
          : baseSellPrice;
      const discountRp = Math.round((unitPrice * memberDiscPercent) / 100);
      const subtotal = 1 * (unitPrice - discountRp);

      return [
        ...prev,
        {
          product,
          qty: 1,
          unitPrice,
          discountRp,
          discountPercent: memberDiscPercent,
          subtotal,
        },
      ];
    });
  };

  const handleUpdateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const subtotal = newQty * (item.unitPrice - item.discountRp);
          return { ...item, qty: newQty, subtotal };
        }
        return item;
      })
    );
  };

  const handleUpdateItemDiscount = (productId: string, discountRp: number, discountPercent: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const subtotal = item.qty * (item.unitPrice - discountRp);
          return { ...item, discountRp, discountPercent, subtotal };
        }
        return item;
      })
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setInvoiceDiscountPercent(0);
    setRedeemPoints(0);
    setInvoiceNo(generateInvoiceNo());
  };

  // Switch branch / outlet
  const handleSelectOutlet = (outlet: Outlet) => {
    if (!canAccessOutlet(user, outlet.id, outlets)) {
      playBeep('error');
      alert(`Akun ${user?.userId || ''} tidak memiliki akses ke cabang ${outlet.name}.`);
      return;
    }
    StorageService.setActiveOutlet(outlet);
    setActiveOutlet(outlet);
  };

  // Hold / Pending current order
  const handleHoldOrder = () => {
    if (cart.length === 0) return;

    const rawSub = cart.reduce((s, i) => s + i.subtotal, 0);
    const holdItem: HeldTransaction = {
      id: 'hold-' + Date.now(),
      holdNumber: `HLD-${heldOrders.length + 1}`,
      timestamp: new Date().toISOString(),
      customer: selectedCustomer,
      items: cart,
      subtotal: rawSub,
      outletId: activeOutlet.id,
      note: `[${activeOutlet.code}] Antrean Kasir ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
    };

    StorageService.holdOrder(holdItem);
    setHeldOrders(StorageService.getHeldOrders());
    playBeep('success');
    alert(`Transaksi berhasil ditahan sebagai "${holdItem.holdNumber}". Anda dapat melayani pelanggan berikutnya.`);
    handleClearCart();
  };

  const handleResumeHold = (held: HeldTransaction) => {
    if (cart.length > 0) {
      if (!confirm('Keranjang aktif saat ini akan digantikan oleh transaksi tertahan. Lanjutkan?')) {
        return;
      }
    }
    setCart(held.items);
    setSelectedCustomer(held.customer);
    StorageService.removeHeldOrder(held.id);
    setHeldOrders(StorageService.getHeldOrders());
  };

  const handleDeleteHold = (id: string) => {
    const updated = StorageService.removeHeldOrder(id);
    setHeldOrders(updated);
  };

  // Calculate current grand total
  const rawSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const itemsDiscountTotal = cart.reduce((sum, item) => sum + item.discountRp * item.qty, 0);
  const subtotalAfterItemDiscounts = rawSubtotal - itemsDiscountTotal;
  const invoiceDiscountAmount = Math.round((subtotalAfterItemDiscounts * invoiceDiscountPercent) / 100);
  const afterInvoiceDiscount = Math.max(0, subtotalAfterItemDiscounts - invoiceDiscountAmount);

  // Tukar poin: dihitung dari tagihan sebelum pajak dan tidak boleh melebihi saldo member.
  const isMemberCustomer =
    selectedCustomer.id !== 'cust-umum' && selectedCustomer.tier !== 'UMUM';
  const maxRedeemablePoints = getMaxRedeemablePoints(
    selectedCustomer.points,
    afterInvoiceDiscount,
    pointSettings
  );
  const appliedRedeemPoints = Math.min(
    Math.max(0, Math.floor(redeemPoints)),
    maxRedeemablePoints
  );
  const pointDiscountAmount = getPointDiscountAmount(
    appliedRedeemPoints,
    pointSettings
  );
  const afterPointDiscount = Math.max(
    0,
    afterInvoiceDiscount - pointDiscountAmount
  );
  const taxAmount = taxEnabled ? Math.round(afterPointDiscount * 0.11) : 0;
  const grandTotal = afterPointDiscount + taxAmount;
  const estimatedEarnedPoints = isMemberCustomer
    ? calculateEarnedPoints(cart, pointSettings)
    : 0;

  useEffect(() => {
    setRedeemPoints((previous) =>
      Math.min(Math.max(0, previous), maxRedeemablePoints)
    );
  }, [maxRedeemablePoints]);

  // Process completed payment
  const handleProcessPayment = async (
    payments: PaymentDetail[],
    payAmount: number,
    changeAmount: number,
    shouldPrint: boolean
  ) => {
    const pointNote =
      appliedRedeemPoints > 0
        ? ` · Tukar ${appliedRedeemPoints} poin (-${pointDiscountAmount})`
        : '';

    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      invoiceNo,
      companyId: user?.companyId || '99999',
      outletId: activeOutlet.id,
      outletName: activeOutlet.name,
      cashierId: user?.userId || 'ADMIN',
      cashierName: user?.name || 'ADMINISTRATOR',
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      customerTier: selectedCustomer.tier,
      date: new Date().toISOString(),
      items: [...cart],
      itemCount: cart.length,
      totalQty: cart.reduce((s, i) => s + i.qty, 0),
      subtotal: rawSubtotal,
      discountTotal:
        itemsDiscountTotal + invoiceDiscountAmount + pointDiscountAmount,
      taxTotal: taxAmount,
      grandTotal,
      payAmount,
      changeAmount,
      payments,
      status: payments.some((p) => p.method === 'PIUTANG') ? 'PIUTANG' : 'LUNAS',
      shiftId: activeShift ? activeShift.id : 'no-shift',
      notes: `Lunas via ${payments.map((p) => p.method).join(', ')} [${activeOutlet.code}]${pointNote}`,
      pointsEarned: estimatedEarnedPoints,
      pointsRedeemed: appliedRedeemPoints,
      pointDiscount: pointDiscountAmount,
    };

    let savedTransaction: { id: string; shiftId: string | null };
    const persistedCustomerId =
      selectedCustomer.tier !== 'UMUM' && isPersistedCustomerId(selectedCustomer.id)
        ? selectedCustomer.id
        : undefined;
    try {
      savedTransaction = await checkoutWithApi({
        invoiceNo,
        customerName: selectedCustomer.name,
        ...(persistedCustomerId
          ? { customerId: persistedCustomerId, pointsRedeemed: appliedRedeemPoints }
          : {}),
        ...(activeShift ? { shiftId: activeShift.id } : {}),
        items: cart.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountRp: item.discountRp,
        })),
        discountTotal:
          itemsDiscountTotal + invoiceDiscountAmount + pointDiscountAmount,
        taxTotal: taxAmount,
        grandTotal,
        payAmount,
        payments: payments.map((payment) => ({
          ...payment,
          bankName: payment.bankName || payment.emoneyName,
        })),
        notes: newTx.notes,
      });
    } catch (error) {
      alert(
        `Transaksi belum tersimpan: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
      return;
    }

    const persistedTransaction = {
      ...newTx,
      id: savedTransaction.id,
      shiftId: savedTransaction.shiftId || 'no-shift',
    };

    setPaymentModalOpen(false);
    setActiveReceiptTransaction(persistedTransaction);
    setTransactions((current) => [persistedTransaction, ...current]);

    try {
      const coreData = await loadCorePosData(activeOutlet.id, activeOutlet.name);
      setProducts(coreData.products);
      setCustomers(coreData.customers);
      setActiveShift(coreData.activeShift);
      setTransactions(coreData.transactions);
    } catch (error) {
      alert(
        `Transaksi ${invoiceNo} sudah tersimpan, tetapi data layar gagal diperbarui: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
    }

    if (shouldPrint) {
      setReceiptModalOpen(true);
    } else {
      alert(`Transaksi ${invoiceNo} berhasil disimpan!`);
      handleClearCart();
    }
  };

  // Shift management handlers
  const handleCloseShift = async (actualCash: number, notes: string) => {
    try {
      const closed = await closeShiftWithApi(actualCash, notes);
      setActiveShift(null);
      setShiftHistory((history) => [
        { ...closed, outletId: activeOutlet.id, outletName: activeOutlet.name },
        ...history,
      ]);
      alert(`Shift Kasir berhasil ditutup! Laporan rekonsiliasi kas telah disimpan.`);
    } catch (error) {
      alert(
        `Shift belum berhasil ditutup: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
    }
  };

  const handleOpenNewShift = async (initialCash: number, cashierName: string) => {
    try {
      const opened = await openShiftWithApi(
        initialCash,
        `Shift Baru [${activeOutlet.code}] · ${cashierName}`
      );
      setActiveShift({
        ...opened,
        outletId: activeOutlet.id,
        outletName: activeOutlet.name,
      });
    } catch (error) {
      alert(
        `Shift belum berhasil dibuka: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
    }
  };

  // Cash movement (Kas Masuk / Kas Keluar Operasional - F10)
  const handleAddCashMovement = async (type: 'MASUK' | 'KELUAR', amount: number, reason: string) => {
    try {
      await addCashMovementWithApi(type, amount, reason);
      const coreData = await loadCorePosData(activeOutlet.id, activeOutlet.name);
      setActiveShift(coreData.activeShift);
      setProducts(coreData.products);
      alert(`Kas ${type} sebesar Rp ${amount.toLocaleString('id-ID')} berhasil dicatat.`);
    } catch (error) {
      alert(
        `Pergerakan kas belum tersimpan: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
    }
  };

  // Sales Return
  const handleProcessReturn = async (salesReturn: SalesReturn): Promise<boolean> => {
    if (!canReturn(user)) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan memproses retur penjualan.');
      return false;
    }

    try {
      await returnWithApi({
        returnNo: salesReturn.returnNo,
        invoiceNo: salesReturn.invoiceNo,
        refundMethod: salesReturn.refundMethod,
        items: salesReturn.items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          reason: item.reason,
        })),
      });
    } catch (error) {
      playBeep('error');
      alert(
        `Retur belum tersimpan: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
      return false;
    }

    StorageService.saveReturn(salesReturn);

    try {
      const coreData = await loadCorePosData(activeOutlet.id, activeOutlet.name);
      setProducts(coreData.products);
      setActiveShift(coreData.activeShift);
      setTransactions(coreData.transactions);
    } catch (error) {
      alert(
        `Retur ${salesReturn.returnNo} sudah tersimpan, tetapi data layar gagal diperbarui: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
    }

    return true;
  };

  // Customer registration
  const handleAddCustomer = async (newCustomer: Customer): Promise<boolean> => {
    const created = await createCustomer({
      code: newCustomer.code,
      name: newCustomer.name,
      phone: newCustomer.phone === '-' ? undefined : newCustomer.phone,
      tier: newCustomer.tier,
      discountPercent: newCustomer.discountPercent,
      points: newCustomer.points,
      address: newCustomer.address,
    });
    setCustomers((current) => [created, ...current]);
    setSelectedCustomer(created);
    return true;
  };

  // Sinkronisasi perubahan massal pelanggan (master data / pengaturan tier).
  const handleUpdateCustomers = async (nextCustomers: Customer[]) => {
    try {
      const previousById = new Map(customers.map((customer) => [customer.id, customer]));
      const nextIds = new Set(nextCustomers.map((customer) => customer.id));

      for (const customer of nextCustomers) {
        const previous = previousById.get(customer.id);

        if (!previous) {
          await createCustomer({
            code: customer.code,
            name: customer.name,
            phone: customer.phone === '-' ? undefined : customer.phone,
            tier: customer.tier,
            discountPercent: customer.discountPercent,
            points: customer.points,
            address: customer.address,
          });
          continue;
        }

        if (!isPersistedCustomerId(customer.id)) continue;

        // Kirim hanya field yang berubah agar poin hasil transaksi tidak
        // tertimpa nilai lama dari layar master data.
        const changes: Partial<CustomerInput> = {};
        if (previous.code !== customer.code) changes.code = customer.code;
        if (previous.name !== customer.name) changes.name = customer.name;
        if (previous.phone !== customer.phone && customer.phone) {
          changes.phone = customer.phone;
        }
        if (previous.tier !== customer.tier) changes.tier = customer.tier;
        if (previous.discountPercent !== customer.discountPercent) {
          changes.discountPercent = customer.discountPercent;
        }
        if (previous.points !== customer.points) changes.points = customer.points;
        if (previous.address !== customer.address && customer.address) {
          changes.address = customer.address;
        }

        if (Object.keys(changes).length > 0) {
          await updateCustomer(customer.id, changes);
        }
      }

      for (const customer of customers) {
        if (
          isPersistedCustomerId(customer.id) &&
          !nextIds.has(customer.id)
        ) {
          await deleteCustomer(customer.id);
        }
      }

      setCustomers(await loadCustomers());
    } catch (error) {
      playBeep('error');
      alert(
        `Perubahan pelanggan gagal disimpan ke server: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
      try {
        setCustomers(await loadCustomers());
      } catch {
        // Biarkan data yang ada bila server juga tidak dapat dihubungi.
      }
    }
  };

  // Database Reset (hanya untuk data lokal: pengaturan, kategori, brand, user)
  const handleResetDatabase = async () => {
    if (!isAdmin(user)) {
      playBeep('error');
      alert('Hanya Administrator yang boleh mereset database.');
      return;
    }
    StorageService.resetDatabase();
    setCategories(StorageService.getCategories());
    setBrands(StorageService.getBrands());
    setPointSettings(StorageService.getPointSettings());
    setUsers(StorageService.getUsers());
    setEMoneyList(StorageService.getEMoney());
    setHeldOrders([]);
    resetTransientPosState();

    try {
      const [coreData, history] = await Promise.all([
        loadCorePosData(activeOutlet.id, activeOutlet.name),
        loadShiftHistory(),
      ]);
      setProducts(coreData.products);
      setCustomers(coreData.customers);
      setActiveShift(coreData.activeShift);
      setTransactions(coreData.transactions);
      setShiftHistory(
        history.map((shift) => ({
          ...shift,
          outletId: activeOutlet.id,
          outletName: activeOutlet.name,
        }))
      );
      alert('Data lokal berhasil di-reset dan data POS dimuat ulang dari server.');
    } catch (error) {
      alert(
        `Data lokal sudah di-reset, tetapi data server gagal dimuat: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
    }
  };

  // Check and enforce outlet authorization for a user (fail-closed)
  const enforceOutletAuthorization = (targetUser: PosUser, currentOutlet: Outlet): Outlet | null => {
    const permitted = getPermittedOutlets(targetUser, outlets);
    if (permitted.length === 0) {
      return null;
    }
    if (permitted.some((o) => o.id === currentOutlet.id)) {
      return currentOutlet;
    }
    // Switch to targetUser's default outlet or first permitted outlet
    const targetOutlet =
      permitted.find((o) => o.id === targetUser.outletId) || permitted[0];

    StorageService.setActiveOutlet(targetOutlet);
    return targetOutlet;
  };

  // Handle Login & Logout
  const handleLoginSuccess = async (loggedUser: PosUser, token: string) => {
    StorageService.setUser(loggedUser, token);
    try {
      const coreData = await loadCorePosData(activeOutlet.id, activeOutlet.name);
      setProducts(coreData.products);
      setCustomers(coreData.customers);
      setActiveShift(coreData.activeShift);
      setTransactions(coreData.transactions);
    } catch (error) {
      hydratedUserIdRef.current = null;
      StorageService.setUser(null);
      throw error;
    }

    void loadShiftHistory()
      .then((history) =>
        setShiftHistory(
          history.map((shift) => ({
            ...shift,
            outletId: activeOutlet.id,
            outletName: activeOutlet.name,
          }))
        )
      )
      .catch(() => {
        // Riwayat shift tidak boleh menghalangi login.
      });

    hydratedUserIdRef.current = loggedUser.id;
    setLoginPrefill(null);
    setUser(loggedUser);
    setActiveTab(getDefaultTab(loggedUser));
    const validOutlet = enforceOutletAuthorization(loggedUser, activeOutlet);
    if (validOutlet) {
      setActiveOutlet(validOutlet);
    }
  };

  const handleSwitchUser = (newUser: PosUser) => {
    hydratedUserIdRef.current = null;
    StorageService.setUser(null);
    resetTransientPosState();
    setLoginPrefill({
      companyId: newUser.companyId,
      userId: newUser.userId,
    });
    setUser(null);
    setActiveTab('pos');
  };

  // Void transaksi langsung ke server agar stok, poin, dan rekap shift ikut
  // dikembalikan. Koreksi/edit nota belum didukung backend.
  const handleDeleteTransaction = async (
    txId: string,
    password: string,
    reason: string
  ) => {
    if (!canVoid(user)) {
      playBeep('error');
      throw new Error('Akun Anda tidak memiliki kewenangan menghapus / void transaksi.');
    }

    await voidTransactionWithApi(txId, password, reason);
    playBeep('delete');

    try {
      const [coreData, history] = await Promise.all([
        loadCorePosData(activeOutlet.id, activeOutlet.name),
        loadShiftHistory(),
      ]);
      setProducts(coreData.products);
      setCustomers(coreData.customers);
      setActiveShift(coreData.activeShift);
      setTransactions(coreData.transactions);
      setShiftHistory(
        history.map((shift) => ({
          ...shift,
          outletId: activeOutlet.id,
          outletName: activeOutlet.name,
        }))
      );
    } catch (error) {
      alert(
        `Transaksi sudah di-void di server, tetapi data layar gagal diperbarui: ${
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
        }`
      );
    }
  };

  const handleLogout = () => {
    setLogoutModalOpen(true);
  };

  const handleConfirmLogout = () => {
    playBeep('delete');
    hydratedUserIdRef.current = null;
    setLoginPrefill(null);
    resetTransientPosState();
    StorageService.setUser(null);
    setUser(null);
    setActiveTab('pos');
    setLogoutModalOpen(false);
  };

  // Pastikan tab aktif & cabang aktif selalu sesuai kewenangan user saat ini
  useEffect(() => {
    if (!user) return;

    if (!canAccessTab(user, activeTab)) {
      setActiveTab(getDefaultTab(user));
    }

    const permitted = getPermittedOutlets(user, outlets);
    if (permitted.length > 0 && !permitted.some((o) => o.id === activeOutlet.id)) {
      const fallback = permitted.find((o) => o.id === user.outletId) || permitted[0];
      StorageService.setActiveOutlet(fallback);
      setActiveOutlet(fallback);
    }
  }, [user, activeTab, outlets, activeOutlet.id]);

  // Pulihkan sesi setelah refresh halaman: data POS harus selalu berasal dari
  // API, bukan cache localStorage yang bisa berisi katalog/nota lama.
  useEffect(() => {
    if (!user || hydratedUserIdRef.current === user.id) return;
    hydratedUserIdRef.current = user.id;
    let cancelled = false;

    (async () => {
      try {
        const coreData = await loadCorePosData(activeOutlet.id, activeOutlet.name);
        if (cancelled) return;
        setProducts(coreData.products);
        setCustomers(coreData.customers);
        setActiveShift(coreData.activeShift);
        setTransactions(coreData.transactions);

        void loadShiftHistory()
          .then((history) => {
            if (cancelled) return;
            setShiftHistory(
              history.map((shift) => ({
                ...shift,
                outletId: activeOutlet.id,
                outletName: activeOutlet.name,
              }))
            );
          })
          .catch(() => {
            // Riwayat shift tidak boleh menghalangi pemulihan sesi.
          });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          hydratedUserIdRef.current = null;
          StorageService.setUser(null);
          setUser(null);
          setActiveTab('pos');
          return;
        }
        alert(
          `Data POS gagal dimuat dari server: ${
            error instanceof Error ? error.message : 'Terjadi kesalahan pada server.'
          }`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, activeOutlet.id, activeOutlet.name]);

  // Sesi kedaluwarsa di tengah pemakaian: API mengirim 401, paksa login ulang.
  useEffect(() => {
    const handleUnauthorized = () => {
      const hadSession = Boolean(StorageService.getUser());
      hydratedUserIdRef.current = null;
      resetTransientPosState();
      StorageService.setUser(null);
      setUser(null);
      setActiveTab('pos');
      if (hadSession) {
        alert('Sesi login berakhir atau token tidak valid. Silakan login kembali.');
      }
    };

    window.addEventListener('pos:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('pos:unauthorized', handleUnauthorized);
  }, []);

  // If user is not logged in, show Login Screen
  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        initialCompanyId={loginPrefill?.companyId}
        initialUserId={loginPrefill?.userId}
      />
    );
  }

  // Fail-closed: akun tanpa akses cabang tidak boleh masuk ke terminal
  const permittedOutlets = getPermittedOutlets(user, outlets);
  if (outlets.length > 0 && permittedOutlets.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Akses Cabang Ditolak</h1>
          <p className="text-sm text-slate-600">
            Akun <strong>{user.name}</strong> ({user.userId}) tidak memiliki izin ke cabang mana pun.
            Hubungi Administrator untuk mengatur hak akses outlet.
          </p>
          <button
            onClick={() => {
              resetTransientPosState();
              StorageService.setUser(null);
              setUser(null);
            }}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold"
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  // Transaksi yang boleh dilihat user (dibatasi outlet yang diizinkan)
  const visibleTransactions =
    isAdmin(user) || user.canAccessAllOutlets
      ? transactions
      : transactions.filter((t) => permittedOutlets.some((o) => o.id === t.outletId));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-800">
      {/* Left navigation rail */}
      <AppSidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSidebarMobileOpen(false);
        }}
        heldCount={heldOrders.length}
        masterTab={masterTab}
        onSelectMasterTab={(tab) => {
          setMasterTab(tab);
          setActiveTab('master');
          setSidebarMobileOpen(false);
        }}
        reportTab={reportTab}
        onSelectReportTab={(tab) => {
          setReportTab(tab);
          setActiveTab('reports');
          setSidebarMobileOpen(false);
        }}
        mobileOpen={sidebarMobileOpen}
        onCloseMobile={() => setSidebarMobileOpen(false)}
        onOpenHoldModal={() => setHoldOrdersModalOpen(true)}
        onOpenHistoryModal={() => setSalesHistoryModalOpen(true)}
        onOpenReturnModal={() => setReturnModalOpen(true)}
        onOpenCashMovementModal={() => setCashMovementModalOpen(true)}
        onOpenShortcutsModal={() => setShortcutsModalOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slim top bar: cabang, shift, jam, user, keluar */}
        <TopBar
          user={user}
          activeShift={activeShift}
          outlets={outlets}
          activeOutlet={activeOutlet}
          onSelectOutlet={handleSelectOutlet}
          onOpenShiftModal={() => setShiftModalOpen(true)}
          onLogout={handleLogout}
          onOpenMobileMenu={() => setSidebarMobileOpen(true)}
        />

        {/* Main Workspace Body */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* VIEW 1: TERMINAL KASIR (POS) */}
          {activeTab === 'pos' && canAccessTab(user, 'pos') && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left 7 Cols: Catalog & Barcode Scanner */}
              <div className="lg:col-span-7 h-full overflow-hidden">
                <ProductCatalog
                  products={products}
                  categories={categories}
                  activeOutlet={activeOutlet}
                  onAddToCart={handleAddToCart}
                  barcodeInputRef={barcodeInputRef}
                />
              </div>

              {/* Right 5 Cols: Cart & Billing Terminal */}
              <div className="lg:col-span-5 h-full overflow-hidden border-l border-slate-200">
                <CartPanel
                  cart={cart}
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={setSelectedCustomer}
                  onUpdateQty={handleUpdateQty}
                  onUpdateItemDiscount={handleUpdateItemDiscount}
                  onRemoveItem={handleRemoveCartItem}
                  onClearCart={handleClearCart}
                  onHoldOrder={handleHoldOrder}
                  onOpenPayment={() => setPaymentModalOpen(true)}
                  invoiceNo={invoiceNo}
                  invoiceDiscountPercent={invoiceDiscountPercent}
                  setInvoiceDiscountPercent={setInvoiceDiscountPercent}
                  taxEnabled={taxEnabled}
                  setTaxEnabled={setTaxEnabled}
                  onOpenNewCustomerModal={() => setNewCustomerModalOpen(true)}
                  canDiscount={canDiscount(user)}
                  pointDiscountAmount={pointDiscountAmount}
                  redeemedPoints={appliedRedeemPoints}
                  estimatedEarnedPoints={estimatedEarnedPoints}
                  maxRedeemablePoints={maxRedeemablePoints}
                  onOpenRedeemPoints={() => setRedeemModalOpen(true)}
                />
              </div>
            </div>
          )}

          {/* VIEW 2: MASTER DATA (PRODUK, KATEGORI, CABANG, PENGGUNA, E-MONEY, PELANGGAN) */}
          {activeTab === 'master' && canAccessMasterData(user) && (
            <MasterDataView
              products={products}
              categories={categories}
              customers={customers}
              outlets={outlets}
              activeOutlet={activeOutlet}
              users={users}
              currentUser={user}
              emoneyList={emoneyList}
              brands={brands}
              masterTab={masterTab}
              onMasterTabChange={setMasterTab}
              pointSettings={pointSettings}
              onUpdatePointSettings={(settings) => {
                const saved = StorageService.savePointSettings(settings);
                setPointSettings(saved);
              }}
              onUpdateProducts={(prods) => {
                StorageService.saveProducts(prods);
                setProducts(prods);
              }}
              onUpdateCategories={(cats) => {
                StorageService.saveCategories(cats);
                setCategories(cats);
              }}
              onUpdateCustomers={(custs) => {
                setCustomers(custs);
                void handleUpdateCustomers(custs);
              }}
              onUpdateOutlets={(updated) => {
                StorageService.saveOutlets(updated);
                setOutlets(updated);
              }}
              onSelectActiveOutlet={handleSelectOutlet}
              onUpdateUsers={(updated) => {
                StorageService.saveUsers(updated);
                setUsers(updated);
              }}
              onUpdateEMoney={(updated) => {
                StorageService.saveEMoney(updated);
                setEMoneyList(updated);
              }}
              onUpdateBrands={(updated) => {
                StorageService.saveBrands(updated);
                setBrands(updated);
              }}
              onSwitchUser={handleSwitchUser}
              onResetDatabase={handleResetDatabase}
            />
          )}

          {/* VIEW 3: LAPORAN KONSOLIDASI OUTLET & REKAP KASIR */}
          {activeTab === 'reports' && canViewReports(user) && (
            <ReportsView
              transactions={visibleTransactions}
              shiftHistory={shiftHistory}
              activeShift={activeShift}
              outlets={outlets}
              activeOutlet={activeOutlet}
              emoneyList={emoneyList}
              users={users}
              currentUser={user}
              reportTab={reportTab}
              onReportTabChange={setReportTab}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {/* VIEW 4: DOKUMENTASI ARSITEKTUR, ERD, API & DOCKER */}
          {activeTab === 'docs' && canViewDocs(user) && <ArchitectureDocsView />}
        </main>

        {/* POS shortcut strip */}
        {activeTab === 'pos' && canAccessTab(user, 'pos') && (
          <PosShortcutStrip
            user={user}
            onOpenCashMovementModal={() => setCashMovementModalOpen(true)}
          />
        )}
      </div>

      {/* POPUP MODALS */}
      {/* 1. Payment Modal (F8) */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        totalAmount={grandTotal}
        customer={selectedCustomer}
        emoneyList={emoneyList}
        onProcessPayment={handleProcessPayment}
      />

      {/* 1b. Redeem Points Modal (Tukar Poin di Kasir) */}
      <RedeemPointsModal
        isOpen={redeemModalOpen}
        onClose={() => setRedeemModalOpen(false)}
        customer={selectedCustomer}
        settings={pointSettings}
        payableAmount={afterInvoiceDiscount}
        appliedPoints={appliedRedeemPoints}
        onApply={setRedeemPoints}
      />

      {/* 2. Receipt Modal (Printable) */}
      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          handleClearCart();
        }}
        transaction={activeReceiptTransaction}
        onNewTransaction={handleClearCart}
      />

      {/* 3. Shift Management Modal */}
      <ShiftModal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        activeShift={activeShift}
        onCloseShift={handleCloseShift}
        onOpenNewShift={handleOpenNewShift}
      />

      {/* 4. Held Orders Modal (F7) */}
      <HoldOrdersModal
        isOpen={holdOrdersModalOpen}
        onClose={() => setHoldOrdersModalOpen(false)}
        heldOrders={heldOrders}
        onResumeHold={handleResumeHold}
        onDeleteHold={handleDeleteHold}
      />

      {/* 5. Sales History Modal (F9) */}
      <SalesHistoryModal
        isOpen={salesHistoryModalOpen}
        onClose={() => setSalesHistoryModalOpen(false)}
        transactions={visibleTransactions}
        currentUser={user}
        canVoid={canVoid(user)}
        onDeleteTransaction={handleDeleteTransaction}
        onSelectTransactionForPrint={(t) => {
          setActiveReceiptTransaction(t);
          setSalesHistoryModalOpen(false);
          setReceiptModalOpen(true);
        }}
      />

      {/* 6. Return Modal */}
      <ReturnModal
        isOpen={returnModalOpen && canReturn(user)}
        onClose={() => setReturnModalOpen(false)}
        transactions={visibleTransactions}
        onProcessReturn={handleProcessReturn}
      />

      {/* 7. Cash Movement Modal (F10) */}
      <CashMovementModal
        isOpen={cashMovementModalOpen}
        onClose={() => setCashMovementModalOpen(false)}
        onAddMovement={handleAddCashMovement}
      />

      {/* 8. Keyboard Shortcuts Modal (F12) */}
      <ShortcutsHelpModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />

      {/* 9. New Customer Registration Modal */}
      <NewCustomerModal
        isOpen={newCustomerModalOpen}
        onClose={() => setNewCustomerModalOpen(false)}
        onAddCustomer={handleAddCustomer}
      />

      {/* 10. Logout Confirmation Modal */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                Konfirmasi Keluar (Log Out)
              </h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                Apakah Anda yakin ingin keluar dari sesi kasir <span className="font-semibold text-slate-700">{user?.name}</span>? Anda perlu memasukkan PIN atau Password untuk masuk kembali.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Ya, Keluar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
