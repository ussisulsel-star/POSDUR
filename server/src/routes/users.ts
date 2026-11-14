import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import { mapUser } from '../utils/serializers';
import {
  isUuid,
  optionalString,
  readQueryString,
  requireString,
} from '../utils/validation';

const router = Router();

const ROLES = new Set(['ADMIN', 'SUPERVISOR', 'KASIR', 'GUDANG']);

const USER_SELECT = `
  SELECT u.id, u.company_id, u.user_id, u.name, u.role, u.is_active,
         u.phone, u.outlet_id, u.allowed_outlet_ids, u.can_access_all_outlets,
         u.permissions, u.last_login, u.created_at,
         (u.pin_hash IS NOT NULL) AS has_pin
    FROM users u
`;

function parseRole(value: unknown, fallback?: string): string {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw new ApiError(400, 'role wajib diisi.');
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'role harus berupa teks.');
  }
  const role = value.trim().toUpperCase();
  if (!ROLES.has(role)) {
    throw new ApiError(
      400,
      `role tidak dikenal. Gunakan salah satu: ${[...ROLES].join(', ')}.`
    );
  }
  return role;
}

function parseOutletIds(value: unknown, field: string): string[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) {
    throw new ApiError(400, `${field} harus berupa array ID outlet.`);
  }
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function parsePermissions(value: unknown): Record<string, boolean> | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'permissions harus berupa objek.');
  }
  const result: Record<string, boolean> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (typeof item === 'boolean') {
      result[key] = item;
    }
  });
  return result;
}

function parseBoolean(value: unknown, field: string): boolean | null {
  if (value === undefined) return null;
  if (typeof value !== 'boolean') {
    throw new ApiError(400, `${field} harus berupa boolean.`);
  }
  return value;
}

function parsePin(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'pin harus berupa teks.');
  }
  const pin = value.trim();
  if (!/^\d{4,6}$/.test(pin)) {
    throw new ApiError(400, 'PIN harus berupa 4 sampai 6 digit angka.');
  }
  return pin;
}

function parsePassword(value: unknown, required: boolean): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'password wajib diisi untuk pengguna baru.');
    }
    return null;
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'password harus berupa teks.');
  }
  if (value.length < 4) {
    throw new ApiError(400, 'password minimal 4 karakter.');
  }
  return value;
}

/**
 * GET /api/v1/users?search=&role=
 * ADMIN & SUPERVISOR boleh membaca daftar pengguna (tanpa hash password/PIN).
 */
