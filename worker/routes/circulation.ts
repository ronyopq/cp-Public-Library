import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  ROLE_RANK,
  circulationSettingsSchema,
  issueSchema,
  renewSchema,
  reservationSchema,
  reservationStatusSchema,
  returnSchema,
  type SessionUser,
} from '@shared/index'
import type { AppEnv } from '../types'
import { requirePermission } from '../lib/auth'
import { apiError, apiOk, getPaginationQuery } from '../lib/http'
import {
  createReservation,
  getCirculationDashboard,
  getCirculationSettings,
  issueLoan,
  listLoans,
  listReminderLogs,
  listReservations,
  lookupCopyByBarcode,
  renewLoan,
  returnLoan,
  saveCirculationSettings,
  searchCatalogRecords,
  searchMembers,
  updateReservationStatus,
} from '../services/circulation'

function isManagerOrAbove(actor: SessionUser | null) {
  return Boolean(actor && ROLE_RANK[actor.role] >= ROLE_RANK.manager)
}

function routeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected circulation error.'
}

export function createCirculationRoutes() {
  const app = new Hono<AppEnv>()

  app.use('*', requirePermission('circulation.manage'))

  app.get('/dashboard', async (c) => {
    return apiOk(c, await getCirculationDashboard(c.env.DB, c.env))
  })

  app.get('/loans', async (c) => {
    const query = getPaginationQuery(new URL(c.req.url).searchParams)
    const bucket = new URL(c.req.url).searchParams.get('bucket')?.trim() ?? 'active'

    return apiOk(
      c,
      await listLoans(c.env.DB, c.env, {
        search: query.search,
        status: query.status,
        bucket,
        page: query.page,
        pageSize: query.pageSize,
      }),
    )
  })

  app.get('/members/search', async (c) => {
    const query = new URL(c.req.url).searchParams.get('query')?.trim() ?? ''
    return apiOk(c, { items: await searchMembers(c.env.DB, query) })
  })

  app.get('/catalog/search', async (c) => {
    const query = new URL(c.req.url).searchParams.get('query')?.trim() ?? ''
    return apiOk(c, { items: await searchCatalogRecords(c.env.DB, query) })
  })

  app.get('/copies/lookup', async (c) => {
    const barcode = new URL(c.req.url).searchParams.get('barcode')?.trim() ?? ''
    if (!barcode) {
      return apiError(c, 400, 'barcode_required', 'Provide a barcode or accession code.')
    }

    const copy = await lookupCopyByBarcode(c.env.DB, barcode)
    if (!copy) {
      return apiError(c, 404, 'copy_not_found', 'No copy matched this barcode.')
    }

    return apiOk(c, { copy })
  })

  app.get('/reservations', async (c) => {
    return apiOk(c, { items: await listReservations(c.env.DB) })
  })

  app.get('/reminders', async (c) => {
    return apiOk(c, { items: await listReminderLogs(c.env.DB, 50) })
  })

  app.get('/settings', async (c) => {
    return apiOk(c, { settings: await getCirculationSettings(c.env.DB, c.env) })
  })

  app.put('/settings', zValidator('json', circulationSettingsSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!isManagerOrAbove(actor)) {
      return apiError(c, 403, 'insufficient_role', 'Only Manager and above can change circulation settings.')
    }

    await saveCirculationSettings(
      c.env.DB,
      actor!,
      c.req.valid('json') as any,
      c.get('requestId'),
    )

    return apiOk(c, { settings: await getCirculationSettings(c.env.DB, c.env) })
  })

  app.post('/issue', zValidator('json', issueSchema), async (c) => {
    const actor = c.get('sessionUser')
    try {
      return apiOk(
        c,
        await issueLoan(c.env, actor!, c.req.valid('json') as any, c.get('requestId')),
        201,
      )
    } catch (error) {
      return apiError(c, 400, 'issue_failed', routeErrorMessage(error))
    }
  })

  app.post('/return', zValidator('json', returnSchema), async (c) => {
    const actor = c.get('sessionUser')
    try {
      return apiOk(
        c,
        await returnLoan(c.env, actor!, c.req.valid('json') as any, c.get('requestId')),
      )
    } catch (error) {
      return apiError(c, 400, 'return_failed', routeErrorMessage(error))
    }
  })

  app.post('/renew', zValidator('json', renewSchema), async (c) => {
    const actor = c.get('sessionUser')
    try {
      return apiOk(
        c,
        await renewLoan(c.env, actor!, c.req.valid('json') as any, c.get('requestId')),
      )
    } catch (error) {
      return apiError(c, 400, 'renew_failed', routeErrorMessage(error))
    }
  })

  app.post('/reservations', zValidator('json', reservationSchema), async (c) => {
    const actor = c.get('sessionUser')
    try {
      return apiOk(
        c,
        {
          reservation: await createReservation(
            c.env,
            actor!,
            c.req.valid('json') as any,
            c.get('requestId'),
          ),
        },
        201,
      )
    } catch (error) {
      return apiError(c, 400, 'reservation_failed', routeErrorMessage(error))
    }
  })

  app.patch('/reservations/:reservationId', zValidator('json', reservationStatusSchema), async (c) => {
    const actor = c.get('sessionUser')
    try {
      return apiOk(c, {
        reservation: await updateReservationStatus(
          c.env,
          actor!,
          c.req.param('reservationId'),
          c.req.valid('json') as any,
          c.get('requestId'),
        ),
      })
    } catch (error) {
      return apiError(c, 400, 'reservation_update_failed', routeErrorMessage(error))
    }
  })

  return app
}
