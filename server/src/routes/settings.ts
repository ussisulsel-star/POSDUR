import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireRole } from '../middleware/authMiddleware';
import { mapPointSettings } from '../utils/serializers';
import { parseInteger, parseMoney } from '../utils/validation';

const router = Router();

const SETTINGS_SELECT = `
  SELECT company_id, enabled, active_from::text AS active_from,
         active_until::text AS active_until,
         redeem_value, min_redeem_points, product_points, updated_at
    FROM point_settings
   WHERE company_id = $1
   LIMIT 1
`;

function parseDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ApiError(400, `${field} harus berupa tanggal yang valid.`);
  }
  return value.slice(0, 10);
}

function parseProductPoints(value: unknown): Record<string, number> | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'productPoints harus berupa objek.');
  }

  const result: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([productId, raw]) => {
    const points = Number(raw);
    if (!Number.isFinite(points) || points < 0) {
      throw new ApiError(
        400,
        `productPoints["${productId}"] harus berupa angka >= 0.`
      );
    }
    const normalized = Math.floor(points);
    if (normalized > 0) {
      result[productId] = normalized;
    }
  });
  return result;
}

function defaultSettings() {
  const year = new Date().getFullYear();
  return mapPointSettings({
    enabled: true,
    active_from: `${year}-01-01`,
    active_until: `${year}-12-31`,
    redeem_value: 100,
    min_redeem_points: 10,
    product_points: {},
  });
}

/**
 * GET /api/v1/point-settings
 * Dibaca terminal kasir untuk validasi poin (semua role login).
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(SETTINGS_SELECT, [req.user!.companyId]);

    res.json({
      success: true,
      data: rows[0] ? mapPointSettings(rows[0]) : defaultSettings(),
    });
  })
);

/**
 * PUT /api/v1/point-settings
 * Body: { enabled, activeFrom, activeUntil, redeemValue, minRedeemPoints, productPoints }
 */
router.put(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const enabled =
      body.enabled === undefined
        ? true
        : (() => {
            if (typeof body.enabled !== 'boolean') {
              throw new ApiError(400, 'enabled harus berupa boolean.');
            }
            return body.enabled;
          })();
    const activeFrom = parseDate(body.activeFrom, 'activeFrom');
    const activeUntil = parseDate(body.activeUntil, 'activeUntil');

    if (activeFrom && activeUntil && activeUntil < activeFrom) {
      throw new ApiError(
        400,
        'activeUntil tidak boleh lebih awal dari activeFrom.'
      );
    }

    const redeemValue = parseMoney(body.redeemValue, 'redeemValue', {
      min: 0,
      fallback: 0,
    });
    const minRedeemPoints = parseInteger(
      body.minRedeemPoints,
      'minRedeemPoints',
      { min: 0, fallback: 0 }
    );
    const productPoints = parseProductPoints(body.productPoints) ?? {};

    if (enabled && redeemValue <= 0) {
      throw new ApiError(
        400,
        'redeemValue harus lebih besar dari 0 saat program poin aktif.'
      );
    }

    const { rows } = await query(
      `INSERT INTO point_settings
         (company_id, enabled, active_from, active_until, redeem_value,
          min_redeem_points, product_points, updated_at)
       VALUES ($1, $2, $3::date, $4::date, $5, $6, $7::jsonb, NOW())
       ON CONFLICT (company_id) DO UPDATE
         SET enabled = EXCLUDED.enabled,
             active_from = EXCLUDED.active_from,
             active_until = EXCLUDED.active_until,
             redeem_value = EXCLUDED.redeem_value,
             min_redeem_points = EXCLUDED.min_redeem_points,
             product_points = EXCLUDED.product_points,
             updated_at = NOW()
       RETURNING company_id, enabled, active_from::text AS active_from,
                 active_until::text AS active_until,
                 redeem_value, min_redeem_points, product_points, updated_at`,
      [
        companyId,
        enabled,
        activeFrom,
        activeUntil,
        redeemValue,
        minRedeemPoints,
        JSON.stringify(productPoints),
      ]
    );

    res.json({ success: true, data: mapPointSettings(rows[0]) });
  })
);

export default router;
