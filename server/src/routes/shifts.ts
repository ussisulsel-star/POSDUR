import { Router } from 'express';
import { query, withTransaction } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import { mapCashMovement, mapShift, toNumber } from '../utils/serializers';
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

const SHIFT_SELECT = `
  SELECT s.*, u.name AS cashier_name
    FROM pos_shifts s
    JOIN users u ON u.id = s.cashier_id
`;

/**
 * GET /api/v1/shifts/active?all=true
 * Shift OPEN milik kasir yang sedang login (ADMIN dapat melihat semua).
 */
router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const showAll = readQueryString(req.query.all) === 'true';

    if (showAll && req.user!.role === 'ADMIN') {
      const { rows } = await query(
        `${SHIFT_SELECT}
          WHERE s.company_id = $1 AND s.status = 'OPEN'
          ORDER BY s.start_time DESC`,
        [companyId]
      );
      res.json({ success: true, data: rows.map(mapShift) });
      return;
    }

    const { rows } = await query(
      `${SHIFT_SELECT}
        WHERE s.company_id = $1 AND s.cashier_id = $2 AND s.status = 'OPEN'
        ORDER BY s.start_time DESC
        LIMIT 1`,
      [companyId, req.user!.id]
    );

    res.json({
      success: true,
      data: rows[0] ? mapShift(rows[0]) : null,
    });
  })
);

/**
 * POST /api/v1/shifts/open
 * Body: { initialCash, notes? }
 */
router.post(
  '/open',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const initialCash = parseMoney(body.initialCash, 'initialCash', {
      min: 0,
      fallback: 0,
    });
    const notes = optionalString(body.notes, 'notes', 1000);

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id
           FROM pos_shifts
          WHERE company_id = $1 AND cashier_id = $2 AND status = 'OPEN'
          FOR UPDATE`,
        [companyId, req.user!.id]
      );

      if (existing.rows.length > 0) {
        throw new ApiError(
          409,
          'Masih ada shift yang terbuka. Tutup shift tersebut terlebih dahulu.'
        );
      }

      const numberResult = await client.query(
        `SELECT COALESCE(MAX(shift_number), 0) + 1 AS next_number
           FROM pos_shifts
          WHERE company_id = $1`,
        [companyId]
      );

      const shiftNumber = Number(numberResult.rows[0]?.next_number ?? 1);

      const insertResult = await client.query(
        `INSERT INTO pos_shifts
           (company_id, shift_number, cashier_id, initial_cash,
            total_cash_sales, total_non_cash_sales, total_cash_in,
            total_cash_out, expected_cash, status, notes)
         VALUES ($1, $2, $3, $4, 0, 0, 0, 0, $4, 'OPEN', $5)
         RETURNING *`,
        [companyId, shiftNumber, req.user!.id, initialCash, notes]
      );

      return insertResult.rows[0];
    });

    res.status(201).json({
      success: true,
      data: mapShift({
        ...result,
        cashier_name: req.user!.name,
      }),
    });
  })
);

/**
 * POST /api/v1/shifts/close
 * Body: { actualCash, notes? }
 */
router.post(
  '/close',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const actualCash = parseMoney(body.actualCash, 'actualCash', { min: 0 });
    const notes = optionalString(body.notes, 'notes', 1000);

    const result = await withTransaction(async (client) => {
      const shiftResult = await client.query(
        `SELECT *
           FROM pos_shifts
          WHERE company_id = $1 AND cashier_id = $2 AND status = 'OPEN'
          ORDER BY start_time DESC
          LIMIT 1
          FOR UPDATE`,
        [companyId, req.user!.id]
      );

      if (shiftResult.rows.length === 0) {
        throw new ApiError(404, 'Tidak ada shift terbuka untuk ditutup.');
      }

      const shift = shiftResult.rows[0];

      // Hitung ulang dari sumber transaksi agar rekap tidak dapat dimanipulasi.
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

      const totalCashSales = roundMoney(
        toNumber(salesResult.rows[0]?.cash_sales)
      );
      const totalNonCashSales = roundMoney(
        toNumber(salesResult.rows[0]?.non_cash_sales)
      );
      const totalCashIn = roundMoney(
        toNumber(movementResult.rows[0]?.cash_in)
      );
      const totalCashOut = roundMoney(
        toNumber(movementResult.rows[0]?.cash_out)
      );
      const expectedCash = roundMoney(
        toNumber(shift.initial_cash) +
          totalCashSales +
          totalCashIn -
          totalCashOut
      );
      const cashDifference = roundMoney(actualCash - expectedCash);

      const updateResult = await client.query(
        `UPDATE pos_shifts
            SET end_time = NOW(),
                total_cash_sales = $3,
                total_non_cash_sales = $4,
                total_cash_in = $5,
                total_cash_out = $6,
                expected_cash = $7,
                actual_cash = $8,
                cash_difference = $9,
                status = 'CLOSED',
                notes = COALESCE($10, notes)
          WHERE company_id = $1 AND id = $2
          RETURNING *`,
        [
          companyId,
          shift.id,
          totalCashSales,
          totalNonCashSales,
          totalCashIn,
          totalCashOut,
          expectedCash,
          actualCash,
          cashDifference,
          notes,
        ]
      );

      return updateResult.rows[0];
    });

    res.json({
      success: true,
      data: mapShift({
        ...result,
        cashier_name: req.user!.name,
      }),
    });
  })
);

/**
 * POST /api/v1/shifts/cash-movement
 * Body: { type: 'MASUK' | 'KELUAR', amount, reason, shiftId? }
 */
router.post(
  '/cash-movement',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const type = requireString(body.type, 'type').toUpperCase();
    if (type !== 'MASUK' && type !== 'KELUAR') {
      throw new ApiError(400, "type harus 'MASUK' atau 'KELUAR'.");
    }

    const amount = parseMoney(body.amount, 'amount', { min: 0.01 });
    const reason = requireString(body.reason, 'reason', { maxLength: 500 });
    const requestedShiftId = optionalUuid(body.shiftId, 'shiftId');

    const result = await withTransaction(async (client) => {
      let shiftResult;

      if (requestedShiftId) {
        shiftResult = await client.query(
          `SELECT *
             FROM pos_shifts
            WHERE company_id = $1 AND id = $2 AND status = 'OPEN'
            FOR UPDATE`,
          [companyId, requestedShiftId]
        );
      } else {
        shiftResult = await client.query(
          `SELECT *
             FROM pos_shifts
            WHERE company_id = $1 AND cashier_id = $2 AND status = 'OPEN'
            ORDER BY start_time DESC
            LIMIT 1
            FOR UPDATE`,
          [companyId, req.user!.id]
        );
      }

      if (shiftResult.rows.length === 0) {
        throw new ApiError(
          404,
          'Tidak ada shift terbuka. Buka shift terlebih dahulu.'
        );
      }

      const shift = shiftResult.rows[0];
      const expectedCash = toNumber(shift.expected_cash);

      if (type === 'KELUAR' && amount > expectedCash + 0.01) {
        throw new ApiError(
          422,
          `Kas keluar melebihi saldo kas laci (tersedia ${expectedCash}).`
        );
      }

      const movementResult = await client.query(
        `INSERT INTO cash_movements
           (company_id, shift_id, type, amount, reason, cashier_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          companyId,
          shift.id,
          type,
          amount,
          reason,
          req.user!.name || req.user!.userId || 'KASIR',
        ]
      );

      await client.query(
        `UPDATE pos_shifts
            SET total_cash_in = total_cash_in + $3,
                total_cash_out = total_cash_out + $4,
                expected_cash = initial_cash + total_cash_sales
                                + total_cash_in + $3
                                - total_cash_out - $4
          WHERE company_id = $1 AND id = $2`,
        [
          companyId,
          shift.id,
          type === 'MASUK' ? amount : 0,
          type === 'KELUAR' ? amount : 0,
        ]
      );

      return movementResult.rows[0];
    });

    res.status(201).json({ success: true, data: mapCashMovement(result) });
  })
);

