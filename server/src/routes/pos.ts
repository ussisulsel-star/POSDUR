import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import {
  mapSalesReturn,
  mapTransaction,
  toDateOnly,
  toNumber,
} from '../utils/serializers';
import {
  isUuid,
  optionalString,
  optionalUuid,
  parseInteger,
  parseMoney,
  readQueryString,
  requireString,
  roundMoney,
} from '../utils/validation';

const router = Router();

const PAYMENT_METHODS = new Set([
  'TUNAI',
  'QRIS',
  'DEBIT',
  'KREDIT',
  'TRANSFER',
  'PIUTANG',
]);

const REFUND_METHODS = new Set(['TUNAI', 'POTONG_PIUTANG', 'GANTI_BARANG']);

const TRANSACTION_SELECT = `
  SELECT t.*, o.name AS outlet_name,
         COALESCE(
           (SELECT json_agg(ti ORDER BY ti.id)
              FROM transaction_items ti
             WHERE ti.transaction_id = t.id),
           '[]'::json
         ) AS items,
         COALESCE(
           (SELECT json_agg(p ORDER BY p.id)
              FROM payments p
             WHERE p.transaction_id = t.id),
           '[]'::json
         ) AS payments
    FROM transactions t
    LEFT JOIN outlets o ON o.id = t.outlet_id
`;

interface PointSettingsRow {
  enabled: boolean;
  active_from: string | null;
  active_until: string | null;
  redeem_value: unknown;
  min_redeem_points: unknown;
  product_points: Record<string, unknown> | null;
}

async function loadPointSettings(
  client: { query: (text: string, params?: unknown[]) => Promise<any> },
  companyId: string
): Promise<PointSettingsRow | null> {
  const { rows } = await client.query(
    `SELECT enabled, active_from::text AS active_from,
            active_until::text AS active_until, redeem_value,
            min_redeem_points, product_points
       FROM point_settings
      WHERE company_id = $1
      LIMIT 1`,
    [companyId]
  );
  return rows[0] ?? null;
}

function isPointProgramActive(
  settings: PointSettingsRow | null,
  now: Date = new Date()
): boolean {
  if (!settings || settings.enabled === false) return false;

  // Gunakan tanggal lokal server agar tidak bergeser satu hari saat dini hari.
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
  const from = toDateOnly(settings.active_from);
  const until = toDateOnly(settings.active_until);

  if (from && today < from) return false;
  if (until && today > until) return false;
  return true;
}

