// src/api/index.ts

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';
import booksRoutes from './routes/books';
import membersRoutes from './routes/members';
import loansRoutes from './routes/loans';
import finesRoutes from './routes/fines';
import paymentsRoutes from './routes/payments';

const app = new Hono();

// Global middleware
app.use(logger());
app.use(cors());
app.use(authMiddleware);

// Health check
app.route('/health', healthRoutes);

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/books', booksRoutes);
app.route('/api/members', membersRoutes);
app.route('/api/loans', loansRoutes);
app.route('/api/fines', finesRoutes);
app.route('/api/payments', paymentsRoutes);

// 404 handler
app.notFound((ctx) => {
  return ctx.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    },
    { status: 404 }
  );
});

// Error handler
app.onError((err, ctx) => {
  console.error('Unhandled error:', err);
  return ctx.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    },
    { status: 500 }
  );
});

export default app;
