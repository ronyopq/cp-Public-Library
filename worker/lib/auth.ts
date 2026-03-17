import type { MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { AppRole, PermissionKey, SessionUser } from '@shared/index'
import { ROLE_RANK } from '@shared/index'
import { dhakaNow } from '@shared/utils'
import type { AppEnv } from '../types'
import { dbAll, dbFirst, dbRun } from './db'
import { apiError } from './http'
import { createSessionToken, sha256Hex } from './password'

const sessionCookieName = 'plms_session'
const sessionLifetimeDays = 14

function sessionExpiryIso(): string {
  return new Date(Date.now() + sessionLifetimeDays * 24 * 60 * 60 * 1000).toISOString()
}

function shouldUseSecureCookie(requestUrl: string): boolean {
  const url = new URL(requestUrl)
  return url.protocol === 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1'
}

export function getSessionUser(c: { get: (key: 'sessionUser') => SessionUser | null }) {
  return c.get('sessionUser')
}

export async function createSession(
  c: Parameters<MiddlewareHandler<AppEnv>>[0],
  userId: string,
) {
  const token = createSessionToken()
  const tokenHash = await sha256Hex(token)
  const expiresAt = sessionExpiryIso()
  const requestUserAgent = c.req.header('user-agent') ?? null
  const requestIp =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    null

  await dbRun(
    c.env.DB,
    `
      INSERT INTO sessions (
        id,
        user_id,
        token_hash,
        expires_at,
        ip_address,
        user_agent,
        created_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      requestIp,
      requestUserAgent,
      dhakaNow(),
      dhakaNow(),
    ],
  )

  setCookie(c, sessionCookieName, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(c.req.url),
    sameSite: 'Lax',
    path: '/',
    maxAge: sessionLifetimeDays * 24 * 60 * 60,
  })
}

export async function revokeSession(
  c: Parameters<MiddlewareHandler<AppEnv>>[0],
): Promise<void> {
  const token = getCookie(c, sessionCookieName)
  if (token) {
    const tokenHash = await sha256Hex(token)
    await dbRun(
      c.env.DB,
      `UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`,
      [dhakaNow(), tokenHash],
    )
  }

  deleteCookie(c, sessionCookieName, { path: '/' })
}

async function loadUserAuthorization(
  db: D1Database,
  userId: string,
): Promise<SessionUser | null> {
  const user = await dbFirst<{
    id: string
    email: string
    nameBn: string
    nameEn: string | null
    phone: string | null
    status: string
    mustChangePassword: number
  }>(
    db,
    `
      SELECT
        id,
        email,
        full_name_bn AS nameBn,
        full_name_en AS nameEn,
        phone,
        status,
        must_change_password AS mustChangePassword
      FROM users
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [userId],
  )

  if (!user || user.status !== 'active') {
    return null
  }

  const roles = await dbAll<{
    roleKey: AppRole
    rankOrder: number
    isPrimary: number
  }>(
    db,
    `
      SELECT
        roles.role_key AS roleKey,
        roles.rank_order AS rankOrder,
        user_roles.is_primary AS isPrimary
      FROM user_roles
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = ?
      ORDER BY user_roles.is_primary DESC, roles.rank_order DESC
    `,
    [userId],
  )

  const resolvedRoles = roles.map((row) => row.roleKey)
  const primaryRole = resolvedRoles[0] ?? 'public'

  const permissionRows = await dbAll<{ permissionKey: PermissionKey }>(
    db,
    `
      SELECT DISTINCT permissions.permission_key AS permissionKey
      FROM user_roles
      INNER JOIN role_permissions ON role_permissions.role_id = user_roles.role_id
      INNER JOIN permissions ON permissions.id = role_permissions.permission_id
      WHERE user_roles.user_id = ?
    `,
    [userId],
  )

  const overrides = await dbAll<{
    permissionKey: PermissionKey
    effect: 'allow' | 'deny'
  }>(
    db,
    `
      SELECT
        permissions.permission_key AS permissionKey,
        user_permission_overrides.effect AS effect
      FROM user_permission_overrides
      INNER JOIN permissions ON permissions.id = user_permission_overrides.permission_id
      WHERE user_permission_overrides.user_id = ?
    `,
    [userId],
  )

  const permissionSet = new Set(permissionRows.map((row) => row.permissionKey))
  for (const override of overrides) {
    if (override.effect === 'allow') {
      permissionSet.add(override.permissionKey)
    } else {
      permissionSet.delete(override.permissionKey)
    }
  }

  return {
    id: user.id,
    email: user.email,
    nameBn: user.nameBn,
    nameEn: user.nameEn,
    phone: user.phone,
    status: user.status,
    role: primaryRole,
    roles: resolvedRoles.length > 0 ? resolvedRoles : [primaryRole],
    permissions: [...permissionSet].sort(),
    mustChangePassword: user.mustChangePassword === 1,
  }
}

export async function getUserAuthorization(
  db: D1Database,
  userId: string,
): Promise<SessionUser | null> {
  return loadUserAuthorization(db, userId)
}

export function hasPermission(
  user: SessionUser | null,
  permissionKey: PermissionKey,
): boolean {
  return Boolean(user && user.permissions.includes(permissionKey))
}

export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, sessionCookieName)
  c.set('sessionUser', null)
  c.set('sessionId', null)
  c.set('requestId', crypto.randomUUID())

  if (!token) {
    await next()
    return
  }

  const tokenHash = await sha256Hex(token)
  const session = await dbFirst<{
    sessionId: string
    userId: string
  }>(
    c.env.DB,
    `
      SELECT id AS sessionId, user_id AS userId
      FROM sessions
      WHERE token_hash = ?
        AND expires_at > ?
        AND revoked_at IS NULL
      LIMIT 1
    `,
    [tokenHash, new Date().toISOString()],
  )

  if (session) {
    const sessionUser = await loadUserAuthorization(c.env.DB, session.userId)
    if (sessionUser) {
      c.set('sessionUser', sessionUser)
      c.set('sessionId', session.sessionId)

      await dbRun(
        c.env.DB,
        `UPDATE sessions SET last_seen_at = ? WHERE id = ?`,
        [dhakaNow(), session.sessionId],
      )
    }
  }

  await next()
}

export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get('sessionUser')) {
      c.res = apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
      return
    }

    await next()
  }
}

export function requireRole(minimumRole: AppRole): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('sessionUser')
    if (!user) {
      c.res = apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
      return
    }

    if (ROLE_RANK[user.role] < ROLE_RANK[minimumRole]) {
      c.res = apiError(c, 403, 'insufficient_role', 'আপনার এই কাজের অনুমতি নেই।')
      return
    }

    await next()
  }
}

export function requirePermission(
  permissionKey: PermissionKey,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('sessionUser')
    if (!user) {
      c.res = apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
      return
    }

    if (!hasPermission(user, permissionKey)) {
      c.res = apiError(
        c,
        403,
        'insufficient_permission',
        'আপনার এই কাজের অনুমতি নেই।',
      )
      return
    }

    await next()
  }
}
