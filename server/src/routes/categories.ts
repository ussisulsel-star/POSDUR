import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import { mapCategory } from '../utils/serializers';
import {
  optionalString,
  readQueryString,
  requireString,
} from '../utils/validation';

const router = Router();

const CATEGORY_COLUMNS = 'id, company_id, name, icon';

function generateCategoryId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `cat-${slug || Date.now()}`;
}

/**
 * GET /api/v1/categories?search=
 * Semua role yang sudah login boleh membaca kategori (dibutuhkan katalog POS).
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
      conditions.push(`name ILIKE $${params.length}`);
    }

    const { rows } = await query(
      `SELECT ${CATEGORY_COLUMNS}
         FROM categories
        WHERE ${conditions.join(' AND ')}
        ORDER BY CASE WHEN id = 'cat-all' THEN 0 ELSE 1 END, name ASC`,
      params
    );

    res.json({ success: true, data: rows.map(mapCategory) });
  })
);

/**
 * POST /api/v1/categories
 * Body: { id?, name, icon? }
 */
router.post(
  '/',
  requireRole('ADMIN', 'GUDANG'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = requireString(body.name, 'name', { maxLength: 100 });
    const icon = optionalString(body.icon, 'icon', 100);
    const requestedId = optionalString(body.id, 'id', 50);
    const id = requestedId ?? generateCategoryId(name);

    const existing = await query(
      `SELECT id FROM categories WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (existing.rows.length > 0) {
      throw new ApiError(409, `ID kategori "${id}" sudah digunakan.`);
    }

    const { rows } = await query(
      `INSERT INTO categories (id, company_id, name, icon)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CATEGORY_COLUMNS}`,
      [id, companyId, name, icon]
    );

    res.status(201).json({ success: true, data: mapCategory(rows[0]) });
  })
);

/**
 * PUT /api/v1/categories/:id
 */
router.put(
  '/:id',
  requireRole('ADMIN', 'GUDANG'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name =
      body.name === undefined
        ? null
        : requireString(body.name, 'name', { maxLength: 100 });
    const icon =
      body.icon === undefined ? null : optionalString(body.icon, 'icon', 100);

    const { rows } = await query(
      `UPDATE categories
          SET name = COALESCE($3, name),
              icon = COALESCE($4, icon)
        WHERE company_id = $1 AND id = $2
        RETURNING ${CATEGORY_COLUMNS}`,
      [companyId, req.params.id, name, icon]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Kategori tidak ditemukan.');
    }

    res.json({ success: true, data: mapCategory(rows[0]) });
  })
);

/**
 * DELETE /api/v1/categories/:id
 * Produk yang memakai kategori ini dipindahkan ke "cat-all" lebih dulu.
 */
router.delete(
  '/:id',
  requireRole('ADMIN', 'GUDANG'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;

    if (req.params.id === 'cat-all') {
      throw new ApiError(
        409,
        'Kategori "Semua" adalah kategori bawaan sistem dan tidak dapat dihapus.'
      );
    }

    const existing = await query(
      `SELECT id, name FROM categories WHERE company_id = $1 AND id = $2 LIMIT 1`,
      [companyId, req.params.id]
    );

    if (existing.rows.length === 0) {
      throw new ApiError(404, 'Kategori tidak ditemukan.');
    }

    await query(
      `UPDATE products
          SET category_id = 'cat-all', updated_at = NOW()
        WHERE company_id = $1 AND category_id = $2`,
      [companyId, req.params.id]
    );

    await query(`DELETE FROM categories WHERE company_id = $1 AND id = $2`, [
      companyId,
      req.params.id,
    ]);

    res.json({
      success: true,
      message: `Kategori "${existing.rows[0].name}" berhasil dihapus.`,
      data: { id: existing.rows[0].id, name: existing.rows[0].name },
    });
  })
);

export default router;
