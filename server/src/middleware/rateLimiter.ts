import { NextFunction, Request, RequestHandler, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
}): RequestHandler {
  const { windowMs, max } = options;
  const message =
    options.message ||
    'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.';

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}|${req.baseUrl}${req.path}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        message,
        retryAfter,
      });
      return;
    }

    bucket.count += 1;

    // Bersihkan bucket kedaluwarsa agar map tidak tumbuh tanpa batas.
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    next();
  };
}