/**
 * GET /api/v1/shifts?status=&limit=&offset=
 * Riwayat shift (default: semua status). Non-admin hanya melihat shift sendiri.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const status = readQueryString(req.query.status).toUpperCase();
    const limit = parseInteger(req.query.limit, 'limit', {
      min: 1,
      max: 100,
      fallback: 20,
    });
    const offset = parseInteger(req.query.offset, 'offset', {
      min: 0,
      fallback: 0,
    });

    if (status && status !== 'OPEN' && status !== 'CLOSED') {
      throw new ApiError(400, "status harus 'OPEN' atau 'CLOSED'.");
    }

    const params: unknown[] = [companyId];
    const conditions = ['s.company_id = $1'];

    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }

    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPERVISOR') {
      params.push(req.user!.id);
      conditions.push(`s.cashier_id = $${params.length}`);
    }

    const { rows } = await query(
      `${SHIFT_SELECT}
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.start_time DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows.map(mapShift) });
  })
);

/**
 * GET /api/v1/shifts/:id/movements
 */
router.get(
  '/:id/movements',
  requireRole('ADMIN', 'SUPERVISOR', 'KASIR'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id shift harus berupa UUID yang valid.');
    }

    const { rows } = await query(
      `SELECT *
         FROM cash_movements
        WHERE company_id = $1 AND shift_id = $2
        ORDER BY created_at DESC`,
      [req.user!.companyId, req.params.id]
    );

    res.json({ success: true, data: rows.map(mapCashMovement) });
  })
);

export default router;
