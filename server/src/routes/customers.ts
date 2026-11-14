import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import { mapCustomer } from '../utils/serializers';
import {
  isUuid,
  optionalString,
  parseInteger,
  parseMoney,
  readQueryString,
  requireString,
} from '../utils/validation';

const router = Router();

interface CustomerBody {
  code?: unknown;
  name?: unknown;
  phone?: unknown;
  tier?: unknown;
  discountPercent?: unknown;
  points?: unknown;
  address?: unknown;
}

const CUSTOMER_COLUMNS = `id, company_id, code, name, phone, tier,
       discount_percent, points, address, created_at`;

/**
 * GET /api/v1/customers?search=&limit=&offset=
 * Dipakai terminal kasir untuk pencarian member berdasarkan nama/telepon.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const search = readQueryString(req.query.search);
    const limit = parseInteger(req.query.limit, 'limit', {
      min: 1,
      max: 500,
      fallback: 200,
    });
    const offset = parseInteger(req.query.offset, 'offset', {
      min: 0,
      fallback: 0,
    });

    const params: unknown[] = [companyId];
    const conditions = ['company_id = $1'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR code ILIKE $${params.length})`
      );
    }

    const { rows } = await query(
      `SELECT ${CUSTOMER_COLUMNS}
         FROM customers
        WHERE ${conditions.join(' AND ')}
        ORDER BY name ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows.map(mapCustomer) });
  })
);

/**
 * POST /api/v1/customers
 * Body: { code?, name, phone?, tier?, discountPercent?, points?, address? }
 */
router.post(
  '/',
  requireRole('ADMIN', 'SUPERVISOR', 'KASIR'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as CustomerBody;

    const name = requireString(body.name, 'name', { maxLength: 255 });
    const code =
      optionalString(body.code, 'code', 50) ??
      `PLG-${Date.now().toString().slice(-6)}`;
    const phone = optionalString(body.phone, 'phone', 50);
    const tier = optionalString(body.tier, 'tier', 50) ?? 'UMUM';
    const discountPercent = parseMoney(body.discountPercent, 'discountPercent', {
      min: 0,
      max: 100,
      fallback: 0,
    });
    const points = parseInteger(body.points, 'points', {
      min: 0,
      fallback: 0,
    });
    const address = optionalString(body.address, 'address', 500);

    const { rows } = await query(
      `INSERT INTO customers
         (company_id, code, name, phone, tier, discount_percent, points, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${CUSTOMER_COLUMNS}`,
      [companyId, code, name, phone, tier, discountPercent, points, address]
    );

    res.status(201).json({ success: true, data: mapCustomer(rows[0]) });
  })
);

/**
 * PUT /api/v1/customers/:id
 * Hanya field yang dikirim yang diubah.
 */
router.put(
  '/:id',
  requireRole('ADMIN', 'SUPERVISOR', 'KASIR'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id pelanggan harus berupa UUID yang valid.');
    }

    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as CustomerBody;

    const code =
      body.code === undefined
        ? null
        : requireString(body.code, 'code', { maxLength: 50 });
    const name =
      body.name === undefined
        ? null
        : requireString(body.name, 'name', { maxLength: 255 });
    const phone =
      body.phone === undefined ? null : optionalString(body.phone, 'phone', 50);
    const tier =
      body.tier === undefined ? null : optionalString(body.tier, 'tier', 50);
    const discountPercent =
      body.discountPercent === undefined
        ? null
        : parseMoney(body.discountPercent, 'discountPercent', {
            min: 0,
            max: 100,
          });
    const points =
      body.points === undefined
        ? null
        : parseInteger(body.points, 'points', { min: 0 });
    const address =
      body.address === undefined
        ? null
        : optionalString(body.address, 'address', 500);

    const { rows } = await query(
      `UPDATE customers
          SET code = COALESCE($3, code),
              name = COALESCE($4, name),
              phone = COALESCE($5, phone),
              tier = COALESCE($6, tier),
              discount_percent = COALESCE($7, discount_percent),
              points = COALESCE($8, points),
              address = COALESCE($9, address)
        WHERE company_id = $1 AND id = $2
        RETURNING ${CUSTOMER_COLUMNS}`,
      [
        companyId,
        req.params.id,
        code,
        name,
        phone,
        tier,
        discountPercent,
        points,
        address,
      ]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Pelanggan tidak ditemukan.');
    }

    res.json({ success: true, data: mapCustomer(rows[0]) });
  })
);

/**
 * DELETE /api/v1/customers/:id
 * Ditolak bila pelanggan sudah terhubung ke transaksi/held order.
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id pelanggan harus berupa UUID yang valid.');
    }

    try {
      const { rows } = await query(
        `DELETE FROM customers
          WHERE company_id = $1 AND id = $2
          RETURNING id, name`,
        [req.user!.companyId, req.params.id]
      );

      if (rows.length === 0) {
        throw new ApiError(404, 'Pelanggan tidak ditemukan.');
      }

      res.json({
        success: true,
        message: 'Pelanggan berhasil dihapus.',
        data: { id: rows[0].id, name: rows[0].name },
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ApiError(
          409,
          'Pelanggan sudah memiliki riwayat transaksi sehingga tidak dapat dihapus.'
        );
      }
      throw error;
    }
  })
);

export default router;
