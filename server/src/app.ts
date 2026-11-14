import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { pingDatabase } from './db';
import { asyncHandler } from './errors';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import customerRoutes from './routes/customers';
import posRoutes from './routes/pos';
import shiftRoutes from './routes/shifts';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/errorHandler';
import { authenticateJWT } from './middleware/authMiddleware';

const app = express();

app.disable('x-powered-by');

app.use(
  cors({
    origin:
      config.corsOrigin === '*'
        ? '*'
        : config.corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: config.corsOrigin !== '*',
  })
);

app.use(express.json({ limit: '2mb' }));

// Logging ringan: tenant diambil dari header (informatif) atau token.
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const tenant = req.user?.companyId || req.headers['x-company-id'] || '-';
    console.log(
      `[${new Date().toISOString()}] [tenant:${tenant}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`
    );
  });
  next();
});

const healthHandler = asyncHandler(async (_req, res) => {
  const databaseUp = await pingDatabase();

  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? 'healthy' : 'degraded',
    service: 'vc3-catat-api',
    version: '1.0.0',
    database: databaseUp ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/products', authenticateJWT, productRoutes);
app.use('/api/v1/customers', authenticateJWT, customerRoutes);
app.use('/api/v1/pos', authenticateJWT, posRoutes);
app.use('/api/v1/shifts', authenticateJWT, shiftRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
