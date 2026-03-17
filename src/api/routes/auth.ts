// src/api/routes/auth.ts

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { hashPassword, verifyPassword, generateAccessToken, generateId } from '../utils/auth';
import { Database, getUserByEmail, createUser, recordLoginAttempt, isUserLocked, logAuditEvent } from '../utils/db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import type { APIResponse, User } from '../../shared/types';

const authRoutes = new Hono();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
  token: z.string(),
});

// POST /api/auth/login
authRoutes.post('/login', async (ctx: Context) => {
  const env = ctx.env as any;
  const db = new Database(env.DB);

  try {
    const body = loginSchema.parse(await ctx.req.json());

    const user = await getUserByEmail(db, body.email);

    if (!user) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'ইমেইল বা পাসওয়ার্ড ভুল।',
          },
        } as APIResponse<null>,
        { status: 401 }
      );
    }

    if (isUserLocked(user)) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'অ্যাকাউন্ট ১৫ মিনিটের জন্য লক করা হয়েছে।',
          },
        } as APIResponse<null>,
        { status: 429 }
      );
    }

    if (!user.is_active) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'এই অ্যাকাউন্ট নিষ্ক্রিয়।',
          },
        } as APIResponse<null>,
        { status: 403 }
      );
    }

    const passwordMatch = await verifyPassword(body.password, user.password_hash);

    if (!passwordMatch) {
      await recordLoginAttempt(db, user.id, false);
      await logAuditEvent(db, generateId(), user.id, 'login_failed', 'User', user.id, 'FAILED', 'Invalid password');

      return ctx.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'ইমেইল বা পাসওয়ার্ড ভুল।',
          },
        } as APIResponse<null>,
        { status: 401 }
      );
    }

    await recordLoginAttempt(db, user.id, true);

    const accessToken = await generateAccessToken(
      { userId: user.id, email: user.email, role_id: user.role_id },
      env.JWT_SECRET || ''
    );

    await logAuditEvent(db, generateId(), user.id, 'login_success', 'User', user.id);

    ctx.header('Set-Cookie', `token=${accessToken}; HttpOnly; Secure; SameSite=Strict; Path=/`);

    return ctx.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role_id: user.role_id,
        },
      },
    } as APIResponse<any>);
  } catch (err: any) {
    console.error('Login error:', err);
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: err.message || 'অনুরোধ বৈধ নয়।',
        },
      } as APIResponse<null>,
      { status: 400 }
    );
  }
});

// POST /api/auth/logout
authRoutes.post('/logout', authMiddleware, async (ctx: Context) => {
  const auth = ctx.get('auth');

  if (auth?.isAuthenticated) {
    const db = new Database((ctx.env as any).DB);
    await logAuditEvent(db, generateId(), auth.userId, 'logout', 'User', auth.userId);
  }

  ctx.header('Set-Cookie', `token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);

  return ctx.json({
    success: true,
    data: { message: 'সফলভাবে লগ আউট হয়েছেন।' },
  } as APIResponse<any>);
});

// GET /api/auth/me
authRoutes.get('/me', authMiddleware, async (ctx: Context) => {
  const auth = ctx.get('auth');
  const env = ctx.env as any;
  const db = new Database(env.DB);

  if (!auth?.isAuthenticated) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'অননুমোদিত।',
        },
      } as APIResponse<null>,
      { status: 401 }
    );
  }

  try {
    const user = await db.query('SELECT id, email, full_name, role_id FROM users WHERE id = ?', [auth.userId]);

    if (!user) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি।',
          },
        } as APIResponse<null>,
        { status: 404 }
      );
    }

    const role = await db.query('SELECT name FROM roles WHERE id = ?', [user.role_id]);

    return ctx.json({
      success: true,
      data: {
        ...user,
        role: role?.name,
      },
    } as APIResponse<any>);
  } catch (err: any) {
    console.error('Get current user error:', err);
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'অভ্যন্তরীণ সার্ভার ত্রুটি।',
        },
      } as APIResponse<null>,
      { status: 500 }
    );
  }
});

// POST /api/auth/change-password
authRoutes.post('/change-password', authMiddleware, async (ctx: Context) => {
  const auth = ctx.get('auth');
  const env = ctx.env as any;
  const db = new Database(env.DB);

  if (!auth?.isAuthenticated) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'অননুমোদিত।',
        },
      } as APIResponse<null>,
      { status: 401 }
    );
  }

  try {
    const body = changePasswordSchema.parse(await ctx.req.json());

    const user = await db.query('SELECT * FROM users WHERE id = ?', [auth.userId]);

    if (!user) {
      throw new Error('NOT_FOUND');
    }

    const passwordMatch = await verifyPassword(body.currentPassword, user.password_hash);

    if (!passwordMatch) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'বর্তমান পাসওয়ার্ড ভুল।',
          },
        } as APIResponse<null>,
        { status: 401 }
      );
    }

    const newHash = await hashPassword(body.newPassword);
    await db.execute('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      newHash,
      auth.userId,
    ]);

    await logAuditEvent(db, generateId(), auth.userId, 'change_password', 'User', auth.userId);

    return ctx.json({
      success: true,
      data: { message: 'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।' },
    } as APIResponse<any>);
  } catch (err: any) {
    console.error('Change password error:', err);
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'অভ্যন্তরীণ সার্ভার ত্রুটি।',
        },
      } as APIResponse<null>,
      { status: 500 }
    );
  }
});

export default authRoutes;
