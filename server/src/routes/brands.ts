import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import { mapBrand } from '../utils/serializers';
import {
  optionalString,
  readQueryString,
  requireString,
} from '../utils/validation';

const router = Router();

const BRAND_COLUMNS =
  'id, company_id, name, tagline, emoji, color_key, is_active, created_at';

const COLOR_KEYS = new Set([
  'amber',
  'emerald',
  'pink',
  'cyan',
  'blue',
  'violet',
  'rose',
  'orange',
  'teal',
  'indigo',
]);

function parseColorKey(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'colorKey harus berupa teks.');
  }
  const normalized = value.trim().toLowerCase();
  if (!COLOR_KEYS.has(normalized)) {
    throw new ApiError(
      400,
      `colorKey tidak dikenal. Gunakan salah satu: ${[...COLOR_KEYS].join(', ')}.`
    );
  }
  return normalized;
}

function parseActive(value: unknown, field = 'isActive'): boolean | null {
  if (value === undefined) return null;
  if (typeof value !== 'boolean') {
    throw new ApiError(400, `${field} harus berupa boolean.`);
  }
  return value;
}

/**
 * GET /api/v1/brands
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
        `(name ILIKE $${params.length} OR tagline ILIKE $${params.length})`
      );
    }

    const { rows } = await query(
      `SELECT ${BRAND_COLUMNS}
         FROM brands
        WHERE ${conditions.join(' AND ')}
        ORDER BY name ASC`,
      params
    );

    res.json({ success: true, data: rows.map(mapBrand) });
  })
);

/**
 * POST /api/v1/brands
 * Body: { id?, name, tagline?, emoji?, colorKey?, isActive? }
 */
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = requireString(body.name, 'name', { maxLength: 100 });
    const tagline = optionalString(body.tagline, 'tagline', 255) ?? '';
    const emoji = optionalString(body.emoji, 'emoji', 20) ?? '';
    const colorKey = parseColorKey(body.colorKey) ?? 'blue';
    const isActive = parseActive(body.isActive) ?? true;
    const id =
      optionalString(body.id, 'id', 50) ?? `brand-${Date.now().toString(36)}`;

    const duplicate = await query(
      `SELECT id FROM brands WHERE company_id = $1 AND UPPER(name) = UPPER($2) LIMIT 1`,
      [companyId, name]
    );

    if (duplicate.rows.length > 0) {
      throw new ApiError(409, `Nama brand "${name}" sudah digunakan.`);
    }

    const { rows } = await query(
      `INSERT INTO brands
         (id, company_id, name, tagline, emoji, color_key, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${BRAND_COLUMNS}`,
      [id, companyId, name, tagline, emoji, colorKey, isActive]
    );

    res.status(201).json({ success: true, data: mapBrand(rows[0]) });
  })
);

/**
 * PUT /api/v1/brands/:id
 */
router.put(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name =
      body.name === undefined
        ? null
        : requireString(body.name, 'name', { maxLength: 100 });
    const tagline =
      body.tagline === undefined
        ? null
        : optionalString(body.tagline, 'tagline', 255) ?? '';
    const emoji =
      body.emoji === undefined
        ? null
        : optionalString(body.emoji, 'emoji', 20) ?? '';
    const colorKey = parseColorKey(body.colorKey);
    const isActive = parseActive(body.isActive);

    if (name) {
      const duplicate = await query(
        `SELECT id FROM brands
          WHERE company_id = $1 AND UPPER(name) = UPPER($2) AND id <> $3
          LIMIT 1`,
        [companyId, name, req.params.id]
      );
      if (duplicate.rows.length > 0) {
        throw new ApiError(409, `Nama brand "${name}" sudah digunakan.`);
      }
    }

    const { rows } = await query(
      `UPDATE brands
          SET name = COALESCE($3, name),
              tagline = COALESCE($4, tagline),
              emoji = COALESCE($5, emoji),
              color_key = COALESCE($6, color_key),
              is_active = COALESCE($7, is_active)
        WHERE company_id = $1 AND id = $2
        RETURNING ${BRAND_COLUMNS}`,
      [companyId, req.params.id, name, tagline, emoji, colorKey, isActive]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Brand tidak ditemukan.');
    }

    res.json({ success: true, data: mapBrand(rows[0]) });
  })
);

/**
 * DELETE /api/v1/brands/:id
 * Brand yang masih dipakai produk/cabang ditolak agar referensi tetap valid.
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;

    const existing = await query(
      `SELECT id, name FROM brands WHERE company_id = $1 AND id = $2 LIMIT 1`,
      [companyId, req.params.id]
    );

    if (existing.rows.length === 0) {
      throw new ApiError(404, 'Brand tidak ditemukan.');
    }

    const brandName = String(existing.rows[0].name);
    const usage = await query<{ products: string; outlets: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM products
           WHERE company_id = $1 AND brand = $2) AS products,
         (SELECT COUNT(*)::text FROM outlets
           WHERE company_id = $1 AND brand = $2) AS outlets`,
      [companyId, brandName]
    );

    const productCount = Number(usage.rows[0]?.products ?? 0);
    const outletCount = Number(usage.rows[0]?.outlets ?? 0);

    if (productCount > 0 || outletCount > 0) {
      const details = [
        productCount > 0 ? `${productCount} produk` : null,
        outletCount > 0 ? `${outletCount} cabang` : null,
      ]
        .filter(Boolean)
        .join(' dan ');
      throw new ApiError(
        409,
        `Brand "${brandName}" masih dipakai oleh ${details}. Pindahkan data tersebut ke brand lain sebelum menghapus.`
      );
    }

    await query(`DELETE FROM brands WHERE company_id = $1 AND id = $2`, [
      companyId,
      req.params.id,
    ]);

    res.json({
      success: true,
      message: `Brand "${brandName}" berhasil dihapus.`,
      data: { id: existing.rows[0].id, name: brandName },
    });
  })
);

export default router;
