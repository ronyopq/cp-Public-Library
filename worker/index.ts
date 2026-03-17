import { Hono } from 'hono'
import { loadSession } from './lib/auth'
import { dbAll, dbRun } from './lib/db'
import { apiError, apiOk } from './lib/http'
import { getFeatureFlags } from './lib/settings'
import { originGuard, securityHeaders } from './lib/security'
import { serveFile } from './lib/storage'
import { createAppRoutes } from './routes/app'
import { createAdminRoutes } from './routes/admin'
import { createAuthRoutes } from './routes/auth'
import { createPublicRoutes } from './routes/public'
import type { AppEnv, AppBindings, TaskMessage } from './types'
import { AccessionCounter } from './durable-objects/accession-counter'

const app = new Hono<AppEnv>()

app.use('*', securityHeaders())
app.use('*', originGuard())
app.use('*', loadSession)
app.use('*', async (c, next) => {
  c.set('featureFlags', await getFeatureFlags(c.env))
  await next()
})

app.route('/api/public', createPublicRoutes())
app.route('/api/auth', createAuthRoutes())
app.route('/api/app', createAppRoutes())
app.route('/api/admin', createAdminRoutes())

app.get('/api/foundation', (c) =>
  apiOk(c, {
    ready: true,
    phase: 'architecture-and-foundation',
    timezone: c.env.APP_TIMEZONE,
    bindings: ['DB', 'APP_CACHE', 'MEDIA_BUCKET', 'TASK_QUEUE', 'ACCESSION_COUNTER'],
  }),
)

app.get('/files/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/files\//, ''))

  if (key.startsWith('members/')) {
    const user = c.get('sessionUser')
    if (!user) {
      return apiError(c, 401, 'unauthorized', 'Member photos require authentication.')
    }

    if (!user.permissions.includes('members.manage')) {
      const ownMember = await dbAll<{ id: string }>(
        c.env.DB,
        `
          SELECT id
          FROM members
          WHERE user_id = ?
            AND photo_r2_key = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [user.id, key],
      )

      if (
        !user.permissions.includes('members.self_service') ||
        ownMember.length === 0
      ) {
        return apiError(c, 403, 'insufficient_permission', 'You cannot view this member photo.')
      }
    }
  }

  if (key.startsWith('exports/')) {
    const user = c.get('sessionUser')
    if (
      !user ||
      (!user.permissions.includes('prints.manage') &&
        !user.permissions.includes('exports.manage'))
    ) {
      return apiError(c, 403, 'insufficient_permission', 'You cannot view this print/export file.')
    }
  }

  return serveFile(c.env.MEDIA_BUCKET, key)
})

app.notFound(async (c) => {
  if (c.req.path.startsWith('/api') || c.req.path.startsWith('/files')) {
    return apiError(c, 404, 'not_found', 'Resource not found.')
  }

  return c.env.ASSETS.fetch(c.req.raw)
})

app.onError((error, c) => {
  console.error(error)
  return apiError(c, 500, 'internal_error', 'Unexpected server error.', {
    message: error.message,
  })
})

async function runScheduledReminderSweep(env: AppBindings) {
  const overdueLoans = await dbAll<{
    loanId: string
    memberId: string
    dueAt: string
  }>(
    env.DB,
    `
      SELECT
        id AS loanId,
        member_id AS memberId,
        due_at AS dueAt
      FROM loans
      WHERE status IN ('issued', 'overdue')
        AND due_at < ?
      LIMIT 200
    `,
    [new Date().toISOString()],
  )

  for (const loan of overdueLoans) {
    await env.TASK_QUEUE.send({
      type: 'overdue-reminder',
      loanId: loan.loanId,
      memberId: loan.memberId,
      dueAt: loan.dueAt,
    })
  }
}

async function handleTaskMessage(env: AppBindings, message: TaskMessage) {
  if (message.type !== 'overdue-reminder') {
    return
  }

  const scheduleDate = new Date().toISOString().slice(0, 10)
  const dedupeKey = `${message.loanId}:${scheduleDate}:overdue`

  await dbRun(
    env.DB,
    `
      INSERT OR IGNORE INTO reminders (
        id,
        loan_id,
        member_id,
        reminder_type,
        channel,
        scheduled_for,
        sent_at,
        status,
        dedupe_key,
        content_snapshot,
        created_at
      )
      VALUES (?, ?, ?, 'overdue', 'system', ?, ?, 'sent', ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      message.loanId,
      message.memberId,
      new Date().toISOString(),
      new Date().toISOString(),
      dedupeKey,
      `Overdue reminder generated for loan ${message.loanId}`,
      new Date().toISOString(),
    ],
  )

  await dbRun(
    env.DB,
    `
      INSERT INTO loan_history (
        id,
        loan_id,
        event_type,
        previous_status,
        next_status,
        event_at,
        actor_user_id,
        note,
        metadata_json
      )
      VALUES (?, ?, 'reminder_generated', 'overdue', 'overdue', ?, NULL, ?, ?)
    `,
    [
      crypto.randomUUID(),
      message.loanId,
      new Date().toISOString(),
      'System reminder created',
      JSON.stringify({ dueAt: message.dueAt }),
    ],
  )
}

const worker: ExportedHandler<AppBindings, TaskMessage> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/files')) {
      return env.ASSETS.fetch(request)
    }

    return app.fetch(request, env, ctx as any)
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduledReminderSweep(env))
  },
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      ctx.waitUntil(handleTaskMessage(env, message.body))
      message.ack()
    }
  },
}

export { AccessionCounter }
export default worker
