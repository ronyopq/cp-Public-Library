import { Hono } from 'hono'
import { requireAuth } from '../lib/auth'
import { dbAll, dbValue } from '../lib/db'
import { apiOk } from '../lib/http'
import { getShellSettings } from '../lib/settings'
import type { AppEnv } from '../types'
import { createCatalogRoutes } from './catalog'
import { createMemberRoutes } from './members'

export function createAppRoutes() {
  const app = new Hono<AppEnv>()

  app.use('*', requireAuth())
  app.route('/catalog', createCatalogRoutes())
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
    const totalTitles = Number(
      (await dbValue<number>(
        c.env.DB,
        `SELECT COUNT(*) AS total FROM bibliographic_records WHERE deleted_at IS NULL`,
      )) ?? 0,
    )
    const totalCopies = Number(
      (await dbValue<number>(
        c.env.DB,
        `SELECT COUNT(*) AS total FROM book_copies WHERE deleted_at IS NULL`,
      )) ?? 0,
    )
    const activeMembers = Number(
      (await dbValue<number>(
        c.env.DB,
        `SELECT COUNT(*) AS total FROM members WHERE deleted_at IS NULL AND status = 'active'`,
      )) ?? 0,
    )
    const issuedCopies = Number(
      (await dbValue<number>(
        c.env.DB,
        `SELECT COUNT(*) AS total FROM loans WHERE status IN ('issued', 'overdue')`,
      )) ?? 0,
    )
    const overdueCopies = Number(
      (await dbValue<number>(
        c.env.DB,
        `SELECT COUNT(*) AS total FROM loans WHERE status = 'overdue'`,
      )) ?? 0,
    )
    const todayCollections = Number(
      (await dbValue<number>(
        c.env.DB,
        `
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM payments
          WHERE status = 'completed'
            AND paid_at >= date('now')
        `,
      )) ?? 0,
    )

    const recentActivities = await dbAll<{
      id: string
      actorDisplayName: string
      actorRoleKey: string | null
      actionKey: string
      entityType: string
      entityId: string
      note: string | null
      createdAt: string
    }>(
      c.env.DB,
      `
        SELECT
          id,
          actor_display_name AS actorDisplayName,
          actor_role_key AS actorRoleKey,
          action_key AS actionKey,
          entity_type AS entityType,
          entity_id AS entityId,
          note,
          created_at AS createdAt
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 8
      `,
    )

    const shellSettings = await getShellSettings(c.env.DB, c.env)

    return apiOk(c, {
      stats: {
        totalTitles,
        totalCopies,
        activeMembers,
        issuedCopies,
        overdueCopies,
        todayCollections,
      },
      recentActivities,
      dashboardWidgets: shellSettings.dashboardWidgets,
    })
  })

  return app
}
