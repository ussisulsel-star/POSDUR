import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import { mapProduct } from '../utils/serializers';
import {
  isUuid,
  optionalString,
  parseInteger,
  parseMoney,
  readQueryString,
  requireString,
} from '../utils/validation';

const router = Router();

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
`;

/**
 * GET /api/v1/products?search=&categoryId=&limit=&offset=
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const search = readQueryString(req.query.search);
    const categoryId = readQueryString(req.query.categoryId);
    const limit = parseInteger(req.query.limit, 'limit', {
      min: 1,
      max: 500,
      fallback: 100,
    });
    const offset = parseInteger(req.query.offset, 'offset', {
      min: 0,
      fallback: 0,
    });

    const filterParams: unknown[] = [companyId];
    const conditions = ['p.company_id = $1'];

    if (search) {
      filterParams.push(`%${search}%`);
      conditions.push(
        `(p.name ILIKE $${filterParams.length} OR p.code ILIKE $${filterParams.length} OR p.barcode ILIKE $${filterParams.length})`
      );
    }

    if (categoryId) {
      filterParams.push(categoryId);
      conditions.push(`p.category_id = $${filterParams.length}`);
    }

    const whereClause = conditions.join(' AND ');
    const listParams = [...filterParams, limit, offset];

    const [listResult, countResult] = await Promise.all([
      query(
        `${PRODUCT_SELECT}
          WHERE ${whereClause}
          ORDER BY p.name ASC
          LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
        listParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM products p WHERE ${whereClause}`,
        filterParams
      ),
    ]);

    res.json({
      success: true,
      data: listResult.rows.map(mapProduct),
      meta: {
        total: Number(countResult.rows[0]?.count ?? 0),
        limit,
        offset,
      },
    });
  })
);

/**
 * GET /api/v1/products/barcode/:barcode
 * Lookup cepat untuk scanner barcode.
 */
router.get(
  '/barcode/:barcode',
  asyncHandler(async (req, res) => {
    const barcode = requireString(req.params.barcode, 'barcode', {
      maxLength: 100,
    });

    const { rows } = await query(
      `${PRODUCT_SELECT}
        WHERE p.company_id = $1 AND p.barcode = $2 AND p.is_active = TRUE
        LIMIT 1`,
      [req.user!.companyId, barcode]
    );

    if (rows.length === 0) {
      throw new ApiError(404, `Produk dengan barcode ${barcode} tidak ditemukan.`);
    }

    res.json({ success: true, data: mapProduct(rows[0]) });
  })
);

/**
 * GET /api/v1/products/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id produk harus berupa UUID yang valid.');
    }

    const { rows } = await query(
      `${PRODUCT_SELECT}
        WHERE p.company_id = $1 AND p.id = $2
        LIMIT 1`,
      [req.user!.companyId, req.params.id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Produk tidak ditemukan.');
    }

    res.json({ success: true, data: mapProduct(rows[0]) });
  })
);

/**
 * POST /api/v1/products  (ADMIN / GUDANG)
 */
router.post(
  '/',
  requireRole('ADMIN', 'GUDANG'),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const companyId = req.user!.companyId;

    const code = requireString(body.code, 'code', { maxLength: 50 });
    const barcode = requireString(body.barcode, 'barcode', { maxLength: 100 });
    const name = requireString(body.name, 'name', { maxLength: 255 });
    const categoryId = optionalString(body.categoryId, 'categoryId', 50);
    const unit = optionalString(body.unit, 'unit', 50) ?? 'Pcs';
    const costPrice = parseMoney(body.costPrice, 'costPrice', {
      min: 0,
      fallback: 0,
    });
    const sellPrice = parseMoney(body.sellPrice, 'sellPrice', {
      min: 0,
      fallback: 0,
    });
    const wholesalePrice = parseMoney(body.wholesalePrice, 'wholesalePrice', {
      min: 0,
      fallback: 0,
    });
    const stock = parseInteger(body.stock, 'stock', { min: 0, fallback: 0 });
    const minStock = parseInteger(body.minStock, 'minStock', {
      min: 0,
      fallback: 5,
    });

    const { rows } = await query(
      `INSERT INTO products
         (company_id, code, barcode, name, category_id, unit,
          cost_price, sell_price, wholesale_price, stock, min_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        companyId,
        code,
        barcode,
        name,
        categoryId,
        unit,
        costPrice,
        sellPrice,
        wholesalePrice,
        stock,
        minStock,
      ]
    );

    res.status(201).json({ success: true, data: mapProduct(rows[0]) });
  })
);

