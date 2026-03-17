// src/api/routes/books.ts

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { Database } from '../utils/db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { generateId, generateAccessionNumber } from '../utils/auth';
import type { APIResponse, PagedResponse } from '../../shared/types';

const booksRoutes = new Hono();

const createBookSchema = z.object({
  isbn: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  edition: z.string().optional(),
  language_id: z.string(),
  publisher_id: z.string().optional(),
  publication_year: z.number().optional(),
  pages: z.number().optional(),
  description: z.string().optional(),
  category_id: z.string().optional(),
});

const createCopySchema = z.object({
  bibliographic_record_id: z.string(),
  condition: z.enum(['NEW', 'GOOD', 'WORN', 'DAMAGED', 'LOST', 'WITHDRAWN', 'REPAIR']),
  acquisition_type: z.enum(['PURCHASE', 'GIFT', 'DONATION', 'REPLACEMENT', 'OTHER']),
  acquisition_date: z.string(),
  acquisition_cost: z.number().optional(),
  acquisition_source: z.string().optional(),
  shelf_id: z.string().optional(),
});

// GET /api/books - List all books (public access)
booksRoutes.get('/', async (ctx: Context) => {
  const env = ctx.env as any;
  const db = new Database(env.DB);

  try {
    const page = parseInt(ctx.req.query('page') || '1');
    const limit = parseInt(ctx.req.query('limit') || '50');
    const offset = (page - 1) * limit;

    const books = await db.queryAll(
      `SELECT b.*, 
              COUNT(DISTINCT bc.id) as copy_count,
              l.name as language_name,
              p.name as publisher_name,
              c.name as category_name
       FROM bibliographic_records b
       LEFT JOIN book_copies bc ON b.id = bc.bibliographic_record_id AND bc.deleted_at IS NULL
       LEFT JOIN languages l ON b.language_id = l.id
       LEFT JOIN publishers p ON b.publisher_id = p.id
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.deleted_at IS NULL AND b.visibility_public = 1
       GROUP BY b.id
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM bibliographic_records WHERE deleted_at IS NULL AND visibility_public = 1'
    );

    return ctx.json({
      success: true,
      data: {
        items: books,
        total: countResult?.total || 0,
        page,
        pageSize: limit,
        hasMore: books.length === limit,
      },
    } as APIResponse<PagedResponse<any>>);
  } catch (err: any) {
    console.error('Books list error:', err);
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

// GET /api/books/:id - Get single book
booksRoutes.get('/:id', async (ctx: Context) => {
  const env = ctx.env as any;
  const db = new Database(env.DB);
  const bookId = ctx.req.param('id');

  try {
    const book = await db.query(
      `SELECT b.*, 
              l.name as language_name,
              p.name as publisher_name,
              c.name as category_name
       FROM bibliographic_records b
       LEFT JOIN languages l ON b.language_id = l.id
       LEFT JOIN publishers p ON b.publisher_id = p.id
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = ? AND (b.visibility_public = 1 OR ? = 1)`,
      [bookId, ctx.get('auth')?.isAuthenticated ? 1 : 0]
    );

    if (!book) {
      return ctx.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'বই খুঁজে পাওয়া যায়নি।',
          },
        } as APIResponse<null>,
        { status: 404 }
      );
    }

    // Get copies
    const copies = await db.queryAll(
      `SELECT * FROM book_copies 
       WHERE bibliographic_record_id = ? AND deleted_at IS NULL`,
      [bookId]
    );

    // Get contributors
    const contributors = await db.queryAll(
      `SELECT bc.*, c.name as contributor_name
       FROM book_contributors bc
       JOIN contributors c ON bc.contributor_id = c.id
       WHERE bc.bibliographic_record_id = ?`,
      [bookId]
    );

    return ctx.json({
      success: true,
      data: {
        ...book,
        copies,
        contributors,
      },
    } as APIResponse<any>);
  } catch (err: any) {
    console.error('Get book error:', err);
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

// POST /api/books - Create new book (requires auth)
booksRoutes.post('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const env = ctx.env as any;
  const db = new Database(env.DB);

  try {
    const body = createBookSchema.parse(await ctx.req.json());

    const bookId = generateId();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO bibliographic_records 
       (id, isbn, title, subtitle, edition, language_id, publisher_id, 
        publication_year, pages, description, category_id, metadata_source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookId,
        body.isbn || null,
        body.title,
        body.subtitle || null,
        body.edition || null,
        body.language_id,
        body.publisher_id || null,
        body.publication_year || null,
        body.pages || null,
        body.description || null,
        body.category_id || null,
        'MANUAL',
        now,
        now,
      ]
    );

    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?, ?)',
      [generateId(), auth.userId, 'book_created', 'Book', bookId]
    );

    const book = await db.query('SELECT * FROM bibliographic_records WHERE id = ?', [bookId]);

    return ctx.json(
      {
        success: true,
        data: book,
      } as APIResponse<any>,
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create book error:', err);
    return ctx.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message || 'অনুরোধ বৈধ নয়।',
        },
      } as APIResponse<null>,
      { status: 400 }
    );
  }
});

// POST /api/books/:id/copies - Add copy
booksRoutes.post('/:id/copies', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  const env = ctx.env as any;
  const db = new Database(env.DB);
  const bookId = ctx.req.param('id');

  try {
    const body = createCopySchema.parse(await ctx.req.json());

    // Verify book exists
    const book = await db.query('SELECT * FROM bibliographic_records WHERE id = ?', [bookId]);
    if (!book) {
      return ctx.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'বই খুঁজে পাওয়া যায়নি।' },
        },
        { status: 404 }
      );
    }

    const copyId = generateId();
    const year = new Date().getFullYear();
    const accessionNumber = generateAccessionNumber(year);

    await db.execute(
      `INSERT INTO book_copies 
       (id, bibliographic_record_id, accession_number, accession_year, condition, 
        acquisition_type, acquisition_date, acquisition_cost, acquisition_source, shelf_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        copyId,
        bookId,
        accessionNumber,
        year,
        body.condition,
        body.acquisition_type,
        body.acquisition_date,
        body.acquisition_cost || null,
        body.acquisition_source || null,
        body.shelf_id || null,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    await db.execute(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?, ?)',
      [generateId(), auth.userId, 'copy_created', 'BookCopy', copyId]
    );

    const copy = await db.query('SELECT * FROM book_copies WHERE id = ?', [copyId]);

    return ctx.json(
      {
        success: true,
        data: copy,
      } as APIResponse<any>,
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create copy error:', err);
    return ctx.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message || 'অনুরোধ বৈধ নয়।',
        },
      } as APIResponse<null>,
      { status: 400 }
    );
  }
});

export default booksRoutes;
