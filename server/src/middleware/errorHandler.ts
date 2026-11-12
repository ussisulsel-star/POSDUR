import { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../errors';

export const notFoundHandler: RequestHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
};

interface PostgresError {
  code?: string;
  constraint?: string;
  detail?: string;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }

  const pgError = error as PostgresError;

  if (pgError.code === '23505') {
    res.status(409).json({
      success: false,
      message: 'Data dengan nilai unik tersebut sudah ada.',
      constraint: pgError.constraint,
    });
    return;
  }

  if (pgError.code === '23503') {
    res.status(409).json({
      success: false,
      message:
        'Data masih terhubung dengan data lain sehingga tidak dapat diproses.',
      constraint: pgError.constraint,
    });
    return;
  }

  if (pgError.code === '22P02') {
    res.status(400).json({
      success: false,
      message: 'Format data tidak valid (kemungkinan ID/UUID salah).',
    });
    return;
  }

  if (pgError.code === '23502') {
    res.status(400).json({
      success: false,
      message: 'Ada kolom wajib yang belum diisi.',
      detail: pgError.detail,
    });
    return;
  }

  console.error('[error]', error);

  const message = (error as Error)?.message || 'Internal Server Error';
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan pada server.'
      : message,
  });
};