/**
 * PUT /api/v1/products/:id  (ADMIN / GUDANG)
 * Hanya field yang dikirim yang diubah.
 */
router.put(
  '/:id',
  requireRole('ADMIN', 'GUDANG'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id produk harus berupa UUID yang valid.');
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const companyId = req.user!.companyId;

    const code =
      body.code === undefined
        ? null
        : requireString(body.code, 'code', { maxLength: 50 });
    const barcode =
      body.barcode === undefined
        ? null
        : requireString(body.barcode, 'barcode', { maxLength: 100 });
    const name =
      body.name === undefined
        ? null
        : requireString(body.name, 'name', { maxLength: 255 });
    const categoryId =
      body.categoryId === undefined
        ? null
        : optionalString(body.categoryId, 'categoryId', 50);
    const unit =
      body.unit === undefined
        ? null
        : optionalString(body.unit, 'unit', 50) ?? 'Pcs';
    const costPrice =
      body.costPrice === undefined
        ? null
        : parseMoney(body.costPrice, 'costPrice', { min: 0 });
    const sellPrice =
      body.sellPrice === undefined
        ? null
        : parseMoney(body.sellPrice, 'sellPrice', { min: 0 });
    const wholesalePrice =
      body.wholesalePrice === undefined
        ? null
        : parseMoney(body.wholesalePrice, 'wholesalePrice', { min: 0 });
    const stock =
      body.stock === undefined
        ? null
        : parseInteger(body.stock, 'stock', { min: 0 });
    const minStock =
      body.minStock === undefined
        ? null
        : parseInteger(body.minStock, 'minStock', { min: 0 });
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      throw new ApiError(400, 'isActive harus berupa boolean.');
    }
    const isActive = body.isActive === undefined ? null : body.isActive;

    const { rows } = await query(
      `UPDATE products
          SET code = COALESCE($3, code),
              barcode = COALESCE($4, barcode),
              name = COALESCE($5, name),
              category_id = COALESCE($6, category_id),
              unit = COALESCE($7, unit),
              cost_price = COALESCE($8, cost_price),
              sell_price = COALESCE($9, sell_price),
              wholesale_price = COALESCE($10, wholesale_price),
              stock = COALESCE($11, stock),
              min_stock = COALESCE($12, min_stock),
              is_active = COALESCE($13, is_active),
              updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *`,
      [
        companyId,
        req.params.id,
        code,
        barcode,
        name,
        categoryId,
        unit,
        costPrice,
        sellPrice,
        wholesalePrice,
        stock,
        minStock,
        isActive,
      ]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Produk tidak ditemukan.');
    }

    res.json({ success: true, data: mapProduct(rows[0]) });
  })
);

/**
 * DELETE /api/v1/products/:id  (ADMIN / GUDANG)
 * Soft delete: menonaktifkan produk agar riwayat transaksi tetap utuh.
 */
router.delete(
  '/:id',
  requireRole('ADMIN', 'GUDANG'),
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) {
      throw new ApiError(400, 'id produk harus berupa UUID yang valid.');
    }

    const { rows } = await query(
      `UPDATE products
          SET is_active = FALSE, updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING id, name, is_active`,
      [req.user!.companyId, req.params.id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Produk tidak ditemukan.');
    }

    res.json({
      success: true,
      message: 'Produk berhasil dinonaktifkan.',
      data: { id: rows[0].id, name: rows[0].name, isActive: rows[0].is_active },
    });
  })
);

export default router;