router.get(
  '/',
  requireRole('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const search = readQueryString(req.query.search);
    const role = readQueryString(req.query.role).toUpperCase();
    const params: unknown[] = [companyId];
    const conditions = ['u.company_id = $1'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(u.user_id ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.phone ILIKE $${params.length})`
      );
    }

    if (role) {
      if (!ROLES.has(role)) {
        throw new ApiError(400, 'Filter role tidak dikenal.');
      }
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }

    const { rows } = await query(
      `${USER_SELECT}
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE u.role
            WHEN 'ADMIN' THEN 0
            WHEN 'SUPERVISOR' THEN 1
            WHEN 'KASIR' THEN 2
            ELSE 3
          END,
          u.name ASC`,
      params
    );

    res.json({ success: true, data: rows.map(mapUser) });
  })
);

/**
 * POST /api/v1/users
 * Body: { userId, name, role, password, pin?, phone?, outletId?,
 *         allowedOutletIds?, canAccessAllOutlets?, permissions?, isActive? }
 */
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const userId = requireString(body.userId, 'userId', { maxLength: 100 });
    const name = requireString(body.name, 'name', { maxLength: 255 });
    const role = parseRole(body.role, 'KASIR');
    const password = parsePassword(body.password, true)!;
    const pin = parsePin(body.pin);
    const phone = optionalString(body.phone, 'phone', 50);
    const outletId = optionalString(body.outletId, 'outletId', 50);
    const allowedOutletIds = parseOutletIds(
      body.allowedOutletIds,
      'allowedOutletIds'
    );
    const canAccessAllOutlets =
      parseBoolean(body.canAccessAllOutlets, 'canAccessAllOutlets') ?? false;
    const permissions = parsePermissions(body.permissions);
    const isActive = parseBoolean(body.isActive, 'isActive') ?? true;

    const duplicate = await query(
      `SELECT id FROM users
        WHERE company_id = $1 AND UPPER(user_id) = UPPER($2)
        LIMIT 1`,
      [companyId, userId]
    );

    if (duplicate.rows.length > 0) {
      throw new ApiError(409, `User ID "${userId}" sudah digunakan.`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    const { rows } = await query(
      `INSERT INTO users
         (company_id, user_id, name, password_hash, role, is_active,
          phone, pin_hash, outlet_id, allowed_outlet_ids,
          can_access_all_outlets, permissions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::jsonb)
       RETURNING id`,
      [
        companyId,
        userId.toUpperCase(),
        name,
        passwordHash,
        role,
        isActive,
        phone,
        pinHash,
        outletId,
        JSON.stringify(
          allowedOutletIds ?? (outletId ? [outletId] : [])
        ),
        canAccessAllOutlets,
        JSON.stringify(permissions ?? {}),
      ]
    );

    const created = await query(`${USER_SELECT} WHERE u.id = $1 LIMIT 1`, [
      rows[0].id,
    ]);

    res.status(201).json({ success: true, data: mapUser(created.rows[0]) });
  })
);

/**
 * PUT /api/v1/users/:id
 * Field yang tidak dikirim tidak diubah. Password/PIN hanya diganti bila diisi.
 */
router.put(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id pengguna harus berupa UUID yang valid.');
    }

    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const userId =
      body.userId === undefined
        ? null
        : requireString(body.userId, 'userId', { maxLength: 100 }).toUpperCase();
    const name =
      body.name === undefined
        ? null
        : requireString(body.name, 'name', { maxLength: 255 });
    const role =
      body.role === undefined || body.role === null || body.role === ''
        ? null
        : parseRole(body.role);
    const password = parsePassword(body.password, false);
    const pin = parsePin(body.pin);
    const phone =
      body.phone === undefined ? null : optionalString(body.phone, 'phone', 50);
    const outletId =
      body.outletId === undefined
        ? null
        : optionalString(body.outletId, 'outletId', 50);
    const allowedOutletIds = parseOutletIds(
      body.allowedOutletIds,
      'allowedOutletIds'
    );
    const canAccessAllOutlets = parseBoolean(
      body.canAccessAllOutlets,
      'canAccessAllOutlets'
    );
    const permissions = parsePermissions(body.permissions);
    const isActive = parseBoolean(body.isActive, 'isActive');

    const existing = await query(
      `SELECT id, role FROM users WHERE company_id = $1 AND id = $2 LIMIT 1`,
      [companyId, req.params.id]
    );

    if (existing.rows.length === 0) {
      throw new ApiError(404, 'Pengguna tidak ditemukan.');
    }

    if (userId) {
      const duplicate = await query(
        `SELECT id FROM users
          WHERE company_id = $1 AND UPPER(user_id) = UPPER($2) AND id <> $3
          LIMIT 1`,
        [companyId, userId, req.params.id]
      );
      if (duplicate.rows.length > 0) {
        throw new ApiError(409, `User ID "${userId}" sudah digunakan.`);
      }
    }

    // Jangan sampai admin terakhir dinonaktifkan / diturunkan role-nya.
    const demotingAdmin =
      existing.rows[0].role === 'ADMIN' &&
      ((role && role !== 'ADMIN') || isActive === false);
    if (demotingAdmin) {
      const adminCount = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM users
          WHERE company_id = $1 AND role = 'ADMIN' AND is_active = TRUE`,
        [companyId]
      );
      if (Number(adminCount.rows[0]?.count ?? 0) <= 1) {
        throw new ApiError(
          409,
          'Admin aktif terakhir tidak dapat diturunkan role atau dinonaktifkan.'
        );
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    await query(
      `UPDATE users
          SET user_id = COALESCE($3, user_id),
              name = COALESCE($4, name),
              role = COALESCE($5, role),
              password_hash = COALESCE($6, password_hash),
              pin_hash = COALESCE($7, pin_hash),
              phone = COALESCE($8, phone),
              outlet_id = COALESCE($9, outlet_id),
              allowed_outlet_ids = COALESCE($10::jsonb, allowed_outlet_ids),
              can_access_all_outlets = COALESCE($11, can_access_all_outlets),
              permissions = COALESCE($12::jsonb, permissions),
              is_active = COALESCE($13, is_active)
        WHERE company_id = $1 AND id = $2`,
      [
        companyId,
        req.params.id,
        userId,
        name,
        role,
        passwordHash,
        pinHash,
        phone,
        outletId,
        allowedOutletIds === null ? null : JSON.stringify(allowedOutletIds),
        canAccessAllOutlets,
        permissions === null ? null : JSON.stringify(permissions),
        isActive,
      ]
    );

    const updated = await query(
      `${USER_SELECT} WHERE u.company_id = $1 AND u.id = $2 LIMIT 1`,
      [companyId, req.params.id]
    );

    res.json({ success: true, data: mapUser(updated.rows[0]) });
  })
);

/**
 * DELETE /api/v1/users/:id
 * Akun dengan riwayat transaksi/shift tidak dihapus agar audit tetap utuh.
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id pengguna harus berupa UUID yang valid.');
    }

    const companyId = req.user!.companyId;

    if (req.params.id === req.user!.id) {
      throw new ApiError(
        409,
        'Anda tidak dapat menghapus akun yang sedang digunakan.'
      );
    }

    const existing = await query(
      `SELECT id, name, user_id, role FROM users
        WHERE company_id = $1 AND id = $2 LIMIT 1`,
      [companyId, req.params.id]
    );

    if (existing.rows.length === 0) {
      throw new ApiError(404, 'Pengguna tidak ditemukan.');
    }

    if (existing.rows[0].role === 'ADMIN') {
      const adminCount = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM users
          WHERE company_id = $1 AND role = 'ADMIN' AND is_active = TRUE`,
        [companyId]
      );
      if (Number(adminCount.rows[0]?.count ?? 0) <= 1) {
        throw new ApiError(
          409,
          'Admin aktif terakhir tidak dapat dihapus.'
        );
      }
    }

    const usage = await query<{ transactions: string; shifts: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM transactions
           WHERE company_id = $1 AND cashier_id = $2) AS transactions,
         (SELECT COUNT(*)::text FROM pos_shifts
           WHERE company_id = $1 AND cashier_id = $2) AS shifts`,
      [companyId, req.params.id]
    );

    const transactionCount = Number(usage.rows[0]?.transactions ?? 0);
    const shiftCount = Number(usage.rows[0]?.shifts ?? 0);

    if (transactionCount > 0 || shiftCount > 0) {
      throw new ApiError(
        409,
        `Pengguna "${existing.rows[0].name}" memiliki ${transactionCount} transaksi dan ${shiftCount} shift. Nonaktifkan akun ini sebagai gantinya agar riwayat tetap utuh.`
      );
    }

    await query(`DELETE FROM users WHERE company_id = $1 AND id = $2`, [
      companyId,
      req.params.id,
    ]);

    res.json({
      success: true,
      message: `Pengguna "${existing.rows[0].name}" berhasil dihapus.`,
      data: { id: existing.rows[0].id, name: existing.rows[0].name },
    });
  })
);

export default router;
