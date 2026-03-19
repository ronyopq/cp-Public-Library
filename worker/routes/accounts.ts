import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  ROLE_RANK,
  accountingCollectionSchema,
  accountingExportSchema,
  accountingReportFilterSchema,
  feeTypeDefinitionSchema,
  paymentVoidSchema,
  type SessionUser,
} from '@shared/index'
import type { AppEnv } from '../types'
import { requirePermission } from '../lib/auth'
import { apiError, apiOk } from '../lib/http'
import { assertRateLimit } from '../lib/security'
import {
  archiveFeeType,
  collectAccountingPayment,
  createFeeType,
  exportAccountingReport,
  getAccountingDashboard,
  getAccountingReport,
  getMemberLedger,
  listArchivedFeeTypes,
  reprintReceipt,
  restoreFeeType,
  searchMembersForAccounts,
  updateFeeType,
  voidAccountingPayment,
} from '../services/accounts'

function isManagerOrAbove(actor: SessionUser | null) {
  return Boolean(actor && ROLE_RANK[actor.role] >= ROLE_RANK.manager)
}

function isAdminOrAbove(actor: SessionUser | null) {
  return Boolean(actor && ROLE_RANK[actor.role] >= ROLE_RANK.admin)
}

function routeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'অপ্রত্যাশিত হিসাব ত্রুটি হয়েছে।'
}

