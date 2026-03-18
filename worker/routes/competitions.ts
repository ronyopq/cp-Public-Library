import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  competitionManageSchema,
  competitionResultsUpdateSchema,
  publicSiteSettingsSchema,
} from '@shared/index'
import type { AppEnv } from '../types'
import { requirePermission } from '../lib/auth'
import { apiError, apiOk } from '../lib/http'
import {
  createCompetition,
  getCompetitionAdminDashboard,
  getCompetitionAdminDetail,
  replaceCompetitionResults,
  updateCompetition,
  updateCompetitionPublicSettings,
} from '../services/competitions'

export function createCompetitionRoutes() {
  const app = new Hono<AppEnv>()

  app.use('*', requirePermission('competitions.manage'))

  app.get('/dashboard', async (c) => {
    return apiOk(c, await getCompetitionAdminDashboard(c.env.DB))
  })

  app.get('/:competitionId', async (c) => {
    const detail = await getCompetitionAdminDetail(c.env.DB, c.req.param('competitionId'))
    if (!detail) {
      return apiError(c, 404, 'competition_not_found', 'প্রতিযোগিতা পাওয়া যায়নি।')
    }

    return apiOk(c, { detail })
  })

  app.post('/', zValidator('json', competitionManageSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে আবার সাইন ইন করুন।')
    }

    const competition = await createCompetition(
      c.env,
      actor,
      c.req.valid('json'),
      c.get('requestId'),
    )
    return apiOk(c, { competition }, 201)
  })

  app.patch('/:competitionId', zValidator('json', competitionManageSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে আবার সাইন ইন করুন।')
    }

    const competition = await updateCompetition(
      c.env,
      actor,
      c.req.param('competitionId'),
      c.req.valid('json'),
      c.get('requestId'),
    )
    return apiOk(c, { competition })
  })

  app.put(
    '/:competitionId/results',
    zValidator('json', competitionResultsUpdateSchema),
    async (c) => {
      const actor = c.get('sessionUser')
      if (!actor) {
        return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে আবার সাইন ইন করুন।')
      }

      const results = await replaceCompetitionResults(
        c.env,
        actor,
        c.req.param('competitionId'),
        c.req.valid('json'),
        c.get('requestId'),
      )

      return apiOk(c, { results })
    },
  )

  app.put('/public-settings', zValidator('json', publicSiteSettingsSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে আবার সাইন ইন করুন।')
    }

    const settings = await updateCompetitionPublicSettings(
      c.env,
      actor,
      c.req.valid('json'),
      c.get('requestId'),
    )
    return apiOk(c, { settings })
  })

  return app
}
