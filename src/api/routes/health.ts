// src/api/routes/health.ts

import { Hono } from 'hono';

const healthRoutes = new Hono();

healthRoutes.get('/', async (ctx) => {
  return ctx.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0-alpha',
  });
});

healthRoutes.get('/db', async (ctx) => {
  try {
    const env = ctx.env as any;
    if (!env.DB) {
      return ctx.json({ status: 'error', message: 'Database not configured' }, { status: 500 });
    }

    const result = await env.DB.prepare('SELECT 1').first();
    return ctx.json({
      status: result ? 'ok' : 'error',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return ctx.json(
      {
        status: 'error',
        message: err.message,
      },
      { status: 500 }
    );
  }
});

export default healthRoutes;
