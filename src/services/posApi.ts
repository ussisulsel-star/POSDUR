import {
  Brand,
  CartItem,
  Category,
  Customer,
  Outlet,
  PaymentDetail,
  PointSettings,
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
  customerPhone?: string;
  outletId?: string;
  outletName?: string;
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
  pointsEarned?: number;
  pointsRedeemed?: number;
  pointDiscount?: number;
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
  customers: Customer[];
  categories: Category[];
  brands: Brand[];
  outlets: Outlet[];
  pointSettings: PointSettings;
  users: User[];
  activeShift: Shift | null;
  transactions: Transaction[];
}

export interface CheckoutInput {
  invoiceNo: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  outletId?: string;
  shiftId?: string;
  pointsRedeemed?: number;
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

export interface ProductInput {
  code: string;
  barcode: string;
  name: string;
  brand?: string;
  categoryId?: string;
  unit?: string;
  costPrice?: number;
  sellPrice?: number;
  sellPriceMall?: number;
  wholesalePrice?: number;
  stock?: number;
  minStock?: number;
  isActive?: boolean;
  image?: string;
  isPackage?: boolean;
  packageItems?: unknown[];
  outletStocks?: Record<string, number>;
}

export interface CategoryInput {
  id?: string;
  name: string;
  icon?: string;
}

export interface BrandInput {
  id?: string;
  name: string;
  tagline?: string;
  emoji?: string;
  colorKey?: string;
  isActive?: boolean;
}

export interface OutletInput {
  id?: string;
  code: string;
  name: string;
  brand?: string;
  address?: string;
  phone?: string;
  city?: string;
  isHQ?: boolean;
  isMall?: boolean;
  isActive?: boolean;
}

export interface UserInput {
  userId: string;
  name: string;
  role?: User['role'];
  password?: string;
  pin?: string;
  phone?: string;
  outletId?: string;
  allowedOutletIds?: string[];
  canAccessAllOutlets?: boolean;
  permissions?: Record<string, boolean>;
  isActive?: boolean;
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
  fallbackOutletId: string,
  fallbackOutletName: string
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
    outletId: transaction.outletId || fallbackOutletId,
    outletName: transaction.outletName || fallbackOutletName,
    customerId: transaction.customerId || 'cust-umum',
    customerPhone: transaction.customerPhone,
    customerTier: 'UMUM',
    shiftId: transaction.shiftId || 'no-shift',
    items,
  };
}

export async function loadCorePosData(
  outletId: string,
  outletName: string,
  includeUsers = false
): Promise<CorePosData> {
  const [
    apiProducts,
    apiCustomers,
    apiCategories,
    apiBrands,
    apiOutlets,
    pointSettings,
    activeShift,
    apiTransactions,
    apiUsers,
  ] = await Promise.all([
    apiRequest<ApiProduct[]>('/products?limit=500'),
    apiRequest<Customer[]>('/customers?limit=500'),
    apiRequest<Category[]>('/categories'),
    apiRequest<Brand[]>('/brands'),
    apiRequest<Outlet[]>('/outlets'),
    apiRequest<PointSettings>('/point-settings'),
    apiRequest<ApiShift | null>(
      `/shifts/active?outletId=${encodeURIComponent(outletId)}`
    ),
    apiRequest<ApiTransaction[]>('/pos/transactions?limit=200'),
    includeUsers ? apiRequest<User[]>('/users') : Promise.resolve<User[]>([]),
  ]);

  const products = apiProducts.map(mapProduct);
  const productsById = new Map(products.map((product) => [product.id, product]));

  return {
    products,
    customers: apiCustomers,
    categories: apiCategories,
    brands: apiBrands,
    outlets: apiOutlets,
    pointSettings,
    users: apiUsers,
    activeShift: activeShift
      ? {
          ...activeShift,
          outletId: activeShift.outletId || outletId,
          outletName: activeShift.outletName || outletName,
        }
      : null,
    transactions: apiTransactions.map((transaction) =>
      mapTransaction(transaction, productsById, outletId, outletName)
    ),
  };
}

export async function loadShiftHistory(
  limit = 30,
  outletId?: string
): Promise<Shift[]> {
  const outletQuery = outletId
    ? `&outletId=${encodeURIComponent(outletId)}`
    : '';
  return apiRequest<Shift[]>(`/shifts?limit=${limit}${outletQuery}`);
}

export interface CustomerInput {
  code?: string;
  name: string;
  phone?: string;
  tier?: string;
  discountPercent?: number;
  points?: number;
  address?: string;
}

export async function loadCustomers(search = ''): Promise<Customer[]> {
  const query = search
    ? `?search=${encodeURIComponent(search)}&limit=500`
    : '?limit=500';
  return apiRequest<Customer[]>(`/customers${query}`);
}

export async function loadProducts(): Promise<Product[]> {
  const products = await apiRequest<ApiProduct[]>('/products?limit=500');
  return products.map(mapProduct);
}