export function createAccountRoutes() {
  const app = new Hono<AppEnv>()

  app.use('*', requirePermission('accounts.view'))

  app.get('/dashboard', async (c) => {
    return apiOk(c, await getAccountingDashboard(c.env.DB))
  })

  app.get('/members/search', async (c) => {
    const query = new URL(c.req.url).searchParams.get('query')?.trim() ?? ''
    return apiOk(c, { items: await searchMembersForAccounts(c.env.DB, query) })
  })

  app.get('/members/:memberId/ledger', async (c) => {
    const actor = c.get('sessionUser')
    const ledger = await getMemberLedger(
      c.env.DB,
      actor,
      c.req.param('memberId'),
      c.get('requestId'),
    )
    if (!ledger) {
      return apiError(c, 404, 'member_not_found', 'সদস্যের হিসাব পাওয়া যায়নি।')
    }

    return apiOk(c, { ledger })
  })

  app.get('/fee-types', async (c) => {
    return apiOk(c, (await getAccountingDashboard(c.env.DB)).feeTypes)
  })

  app.get('/fee-types/archived', async (c) => {
    const actor = c.get('sessionUser')
    if (!isAdminOrAbove(actor)) {
      return apiError(c, 403, 'insufficient_role', 'আর্কাইভ ফি টাইপ দেখতে Admin বা Super Admin প্রয়োজন।')
    }

    return apiOk(c, { items: await listArchivedFeeTypes(c.env.DB) })
  })

  app.post('/fee-types', zValidator('json', feeTypeDefinitionSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!isAdminOrAbove(actor)) {
      return apiError(c, 403, 'insufficient_role', 'ফি টাইপ তৈরি করতে Admin বা Super Admin প্রয়োজন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'account-fee-type-create', 20, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    try {
      return apiOk(
        c,
        {
          feeType: await createFeeType(
            c.env.DB,
            actor!,
            c.req.valid('json') as any,
            c.get('requestId'),
          ),
        },
        201,
      )
    } catch (error) {
      return apiError(c, 400, 'fee_type_create_failed', routeErrorMessage(error))
    }
  })

  app.patch('/fee-types/:feeTypeId', zValidator('json', feeTypeDefinitionSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!isAdminOrAbove(actor)) {
      return apiError(c, 403, 'insufficient_role', 'ফি টাইপ আপডেট করতে Admin বা Super Admin প্রয়োজন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'account-fee-type-update', 40, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    try {
      return apiOk(c, {
        feeType: await updateFeeType(
          c.env.DB,
          actor!,
          c.req.param('feeTypeId'),
          c.req.valid('json') as any,
          c.get('requestId'),
        ),
      })
    } catch (error) {
      return apiError(c, 400, 'fee_type_update_failed', routeErrorMessage(error))
    }
  })

  app.delete('/fee-types/:feeTypeId', async (c) => {
    const actor = c.get('sessionUser')
    if (!isAdminOrAbove(actor)) {
      return apiError(c, 403, 'insufficient_role', 'ফি টাইপ আর্কাইভ করতে Admin বা Super Admin প্রয়োজন।')
    }

    try {
      await archiveFeeType(c.env.DB, actor!, c.req.param('feeTypeId'), c.get('requestId'))
      return apiOk(c, { success: true })
    } catch (error) {
      return apiError(c, 400, 'fee_type_archive_failed', routeErrorMessage(error))
    }
  })

  app.post('/fee-types/:feeTypeId/restore', async (c) => {
    const actor = c.get('sessionUser')
    if (!isAdminOrAbove(actor)) {
      return apiError(c, 403, 'insufficient_role', 'ফি টাইপ পুনরুদ্ধার করতে Admin বা Super Admin প্রয়োজন।')
    }

    try {
      return apiOk(c, {
        feeType: await restoreFeeType(
          c.env.DB,
          actor!,
          c.req.param('feeTypeId'),
          c.get('requestId'),
        ),
      })
    } catch (error) {
      return apiError(c, 400, 'fee_type_restore_failed', routeErrorMessage(error))
    }
  })

  app.post('/collect', requirePermission('accounts.manage'), zValidator('json', accountingCollectionSchema), async (c) => {
    const actor = c.get('sessionUser')
    const rateLimitFailure = await assertRateLimit(c, 'account-collect', 60, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    try {
      return apiOk(
        c,
        await collectAccountingPayment(
          c.env,
          actor!,
          c.req.valid('json') as any,
          c.get('requestId'),
        ),
        201,
      )
    } catch (error) {
      return apiError(c, 400, 'payment_collect_failed', routeErrorMessage(error))
    }
  })

  app.post('/receipts/:receiptId/reprint', async (c) => {
    const actor = c.get('sessionUser')
    try {
      return apiOk(c, {
        receipt: await reprintReceipt(
          c.env,
          actor!,
          c.req.param('receiptId'),
          c.get('requestId'),
        ),
      })
    } catch (error) {
      return apiError(c, 400, 'receipt_reprint_failed', routeErrorMessage(error))
    }
  })

  app.get('/reports', requirePermission('reports.view'), async (c) => {
    const searchParams = new URL(c.req.url).searchParams
    const parsed = accountingReportFilterSchema.safeParse({
      preset: searchParams.get('preset') ?? 'monthly',
      startDate: searchParams.get('startDate') ?? '',
      endDate: searchParams.get('endDate') ?? '',
      feeTypeId: searchParams.get('feeTypeId') ?? '',
      paymentMethodCode: searchParams.get('paymentMethodCode') ?? '',
      memberId: searchParams.get('memberId') ?? '',
    })
    if (!parsed.success) {
      return apiError(c, 400, 'report_filter_invalid', 'রিপোর্ট ফিল্টার সঠিক নয়।', parsed.error.flatten())
    }

    return apiOk(c, { report: await getAccountingReport(c.env.DB, parsed.data as any) })
  })

  app.post('/reports/export', requirePermission('reports.view'), zValidator('json', accountingExportSchema), async (c) => {
    const actor = c.get('sessionUser')
    const rateLimitFailure = await assertRateLimit(c, 'account-report-export', 25, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    try {
      const payload = c.req.valid('json') as any
      return apiOk(c, {
        export: await exportAccountingReport(
          c.env,
          actor!,
          payload,
          payload.format,
          c.get('requestId'),
        ),
      })
    } catch (error) {
      return apiError(c, 400, 'report_export_failed', routeErrorMessage(error))
    }
  })

  app.post('/reports/preview', requirePermission('reports.view'), zValidator('json', accountingReportFilterSchema), async (c) => {
    const actor = c.get('sessionUser')
    const rateLimitFailure = await assertRateLimit(c, 'account-report-preview', 40, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    try {
      return apiOk(c, {
        preview: await exportAccountingReport(
          c.env,
          actor!,
          c.req.valid('json') as any,
          'html',
          c.get('requestId'),
        ),
      })
    } catch (error) {
      return apiError(c, 400, 'report_preview_failed', routeErrorMessage(error))
    }
  })

  app.post('/payments/:paymentId/void', requirePermission('accounts.manage'), zValidator('json', paymentVoidSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!isManagerOrAbove(actor)) {
      return apiError(c, 403, 'insufficient_role', 'পেমেন্ট বাতিল করতে Manager বা তার উপরের ভূমিকা প্রয়োজন।')
    }

    try {
      await voidAccountingPayment(
        c.env,
        actor!,
        c.req.param('paymentId'),
        c.req.valid('json').reason,
        c.get('requestId'),
      )
      return apiOk(c, { success: true })
    } catch (error) {
      return apiError(c, 400, 'payment_void_failed', routeErrorMessage(error))
    }
  })

  return app
}
