import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { authenticateJWT } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimiter';
import { mapUser } from '../utils/serializers';
import { requireString } from '../utils/validation';

const router = Router();

interface LoginBody {
  companyId?: unknown;
  userId?: unknown;
  password?: unknown;
}

/**
 * POST /api/v1/auth/login
 * Body: { companyId, userId, password }
 */
router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as LoginBody;

    const companyId = requireString(body.companyId, 'companyId', {
      maxLength: 50,
    });
    const userId = requireString(body.userId, 'userId', { maxLength: 100 });
    const password = requireString(body.password, 'password', {
      maxLength: 200,
    });

    const { rows } = await query(
      `SELECT u.id, u.company_id, u.user_id, u.name, u.password_hash, u.role,
              u.is_active, u.created_at, c.name AS company_name
         FROM users u
         JOIN companies c ON c.id = u.company_id
        WHERE u.company_id = $1 AND UPPER(u.user_id) = UPPER($2)
        LIMIT 1`,
      [companyId, userId]
    );

    const user = rows[0];
    const passwordMatches = user
      ? await bcrypt.compare(password, String(user.password_hash))
      : false;

    if (!user || !passwordMatches) {
      throw new ApiError(
        401,
        'ID Perusahaan, User ID, atau Password tidak sesuai.'
      );
    }

    if (user.is_active === false) {
      throw new ApiError(
        403,
        `Akun ${user.name} (${user.user_id}) sedang dinonaktifkan oleh administrator.`
      );
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        companyId: user.company_id,
        name: user.name,
        role: user.role,
      },
      config.jwtSecret,
      {
        subject: String(user.id),
        expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
      }
    );

    res.json({
      success: true,
      data: {
        token,
        user: mapUser(user),
      },
    });
  })
);

/**
 * GET /api/v1/auth/me
 * Mengembalikan profil terbaru berdasarkan token.
 */
router.get(
  '/me',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.company_id, u.user_id, u.name, u.role, u.is_active,
              u.created_at, c.name AS company_name
         FROM users u
         JOIN companies c ON c.id = u.company_id
        WHERE u.company_id = $1 AND u.id = $2
        LIMIT 1`,
      [req.user!.companyId, req.user!.id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Akun tidak ditemukan pada tenant ini.');
    }

    res.json({ success: true, data: mapUser(rows[0]) });
  })
);

export default router;
