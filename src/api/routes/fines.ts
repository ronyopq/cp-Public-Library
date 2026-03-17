import { Hono } from 'hono';
import { Context } from 'hono';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { db } from '../utils/db';
import { generateId } from '../utils/auth';
import { z } from 'zod';

const finesRoutes = new Hono();

// Validation schemas
const createFineSchema = z.object({
  member_id: z.string().min(1, 'Member required'),
  loan_id: z.string().optional(),
  fine_type: z.enum(['OVERDUE', 'DAMAGE', 'LOST', 'MANUAL']),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().optional()
});

const waiveFineSchema = z.object({
  waive_reason: z.string().min(5, 'Reason required (min 5 chars)'),
  approve_by: z.string().optional()
});

/**
 * GET /api/fines
 * Get paginated list of fines
 * Filters: member_id, status (PENDING, PAID, WAIVED, PARTIAL), page, limit
 */
finesRoutes.get('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const page = parseInt(ctx.req.query('page') || '1');
  const limit = Math.min(parseInt(ctx.req.query('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const status = ctx.req.query('status');
  const memberId = ctx.req.query('member_id');

  try {
    let whereClause = 'WHERE f.deleted_at IS NULL';
    let params: any[] = [];

    if (status) {
      whereClause += ' AND f.status = ?';
      params.push(status);
    }
    if (memberId) {
      whereClause += ' AND f.member_id = ?';
      params.push(memberId);
    }

    // Get total count
    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM fines f ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Get paginated fines
    const fines = await db.queryAll(
      `SELECT 
        f.*,
        m.full_name as member_name,
        m.phone,
        l.issued_date,
        l.due_date
      FROM fines f
      JOIN members m ON f.member_id = m.id
      LEFT JOIN loans l ON f.loan_id = l.id
      ${whereClause}
      ORDER BY f.calculated_date DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return ctx.json({
      success: true,
      data: {
        items: fines,
        total,
        page,
        limit,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ফি তথ্য পেতে ব্যর্থ।',
          message_en: 'Failed to fetch fine information.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/fines/:id
 * Get single fine with details
 */
finesRoutes.get('/:id', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const fineId = ctx.req.param('id');

  try {
    const fine = await db.query(
      `SELECT 
        f.*,
        m.full_name as member_name,
        m.phone,
        l.issued_date,
        l.due_date,
        l.returned_date,
        b.title as book_title
      FROM fines f
      JOIN members m ON f.member_id = m.id
      LEFT JOIN loans l ON f.loan_id = l.id
      LEFT JOIN book_copies bc ON l.book_copy_id = bc.id
      LEFT JOIN bibliographic_records b ON bc.bibliographic_record_id = b.id
      WHERE f.id = ? AND f.deleted_at IS NULL`,
      [fineId]
    );

    if (!fine) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'ফি দেখা যায় নি।',
            message_en: 'Fine not found.'
          }
        },
        { status: 404 }
      );
    }

    // Get payments for this fine
    const payments = await db.queryAll(
      `SELECT * FROM payments WHERE fine_id = ? ORDER BY created_at DESC`,
      [fineId]
    );

    return ctx.json({
      success: true,
      data: {
        ...fine,
        payments
      }
    });
  } catch (error: any) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ফি তথ্য পেতে ব্যর্থ।',
          message_en: 'Failed to fetch fine details.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/fines
 * Create a manual fine (Officer+ only)
 */
finesRoutes.post('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);

  // Check permission
  const hasPermission = await db.queryAll(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = ? AND p.name = ?`,
    [auth.role_id, 'fines:create']
  );
  if (!hasPermission.length) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'আপনার এই অনুমতি নেই।',
          message_en: 'You do not have permission to create fines.'
        }
      },
      { status: 403 }
    );
  }

  try {
    const body = createFineSchema.parse(await ctx.req.json());

    // Verify member exists
    const member = await db.query(
      `SELECT * FROM members WHERE id = ? AND deleted_at IS NULL`,
      [body.member_id]
    );
    if (!member) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'সদস্য দেখা যায় নি।',
            message_en: 'Member not found.'
          }
        },
        { status: 404 }
      );
    }

    // Create fine
    const fineId = generateId();
    const today = new Date().toISOString().split('T')[0];

    await db.execute(
      `INSERT INTO fines (
        id, member_id, loan_id, fine_type, amount, 
        calculated_date, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fineId,
        body.member_id,
        body.loan_id || null,
        body.fine_type,
        body.amount,
        today,
        'PENDING',
        body.notes || null,
        new Date().toISOString()
      ]
    );

    // Audit log
    await db.execute(
      `INSERT INTO audit_logs (
        id, user_id, action, resource_type, resource_id, 
        new_values, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        auth.user_id,
        'fine_created',
        'fines',
        fineId,
        JSON.stringify({
          member_id: body.member_id,
          amount: body.amount,
          type: body.fine_type
        }),
        'SUCCESS',
        new Date().toISOString()
      ]
    );

    return ctx.json({
      success: true,
      data: {
        id: fineId,
        member_id: body.member_id,
        amount: body.amount,
        status: 'PENDING',
        message: 'ফি সফলভাবে তৈরি হয়েছে।'
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'বৈধতা ত্রুটি।',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }

    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ফি তৈরি করতে ব্যর্থ।',
          message_en: 'Failed to create fine.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/fines/:id/waive
 * Waive (forgive) a fine (Manager+ only)
 */
finesRoutes.post('/:id/waive', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const fineId = ctx.req.param('id');

  // Check permission (Manager+)
  const hasPermission = await db.queryAll(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = ? AND p.name = ?`,
    [auth.role_id, 'fines:waive']
  );
  if (!hasPermission.length) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'আপনার এই অনুমতি নেই।',
          message_en: 'You do not have permission to waive fines.'
        }
      },
      { status: 403 }
    );
  }

  try {
    const body = waiveFineSchema.parse(await ctx.req.json());

    // Get fine
    const fine = await db.query(
      `SELECT * FROM fines WHERE id = ? AND status = 'PENDING' AND deleted_at IS NULL`,
      [fineId]
    );
    if (!fine) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'ফি দেখা যায় নি অথবা ইতিমধ্যে পরিশোধ করা হয়েছে।',
            message_en: 'Fine not found or already paid.'
          }
        },
        { status: 404 }
      );
    }

    // Mark as waived
    await db.execute(
      `UPDATE fines SET status = 'WAIVED', waived_reason = ?, waived_by = ?, waived_date = ?, updated_at = ? WHERE id = ?`,
      [
        body.waive_reason,
        auth.user_id,
        new Date().toISOString().split('T')[0],
        new Date().toISOString(),
        fineId
      ]
    );

    // Audit log
    await db.execute(
      `INSERT INTO audit_logs (
        id, user_id, action, resource_type, resource_id, 
        new_values, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        auth.user_id,
        'fine_waived',
        'fines',
        fineId,
        JSON.stringify({
          reason: body.waive_reason,
          waived_amount: fine.amount
        }),
        'SUCCESS',
        new Date().toISOString()
      ]
    );

    return ctx.json({
      success: true,
      data: {
        id: fineId,
        status: 'WAIVED',
        waived_amount: fine.amount,
        message: 'ফি মাফ করা হয়েছে।'
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'বৈধতা ত্রুটি।',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }

    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ফি মাফ করতে ব্যর্থ।',
          message_en: 'Failed to waive fine.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/fines/member/:memberId
 * Get all fines for a member with summary
 */
finesRoutes.get('/member/:memberId', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const memberId = ctx.req.param('memberId');

  try {
    // Get fines for member
    const fines = await db.queryAll(
      `SELECT * FROM fines WHERE member_id = ? AND deleted_at IS NULL ORDER BY calculated_date DESC`,
      [memberId]
    );

     // Calculate summary
    const summary = {
      total_pending: 0,
      total_paid: 0,
      total_waived: 0,
      outstanding: 0
    };

    fines.forEach(fine => {
      if (fine.status === 'PENDING') {
        summary.total_pending += fine.amount;
        summary.outstanding += fine.amount;
      } else if (fine.status === 'PAID' || fine.status === 'PARTIAL') {
        summary.total_paid += fine.amount;
      } else if (fine.status === 'WAIVED') {
        summary.total_waived += fine.amount;
      }
    });

    return ctx.json({
      success: true,
      data: {
        fines,
        summary
      }
    });
  } catch (error: any) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ডেটা পেতে ব্যর্থ।',
          message_en: 'Failed to fetch data.'
        }
      },
      { status: 500 }
    );
  }
});

export default finesRoutes;