function getProductPoints(
  settings: PointSettingsRow | null,
  productId: string
): number {
  if (!settings || !settings.product_points) return 0;
  const value = Number(settings.product_points[productId] ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function countEarnedPoints(
  settings: PointSettingsRow | null,
  items: Array<{ productId: string; qty: number }>
): number {
  if (!isPointProgramActive(settings)) return 0;
  return items.reduce(
    (total, item) => total + getProductPoints(settings, item.productId) * item.qty,
    0
  );
}

/**
 * Hitung ulang agregat kas shift dari transaksi yang tersisa.
 * Dipakai void dan koreksi transaksi agar laporan tutup kasir konsisten.
 */
async function recalculateShiftTotals(
  client: { query: (text: string, params?: unknown[]) => Promise<any> },
  companyId: string,
  shiftId: string
): Promise<void> {
  const shiftResult = await client.query(
    `SELECT id, status
       FROM pos_shifts
      WHERE company_id = $1 AND id = $2
      FOR UPDATE`,
    [companyId, shiftId]
  );

  const shift = shiftResult.rows[0];
  if (!shift || shift.status !== 'OPEN') return;

  const salesResult = await client.query(
    `SELECT
       COALESCE(SUM(GREATEST(t.grand_total - COALESCE(nc.non_cash, 0), 0)), 0) AS cash_sales,
       COALESCE(SUM(LEAST(COALESCE(nc.non_cash, 0), t.grand_total)), 0) AS non_cash_sales
     FROM transactions t
     LEFT JOIN LATERAL (
       SELECT SUM(p.amount) AS non_cash
         FROM payments p
        WHERE p.transaction_id = t.id AND p.method <> 'TUNAI'
     ) nc ON TRUE
    WHERE t.company_id = $1 AND t.shift_id = $2 AND t.status <> 'BATAL'`,
    [companyId, shift.id]
  );

  const movementResult = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'MASUK' THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN type = 'KELUAR' THEN amount ELSE 0 END), 0) AS cash_out
     FROM cash_movements
    WHERE company_id = $1 AND shift_id = $2`,
    [companyId, shift.id]
  );

  const totalCashSales = roundMoney(toNumber(salesResult.rows[0]?.cash_sales));
  const totalNonCashSales = roundMoney(
    toNumber(salesResult.rows[0]?.non_cash_sales)
  );
  const totalCashIn = roundMoney(toNumber(movementResult.rows[0]?.cash_in));
  const totalCashOut = roundMoney(toNumber(movementResult.rows[0]?.cash_out));

  await client.query(
    `UPDATE pos_shifts
        SET total_cash_sales = $3,
            total_non_cash_sales = $4,
            total_cash_in = $5,
            total_cash_out = $6,
            expected_cash = initial_cash + $3 + $5 - $6
      WHERE company_id = $1 AND id = $2`,
    [
      companyId,
      shift.id,
      totalCashSales,
      totalNonCashSales,
      totalCashIn,
      totalCashOut,
    ]
  );
}

interface CheckoutItemInput {
  productId?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
  discountRp?: unknown;
}

interface CheckoutPaymentInput {
  method?: unknown;
  amount?: unknown;
  bankName?: unknown;
  cardLastFour?: unknown;
  traceNumber?: unknown;
  qrRef?: unknown;
  dueDate?: unknown;
}

function parseDay(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ApiError(400, `${field} harus berupa tanggal yang valid.`);
  }
  return value.slice(0, 10);
}

/**
 * POST /api/v1/pos/checkout
 * Membuat nota penjualan secara atomik: simpan transaksi, item, pembayaran,
 * potong stok, update shift kas, dan poin pelanggan.
 */
router.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const invoiceNo = requireString(body.invoiceNo, 'invoiceNo', {
      maxLength: 100,
    });
    const rawItems = body.items;
    const rawPayments = body.payments;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new ApiError(400, 'items wajib berisi minimal satu produk.');
    }
    if (!Array.isArray(rawPayments) || rawPayments.length === 0) {
      throw new ApiError(400, 'payments wajib berisi minimal satu metode bayar.');
    }

    const items = (rawItems as CheckoutItemInput[]).map((raw, index) => {
      const item = raw ?? {};
      const productId = requireString(
        item.productId,
        `items[${index}].productId`,
        { maxLength: 64 }
      );
      if (!isUuid(productId)) {
        throw new ApiError(
          400,
          `items[${index}].productId harus berupa UUID produk.`
        );
      }
      return {
        productId,
        qty: parseInteger(item.qty, `items[${index}].qty`, { min: 1 }),
        unitPrice: parseMoney(item.unitPrice, `items[${index}].unitPrice`, {
          min: 0,
        }),
        discountRp: parseMoney(
          item.discountRp,
          `items[${index}].discountRp`,
          { min: 0, fallback: 0 }
        ),
      };
    });

    const payments = (rawPayments as CheckoutPaymentInput[]).map(
      (raw, index) => {
        const payment = raw ?? {};
        const method = requireString(
          payment.method,
          `payments[${index}].method`
        ).toUpperCase();

        if (!PAYMENT_METHODS.has(method)) {
          throw new ApiError(
            400,
            `payments[${index}].method tidak dikenal. Gunakan salah satu: ${[
              ...PAYMENT_METHODS,
            ].join(', ')}.`
          );
        }

        return {
          method,
          amount: parseMoney(
            payment.amount,
            `payments[${index}].amount`,
            { min: 0 }
          ),
          bankName: optionalString(
            payment.bankName,
            `payments[${index}].bankName`,
            50
          ),
          cardLastFour: optionalString(
            payment.cardLastFour,
            `payments[${index}].cardLastFour`,
            10
          ),
          traceNumber: optionalString(
            payment.traceNumber,
            `payments[${index}].traceNumber`,
            100
          ),
          qrRef: optionalString(
            payment.qrRef,
            `payments[${index}].qrRef`,
            100
          ),
          dueDate: parseDay(
            payment.dueDate,
            `payments[${index}].dueDate`
          ),
        };
      }
    );

    const customerId = optionalUuid(body.customerId, 'customerId');
    const pointsRedeemed = parseInteger(body.pointsRedeemed, 'pointsRedeemed', {
      min: 0,
      fallback: 0,
    });

    if (pointsRedeemed > 0 && !customerId) {
      throw new ApiError(
        422,
        'pointsRedeemed memerlukan customerId pelanggan terdaftar.'
      );
    }

    const requestedCustomerName = optionalString(
      body.customerName,
      'customerName',
      255
    );
    const requestedShiftId = optionalUuid(body.shiftId, 'shiftId');
    const notes = optionalString(body.notes, 'notes', 1000);
    const requestedCustomerPhone = optionalString(
      body.customerPhone,
      'customerPhone',
      50
    );
    const outletId = optionalString(body.outletId, 'outletId', 50);

    // Pastikan cabang yang dikirim benar-benar milik tenant ini.
    if (outletId) {
      const outletResult = await query(
        `SELECT id FROM outlets
          WHERE company_id = $1 AND id = $2 AND is_active = TRUE
          LIMIT 1`,
        [companyId, outletId]
      );
      if (outletResult.rows.length === 0) {
        throw new ApiError(
          422,
          'Cabang transaksi tidak ditemukan atau sedang nonaktif.'
        );
      }
    }

    const result = await withTransaction(async (client) => {
      // 1. Lock produk agar stok tidak bisa oversell saat checkout bersamaan.
      const productIds = [...new Set(items.map((item) => item.productId))];
      const productResult = await client.query(
        `SELECT *
           FROM products
          WHERE company_id = $1 AND id = ANY($2::uuid[])
          FOR UPDATE`,
        [companyId, productIds]
      );

      const productMap = new Map<string, Record<string, any>>(
        productResult.rows.map((row) => [String(row.id), row])
      );

      let rawSubtotal = 0;
      let itemDiscountTotal = 0;
      let purchasedQty = 0;

      for (const item of items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new ApiError(
            422,
            `Produk ${item.productId} tidak ditemukan pada tenant ini.`
          );
        }
        if (product.is_active === false) {
          throw new ApiError(422, `Produk ${product.name} sedang tidak aktif.`);
        }
        if (item.unitPrice <= 0) {
          throw new ApiError(
            422,
            `Harga jual produk ${product.name} tidak valid.`
          );
        }
        if (item.discountRp > item.unitPrice) {
          throw new ApiError(
            422,
            `Diskon produk ${product.name} melebihi harga satuan.`
          );
        }
        if (toNumber(product.stock) < item.qty) {
          throw new ApiError(
            422,
            `Stok ${product.name} tidak cukup (tersedia ${product.stock}, diminta ${item.qty}).`
          );
        }

        rawSubtotal += item.unitPrice * item.qty;
        itemDiscountTotal += item.discountRp * item.qty;
        purchasedQty += item.qty;
      }

      rawSubtotal = roundMoney(rawSubtotal);
      itemDiscountTotal = roundMoney(itemDiscountTotal);

      // Validasi program poin di server: status aktif, nilai tukar, dan
      // minimal poin tidak boleh hanya dipercaya dari perhitungan klien.
      const pointSettings = await loadPointSettings(client, companyId);
      const pointProgramActive = isPointProgramActive(pointSettings);
      let pointDiscount = 0;

      if (pointsRedeemed > 0) {
        if (!pointSettings) {
          throw new ApiError(
            422,
            'Program poin belum diatur oleh administrator.'
          );
        }
        if (!pointProgramActive) {
          throw new ApiError(
            422,
            'Program poin sedang tidak aktif atau di luar periode berlaku.'
          );
        }

        const redeemValue = toNumber(pointSettings.redeem_value);
        const minRedeemPoints = Math.max(
          0,
          Math.floor(toNumber(pointSettings.min_redeem_points))
        );

        if (redeemValue <= 0) {
          throw new ApiError(422, 'Nilai tukar poin belum diatur.');
        }
        if (pointsRedeemed < minRedeemPoints) {
          throw new ApiError(
            422,
            `Minimal penukaran poin adalah ${minRedeemPoints} poin.`
          );
        }

        pointDiscount = roundMoney(pointsRedeemed * redeemValue);
      }

      const earnedPoints = countEarnedPoints(pointSettings, items);

      const discountTotal =
        body.discountTotal === undefined
          ? roundMoney(itemDiscountTotal + pointDiscount)
          : parseMoney(body.discountTotal, 'discountTotal', { min: 0 });

      if (discountTotal + 0.01 < itemDiscountTotal + pointDiscount) {
        throw new ApiError(
          422,
          'discountTotal lebih kecil dari diskon item + nilai tukar poin.'
        );
      }
      if (discountTotal > rawSubtotal + 0.01) {
        throw new ApiError(422, 'discountTotal melebihi subtotal transaksi.');
      }

      const taxTotal =
        body.taxTotal === undefined
          ? 0
          : parseMoney(body.taxTotal, 'taxTotal', { min: 0 });

      const grandTotal = roundMoney(rawSubtotal - discountTotal + taxTotal);
      if (grandTotal < 0) {
        throw new ApiError(422, 'Grand total tidak boleh negatif.');
      }

      if (body.grandTotal !== undefined) {
        const clientGrandTotal = parseMoney(body.grandTotal, 'grandTotal', {
          min: 0,
        });
        if (Math.abs(clientGrandTotal - grandTotal) > 0.01) {
          throw new ApiError(
            422,
            `grandTotal tidak sesuai perhitungan server (server: ${grandTotal}).`
          );
        }
      }

      const paymentSum = roundMoney(
        payments.reduce((total, payment) => total + payment.amount, 0)
      );
      const hasReceivable = payments.some(
        (payment) => payment.method === 'PIUTANG'
      );

      if (paymentSum + 0.01 < grandTotal && !hasReceivable) {
        throw new ApiError(
          422,
          `Total pembayaran (${paymentSum}) kurang dari grand total (${grandTotal}).`
        );
      }

      const payAmount =
        body.payAmount === undefined
          ? paymentSum
          : parseMoney(body.payAmount, 'payAmount', { min: 0 });

      if (payAmount + 0.01 < paymentSum) {
        throw new ApiError(
          422,
          'payAmount tidak boleh lebih kecil dari jumlah pembayaran.'
        );
      }

      const changeAmount = roundMoney(Math.max(0, payAmount - grandTotal));
      const status = hasReceivable ? 'PIUTANG' : 'LUNAS';

      // 2. Validasi pelanggan (bila dikirim sebagai UUID).
      let resolvedCustomerId: string | null = null;
      let customerName = requestedCustomerName ?? 'Umum (Walk-in)';
      let customerPhone = requestedCustomerPhone;

      if (customerId) {
        const customerResult = await client.query(
          `SELECT id, name, phone, points
             FROM customers
            WHERE company_id = $1 AND id = $2
            FOR UPDATE`,
          [companyId, customerId]
        );

        if (customerResult.rows.length === 0) {
          throw new ApiError(422, 'Pelanggan tidak ditemukan.');
        }

        const customer = customerResult.rows[0];

        if (pointsRedeemed > toNumber(customer.points)) {
          throw new ApiError(
            422,
            `Poin pelanggan tidak cukup (tersedia ${toNumber(customer.points)}, diminta ${pointsRedeemed}).`
          );
        }

        resolvedCustomerId = String(customer.id);
        customerName = String(customer.name);
        customerPhone = customerPhone ?? (customer.phone ?? null);
      }

      // 3. Tentukan shift aktif kasir (opsional bila kasir belum buka shift).
      let shiftId: string | null = null;

      if (requestedShiftId) {
        const shiftResult = await client.query(
          `SELECT id, outlet_id
             FROM pos_shifts
            WHERE company_id = $1 AND id = $2 AND status = 'OPEN'`,
          [companyId, requestedShiftId]
        );

        if (shiftResult.rows.length === 0) {
          throw new ApiError(422, 'Shift tidak ditemukan atau sudah ditutup.');
        }
        if (
          outletId &&
          shiftResult.rows[0].outlet_id &&
          String(shiftResult.rows[0].outlet_id) !== outletId
        ) {
          throw new ApiError(
            422,
            'Shift yang dipilih bukan milik cabang yang sedang aktif.'
          );
        }

        shiftId = String(shiftResult.rows[0].id);
      } else {
        const shiftParams: unknown[] = [companyId, req.user!.id];
        let outletCondition = '';

        if (outletId) {
          shiftParams.push(outletId);
          outletCondition = ` AND (outlet_id IS NULL OR outlet_id = $${shiftParams.length})`;
        }

        const shiftResult = await client.query(
          `SELECT id
             FROM pos_shifts
            WHERE company_id = $1 AND cashier_id = $2 AND status = 'OPEN'${outletCondition}
            ORDER BY start_time DESC
            LIMIT 1`,
          shiftParams
        );

        shiftId = shiftResult.rows[0] ? String(shiftResult.rows[0].id) : null;
      }

      // 4. Simpan header nota.
      const transactionResult = await client.query(
        `INSERT INTO transactions
           (company_id, invoice_no, shift_id, cashier_id, cashier_name,
            customer_id, customer_name, customer_phone, outlet_id,
            subtotal, discount_total, tax_total, grand_total, pay_amount,
            change_amount, status, notes, points_earned, points_redeemed,
            point_discount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16, $17, $18, $19, $20)
         RETURNING *`,
        [
          companyId,
          invoiceNo,
          shiftId,
          req.user!.id,
          req.user!.name || req.user!.userId || 'KASIR',
          resolvedCustomerId,
          customerName,
          customerPhone,
          outletId,
          rawSubtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          payAmount,
          changeAmount,
          status,
          notes,
          earnedPoints,
          pointsRedeemed,
          pointDiscount,
        ]
      );

      const transaction = transactionResult.rows[0];

      // 5. Simpan item + potong stok.
      const insertedItems: Record<string, any>[] = [];

      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const lineSubtotal = roundMoney(
          (item.unitPrice - item.discountRp) * item.qty
        );

        const itemResult = await client.query(
          `INSERT INTO transaction_items
             (transaction_id, product_id, product_name, qty, unit,
              cost_price, unit_price, discount_rp, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            transaction.id,
            item.productId,
            product.name,
            item.qty,
            product.unit,
            toNumber(product.cost_price),
            item.unitPrice,
            item.discountRp,
            lineSubtotal,
          ]
        );

        insertedItems.push(itemResult.rows[0]);

        await client.query(
          `UPDATE products
              SET stock = stock - $3, updated_at = NOW()
            WHERE company_id = $1 AND id = $2`,
          [companyId, item.productId, item.qty]
        );
      }

      // 6. Simpan pembayaran.
      const insertedPayments: Record<string, any>[] = [];

      for (const payment of payments) {
        const paymentResult = await client.query(
          `INSERT INTO payments
             (transaction_id, method, amount, bank_name, card_last_four,
              trace_number, qr_ref, due_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            transaction.id,
            payment.method,
            payment.amount,
            payment.bankName,
            payment.cardLastFour,
            payment.traceNumber,
            payment.qrRef,
            payment.dueDate,
          ]
        );

        insertedPayments.push(paymentResult.rows[0]);
      }

      // 7. Update rekap shift: kas fisik = grand total - pembayaran non-tunai.
      if (shiftId) {
        const nonCash = roundMoney(
          payments
            .filter((payment) => payment.method !== 'TUNAI')
            .reduce((total, payment) => total + payment.amount, 0)
        );
        const cashPortion = roundMoney(Math.max(0, grandTotal - nonCash));
        const nonCashPortion = roundMoney(grandTotal - cashPortion);

        await client.query(
          `UPDATE pos_shifts
              SET total_cash_sales = total_cash_sales + $3,
                  total_non_cash_sales = total_non_cash_sales + $4,
                  expected_cash = initial_cash + total_cash_sales + $3
                                  + total_cash_in - total_cash_out
            WHERE company_id = $1 AND id = $2`,
          [companyId, shiftId, cashPortion, nonCashPortion]
        );
      }

      // 8. Perbarui poin loyalitas memakai poin per produk dari point_settings.
      if (resolvedCustomerId && (earnedPoints > 0 || pointsRedeemed > 0)) {
        await client.query(
          `UPDATE customers
              SET points = GREATEST(points - $3 + $4, 0)
            WHERE company_id = $1 AND id = $2`,
          [companyId, resolvedCustomerId, pointsRedeemed, earnedPoints]
        );
      }

      return { transaction, insertedItems, insertedPayments };
    });

    res.status(201).json({
      success: true,
      data: mapTransaction({
        ...result.transaction,
        items: result.insertedItems,
        payments: result.insertedPayments,
      }),
    });
  })
);

/**
 * POST /api/v1/pos/transactions/:id/void
 * Body: { password, reason? }
 * Membatalkan nota: stok dikembalikan, poin belanja ditarik, dan rekap shift
 * yang masih OPEN dihitung ulang dari transaksi yang tersisa.
 * Password akun yang sedang login wajib dikirim sebagai otorisasi ulang.
 */
router.post(
  '/transactions/:id/void',
  requireRole('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id transaksi harus berupa UUID yang valid.');
    }

    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const password = requireString(body.password, 'password', {
      maxLength: 200,
    });
    const reason =
      optionalString(body.reason, 'reason', 500) ?? 'Void oleh supervisor';
    const cashierName = req.user!.name || req.user!.userId || 'SUPERVISOR';

    const credentialResult = await query(
      `SELECT password_hash
         FROM users
        WHERE company_id = $1 AND id = $2 AND is_active = TRUE`,
      [companyId, req.user!.id]
    );

    if (credentialResult.rows.length === 0) {
      throw new ApiError(401, 'Akun otorisasi tidak ditemukan atau nonaktif.');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      String(credentialResult.rows[0].password_hash)
    );

    if (!passwordMatches) {
      throw new ApiError(403, 'Password otorisasi salah. Void dibatalkan.');
    }

    const result = await withTransaction(async (client) => {
      const transactionResult = await client.query(
        `SELECT *
           FROM transactions
          WHERE company_id = $1 AND id = $2
          FOR UPDATE`,
        [companyId, req.params.id]
      );

      if (transactionResult.rows.length === 0) {
        throw new ApiError(404, 'Transaksi tidak ditemukan.');
      }

      const transaction = transactionResult.rows[0];

      if (transaction.status === 'BATAL') {
        throw new ApiError(409, 'Transaksi sudah dibatalkan sebelumnya.');
      }
      if (transaction.status === 'RETUR') {
        throw new ApiError(
          409,
          'Transaksi sudah diretur dan tidak dapat dibatalkan.'
        );
      }

      const itemResult = await client.query(
        `SELECT product_id, qty
           FROM transaction_items
          WHERE transaction_id = $1`,
        [transaction.id]
      );

      for (const item of itemResult.rows) {
        await client.query(
          `UPDATE products
              SET stock = stock + $3, updated_at = NOW()
            WHERE company_id = $1 AND id = $2`,
          [companyId, item.product_id, item.qty]
        );
      }

      // Rekap shift hanya dihitung ulang bila shift masih terbuka.
      if (transaction.shift_id) {
        await recalculateShiftTotals(
          client,
          companyId,
          String(transaction.shift_id)
        );
      }

      // Kembalikan poin: tarik poin yang didapat, kembalikan poin yang ditukar.
      if (transaction.customer_id) {
        const earnedPoints = Math.max(
          0,
          Math.floor(toNumber(transaction.points_earned))
        );
        const redeemedPoints = Math.max(
          0,
          Math.floor(toNumber(transaction.points_redeemed))
        );

        if (earnedPoints > 0 || redeemedPoints > 0) {
          await client.query(
            `UPDATE customers
                SET points = GREATEST(points - $3 + $4, 0)
              WHERE company_id = $1 AND id = $2`,
            [companyId, transaction.customer_id, earnedPoints, redeemedPoints]
          );
        }
      }

      await client.query(
        `UPDATE transactions
            SET status = 'BATAL',
                notes = COALESCE(notes || ' | ', '') || $3
          WHERE company_id = $1 AND id = $2`,
        [
          companyId,
          transaction.id,
          `[VOID by ${cashierName} - ${reason}]`,
        ]
      );

      const updated = await client.query(
        `${TRANSACTION_SELECT}
          WHERE t.company_id = $1 AND t.id = $2
          LIMIT 1`,
        [companyId, transaction.id]
      );

      return updated.rows[0];
    });

    res.json({ success: true, data: mapTransaction(result) });
  })
);

/**
 * PUT /api/v1/pos/transactions/:id
 * Body: { password, reason, items, payments, customerName?, customerPhone?,
 *         taxTotal? }
 *
 * Koreksi nota oleh supervisor/admin. Endpoint ini merekonsiliasi seluruh
 * dampak transaksi dalam satu transaksi database:
 * - selisih stok item lama vs item baru,
 * - penggantian rincian item dan pembayaran,
 * - poin member (poin didapat dihitung ulang, poin ditukar dipertahankan),
 * - agregat kas shift yang masih OPEN.
 */
router.put(
  '/transactions/:id',
  requireRole('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id transaksi harus berupa UUID yang valid.');
    }

    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const password = requireString(body.password, 'password', {
      maxLength: 200,
    });
    const reason = requireString(body.reason, 'reason', { maxLength: 500 });
    const cashierName = req.user!.name || req.user!.userId || 'SUPERVISOR';

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new ApiError(400, 'items wajib berisi minimal satu produk.');
    }
    if (!Array.isArray(body.payments) || body.payments.length === 0) {
      throw new ApiError(400, 'payments wajib berisi minimal satu metode bayar.');
    }

    const items = (body.items as CheckoutItemInput[]).map((raw, index) => {
      const item = raw ?? {};
      const productId = requireString(
        item.productId,
        `items[${index}].productId`,
        { maxLength: 64 }
      );
      if (!isUuid(productId)) {
        throw new ApiError(
          400,
          `items[${index}].productId harus berupa UUID produk.`
        );
      }
      return {
        productId,
        qty: parseInteger(item.qty, `items[${index}].qty`, { min: 1 }),
        unitPrice: parseMoney(item.unitPrice, `items[${index}].unitPrice`, {
          min: 0,
        }),
        discountRp: parseMoney(
          item.discountRp,
          `items[${index}].discountRp`,
          { min: 0, fallback: 0 }
        ),
      };
    });

    const payments = (body.payments as CheckoutPaymentInput[]).map(
      (raw, index) => {
        const payment = raw ?? {};
        const method = requireString(
          payment.method,
          `payments[${index}].method`
        ).toUpperCase();

        if (!PAYMENT_METHODS.has(method)) {
          throw new ApiError(
            400,
            `payments[${index}].method tidak dikenal. Gunakan salah satu: ${[
              ...PAYMENT_METHODS,
            ].join(', ')}.`
          );
        }

        return {
          method,
          amount: parseMoney(
            payment.amount,
            `payments[${index}].amount`,
            { min: 0 }
          ),
          bankName: optionalString(
            payment.bankName,
            `payments[${index}].bankName`,
            50
          ),
          cardLastFour: optionalString(
            payment.cardLastFour,
            `payments[${index}].cardLastFour`,
            10
          ),
          traceNumber: optionalString(
            payment.traceNumber,
            `payments[${index}].traceNumber`,
            100
          ),
          qrRef: optionalString(
            payment.qrRef,
            `payments[${index}].qrRef`,
            100
          ),
          dueDate: parseDay(
            payment.dueDate,
            `payments[${index}].dueDate`
          ),
        };
      }
    );

    const credentialResult = await query(
      `SELECT password_hash
         FROM users
        WHERE company_id = $1 AND id = $2 AND is_active = TRUE`,
      [companyId, req.user!.id]
    );

    if (credentialResult.rows.length === 0) {
      throw new ApiError(401, 'Akun otorisasi tidak ditemukan atau nonaktif.');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      String(credentialResult.rows[0].password_hash)
    );

    if (!passwordMatches) {
      throw new ApiError(403, 'Password otorisasi salah. Koreksi dibatalkan.');
    }

    const requestedCustomerName = optionalString(
      body.customerName,
      'customerName',
      255
    );
    const requestedCustomerPhone = optionalString(
      body.customerPhone,
      'customerPhone',
      50
    );
    const requestedTaxTotal =
      body.taxTotal === undefined
        ? null
        : parseMoney(body.taxTotal, 'taxTotal', { min: 0 });

    const result = await withTransaction(async (client) => {
      const transactionResult = await client.query(
        `SELECT *
           FROM transactions
          WHERE company_id = $1 AND id = $2
          FOR UPDATE`,
        [companyId, req.params.id]
      );

      if (transactionResult.rows.length === 0) {
        throw new ApiError(404, 'Transaksi tidak ditemukan.');
      }

      const transaction = transactionResult.rows[0];

      if (transaction.status === 'BATAL') {
        throw new ApiError(409, 'Transaksi yang sudah void tidak dapat dikoreksi.');
      }
      if (transaction.status === 'RETUR') {
        throw new ApiError(409, 'Transaksi yang sudah diretur tidak dapat dikoreksi.');
      }

      const oldItemResult = await client.query(
        `SELECT * FROM transaction_items WHERE transaction_id = $1`,
        [transaction.id]
      );

      const oldQtyByProduct = new Map<string, number>();
      let oldItemDiscountTotal = 0;

      for (const row of oldItemResult.rows) {
        const productId = String(row.product_id);
        oldQtyByProduct.set(
          productId,
          (oldQtyByProduct.get(productId) ?? 0) + toNumber(row.qty)
        );
        oldItemDiscountTotal +=
          toNumber(row.discount_rp) * toNumber(row.qty);
      }
      oldItemDiscountTotal = roundMoney(oldItemDiscountTotal);

      const newQtyByProduct = new Map<string, number>();
      let rawSubtotal = 0;
      let itemDiscountTotal = 0;

      for (const item of items) {
        newQtyByProduct.set(
          item.productId,
          (newQtyByProduct.get(item.productId) ?? 0) + item.qty
        );
        rawSubtotal += item.unitPrice * item.qty;
        itemDiscountTotal += item.discountRp * item.qty;
      }
      rawSubtotal = roundMoney(rawSubtotal);
      itemDiscountTotal = roundMoney(itemDiscountTotal);

      // Lock seluruh produk lama & baru agar koreksi bersamaan tetap aman.
      const productIds = [
        ...new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]),
      ];
      const productResult = await client.query(
        `SELECT * FROM products
          WHERE company_id = $1 AND id = ANY($2::uuid[])
          FOR UPDATE`,
        [companyId, productIds]
      );
      const productMap = new Map<string, Record<string, any>>(
        productResult.rows.map((row) => [String(row.id), row])
      );

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new ApiError(
            422,
            `Produk ${item.productId} tidak ditemukan pada tenant ini.`
          );
        }
        if (product.is_active === false) {
          throw new ApiError(422, `Produk ${product.name} sedang tidak aktif.`);
        }
        if (item.unitPrice <= 0) {
          throw new ApiError(
            422,
            `Harga jual produk ${product.name} tidak valid.`
          );
        }
        if (item.discountRp > item.unitPrice) {
          throw new ApiError(
            422,
            `Diskon produk ${product.name} melebihi harga satuan.`
          );
        }
      }

      // Selisih stok: qty baru - qty lama. Positif berarti stok berkurang.
      for (const productId of productIds) {
        const delta =
          (newQtyByProduct.get(productId) ?? 0) -
          (oldQtyByProduct.get(productId) ?? 0);

        if (delta === 0) continue;

        const product = productMap.get(productId);

        if (delta > 0) {
          if (!product) {
            throw new ApiError(
              422,
              `Produk ${productId} tidak ditemukan untuk penambahan qty.`
            );
          }
          if (toNumber(product.stock) < delta) {
            throw new ApiError(
              422,
              `Stok ${product.name} tidak cukup untuk koreksi (tersedia ${product.stock}, tambahan ${delta}).`
            );
          }
        }

        await client.query(
          `UPDATE products
              SET stock = stock - $3, updated_at = NOW()
            WHERE company_id = $1 AND id = $2`,
          [companyId, productId, delta]
        );
      }

      const pointSettings = await loadPointSettings(client, companyId);
      const earnedPoints = countEarnedPoints(pointSettings, items);
      const previousEarnedPoints = Math.max(
        0,
        Math.floor(toNumber(transaction.points_earned))
      );
      const pointsRedeemed = Math.max(
        0,
        Math.floor(toNumber(transaction.points_redeemed))
      );
      const pointDiscount = Math.max(0, toNumber(transaction.point_discount));
      const invoiceDiscount = roundMoney(
        Math.max(
          0,
          toNumber(transaction.discount_total) -
            oldItemDiscountTotal -
            pointDiscount
        )
      );

      if (pointDiscount > rawSubtotal - itemDiscountTotal + 0.01) {
        throw new ApiError(
          422,
          'Nilai tukar poin pada nota ini melebihi subtotal setelah koreksi. Void nota lalu buat transaksi baru.'
        );
      }

      const discountTotal = roundMoney(
        itemDiscountTotal + invoiceDiscount + pointDiscount
      );

      if (discountTotal > rawSubtotal + 0.01) {
        throw new ApiError(422, 'Total diskon melebihi subtotal transaksi.');
      }

      const taxTotal =
        requestedTaxTotal ?? roundMoney(toNumber(transaction.tax_total));
      const grandTotal = roundMoney(rawSubtotal - discountTotal + taxTotal);

      if (grandTotal < 0) {
        throw new ApiError(422, 'Grand total tidak boleh negatif.');
      }

      const paymentSum = roundMoney(
        payments.reduce((total, payment) => total + payment.amount, 0)
      );
      const hasReceivable = payments.some(
        (payment) => payment.method === 'PIUTANG'
      );

      if (paymentSum + 0.01 < grandTotal && !hasReceivable) {
        throw new ApiError(
          422,
          `Total pembayaran (${paymentSum}) kurang dari grand total (${grandTotal}).`
        );
      }

      const changeAmount = roundMoney(Math.max(0, paymentSum - grandTotal));
      const status = hasReceivable ? 'PIUTANG' : 'LUNAS';

      await client.query(
        `UPDATE transactions
            SET customer_name = $3,
                customer_phone = $4,
                subtotal = $5,
                discount_total = $6,
                tax_total = $7,
                grand_total = $8,
                pay_amount = $9,
                change_amount = $10,
                status = $11,
                points_earned = $12,
                notes = CASE
                          WHEN notes IS NULL OR notes = '' THEN $13
                          ELSE notes || ' | ' || $13
                        END
          WHERE company_id = $1 AND id = $2`,
        [
          companyId,
          transaction.id,
          requestedCustomerName ?? transaction.customer_name,
          requestedCustomerPhone ?? transaction.customer_phone,
          rawSubtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          paymentSum,
          changeAmount,
          status,
          earnedPoints,
          `[KOREKSI by ${cashierName} - ${reason}]`,
        ]
      );

      await client.query(
        `DELETE FROM transaction_items WHERE transaction_id = $1`,
        [transaction.id]
      );

      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const lineSubtotal = roundMoney(
          (item.unitPrice - item.discountRp) * item.qty
        );

        await client.query(
          `INSERT INTO transaction_items
             (transaction_id, product_id, product_name, qty, unit,
              cost_price, unit_price, discount_rp, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            transaction.id,
            item.productId,
            product.name,
            item.qty,
            product.unit,
            toNumber(product.cost_price),
            item.unitPrice,
            item.discountRp,
            lineSubtotal,
          ]
        );
      }

      await client.query(`DELETE FROM payments WHERE transaction_id = $1`, [
        transaction.id,
      ]);

      for (const payment of payments) {
        await client.query(
          `INSERT INTO payments
             (transaction_id, method, amount, bank_name, card_last_four,
              trace_number, qr_ref, due_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            transaction.id,
            payment.method,
            payment.amount,
            payment.bankName,
            payment.cardLastFour,
            payment.traceNumber,
            payment.qrRef,
            payment.dueDate,
          ]
        );
      }

      // Sesuaikan poin member hanya untuk selisih poin yang didapat.
      if (transaction.customer_id) {
        const pointsDelta = earnedPoints - previousEarnedPoints;
        if (pointsDelta !== 0) {
          await client.query(
            `UPDATE customers
                SET points = GREATEST(points + $3, 0)
              WHERE company_id = $1 AND id = $2`,
            [companyId, transaction.customer_id, pointsDelta]
          );
        }
      }

      if (transaction.shift_id) {
        await recalculateShiftTotals(
          client,
          companyId,
          String(transaction.shift_id)
        );
      }

      const updated = await client.query(
        `${TRANSACTION_SELECT}
          WHERE t.company_id = $1 AND t.id = $2
          LIMIT 1`,
        [companyId, transaction.id]
      );

      return updated.rows[0];
    });

    res.json({ success: true, data: mapTransaction(result) });
  })
);

/**
 * GET /api/v1/pos/transactions?from=&to=&status=&invoiceNo=&limit=&offset=
 */
router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const invoiceNo = readQueryString(req.query.invoiceNo);
    const status = readQueryString(req.query.status).toUpperCase();
    const from = readQueryString(req.query.from);
    const to = readQueryString(req.query.to);
    const limit = parseInteger(req.query.limit, 'limit', {
      min: 1,
      max: 200,
      fallback: 50,
    });
    const offset = parseInteger(req.query.offset, 'offset', {
      min: 0,
      fallback: 0,
    });

    const filterParams: unknown[] = [companyId];
    const conditions = ['t.company_id = $1'];

    if (invoiceNo) {
      filterParams.push(`%${invoiceNo}%`);
      conditions.push(`t.invoice_no ILIKE $${filterParams.length}`);
    }

    if (status) {
      filterParams.push(status);
      conditions.push(`t.status = $${filterParams.length}`);
    }

    if (from) {
      filterParams.push(parseDay(from, 'from'));
      conditions.push(`t.created_at >= $${filterParams.length}::date`);
    }

    if (to) {
      filterParams.push(parseDay(to, 'to'));
      conditions.push(
        `t.created_at < ($${filterParams.length}::date + INTERVAL '1 day')`
      );
    }

    const whereClause = conditions.join(' AND ');

    const [listResult, countResult] = await Promise.all([
      query(
        `${TRANSACTION_SELECT}
          WHERE ${whereClause}
          ORDER BY t.created_at DESC
          LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
        [...filterParams, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM transactions t WHERE ${whereClause}`,
        filterParams
      ),
    ]);

    res.json({
      success: true,
      data: listResult.rows.map(mapTransaction),
      meta: {
        total: Number(countResult.rows[0]?.count ?? 0),
        limit,
        offset,
      },
    });
  })
);

/**
 * GET /api/v1/pos/transactions/:invoiceNo
 */
router.get(
  '/transactions/:invoiceNo',
  asyncHandler(async (req, res) => {
    const invoiceNo = requireString(req.params.invoiceNo, 'invoiceNo', {
      maxLength: 100,
    });

    const { rows } = await query(
      `${TRANSACTION_SELECT}
        WHERE t.company_id = $1 AND t.invoice_no = $2
        LIMIT 1`,
      [req.user!.companyId, invoiceNo]
    );

    if (rows.length === 0) {
      throw new ApiError(404, `Nota ${invoiceNo} tidak ditemukan.`);
    }

    res.json({ success: true, data: mapTransaction(rows[0]) });
  })
);

/**
 * POST /api/v1/pos/returns
 * Body: { returnNo, invoiceNo, refundMethod, items: [{ productId, qty, reason? }], note? }
 * Mengembalikan stok dan mencatat refund secara atomik.
 */
router.post(
  '/returns',
  requireRole('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const returnNo = requireString(body.returnNo, 'returnNo', {
      maxLength: 100,
    });
    const invoiceNo = requireString(body.invoiceNo, 'invoiceNo', {
      maxLength: 100,
    });
    const refundMethod = requireString(
      body.refundMethod,
      'refundMethod'
    ).toUpperCase();

    if (!REFUND_METHODS.has(refundMethod)) {
      throw new ApiError(
        400,
        `refundMethod harus salah satu dari: ${[...REFUND_METHODS].join(', ')}.`
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new ApiError(400, 'items retur wajib berisi minimal satu produk.');
    }

    const returnItems = (body.items as Record<string, unknown>[]).map(
      (raw, index) => {
        const productId = requireString(
          raw?.productId,
          `items[${index}].productId`,
          { maxLength: 64 }
        );
        if (!isUuid(productId)) {
          throw new ApiError(
            400,
            `items[${index}].productId harus berupa UUID produk.`
          );
        }
        return {
          productId,
          qty: parseInteger(raw?.qty, `items[${index}].qty`, { min: 1 }),
          reason: optionalString(
            raw?.reason,
            `items[${index}].reason`,
            255
          ),
        };
      }
    );

    const cashierName =
      req.user!.name || req.user!.userId || 'KASIR';

    const result = await withTransaction(async (client) => {
      const duplicate = await client.query(
        `SELECT 1 FROM sales_returns
          WHERE company_id = $1 AND return_no = $2
          LIMIT 1`,
        [companyId, returnNo]
      );

      if (duplicate.rows.length > 0) {
        throw new ApiError(409, `Nomor retur ${returnNo} sudah digunakan.`);
      }

      const transactionResult = await client.query(
        `SELECT *
           FROM transactions
          WHERE company_id = $1 AND invoice_no = $2
          FOR UPDATE`,
        [companyId, invoiceNo]
      );

      if (transactionResult.rows.length === 0) {
        throw new ApiError(404, `Nota ${invoiceNo} tidak ditemukan.`);
      }

      const transaction = transactionResult.rows[0];

      const itemResult = await client.query(
        `SELECT *
           FROM transaction_items
          WHERE transaction_id = $1`,
        [transaction.id]
      );

      const purchasedMap = new Map<string, Record<string, any>>();
      for (const row of itemResult.rows) {
        purchasedMap.set(String(row.product_id), row);
      }

      const returnPayload: Record<string, unknown>[] = [];
      let totalRefund = 0;

      for (const returnItem of returnItems) {
        const purchased = purchasedMap.get(returnItem.productId);

        if (!purchased) {
          throw new ApiError(
            422,
            `Produk ${returnItem.productId} tidak ada pada nota ${invoiceNo}.`
          );
        }
        if (returnItem.qty > toNumber(purchased.qty)) {
          throw new ApiError(
            422,
            `Qty retur ${purchased.product_name} melebihi qty pembelian (${purchased.qty}).`
          );
        }

        const price = roundMoney(
          toNumber(purchased.unit_price) - toNumber(purchased.discount_rp)
        );
        const subtotal = roundMoney(price * returnItem.qty);
        totalRefund = roundMoney(totalRefund + subtotal);

        returnPayload.push({
          productId: returnItem.productId,
          productName: purchased.product_name,
          qty: returnItem.qty,
          price,
          subtotal,
          reason: returnItem.reason ?? 'Retur penjualan',
        });
      }

      if (totalRefund <= 0) {
        throw new ApiError(422, 'Total refund tidak valid.');
      }

      const returnResult = await client.query(
        `INSERT INTO sales_returns
           (company_id, return_no, invoice_no, total_refund, refund_method,
            cashier_name, items_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [
          companyId,
          returnNo,
          invoiceNo,
          totalRefund,
          refundMethod,
          cashierName,
          JSON.stringify(returnPayload),
        ]
      );

      // Kembalikan stok.
      for (const returnItem of returnItems) {
        await client.query(
          `UPDATE products
              SET stock = stock + $3, updated_at = NOW()
            WHERE company_id = $1 AND id = $2`,
          [companyId, returnItem.productId, returnItem.qty]
        );
      }

      // Bila seluruh item nota diretur, tandai nota sebagai RETUR.
      const fullyReturned = itemResult.rows.every((purchased) => {
        const returned = returnItems.find(
          (item) => item.productId === String(purchased.product_id)
        );
        return returned && returned.qty === toNumber(purchased.qty);
      });

      if (fullyReturned) {
        await client.query(
          `UPDATE transactions SET status = 'RETUR' WHERE id = $1`,
          [transaction.id]
        );
      }

      // Refund tunai mengurangi kas shift aktif (tercatat sebagai kas keluar).
      if (refundMethod === 'TUNAI') {
        const shiftResult = await client.query(
          `SELECT id
             FROM pos_shifts
            WHERE company_id = $1 AND cashier_id = $2 AND status = 'OPEN'
            ORDER BY start_time DESC
            LIMIT 1
            FOR UPDATE`,
          [companyId, req.user!.id]
        );

        if (shiftResult.rows.length > 0) {
          const shiftId = String(shiftResult.rows[0].id);

          await client.query(
            `INSERT INTO cash_movements
               (company_id, shift_id, type, amount, reason, cashier_name)
             VALUES ($1, $2, 'KELUAR', $3, $4, $5)`,
            [
              companyId,
              shiftId,
              totalRefund,
              `Refund retur ${returnNo} (nota ${invoiceNo})`,
              cashierName,
            ]
          );

          await client.query(
            `UPDATE pos_shifts
                SET total_cash_out = total_cash_out + $3,
                    expected_cash = initial_cash + total_cash_sales
                                    + total_cash_in - (total_cash_out + $3)
              WHERE company_id = $1 AND id = $2`,
            [companyId, shiftId, totalRefund]
          );
        }
      }

      return returnResult.rows[0];
    });

    res.status(201).json({
      success: true,
      data: mapSalesReturn(result),
    });
  })
);

export default router;
