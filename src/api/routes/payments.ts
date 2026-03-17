import { Hono } from 'hono';
import { Context } from 'hono';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { db } from '../utils/db';
import { generateId } from '../utils/auth';
import { z } from 'zod';

const paymentsRoutes = new Hono();

// Validation schemas
const createPaymentSchema = z.object({
  fine_id: z.string().min(1, 'Fine required'),
  amount: z.number().positive('Amount must be positive'),
  payment_type: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
  notes: z.string().optional()
});

/**
 * GET /api/payments
 * Get paginated list of payments
 * Filters: member_id, fine_id, payment_type, page, limit
 */
paymentsRoutes.get('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const page = parseInt(ctx.req.query('page') || '1');
  const limit = Math.min(parseInt(ctx.req.query('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const fineId = ctx.req.query('fine_id');
  const paymentType = ctx.req.query('payment_type');

  try {
    let whereClause = 'WHERE p.deleted_at IS NULL';
    let params: any[] = [];

    if (fineId) {
      whereClause += ' AND p.fine_id = ?';
      params.push(fineId);
    }
    if (paymentType) {
      whereClause += ' AND p.payment_type = ?';
      params.push(paymentType);
    }

    // Get total count
    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM payments p ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Get paginated payments
    const payments = await db.queryAll(
      `SELECT 
        p.*,
        f.amount as fine_amount,
        f.fine_type,
        m.full_name as member_name,
        m.phone,
        pt.name as payment_type_name
      FROM payments p
      JOIN fines f ON p.fine_id = f.id
      JOIN members m ON f.member_id = m.id
      JOIN payment_types pt ON p.payment_type = pt.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return ctx.json({
      success: true,
      data: {
        items: payments,
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
          message: 'পেমেন্ট তথ্য পেতে ব্যর্থ।',
          message_en: 'Failed to fetch payment information.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/payments/:id
 * Get single payment with receipt details
 */
paymentsRoutes.get('/:id', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const paymentId = ctx.req.param('id');

  try {
    const payment = await db.query(
      `SELECT 
        p.*,
        f.amount as fine_amount,
        f.fine_type,
        m.full_name as member_name,
        m.phone,
        m.membership_number,
        pt.name as payment_type_name
      FROM payments p
      JOIN fines f ON p.fine_id = f.id
      JOIN members m ON f.member_id = m.id
      JOIN payment_types pt ON p.payment_type = pt.id
      WHERE p.id = ? AND p.deleted_at IS NULL`,
      [paymentId]
    );

    if (!payment) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'পেমেন্ট দেখা যায় নি।',
            message_en: 'Payment not found.'
          }
        },
        { status: 404 }
      );
    }

    // Get receipt if generated
    const receipt = await db.query(
      `SELECT * FROM receipts WHERE payment_id = ?`,
      [paymentId]
    );

    return ctx.json({
      success: true,
      data: {
        ...payment,
        receipt
      }
    });
  } catch (error: any) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'পেমেন্ট তথ্য পেতে ব্যর্থ।',
          message_en: 'Failed to fetch payment details.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/payments
 * Record a payment against a fine
 */
paymentsRoutes.post('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);

  // Check permission
  const hasPermission = await db.queryAll(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = ? AND p.name = ?`,
    [auth.role_id, 'payments:create']
  );
  if (!hasPermission.length) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'আপনার এই অনুমতি নেই।',
          message_en: 'You do not have permission to record payments.'
        }
      },
      { status: 403 }
    );
  }

  try {
    const body = createPaymentSchema.parse(await ctx.req.json());

    // Get fine
    const fine = await db.query(
      `SELECT * FROM fines WHERE id = ? AND deleted_at IS NULL`,
      [body.fine_id]
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

    // Validate amount
    if (body.amount > fine.amount) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `পেমেন্ট পরিমাণ ফি পরিমাণ (${fine.amount} টাকা) অতিক্রম করে।`,
            message_en: `Payment amount exceeds fine amount (${fine.amount} BDT).`
          }
        },
        { status: 400 }
      );
    }

    // Create payment
    const paymentId = generateId();
    const receiptId = generateId();

    await db.execute(
      `INSERT INTO payments (
        id, fine_id, amount, payment_type, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        body.fine_id,
        body.amount,
        body.payment_type,
        body.notes || null,
        new Date().toISOString()
      ]
    );

    // Determine if fine is fully paid
    const totalPaid = body.amount;
    const newStatus = totalPaid >= fine.amount ? 'PAID' : 'PARTIAL';

    // Update fine status
    await db.execute(
      `UPDATE fines SET status = ?, updated_at = ? WHERE id = ?`,
      [newStatus, new Date().toISOString(), body.fine_id]
    );

    // Create ledger entry (accounting)
    await db.execute(
      `INSERT INTO ledger_entries (
        id, entry_type, amount, member_id, fine_id, payment_id,
        description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        'PAYMENT',
        body.amount,
        fine.member_id,
        body.fine_id,
        paymentId,
        `Payment for ${fine.fine_type} fine`,
        new Date().toISOString()
      ]
    );

    // Create receipt
    const today = new Date().toISOString().split('T')[0];
    await db.execute(
      `INSERT INTO receipts (
        id, payment_id, receipt_number, issued_date, 
        amount, payment_method, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        receiptId,
        paymentId,
        `RCP-${today.replace(/-/g, '')}-${paymentId.slice(-6).toUpperCase()}`,
        today,
        body.amount,
        body.payment_type,
        'GENERATED',
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
        'payment_recorded',
        'payments',
        paymentId,
        JSON.stringify({
          amount: body.amount,
          payment_type: body.payment_type,
          fine_id: body.fine_id,
          new_status: newStatus
        }),
        'SUCCESS',
        new Date().toISOString()
      ]
    );

    return ctx.json({
      success: true,
      data: {
        payment_id: paymentId,
        receipt_id: receiptId,
        amount: body.amount,
        fine_status: newStatus,
        receipt_number: `RCP-${today.replace(/-/g, '')}-${paymentId.slice(-6).toUpperCase()}`,
        message: newStatus === 'PAID' 
          ? 'পেমেন্ট সফলভাবে রেকর্ড করা হয়েছে। ফি সম্পূর্ণভাবে পরিশোধ করা হয়েছে।'
          : 'আংশিক পেমেন্ট রেকর্ড করা হয়েছে।'
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
          message: 'পেমেন্ট রেকর্ড করতে ব্যর্থ।',
          message_en: 'Failed to record payment.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/payments/receipt/:receiptId
 * Get receipt details for printing
 */
paymentsRoutes.get('/receipt/:receiptId', authMiddleware, async (ctx: Context) => {
  const receiptId = ctx.req.param('receiptId');

  try {
    const receipt = await db.query(
      `SELECT 
        r.*,
        p.amount as payment_amount,
        p.notes as payment_notes,
        f.amount as fine_amount,
        f.fine_type,
        m.full_name as member_name,
        m.phone,
        m.membership_number,
        u.full_name as recorded_by
      FROM receipts r
      JOIN payments p ON r.payment_id = p.id
      JOIN fines f ON p.fine_id = f.id
      JOIN members m ON f.member_id = m.id
      JOIN users u ON r.created_by = u.id
      WHERE r.id = ? AND r.deleted_at IS NULL`,
      [receiptId]
    );

    if (!receipt) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'রশিদ দেখা যায় নি।',
            message_en: 'Receipt not found.'
          }
        },
        { status: 404 }
      );
    }

    return ctx.json({
      success: true,
      data: receipt
    });
  } catch (error: any) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'রশিদ তথ্য পেতে ব্যর্থ।',
          message_en: 'Failed to fetch receipt.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/payments/member/:memberId/outstanding
 * Get member's outstanding fines (not yet paid)
 */
paymentsRoutes.get('/member/:memberId/outstanding', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const memberId = ctx.req.param('memberId');

  try {
    const outstanding = await db.queryAll(
      `SELECT 
        f.*,
        l.issued_date,
        l.due_date,
        b.title as book_title
      FROM fines f
      LEFT JOIN loans l ON f.loan_id = l.id
      LEFT JOIN book_copies bc ON l.book_copy_id = bc.id
      LEFT JOIN bibliographic_records b ON bc.bibliographic_record_id = b.id
      WHERE f.member_id = ? 
        AND f.status IN ('PENDING', 'PARTIAL')
        AND f.deleted_at IS NULL
      ORDER BY f.calculated_date ASC`,
      [memberId]
    );

    const summary = {
      total_outstanding: 0,
      total_fines: outstanding.length,
      fines: outstanding
    };

    outstanding.forEach(fine => {
      summary.total_outstanding += fine.amount;
    });

    return ctx.json({
      success: true,
      data: summary
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

export default paymentsRoutes;
