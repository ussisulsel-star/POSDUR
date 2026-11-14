import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import { mapOutlet } from '../utils/serializers';
import {
  optionalString,
  readQueryString,
  requireString,
} from '../utils/validation';

const router = Router();

const OUTLET_COLUMNS = `id, company_id, code, name, brand, address, phone,
       city, is_hq, is_mall, is_active`;

function parseBoolean(value: unknown, field: string): boolean | null {
  if (value === undefined) return null;
  if (typeof value !== 'boolean') {
    throw new ApiError(400, `${field} harus berupa boolean.`);
  }
  return value;
}

/**
 * GET /api/v1/outlets?search=
 * Semua user yang login perlu daftar cabang untuk kontrol akses outlet.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const search = readQueryString(req.query.search);
    const params: unknown[] = [companyId];
    const conditions = ['company_id = $1'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(name ILIKE $${params.length} OR code ILIKE $${params.length} OR city ILIKE $${params.length})`
      );
    }

    const { rows } = await query(
      `SELECT ${OUTLET_COLUMNS}
         FROM outlets
        WHERE ${conditions.join(' AND ')}
        ORDER BY is_hq DESC, code ASC`,
      params
    );

    res.json({ success: true, data: rows.map(mapOutlet) });
  })
);

/**
 * POST /api/v1/outlets
 * Body: { id?, code, name, brand?, address?, phone?, city?, isHQ?, isMall?, isActive? }
 */
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const code = requireString(body.code, 'code', { maxLength: 50 });
    const name = requireString(body.name, 'name', { maxLength: 255 });
    const brand = optionalString(body.brand, 'brand', 100);
    const address = optionalString(body.address, 'address', 1000) ?? '';
    const phone = optionalString(body.phone, 'phone', 50) ?? '';
    const city = optionalString(body.city, 'city', 100) ?? '';
    const isHQ = parseBoolean(body.isHQ, 'isHQ') ?? false;
    const isMall = parseBoolean(body.isMall, 'isMall') ?? false;
    const isActive = parseBoolean(body.isActive, 'isActive') ?? true;
    const id =
      optionalString(body.id, 'id', 50) ?? `out-${Date.now().toString(36)}`;

    const duplicate = await query(
      `SELECT id FROM outlets WHERE company_id = $1 AND UPPER(code) = UPPER($2) LIMIT 1`,
      [companyId, code]
    );

    if (duplicate.rows.length > 0) {
      throw new ApiError(409, `Kode cabang "${code}" sudah digunakan.`);
    }

    const { rows } = await query(
      `INSERT INTO outlets
         (id, company_id, code, name, brand, address, phone, city,
          is_hq, is_mall, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${OUTLET_COLUMNS}`,
      [
        id,
        companyId,
        code,
        name,
        brand,
        address,
        phone,
        city,
        isHQ,
        isMall,
        isActive,
      ]
    );

    res.status(201).json({ success: true, data: mapOutlet(rows[0]) });
  })
);

/**
 * PUT /api/v1/outlets/:id
 */
router.put(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const code =
      body.code === undefined
        ? null
        : requireString(body.code, 'code', { maxLength: 50 });
    const name =
      body.name === undefined
        ? null
        : requireString(body.name, 'name', { maxLength: 255 });
    const brand =
      body.brand === undefined ? null : optionalString(body.brand, 'brand', 100);
    const address =
      body.address === undefined
        ? null
        : optionalString(body.address, 'address', 1000) ?? '';
    const phone =
      body.phone === undefined
        ? null
        : optionalString(body.phone, 'phone', 50) ?? '';
    const city =
      body.city === undefined
        ? null
        : optionalString(body.city, 'city', 100) ?? '';
    const isHQ = parseBoolean(body.isHQ, 'isHQ');
    const isMall = parseBoolean(body.isMall, 'isMall');
    const isActive = parseBoolean(body.isActive, 'isActive');

    if (code) {
      const duplicate = await query(
        `SELECT id FROM outlets
          WHERE company_id = $1 AND UPPER(code) = UPPER($2) AND id <> $3
          LIMIT 1`,
        [companyId, code, req.params.id]
      );
      if (duplicate.rows.length > 0) {
        throw new ApiError(409, `Kode cabang "${code}" sudah digunakan.`);
      }
    }

    const { rows } = await query(
      `UPDATE outlets
          SET code = COALESCE($3, code),
              name = COALESCE($4, name),
              brand = COALESCE($5, brand),
              address = COALESCE($6, address),
              phone = COALESCE($7, phone),
              city = COALESCE($8, city),
              is_hq = COALESCE($9, is_hq),
              is_mall = COALESCE($10, is_mall),
              is_active = COALESCE($11, is_active),
              updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING ${OUTLET_COLUMNS}`,
      [
        companyId,
        req.params.id,
        code,
        name,
        brand,
        address,
        phone,
        city,
        isHQ,
        isMall,
        isActive,
      ]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Cabang tidak ditemukan.');
    }

    res.json({ success: true, data: mapOutlet(rows[0]) });
  })
);

/**
 * DELETE /api/v1/outlets/:id
 * Ditolak bila cabang sudah dipakai transaksi, shift, atau akses pengguna.
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;

    const existing = await query(
      `SELECT id, name FROM outlets WHERE company_id = $1 AND id = $2 LIMIT 1`,
      [companyId, req.params.id]
    );

    if (existing.rows.length === 0) {
      throw new ApiError(404, 'Cabang tidak ditemukan.');
    }

    const usage = await query<{
      transactions: string;
      shifts: string;
      users: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM transactions
           WHERE company_id = $1 AND outlet_id = $2) AS transactions,
         (SELECT COUNT(*)::text FROM pos_shifts
           WHERE company_id = $1 AND outlet_id = $2) AS shifts,
         (SELECT COUNT(*)::text FROM users
           WHERE company_id = $1
             AND (outlet_id = $2
                  OR allowed_outlet_ids @> to_jsonb(ARRAY[$2]::text[]))) AS users`,
      [companyId, req.params.id]
    );

    const transactionCount = Number(usage.rows[0]?.transactions ?? 0);
    const shiftCount = Number(usage.rows[0]?.shifts ?? 0);
    const userCount = Number(usage.rows[0]?.users ?? 0);

    if (transactionCount > 0 || shiftCount > 0 || userCount > 0) {
      const details = [
        transactionCount > 0 ? `${transactionCount} transaksi` : null,
        shiftCount > 0 ? `${shiftCount} shift` : null,
        userCount > 0 ? `${userCount} pengguna` : null,
      ]
        .filter(Boolean)
        .join(', ');
      throw new ApiError(
        409,
        `Cabang "${existing.rows[0].name}" masih terhubung dengan ${details} sehingga tidak dapat dihapus. Nonaktifkan cabang ini sebagai gantinya.`
      );
    }

    await query(`DELETE FROM outlets WHERE company_id = $1 AND id = $2`, [
      companyId,
      req.params.id,
    ]);

    res.json({
      success: true,
      message: `Cabang "${existing.rows[0].name}" berhasil dihapus.`,
      data: { id: existing.rows[0].id, name: existing.rows[0].name },
    });
  })
);

export default router;