export async function loadCategories(): Promise<Category[]> {
  return apiRequest<Category[]>('/categories');
}

export async function loadBrands(): Promise<Brand[]> {
  return apiRequest<Brand[]>('/brands');
}

export async function loadOutlets(): Promise<Outlet[]> {
  return apiRequest<Outlet[]>('/outlets');
}

export async function loadUsers(): Promise<User[]> {
  return apiRequest<User[]>('/users');
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  return apiRequest<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCustomer(
  customerId: string,
  input: Partial<CustomerInput>
): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteCustomer(customerId: string): Promise<void> {
  await apiRequest(`/customers/${customerId}`, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ *
 * Master data: produk, kategori, brand, cabang, pengguna, poin
 * ------------------------------------------------------------------ */

export async function createProduct(input: ProductInput): Promise<Product> {
  const product = await apiRequest<ApiProduct>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return mapProduct(product);
}

export async function updateProduct(
  productId: string,
  input: Partial<ProductInput>
): Promise<Product> {
  const product = await apiRequest<ApiProduct>(`/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return mapProduct(product);
}

export async function deleteProduct(productId: string): Promise<void> {
  await apiRequest(`/products/${productId}`, { method: 'DELETE' });
}

export async function createCategory(
  input: CategoryInput
): Promise<Category> {
  return apiRequest<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCategory(
  categoryId: string,
  input: Partial<CategoryInput>
): Promise<Category> {
  return apiRequest<Category>(`/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await apiRequest(`/categories/${categoryId}`, { method: 'DELETE' });
}

export async function createBrand(input: BrandInput): Promise<Brand> {
  return apiRequest<Brand>('/brands', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateBrand(
  brandId: string,
  input: Partial<BrandInput>
): Promise<Brand> {
  return apiRequest<Brand>(`/brands/${brandId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteBrand(brandId: string): Promise<void> {
  await apiRequest(`/brands/${brandId}`, { method: 'DELETE' });
}

export async function createOutlet(input: OutletInput): Promise<Outlet> {
  return apiRequest<Outlet>('/outlets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateOutlet(
  outletId: string,
  input: Partial<OutletInput>
): Promise<Outlet> {
  return apiRequest<Outlet>(`/outlets/${outletId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteOutlet(outletId: string): Promise<void> {
  await apiRequest(`/outlets/${outletId}`, { method: 'DELETE' });
}

export async function createUser(input: UserInput): Promise<User> {
  return apiRequest<User>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateUser(
  userId: string,
  input: Partial<UserInput>
): Promise<User> {
  return apiRequest<User>(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await apiRequest(`/users/${userId}`, { method: 'DELETE' });
}

export async function updatePointSettings(
  settings: PointSettings
): Promise<PointSettings> {
  return apiRequest<PointSettings>('/point-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
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

/**
 * Void transaksi di server. `password` adalah password akun yang sedang login
 * dan diverifikasi ulang oleh backend sebagai otorisasi tindakan.
 */
export async function voidTransactionWithApi(
  transactionId: string,
  password: string,
  reason?: string
): Promise<Transaction> {
  return apiRequest<Transaction>(`/pos/transactions/${transactionId}/void`, {
    method: 'POST',
    body: JSON.stringify({ password, reason }),
  });
}

export interface TransactionCorrectionInput {
  password: string;
  reason: string;
  items: Array<{
    productId: string;
    qty: number;
    unitPrice: number;
    discountRp: number;
  }>;
  payments: PaymentDetail[];
  customerName?: string;
  customerPhone?: string;
  taxTotal?: number;
}

/**
 * Koreksi transaksi (item/qty/metode bayar) di server. Backend menghitung
 * ulang stok, poin, dan rekap shift dalam satu transaksi database.
 */
export async function correctTransactionWithApi(
  transactionId: string,
  input: TransactionCorrectionInput
): Promise<Transaction> {
  return apiRequest<Transaction>(`/pos/transactions/${transactionId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function openShiftWithApi(
  initialCash: number,
  notes: string,
  outletId?: string
): Promise<ApiShift> {
  return apiRequest<ApiShift>('/shifts/open', {
    method: 'POST',
    body: JSON.stringify({ initialCash, notes, outletId }),
  });
}

export async function closeShiftWithApi(
  actualCash: number,
  notes: string,
  outletId?: string
): Promise<ApiShift> {
  return apiRequest<ApiShift>('/shifts/close', {
    method: 'POST',
    body: JSON.stringify({ actualCash, notes, outletId }),
  });
}

export async function addCashMovementWithApi(
  type: 'MASUK' | 'KELUAR',
  amount: number,
  reason: string,
  shiftId?: string
): Promise<void> {
  await apiRequest('/shifts/cash-movement', {
    method: 'POST',
    body: JSON.stringify({ type, amount, reason, shiftId }),
  });
}
