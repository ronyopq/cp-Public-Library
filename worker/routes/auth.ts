import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { changePasswordSchema, loginSchema } from '@shared/index'
import type { AppEnv } from '../types'
import { createSession, getUserAuthorization, requireAuth, revokeSession } from '../lib/auth'
import { writeAudit } from '../lib/audit'
import { dbFirst, dbRun } from '../lib/db'
import { apiError, apiOk } from '../lib/http'
import { hashPassword, verifyPassword } from '../lib/password'
import { assertRateLimit } from '../lib/security'
import { getFeatureFlags, getShellSettings } from '../lib/settings'

export function createAuthRoutes() {
  const app = new Hono<AppEnv>()

  app.get('/session', async (c) => {
    const shellSettings = await getShellSettings(c.env.DB, c.env)
    return apiOk(c, {
      user: c.get('sessionUser'),
      featureFlags: c.get('featureFlags'),
      profile: shellSettings.profile,
      metadata: shellSettings.metadata,
    })
  })

  app.post('/login', zValidator('json', loginSchema), async (c) => {
    const rateLimitFailure = await assertRateLimit(c, 'login', 10, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const payload = c.req.valid('json')
    const user = await dbFirst<{
      id: string
      email: string
      passwordHash: string
      status: string
    }>(
      c.env.DB,
      `
        SELECT
          id,
          email,
          password_hash AS passwordHash,
          status
        FROM users
        WHERE email = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [payload.email.toLowerCase()],
    )

    if (!user || user.status !== 'active') {
      return apiError(c, 401, 'invalid_credentials', 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।')
    }

    const validPassword = await verifyPassword(payload.password, user.passwordHash)
    if (!validPassword) {
      return apiError(c, 401, 'invalid_credentials', 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।')
    }

    await createSession(c, user.id)
    await dbRun(c.env.DB, `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      new Date().toISOString(),
      user.id,
    ])

    const sessionUser = await getUserAuthorization(c.env.DB, user.id)
    if (!sessionUser) {
      return apiError(c, 401, 'session_error', 'সেশন তৈরি করা যায়নি।')
    }

    await writeAudit(
      c.env.DB,
      sessionUser,
      'auth.login',
      'user',
      user.id,
      'ইউজার সাইন ইন করেছেন।',
      {
        requestId: c.get('requestId'),
        ipAddress: c.req.header('cf-connecting-ip') ?? null,
        userAgent: c.req.header('user-agent') ?? null,
      },
    )

    const shellSettings = await getShellSettings(c.env.DB, c.env)
    return apiOk(c, {
      user: sessionUser,
      featureFlags: await getFeatureFlags(c.env),
      profile: shellSettings.profile,
      metadata: shellSettings.metadata,
    })
  })

  app.post('/logout', async (c) => {
    const actor = c.get('sessionUser')
    if (actor) {
      await writeAudit(c.env.DB, actor, 'auth.logout', 'user', actor.id, 'ইউজার সাইন আউট করেছেন।', {
        requestId: c.get('requestId'),
      })
    }
    await revokeSession(c)
    return apiOk(c, { success: true })
  })

  app.post(
    '/change-password',
    requireAuth(),
    zValidator('json', changePasswordSchema),
    async (c) => {
      const actor = c.get('sessionUser')
      if (!actor) {
        return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
      }

      const rateLimitFailure = await assertRateLimit(c, 'change-password', 10, 300)
      if (rateLimitFailure) {
        return rateLimitFailure
      }

      const payload = c.req.valid('json')
      const user = await dbFirst<{ passwordHash: string }>(
        c.env.DB,
        `SELECT password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1`,
        [actor.id],
      )

      if (!user) {
        return apiError(c, 404, 'user_not_found', 'ইউজার পাওয়া যায়নি।')
      }

      const validPassword = await verifyPassword(payload.currentPassword, user.passwordHash)
      if (!validPassword) {
        return apiError(c, 400, 'invalid_password', 'বর্তমান পাসওয়ার্ড সঠিক নয়।')
      }

      await dbRun(
        c.env.DB,
        `
          UPDATE users
          SET password_hash = ?, must_change_password = 0, updated_at = ?
          WHERE id = ?
        `,
        [await hashPassword(payload.newPassword), new Date().toISOString(), actor.id],
      )

      await writeAudit(
        c.env.DB,
        actor,
        'auth.change_password',
        'user',
        actor.id,
        'ইউজার নিজের পাসওয়ার্ড পরিবর্তন করেছেন।',
        {
          requestId: c.get('requestId'),
        },
      )

      return apiOk(c, { success: true })
    },
  )

  return app
}
