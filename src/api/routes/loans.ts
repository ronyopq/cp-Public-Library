import { Hono } from 'hono';
import { Context } from 'hono';
import { authMiddleware, requireAuth, requireRole } from '../middleware/auth';
import { db } from '../utils/db';
import { generateId } from '../utils/auth';
import { z } from 'zod';

const loansRoutes = new Hono();

// Validation schemas
const issueLoanSchema = z.object({
  member_id: z.string().min(1, 'Member required'),
  book_copy_id: z.string().min(1, 'Copy required')
});

const returnLoanSchema = z.object({
  loan_id: z.string().min(1, 'Loan ID required'),
  copy_condition: z.enum(['NEW', 'GOOD', 'WORN', 'DAMAGED', 'LOST']),
  staff_notes: z.string().optional()
});

const renewLoanSchema = z.object({
  loan_id: z.string().min(1, 'Loan ID required')
});

/**
 * GET /api/loans
 * Get paginated list of loans
 * Filters: member_id, status (ACTIVE, RETURNED, LOST), page, limit
 */
loansRoutes.get('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const page = parseInt(ctx.req.query('page') || '1');
  const limit = Math.min(parseInt(ctx.req.query('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const status = ctx.req.query('status');
  const memberId = ctx.req.query('member_id');

  try {
    let whereClause = 'WHERE l.deleted_at IS NULL';
    let params: any[] = [];

    if (status) {
      whereClause += ' AND l.status = ?';
      params.push(status);
    }
    if (memberId) {
      whereClause += ' AND l.member_id = ?';
      params.push(memberId);
    }

    // Get total count
    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM loans l ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Get paginated loans
    const loans = await db.queryAll(
      `SELECT 
        l.*,
        m.full_name as member_name,
        b.title as book_title,
        bc.accession_number
      FROM loans l
      JOIN members m ON l.member_id = m.id
      JOIN book_copies bc ON l.book_copy_id = bc.id
      JOIN bibliographic_records b ON bc.bibliographic_record_id = b.id
      ${whereClause}
      ORDER BY l.issued_date DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return ctx.json({
      success: true,
      data: {
        items: loans,
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
          message: 'লোন তথ্য পেতে ব্যর্থ।',
          message_en: 'Failed to fetch loan information.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/loans/:id
 * Get single loan with full details
 */
loansRoutes.get('/:id', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const loanId = ctx.req.param('id');

  try {
    const loan = await db.query(
      `SELECT 
        l.*,
        m.full_name as member_name,
        m.phone as member_phone,
        b.title as book_title,
        b.isbn,
        bc.accession_number,
        bc.condition
      FROM loans l
      JOIN members m ON l.member_id = m.id
      JOIN book_copies bc ON l.book_copy_id = bc.id
      JOIN bibliographic_records b ON bc.bibliographic_record_id = b.id
      WHERE l.id = ? AND l.deleted_at IS NULL`,
      [loanId]
    );

    if (!loan) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'লোন দেখা যায় নি।',
            message_en: 'Loan not found.'
          }
        },
        { status: 404 }
      );
    }

    // Get loan history
    const history = await db.queryAll(
      `SELECT * FROM loan_history WHERE loan_id = ? ORDER BY created_at DESC`,
      [loanId]
    );

    // Get any fines associated with this loan
    const fines = await db.queryAll(
      `SELECT * FROM fines WHERE loan_id = ? ORDER BY created_at DESC`,
      [loanId]
    );

    return ctx.json({
      success: true,
      data: {
        ...loan,
        history,
        fines
      }
    });
  } catch (error: any) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'লোন তথ্য পেতে ব্যর্থ।',
          message_en: 'Failed to fetch loan details.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/loans
 * Issue a new loan (Library staff only)
 * Body: { member_id, book_copy_id }
 */
loansRoutes.post('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);

  // Check permission
  const hasPermission = await db.queryAll(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = ? AND p.name = ?`,
    [auth.role_id, 'loans:create']
  );
  if (!hasPermission.length) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'আপনার এই অনুমতি নেই।',
          message_en: 'You do not have permission to issue loans.'
        }
      },
      { status: 403 }
    );
  }

  try {
    const body = issueLoanSchema.parse(await ctx.req.json());

    // Verify member exists and is active
    const member = await db.query(
      `SELECT * FROM members WHERE id = ? AND membership_status = 'ACTIVE' AND deleted_at IS NULL`,
      [body.member_id]
    );
    if (!member) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'সদস্য সক্রিয় নয় বা পাওয়া যায় নি।',
            message_en: 'Member not found or not active.'
          }
        },
        { status: 404 }
      );
    }

    // Verify copy exists and is available
    const copy = await db.query(
      `SELECT * FROM book_copies WHERE id = ? AND is_available = 1 AND deleted_at IS NULL`,
      [body.book_copy_id]
    );
    if (!copy) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'এই বই কপি উপলব্ধ নয়।',
            message_en: 'This book copy is not available.'
          }
        },
        { status: 400 }
      );
    }

    // Check member doesn't exceed max loans (default 5)
    const activeLoanCount = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND status = 'ACTIVE'`,
      [body.member_id]
    );
    if ((activeLoanCount?.count || 0) >= 5) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'সদস্য সর্বোচ্চ লোন সীমা অতিক্রম করেছে।',
            message_en: 'Member has reached maximum loan limit.'
          }
        },
        { status: 400 }
      );
    }

    // Create loan
    const loanId = generateId();
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 14); // 14-day loan period

    await db.execute(
      `INSERT INTO loans (
        id, member_id, book_copy_id, issued_date, due_date, 
        status, renewal_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loanId,
        body.member_id,
        body.book_copy_id,
        today.toISOString().split('T')[0],
        dueDate.toISOString().split('T')[0],
        'ACTIVE',
        0,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );

    // Create loan history entry
    await db.execute(
      `INSERT INTO loan_history (
        id, loan_id, action, staff_id, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        generateId(),
        loanId,
        'ISSUED',
        auth.user_id,
        new Date().toISOString()
      ]
    );

    // Mark copy as unavailable
    await db.execute(
      `UPDATE book_copies SET is_available = 0, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), body.book_copy_id]
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
        'loan_issued',
        'loans',
        loanId,
        JSON.stringify({ member_id: body.member_id, copy_id: body.book_copy_id }),
        'SUCCESS',
        new Date().toISOString()
      ]
    );

    const loan = await db.query(
      `SELECT l.*, b.title FROM loans l 
       JOIN book_copies bc ON l.book_copy_id = bc.id
       JOIN bibliographic_records b ON bc.bibliographic_record_id = b.id
       WHERE l.id = ?`,
      [loanId]
    );

    return ctx.json({
      success: true,
      data: {
        ...loan,
        message: `লোন সফলভাবে তৈরি হয়েছে। ফেরত দেওয়ার তারিখ: ${dueDate.toLocaleDateString('en-BD')}`
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
          message: 'লোন তৈরি করতে ব্যর্থ।',
          message_en: 'Failed to create loan.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/loans/:id/return
 * Return a loan (mark as returned)
 * Body: { copy_condition, staff_notes? }
 */
loansRoutes.post('/:id/return', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const loanId = ctx.req.param('id');

  const hasPermission = await db.queryAll(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = ? AND p.name = ?`,
    [auth.role_id, 'loans:return']
  );
  if (!hasPermission.length) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'আপনার এই অনুমতি নেই।',
          message_en: 'You do not have permission to return loans.'
        }
      },
      { status: 403 }
    );
  }

  try {
    const body = returnLoanSchema.parse(await ctx.req.json());

    // Get loan
    const loan = await db.query(
      `SELECT * FROM loans WHERE id = ? AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [loanId]
    );
    if (!loan) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'লোন পাওয়া যায় নি বা ইতিমধ্যে ফেরত দেওয়া হয়েছে।',
            message_en: 'Loan not found or already returned.'
          }
        },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const dueDate = loan.due_date;
    const isOverdue = today > dueDate;

    // Mark loan as returned
    await db.execute(
      `UPDATE loans SET status = 'RETURNED', returned_date = ?, updated_at = ? WHERE id = ?`,
      [today, new Date().toISOString(), loanId]
    );

    // Create loan history entry
    await db.execute(
      `INSERT INTO loan_history (
        id, loan_id, action, staff_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        loanId,
        'RETURNED',
        auth.user_id,
        body.staff_notes || null,
        new Date().toISOString()
      ]
    );

    // Update copy condition and availability
    await db.execute(
      `UPDATE book_copies SET 
        condition = ?, is_available = 1, updated_at = ? 
       WHERE id = ?`,
      [body.copy_condition, new Date().toISOString(), loan.book_copy_id]
    );

    // If overdue, create fine
    let fineId = null;
    if (isOverdue) {
      const daysLate = Math.floor((new Date(today).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const fineAmount = Math.min(daysLate * 5, 100); // 5 BDT per day, max 100 BDT

      fineId = generateId();
      await db.execute(
        `INSERT INTO fines (
          id, loan_id, member_id, fine_type, amount, 
          calculated_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fineId,
          loanId,
          loan.member_id,
          'OVERDUE',
          fineAmount,
          today,
          'PENDING',
          new Date().toISOString()
        ]
      );

      // Create audit log for fine
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
          JSON.stringify({ days_late: daysLate, amount: fineAmount }),
          'SUCCESS',
          new Date().toISOString()
        ]
      );
    }

    // Audit log for return
    await db.execute(
      `INSERT INTO audit_logs (
        id, user_id, action, resource_type, resource_id, 
        new_values, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        auth.user_id,
        'loan_returned',
        'loans',
        loanId,
        JSON.stringify({ condition: body.copy_condition, is_overdue: isOverdue }),
        'SUCCESS',
        new Date().toISOString()
      ]
    );

    return ctx.json({
      success: true,
      data: {
        loan_id: loanId,
        status: 'RETURNED',
        is_overdue: isOverdue,
        fine_created: !!fineId,
        fine_id: fineId,
        message: isOverdue 
          ? `লোন ফেরত দেওয়া হয়েছে। বিলম্ব ফি প্রযোজনীয়।`
          : 'লোন সফলভাবে ফেরত দেওয়া হয়েছে।'
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
          message: 'লোন ফেরত দিতে ব্যর্থ।',
          message_en: 'Failed to return loan.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/loans/:id/renew
 * Renew a loan (extend due date)
 */
loansRoutes.post('/:id/renew', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const loanId = ctx.req.param('id');

  const hasPermission = await db.queryAll(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = ? AND p.name = ?`,
    [auth.role_id, 'loans:renew']
  );
  if (!hasPermission.length) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'আপনার এই অনুমতি নেই।',
          message_en: 'You do not have permission to renew loans.'
        }
      },
      { status: 403 }
    );
  }

  try {
    const loan = await db.query(
      `SELECT * FROM loans WHERE id = ? AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [loanId]
    );

    if (!loan) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'লোন পাওয়া যায় নি।',
            message_en: 'Loan not found.'
          }
        },
        { status: 404 }
      );
    }

    // Check max renewals (2)
    if ((loan.renewal_count || 0) >= 2) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'সর্বোচ্চ নবায়ন সীমা অতিক্রম করা হয়েছে।',
            message_en: 'Maximum renewal limit reached.'
          }
        },
        { status: 400 }
      );
    }

    // Extend due date by 14 days
    const newDueDate = new Date(loan.due_date);
    newDueDate.setDate(newDueDate.getDate() + 14);

    await db.execute(
      `UPDATE loans SET 
        due_date = ?, renewal_count = renewal_count + 1, updated_at = ? 
       WHERE id = ?`,
      [
        newDueDate.toISOString().split('T')[0],
        new Date().toISOString(),
        loanId
      ]
    );

    // Create history entry
    await db.execute(
      `INSERT INTO loan_history (
        id, loan_id, action, staff_id, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        generateId(),
        loanId,
        'RENEWED',
        auth.user_id,
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
        'loan_renewed',
        'loans',
        loanId,
        JSON.stringify({ new_due_date: newDueDate.toISOString().split('T')[0] }),
        'SUCCESS',
        new Date().toISOString()
      ]
    );

    return ctx.json({
      success: true,
      data: {
        loan_id: loanId,
        new_due_date: newDueDate.toISOString().split('T')[0],
        renewal_count: (loan.renewal_count || 0) + 1,
        message: `লোন নবায়ন করা হয়েছে। নতুন ফেরত দেওয়ার তারিখ: ${newDueDate.toLocaleDateString('en-BD')}`
      }
    });
  } catch (error: any) {
    return ctx.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'লোন নবায়ন করতে ব্যর্থ।',
          message_en: 'Failed to renew loan.'
        }
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/loans/due-soon
 * Get loans due within next 3 days
 */
loansRoutes.get('/due-soon', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);

  try {
    const today = new Date().toISOString().split('T')[0];
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);

    const loans = await db.queryAll(
      `SELECT 
        l.*,
        m.full_name as member_name,
        m.phone,
        b.title as book_title,
        bc.accession_number
      FROM loans l
      JOIN members m ON l.member_id = m.id
      JOIN book_copies bc ON l.book_copy_id = bc.id
      JOIN bibliographic_records b ON bc.bibliographic_record_id = b.id
      WHERE l.status = 'ACTIVE' 
        AND l.due_date BETWEEN ? AND ?
        AND l.deleted_at IS NULL
      ORDER BY l.due_date ASC`,
      [today, inThreeDays.toISOString().split('T')[0]]
    );

    return ctx.json({
      success: true,
      data: loans
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

export default loansRoutes;
