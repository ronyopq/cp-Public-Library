// src/api/routes/members.ts

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { Database } from '../utils/db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { generateId, generateMembershipNumber } from '../utils/auth';
import type { APIResponse } from '../../shared/types';

const membersRoutes = new Hono();

const createMemberSchema = z.object({
  full_name: z.string().min(1),
  phone: z.string().regex(/^\+880\d{9}$/),
  email: z.string().email().optional(),
  address: z.string().min(1),
  city: z.string().optional(),
  membership_type: z.enum(['STUDENT', 'STAFF', 'GENERAL', 'LIFE']),
});

// GET /api/members - List members (staff only)
membersRoutes.get('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const env = ctx.env as any;
  const db = new Database(env.DB);

  try {
    // Check permission
    const hasPerm = await db.queryAll(
      `SELECT 1 FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ? AND p.name = 'members:read'`,
      [auth.role_id]
    );

    if (hasPerm.length === 0) {
      return ctx.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'অনুমতি নেই।' },
        },
        { status: 403 }
      );
    }

    const page = parseInt(ctx.req.query('page') || '1');
    const limit = parseInt(ctx.req.query('limit') || '50');
    const offset = (page - 1) * limit;

    const members = await db.queryAll(
      `SELECT id, membership_number, full_name, phone, email, membership_status, 
              membership_type, outstanding_fine, total_books_borrowed
       FROM members
       WHERE deleted_at IS NULL
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) as total FROM members WHERE deleted_at IS NULL');

    return ctx.json({
      success: true,
      data: {
        items: members,
        total: countResult?.total || 0,
        page,
        pageSize: limit,
        hasMore: members.length === limit,
      },
    });
  } catch (err: any) {
    console.error('Members list error:', err);
    return ctx.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'অভ্যন্তরীণ সার্ভার ত্রুটি।' },
      },
      { status: 500 }
    );
  }
});

// GET /api/members/:id - Get member details
membersRoutes.get('/:id', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const env = ctx.env as any;
  const db = new Database(env.DB);
  const memberId = ctx.req.param('id');

  try {
    const member = await db.query('SELECT * FROM members WHERE id = ? AND deleted_at IS NULL', [memberId]);

    if (!member) {
      return ctx.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'সদস্য খুঁজে পাওয়া যায়নি।' },
        },
        { status: 404 }
      );
    }

    // Get loans
    const loans = await db.queryAll(
      `SELECT l.*, b.title, bc.accession_number
       FROM loans l
       JOIN book_copies bc ON l.book_copy_id = bc.id
       JOIN bibliographic_records b ON bc.bibliographic_record_id = b.id
       WHERE l.member_id = ?
       ORDER BY l.issued_date DESC`,
      [memberId]
    );

    // Get fines
    const fines = await db.queryAll(
      'SELECT * FROM fines WHERE member_id = ? ORDER BY fine_date DESC',
      [memberId]
    );

    return ctx.json({
      success: true,
      data: {
        ...member,
        loans,
        fines,
      },
    });
  } catch (err: any) {
    console.error('Get member error:', err);
    return ctx.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'অভ্যন্তরীণ সার্ভার ত্রুটি।' },
      },
      { status: 500 }
    );
  }
});

// POST /api/members - Create new member
membersRoutes.post('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const env = ctx.env as any;
  const db = new Database(env.DB);

  try {
    const body = createMemberSchema.parse(await ctx.req.json());

    // Check permission
    const hasPerm = await db.queryAll(
      `SELECT 1 FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ? AND p.name = 'members:create'`,
      [auth.role_id]
    );

    if (hasPerm.length === 0) {
      return ctx.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'অনুমতি নেই।' },
        },
        { status: 403 }
      );
    }

    // Check if phone already exists
    const existing = await db.query('SELECT id FROM members WHERE phone = ?', [body.phone]);
    if (existing) {
      return ctx.json(
        {
          success: false,
          error: { code: 'DUPLICATE', message: 'এই ফোন নম্বর ইতিমধ্যে নিবন্ধিত।' },
        },
        { status: 400 }
      );
    }

    const memberId = generateId();
    const membershipNumber = generateMembershipNumber();
    const now = new Date();
    const expiryDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    await db.execute(
      `INSERT INTO members 
       (id, membership_number, full_name, phone, email, address, city, membership_type, 
        membership_start_date, membership_expiry_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        membershipNumber,
        body.full_name,
        body.phone,
        body.email || null,
        body.address,
        body.city || null,
        body.membership_type,
        now.toISOString().split('T')[0],
        expiryDate.toISOString().split('T')[0],
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?, ?)',
      [generateId(), auth.userId, 'member_created', 'Member', memberId]
    );

    const member = await db.query('SELECT * FROM members WHERE id = ?', [memberId]);

    return ctx.json(
      {
        success: true,
        data: member,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create member error:', err);
    return ctx.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message || 'অনুরোধ বৈধ নয়।',
        },
      },
      { status: 400 }
    );
  }
});

export default membersRoutes;
