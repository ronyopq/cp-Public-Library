import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { analyticsExportSchema, analyticsFilterSchema } from '@shared/index'
import { requireAuth, requirePermission } from '../lib/auth'
import { apiError, apiOk } from '../lib/http'
import { getShellSettings } from '../lib/settings'
import { exportStaffDashboard, getStaffDashboard } from '../services/analytics'
import type { AppEnv } from '../types'
import { createAccountRoutes } from './accounts'
import { createCatalogRoutes } from './catalog'
import { createCompetitionRoutes } from './competitions'
import { createCirculationRoutes } from './circulation'
import { createMemberRoutes } from './members'

export function createAppRoutes() {
  const app = new Hono<AppEnv>()

  app.use('*', requireAuth())
  app.route('/accounts', createAccountRoutes())
  app.route('/catalog', createCatalogRoutes())
  app.route('/competitions', createCompetitionRoutes())
  app.route('/circulation', createCirculationRoutes())
  app.route('/members', createMemberRoutes())

  app.get('/shell', async (c) => {
    const shellSettings = await getShellSettings(c.env.DB, c.env)
    return apiOk(c, {
      user: c.get('sessionUser'),
      featureFlags: c.get('featureFlags'),
      settings: shellSettings,
    })
  })

  app.get('/dashboard', async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে আবার সাইন ইন করুন।')
    }

    const parsed = analyticsFilterSchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    )
    if (!parsed.success) {
      return apiError(
        c,
        400,
        'dashboard_filter_invalid',
        'ড্যাশবোর্ড ফিল্টার সঠিক নয়।',
        parsed.error.flatten(),
      )
    }

    try {
      return apiOk(c, await getStaffDashboard(c.env, actor, parsed.data))
    } catch (error) {
      return apiError(
        c,
        403,
        'dashboard_access_denied',
        error instanceof Error ? error.message : 'ড্যাশবোর্ড দেখা যাচ্ছে না।',
      )
    }
  })

  app.post(
    '/dashboard/export',
    requirePermission('reports.view'),
    zValidator('json', analyticsExportSchema),
    async (c) => {
      const actor = c.get('sessionUser')
      if (!actor) {
        return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে আবার সাইন ইন করুন।')
      }

      try {
        return apiOk(c, {
          export: await exportStaffDashboard(
            c.env,
            actor,
            c.req.valid('json'),
            c.get('requestId'),
          ),
        })
      } catch (error) {
        return apiError(
          c,
          400,
          'dashboard_export_failed',
          error instanceof Error ? error.message : 'ড্যাশবোর্ড রিপোর্ট এক্সপোর্ট ব্যর্থ হয়েছে।',
        )
      }
    },
  )

  return app
}
