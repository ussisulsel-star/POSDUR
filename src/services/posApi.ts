import {
  CartItem,
  PaymentDetail,
  Product,
  Shift,
  Transaction,
  User,
} from '../types/pos';
import { apiRequest } from './apiService';

interface ApiProduct extends Omit<Product, 'categoryId' | 'categoryName'> {
  categoryId: string | null;
  categoryName?: string;
}

interface ApiShift extends Omit<Shift, 'outletId' | 'outletName'> {
  outletId?: string;
  outletName?: string;
}

interface ApiTransactionItem {
  productId: string;
  productName: string;
  qty: number;
  unit: string;
  costPrice: number;
  unitPrice: number;
  discountRp: number;
  subtotal: number;
}

interface ApiTransaction {
  id: string;
  companyId: string;
  invoiceNo: string;
  shiftId: string | null;
  cashierId: string;
  cashierName: string;
  customerId: string | null;
  customerName: string;
  date: string;
  items: ApiTransactionItem[];
  itemCount: number;
  totalQty: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  payAmount: number;
  changeAmount: number;
  payments: PaymentDetail[];
  status: Transaction['status'];
  notes?: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface CorePosData {
  products: Product[];
  activeShift: Shift | null;
  transactions: Transaction[];
}

export interface CheckoutInput {
  invoiceNo: string;
  customerName: string;
  shiftId?: string;
  items: Array<{
    productId: string;
    qty: number;
    unitPrice: number;
    discountRp: number;
  }>;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  payAmount: number;
  payments: PaymentDetail[];
  notes?: string;
}

export interface CheckoutResult {
  id: string;
  invoiceNo: string;
  shiftId: string | null;
}

function mapProduct(product: ApiProduct): Product {
  return {
    ...product,
    categoryId: product.categoryId || '',
    categoryName: product.categoryName || 'Tanpa kategori',
  };
}

function mapTransaction(
  transaction: ApiTransaction,
  productsById: Map<string, Product>,
  outletId: string,
  outletName: string
): Transaction {
  const items: CartItem[] = transaction.items.map((item) => {
    // Produk bisa saja sudah dihapus/nonaktif atau berada di luar batas
    // paginasi katalog. Nota lama tetap harus tampil, jadi gunakan data
    // minimal dari item transaksi alih-alih menggagalkan seluruh login.
    const product: Product = productsById.get(item.productId) || {
      id: item.productId,
      barcode: '',
      code: '',
      name: item.productName,
      categoryId: '',
      categoryName: 'Produk tidak ditemukan',
      unit: item.unit,
      costPrice: item.costPrice,
      sellPrice: item.unitPrice,
    };

    return {
      product,
      qty: item.qty,
      unitPrice: item.unitPrice,
      discountRp: item.discountRp,
      discountPercent:
        item.unitPrice > 0 ? (item.discountRp / item.unitPrice) * 100 : 0,
      subtotal: item.subtotal,
    };
  });

  return {
    ...transaction,
    outletId,
    outletName,
    customerId: transaction.customerId || 'cust-umum',
    customerPhone: undefined,
    customerTier: 'UMUM',
    shiftId: transaction.shiftId || 'no-shift',
    items,
  };
}

export async function loadCorePosData(
  outletId: string,
  outletName: string
): Promise<CorePosData> {
  const [apiProducts, activeShift, apiTransactions] = await Promise.all([
    apiRequest<ApiProduct[]>('/products?limit=500'),
    apiRequest<ApiShift | null>('/shifts/active'),
    apiRequest<ApiTransaction[]>('/pos/transactions?limit=200'),
  ]);
  const products = apiProducts.map(mapProduct);
  const productsById = new Map(products.map((product) => [product.id, product]));

  return {
    products,
    activeShift: activeShift
      ? { ...activeShift, outletId, outletName }
      : null,
    transactions: apiTransactions.map((transaction) =>
      mapTransaction(transaction, productsById, outletId, outletName)
    ),
  };
}

export async function loginWithApi(
  companyId: string,
  userId: string,
  password: string
): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({ companyId, userId, password }),
  });
}

export async function checkoutWithApi(
  checkout: CheckoutInput
): Promise<CheckoutResult> {
  return apiRequest<CheckoutResult>('/pos/checkout', {
    method: 'POST',
    body: JSON.stringify(checkout),
  });
}

export interface ReturnInput {
  returnNo: string;
  invoiceNo: string;
  refundMethod: 'TUNAI' | 'POTONG_PIUTANG' | 'GANTI_BARANG';
  items: Array<{
    productId: string;
    qty: number;
    reason?: string;
  }>;
  note?: string;
}

export async function returnWithApi(input: ReturnInput): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/pos/returns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function openShiftWithApi(
  initialCash: number,
  notes: string
): Promise<ApiShift> {
  return apiRequest<ApiShift>('/shifts/open', {
    method: 'POST',
    body: JSON.stringify({ initialCash, notes }),
  });
}

export async function closeShiftWithApi(
  actualCash: number,
  notes: string
): Promise<ApiShift> {
  return apiRequest<ApiShift>('/shifts/close', {
    method: 'POST',
    body: JSON.stringify({ actualCash, notes }),
  });
}

export async function addCashMovementWithApi(
  type: 'MASUK' | 'KELUAR',
  amount: number,
  reason: string
): Promise<void> {
  await apiRequest('/shifts/cash-movement', {
    method: 'POST',
    body: JSON.stringify({ type, amount, reason }),
  });
}
