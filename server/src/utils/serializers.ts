/**
 * Pemetaan baris PostgreSQL (snake_case) menjadi objek JSON (camelCase)
 * agar konsisten dengan tipe `src/types/pos.ts` di frontend.
 */

export const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

export const toNullableNumber = (
  value: unknown
): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

/**
 * Normalisasi tanggal menjadi `YYYY-MM-DD`.
 * Kolom DATE dari `pg` dapat berupa objek Date, jadi jangan memakai
 * `String(value).slice()` yang menghasilkan format "Thu Jan 01".
 * Sebaiknya query juga memakai `::text` agar nilainya sudah berupa string.
 */
export const toDateOnly = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    // `pg` mem-parse DATE sebagai tengah malam waktu lokal, jadi gunakan
    // getter lokal agar tanggal tidak bergeser satu hari.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toISOString().slice(0, 10);
};

type Row = Record<string, any>;

export function mapUser(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    phone: row.phone ?? undefined,
    outletId: row.outlet_id ?? undefined,
    allowedOutletIds: toJsonArray(row.allowed_outlet_ids),
    canAccessAllOutlets: Boolean(row.can_access_all_outlets),
    permissions: toJsonObject(row.permissions),
    hasPin: Boolean(row.has_pin),
    isActive: row.is_active,
    lastLogin: row.last_login ?? undefined,
    companyName: row.company_name ?? undefined,
    createdAt: row.created_at,
  };
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function mapProduct(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand ?? undefined,
    categoryId: row.category_id,
    categoryName: row.category_name ?? undefined,
    unit: row.unit,
    costPrice: toNumber(row.cost_price),
    sellPrice: toNumber(row.sell_price),
    sellPriceMall: toNullableNumber(row.sell_price_mall) ?? undefined,
    wholesalePrice: toNumber(row.wholesale_price),
    stock: toNumber(row.stock),
    minStock: toNumber(row.min_stock),
    image: row.image ?? undefined,
    isPackage: Boolean(row.is_package),
    packageItems: Array.isArray(row.package_items) ? row.package_items : [],
    outletStocks: toJsonObject(row.outlet_stocks),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCategory(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    icon: row.icon ?? undefined,
  };
}

export function mapBrand(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    tagline: row.tagline ?? '',
    emoji: row.emoji ?? '',
    colorKey: row.color_key ?? 'blue',
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function mapOutlet(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    brand: row.brand ?? undefined,
    address: row.address ?? '',
    phone: row.phone ?? '',
    city: row.city ?? '',
    isHQ: Boolean(row.is_hq),
    isMall: Boolean(row.is_mall),
    isActive: row.is_active,
  };
}

export function mapPointSettings(row: Row) {
  return {
    enabled: Boolean(row.enabled),
    activeFrom: toDateOnly(row.active_from),
    activeUntil: toDateOnly(row.active_until),
    redeemValue: toNumber(row.redeem_value),
    minRedeemPoints: toNumber(row.min_redeem_points),
    productPoints: toJsonObject(row.product_points) as Record<string, number>,
  };
}

export function mapCustomer(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    tier: row.tier,
    discountPercent: toNumber(row.discount_percent),
    points: toNumber(row.points),
    address: row.address,
    createdAt: row.created_at,
  };
}

export function mapShift(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    shiftNumber: toNumber(row.shift_number),
    cashierId: row.cashier_id,
    cashierName: row.cashier_name ?? undefined,
    outletId: row.outlet_id ?? undefined,
    outletName: row.outlet_name ?? undefined,
    startTime: row.start_time,
    endTime: row.end_time,
    initialCash: toNumber(row.initial_cash),
    totalCashSales: toNumber(row.total_cash_sales),
    totalNonCashSales: toNumber(row.total_non_cash_sales),
    totalCashIn: toNumber(row.total_cash_in),
    totalCashOut: toNumber(row.total_cash_out),
    expectedCash: toNumber(row.expected_cash),
    actualCash: toNullableNumber(row.actual_cash),
    cashDifference: toNullableNumber(row.cash_difference),
    status: row.status,
    notes: row.notes,
  };
}

export function mapCashMovement(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    shiftId: row.shift_id,
    type: row.type,
    amount: toNumber(row.amount),
    reason: row.reason,
    cashierName: row.cashier_name,
    timestamp: row.created_at,
  };
}

export function mapTransactionItem(row: Row) {
  return {
    productId: row.product_id,
    productName: row.product_name,
    qty: toNumber(row.qty),
    unit: row.unit,
    costPrice: toNumber(row.cost_price),
    unitPrice: toNumber(row.unit_price),
    discountRp: toNumber(row.discount_rp),
    subtotal: toNumber(row.subtotal),
  };
}

export function mapPayment(row: Row) {
  return {
    method: row.method,
    amount: toNumber(row.amount),
    bankName: row.bank_name ?? undefined,
    cardLastFour: row.card_last_four ?? undefined,
    traceNumber: row.trace_number ?? undefined,
    qrRef: row.qr_ref ?? undefined,
    dueDate: row.due_date ?? undefined,
  };
}

export function mapTransaction(row: Row) {
  const items = Array.isArray(row.items)
    ? row.items.map(mapTransactionItem)
    : undefined;
  const payments = Array.isArray(row.payments)
    ? row.payments.map(mapPayment)
    : undefined;

  return {
    id: row.id,
    companyId: row.company_id,
    invoiceNo: row.invoice_no,
    shiftId: row.shift_id,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? undefined,
    outletId: row.outlet_id ?? undefined,
    outletName: row.outlet_name ?? undefined,
    date: row.created_at,
    items,
    itemCount: items?.length,
    totalQty: items?.reduce((total, item) => total + item.qty, 0),
    subtotal: toNumber(row.subtotal),
    discountTotal: toNumber(row.discount_total),
    taxTotal: toNumber(row.tax_total),
    grandTotal: toNumber(row.grand_total),
    payAmount: toNumber(row.pay_amount),
    changeAmount: toNumber(row.change_amount),
    pointsEarned: toNumber(row.points_earned),
    pointsRedeemed: toNumber(row.points_redeemed),
    pointDiscount: toNumber(row.point_discount),
    payments,
    status: row.status,
    notes: row.notes,
  };
}

export function mapSalesReturn(row: Row) {
  return {
    id: row.id,
    companyId: row.company_id,
    returnNo: row.return_no,
    invoiceNo: row.invoice_no,
    totalRefund: toNumber(row.total_refund),
    refundMethod: row.refund_method,
    cashierName: row.cashier_name,
    items: row.items_json,
    date: row.created_at,
  };
}
