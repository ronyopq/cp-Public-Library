// src/api/middleware/auth.ts

import type { Context, Next } from 'hono';
import { verifyAccessToken } from '../utils/auth';
import type { AuthContext } from '../../shared/types';

declare global {
  namespace HonoRequest {
    interface HonoRequest {
      auth?: AuthContext;
    }
  }
}

export async function authMiddleware(ctx: Context, next: Next) {
  const token = ctx.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    ctx.set('auth', {
      isAuthenticated: false,
      userId: '',
      email: '',
      role_id: '',
    });
    return next();
  }

  const jwtSecret = ctx.env?.JWT_SECRET || '';
  const payload = await verifyAccessToken(token, jwtSecret);

  if (payload) {
    ctx.set('auth', {
      isAuthenticated: true,
      userId: payload.userId,
      email: payload.email,
      role_id: payload.role_id,
    });
  } else {
    ctx.set('auth', {
      isAuthenticated: false,
      userId: '',
      email: '',
      role_id: '',
    });
  }

  return next();
}

export function requireAuth(ctx: Context) {
  const auth = ctx.get('auth') as AuthContext | undefined;
  if (!auth?.isAuthenticated) {
    throw new Error('UNAUTHORIZED');
  }
  return auth;
}

export function requireRole(ctx: Context, ...roles: string[]) {
  const auth = requireAuth(ctx);
  if (!roles.includes(auth.role_id)) {
    throw new Error('FORBIDDEN');
  }
  return auth;
}

export function requirePermission(
  db: any,
  auth: AuthContext,
  permissionName: string
): Promise<boolean> {
  return db
    .queryAll(
      `SELECT 1 FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ? AND p.name = ?`,
      [auth.role_id, permissionName]
    )
    .then((results: any) => results.length > 0);
}
