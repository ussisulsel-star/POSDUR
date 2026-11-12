import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config';

export interface AuthUser {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload extends JwtPayload {
  userId?: string;
  companyId?: string;
  name?: string;
  role?: string;
}

/**
 * Memverifikasi Bearer JWT (signature + expiry) lalu menempelkan identitas
 * tenant ke `req.user`. Seluruh route bisnis WAJIB memakai middleware ini
 * dan memfilter query dengan `req.user.companyId`.
 */
export const authenticateJWT: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Akses ditolak: token otentikasi JWT tidak ditemukan.',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;

    if (!payload.sub || !payload.companyId) {
      throw new Error('Payload token tidak lengkap.');
    }

    req.user = {
      id: String(payload.sub),
      userId: payload.userId || '',
      companyId: payload.companyId,
      name: payload.name || '',
      role: payload.role || 'KASIR',
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
  }
};

/** Membatasi akses route berdasarkan role pengguna. */
export function requireRole(...roles: string[]): RequestHandler {
  const allowed = roles.map((role) => role.toUpperCase());

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Otentikasi diperlukan.',
      });
      return;
    }

    if (!allowed.includes(req.user.role.toUpperCase())) {
      res.status(403).json({
        success: false,
        message: `Akses ditolak: role ${req.user.role} tidak memiliki kewenangan.`,
      });
      return;
    }

    next();
  };
}
