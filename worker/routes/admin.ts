import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  adminResetPasswordSchema,
  auditLogFilterSchema,
  backupRequestSchema,
  featureFlagSchema,
  importModeSchema,
  shellSettingsSchema,
  type ManagedUser,
  type PermissionOverrideRecord,
  type RoleRecord,
  userCreateSchema,
  userEditSchema,
} from '@shared/index'
import { dhakaNow } from '@shared/utils'
import type { AppEnv } from '../types'
import { getUserAuthorization, requirePermission } from '../lib/auth'
import { writeAudit } from '../lib/audit'
import { dbAll, dbFirst, dbRun } from '../lib/db'
import { apiError, apiOk, getPaginationQuery } from '../lib/http'
import { hashPassword } from '../lib/password'
import { assertRateLimit, validateFileUpload } from '../lib/security'
import {
  getFeatureFlags,
  getShellSettings,
  saveFeatureFlags,
  saveShellSettings,
} from '../lib/settings'
import { buildR2Key, fileErrorResponse, putFile } from '../lib/storage'
import {
  importCatalogFromCsv,
  importMembersFromCsv,
  listRecentExports,
  requestSystemBackupExport,
} from '../services/maintenance'

async function getRoles(db: D1Database): Promise<RoleRecord[]> {
  return dbAll<RoleRecord>(
    db,
    `
      SELECT
        id,
        role_key AS roleKey,
        name_bn AS nameBn,
        name_en AS nameEn,
        rank_order AS rankOrder
      FROM roles
      ORDER BY rank_order DESC
    `,
  )
}

async function getPermissions(db: D1Database) {
  return dbAll<{ id: string; permissionKey: string; moduleName: string }>(
    db,
    `
      SELECT
        id,
        permission_key AS permissionKey,
        module_name AS moduleName
      FROM permissions
      ORDER BY module_name, permission_key
    `,
  )
}

async function getPermissionIdMap(db: D1Database) {
  const permissions = await getPermissions(db)
  return new Map(permissions.map((permission) => [permission.permissionKey, permission.id]))
}

async function getRoleIdMap(db: D1Database) {
  const roles = await getRoles(db)
  return new Map(roles.map((role) => [role.roleKey, role.id]))
}

async function getUserPermissionOverrides(
  db: D1Database,
  userId: string,
): Promise<PermissionOverrideRecord[]> {
  return dbAll<PermissionOverrideRecord>(
    db,
    `
      SELECT
        permissions.permission_key AS permissionKey,
        user_permission_overrides.effect AS effect
      FROM user_permission_overrides
      INNER JOIN permissions ON permissions.id = user_permission_overrides.permission_id
      WHERE user_permission_overrides.user_id = ?
      ORDER BY permissions.permission_key
    `,
    [userId],
  )
}

async function listManagedUsers(
  db: D1Database,
  search: string,
  page: number,
  pageSize: number,
) {
  const likeSearch = `%${search}%`
  const users = await dbAll<{
    id: string
    email: string
    fullNameBn: string
    fullNameEn: string | null
    phone: string | null
    status: ManagedUser['status']
    mustChangePassword: number
    lastLoginAt: string | null
    createdAt: string
  }>(
    db,
    `
      SELECT
        id,
        email,
        full_name_bn AS fullNameBn,
        full_name_en AS fullNameEn,
        phone,
        status,
        must_change_password AS mustChangePassword,
        last_login_at AS lastLoginAt,
        created_at AS createdAt
      FROM users
      WHERE deleted_at IS NULL
        AND (
          ? = '%%'
          OR lower(email) LIKE lower(?)
          OR full_name_bn LIKE ?
          OR COALESCE(full_name_en, '') LIKE ?
          OR COALESCE(phone, '') LIKE ?
        )
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    [
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      pageSize,
      (page - 1) * pageSize,
    ],
  )

  const totalRow = await dbFirst<{ total: number }>(
    db,
    `
      SELECT COUNT(*) AS total
      FROM users
      WHERE deleted_at IS NULL
        AND (
          ? = '%%'
          OR lower(email) LIKE lower(?)
          OR full_name_bn LIKE ?
          OR COALESCE(full_name_en, '') LIKE ?
          OR COALESCE(phone, '') LIKE ?
        )
    `,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  )

  const items: ManagedUser[] = []
  for (const user of users) {
    const authorization = await getUserAuthorization(db, user.id)
    items.push({
      id: user.id,
      email: user.email,
      fullNameBn: user.fullNameBn,
      fullNameEn: user.fullNameEn,
      phone: user.phone,
      status: user.status,
      primaryRole: authorization?.role ?? 'public',
      roles: authorization?.roles ?? ['public'],
      mustChangePassword: user.mustChangePassword === 1,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      permissionOverrides: await getUserPermissionOverrides(db, user.id),
    })
  }

  return {
    items,
    total: Number(totalRow?.total ?? 0),
  }
}

async function replaceUserRoles(
  db: D1Database,
  userId: string,
  roles: ManagedUser['roles'],
  actorId: string,
) {
  const roleIdMap = await getRoleIdMap(db)
  await dbRun(db, `DELETE FROM user_roles WHERE user_id = ?`, [userId])

  for (const [index, roleKey] of roles.entries()) {
    const roleId = roleIdMap.get(roleKey)
    if (!roleId) {
      continue
    }

    await dbRun(
      db,
      `
        INSERT INTO user_roles (
          user_id,
          role_id,
          is_primary,
          assigned_at,
          assigned_by_user_id
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [userId, roleId, index === 0 ? 1 : 0, dhakaNow(), actorId],
    )
  }
}

async function replacePermissionOverrides(
  db: D1Database,
  userId: string,
  overrides: PermissionOverrideRecord[],
  actorId: string,
) {
  const permissionIdMap = await getPermissionIdMap(db)
  await dbRun(db, `DELETE FROM user_permission_overrides WHERE user_id = ?`, [userId])

  for (const override of overrides) {
    const permissionId = permissionIdMap.get(override.permissionKey)
    if (!permissionId) {
      continue
    }

    await dbRun(
      db,
      `
        INSERT INTO user_permission_overrides (
          user_id,
          permission_id,
          effect,
          updated_by_user_id,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [userId, permissionId, override.effect, actorId, dhakaNow()],
    )
  }
}

async function countActiveSuperAdmins(db: D1Database): Promise<number> {
  const row = await dbFirst<{ total: number }>(
    db,
    `
      SELECT COUNT(DISTINCT users.id) AS total
      FROM users
      INNER JOIN user_roles ON user_roles.user_id = users.id
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE users.deleted_at IS NULL
        AND users.status = 'active'
        AND roles.role_key = 'super_admin'
    `,
  )
  return Number(row?.total ?? 0)
}

function safeJsonObject(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

function dateStartIso(value: string) {
  return new Date(`${value}T00:00:00+06:00`).toISOString()
}

function dateEndIso(value: string) {
  return new Date(`${value}T23:59:59.999+06:00`).toISOString()
}

export function createAdminRoutes() {
  const app = new Hono<AppEnv>()

  app.get('/roles', requirePermission('users.manage'), async (c) => {
    return apiOk(c, {
      roles: await getRoles(c.env.DB),
      permissions: await getPermissions(c.env.DB),
    })
  })

  app.get('/users', requirePermission('users.manage'), async (c) => {
    const query = getPaginationQuery(new URL(c.req.url).searchParams)
    const result = await listManagedUsers(c.env.DB, query.search, query.page, query.pageSize)

    return apiOk(c, {
      items: result.items,
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    })
  })

  app.post('/users', requirePermission('users.manage'), zValidator('json', userCreateSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'admin-user-create', 20, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const payload = c.req.valid('json')
    const existing = await dbFirst<{ id: string }>(
      c.env.DB,
      `SELECT id FROM users WHERE email = ? LIMIT 1`,
      [payload.email.toLowerCase()],
    )
    if (existing) {
      return apiError(c, 409, 'email_in_use', 'এই ইমেইল ঠিকানাটি ইতোমধ্যে ব্যবহৃত হয়েছে।')
    }

    const userId = crypto.randomUUID()
    const now = dhakaNow()
    await dbRun(
      c.env.DB,
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          full_name_bn,
          full_name_en,
          phone,
          status,
          must_change_password,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        payload.email.toLowerCase(),
        await hashPassword(payload.password),
        payload.fullNameBn,
        payload.fullNameEn || null,
        payload.phone || null,
        payload.status,
        payload.mustChangePassword ? 1 : 0,
        now,
        now,
      ],
    )

    await replaceUserRoles(c.env.DB, userId, payload.roles, actor.id)
    await replacePermissionOverrides(
      c.env.DB,
      userId,
      payload.permissionOverrides,
      actor.id,
    )

    const createdUser = await getUserAuthorization(c.env.DB, userId)
    await writeAudit(
      c.env.DB,
      actor,
      'users.create',
      'user',
      userId,
      'নতুন ইউজার তৈরি করা হয়েছে।',
      {
        requestId: c.get('requestId'),
        after: {
          email: payload.email.toLowerCase(),
          roles: payload.roles,
          status: payload.status,
        },
      },
    )

    return apiOk(c, { user: createdUser }, 201)
  })

  app.patch('/users/:userId', requirePermission('users.manage'), zValidator('json', userEditSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'admin-user-update', 40, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const userId = c.req.param('userId')
    const payload = c.req.valid('json')
    const before = await getUserAuthorization(c.env.DB, userId)
    if (!before) {
      return apiError(c, 404, 'user_not_found', 'ইউজার পাওয়া যায়নি।')
    }

    if (userId === actor.id && payload.status !== 'active') {
      return apiError(c, 400, 'self_deactivate_blocked', 'নিজের একাউন্ট নিষ্ক্রিয় করা যাবে না।')
    }

    if ((before.roles.includes('super_admin') && !payload.roles.includes('super_admin')) || payload.status !== 'active') {
      const superAdminCount = await countActiveSuperAdmins(c.env.DB)
      if (before.roles.includes('super_admin') && superAdminCount <= 1) {
        return apiError(
          c,
          400,
          'last_super_admin_blocked',
          'সর্বশেষ সক্রিয় Super Admin-কে অপসারণ বা নিষ্ক্রিয় করা যাবে না।',
        )
      }
    }

    await dbRun(
      c.env.DB,
      `
        UPDATE users
        SET
          full_name_bn = ?,
          full_name_en = ?,
          phone = ?,
          status = ?,
          must_change_password = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        payload.fullNameBn,
        payload.fullNameEn || null,
        payload.phone || null,
        payload.status,
        payload.mustChangePassword ? 1 : 0,
        dhakaNow(),
        userId,
      ],
    )

    await replaceUserRoles(c.env.DB, userId, payload.roles, actor.id)
    await replacePermissionOverrides(
      c.env.DB,
      userId,
      payload.permissionOverrides,
      actor.id,
    )

    const after = await getUserAuthorization(c.env.DB, userId)
    await writeAudit(
      c.env.DB,
      actor,
      'users.update',
      'user',
      userId,
      'ইউজার তথ্য হালনাগাদ করা হয়েছে।',
      {
        requestId: c.get('requestId'),
        before,
        after,
      },
    )

    return apiOk(c, { user: after })
  })

  app.post(
    '/users/:userId/reset-password',
    requirePermission('users.manage'),
    zValidator('json', adminResetPasswordSchema),
    async (c) => {
      const actor = c.get('sessionUser')
      if (!actor) {
        return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
      }

      const rateLimitFailure = await assertRateLimit(c, 'admin-password-reset', 20, 300)
      if (rateLimitFailure) {
        return rateLimitFailure
      }

      const userId = c.req.param('userId')
      const payload = c.req.valid('json')
      const user = await dbFirst<{ id: string }>(
        c.env.DB,
        `SELECT id FROM users WHERE id = ? LIMIT 1`,
        [userId],
      )
      if (!user) {
        return apiError(c, 404, 'user_not_found', 'ইউজার পাওয়া যায়নি।')
      }

      await dbRun(
        c.env.DB,
        `
          UPDATE users
          SET password_hash = ?, must_change_password = ?, updated_at = ?
          WHERE id = ?
        `,
        [
          await hashPassword(payload.newPassword),
          payload.requireChangeAtNextLogin ? 1 : 0,
          dhakaNow(),
          userId,
        ],
      )

      await writeAudit(
        c.env.DB,
        actor,
        'users.reset_password',
        'user',
        userId,
        'ইউজারের পাসওয়ার্ড রিসেট করা হয়েছে।',
        {
          requestId: c.get('requestId'),
          after: {
            requireChangeAtNextLogin: payload.requireChangeAtNextLogin,
          },
        },
      )

      return apiOk(c, { success: true })
    },
  )

  app.get('/settings', requirePermission('settings.manage'), async (c) => {
    return apiOk(c, {
      settings: await getShellSettings(c.env.DB, c.env),
      featureFlags: await getFeatureFlags(c.env),
    })
  })

  app.put('/settings/shell', requirePermission('settings.manage'), zValidator('json', shellSettingsSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'admin-settings-shell', 20, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const before = await getShellSettings(c.env.DB, c.env)
    const payload = c.req.valid('json')
    await saveShellSettings(c.env.DB, actor.id, payload)

    await writeAudit(
      c.env.DB,
      actor,
      'settings.update_shell',
      'app_settings',
      'shell',
      'সাইট সেটিংস হালনাগাদ করা হয়েছে।',
      {
        requestId: c.get('requestId'),
        before,
        after: payload,
      },
    )

    return apiOk(c, { settings: await getShellSettings(c.env.DB, c.env) })
  })

  app.put('/settings/flags', requirePermission('feature_flags.manage'), zValidator('json', featureFlagSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'admin-settings-flags', 20, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const before = await getFeatureFlags(c.env)
    const payload = c.req.valid('json')
    await saveFeatureFlags(c.env, payload, actor.id)

    await writeAudit(
      c.env.DB,
      actor,
      'settings.update_flags',
      'feature_flags',
      'all',
      'পাবলিক ও অ্যাপ ফিচার টগল হালনাগাদ করা হয়েছে।',
      {
        requestId: c.get('requestId'),
        before,
        after: payload,
      },
    )

    return apiOk(c, { featureFlags: await getFeatureFlags(c.env) })
  })

  app.post('/settings/assets', requirePermission('settings.manage'), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'settings-assets', 20, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const formData = await c.req.formData()
    const uploaded: Record<string, string> = {}

    for (const fieldName of ['logo', 'favicon'] as const) {
      const value = formData.get(fieldName)
      if (!(value instanceof File) || value.size === 0) {
        continue
      }

      const validationError = validateFileUpload(
        value,
        ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon'],
        fieldName === 'favicon' ? 512 * 1024 : 4 * 1024 * 1024,
        {
          allowedExtensions:
            fieldName === 'favicon'
              ? ['png', 'svg', 'ico']
              : ['png', 'jpg', 'jpeg', 'svg'],
        },
      )
      if (validationError) {
        return fileErrorResponse(c, validationError)
      }

      const key = buildR2Key('branding', value.name)
      await putFile(c.env.MEDIA_BUCKET, key, value, {
        fieldName,
        uploadedBy: actor.id,
      })
      uploaded[fieldName] = key
    }

    return apiOk(c, uploaded)
  })

  app.get('/exports', requirePermission('exports.manage'), async (c) => {
    return apiOk(c, await listRecentExports(c.env.DB))
  })

  app.post('/backups', requirePermission('exports.manage'), zValidator('json', backupRequestSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'admin-backups', 10, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    try {
      return apiOk(
        c,
        await requestSystemBackupExport(
          c.env,
          actor,
          c.req.valid('json'),
          c.get('requestId'),
        ),
        202,
      )
    } catch (error) {
      return apiError(c, 400, 'backup_request_failed', error instanceof Error ? error.message : 'Backup request failed.')
    }
  })

  app.post('/imports/members', requirePermission('members.manage'), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'admin-import-members', 12, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return apiError(c, 400, 'file_missing', 'CSV ফাইল নির্বাচন করুন।')
    }

    const mode = importModeSchema.parse(String(formData.get('mode') ?? 'create_only'))
    const validationError = validateFileUpload(
      file,
      ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
      4 * 1024 * 1024,
      { allowedExtensions: ['csv'], allowEmptyMime: true },
    )
    if (validationError) {
      return fileErrorResponse(c, validationError)
    }

    try {
      return apiOk(c, {
        summary: await importMembersFromCsv(c.env, actor, await file.text(), mode, c.get('requestId')),
      })
    } catch (error) {
      return apiError(c, 400, 'member_import_failed', error instanceof Error ? error.message : 'Member import failed.')
    }
  })

  app.post('/imports/catalog', requirePermission('catalog.manage_metadata'), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'admin-import-catalog', 12, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return apiError(c, 400, 'file_missing', 'CSV ফাইল নির্বাচন করুন।')
    }

    const mode = importModeSchema.parse(String(formData.get('mode') ?? 'create_only'))
    const validationError = validateFileUpload(
      file,
      ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
      5 * 1024 * 1024,
      { allowedExtensions: ['csv'], allowEmptyMime: true },
    )
    if (validationError) {
      return fileErrorResponse(c, validationError)
    }

    try {
      return apiOk(c, {
        summary: await importCatalogFromCsv(c.env, actor, await file.text(), mode, c.get('requestId')),
      })
    } catch (error) {
      return apiError(c, 400, 'catalog_import_failed', error instanceof Error ? error.message : 'Catalog import failed.')
    }
  })

  app.get('/audit-logs', requirePermission('audit.view'), async (c) => {
    const parsed = auditLogFilterSchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    )
    if (!parsed.success) {
      return apiError(c, 400, 'audit_filter_invalid', 'Audit filter is invalid.', parsed.error.flatten())
    }

    const filters = parsed.data
    const where: string[] = []
    const bindings: unknown[] = []

    if (filters.search) {
      const likeSearch = `%${filters.search}%`
      where.push(`(
        actor_display_name LIKE ?
        OR action_key LIKE ?
        OR entity_type LIKE ?
        OR entity_id LIKE ?
        OR COALESCE(note, '') LIKE ?
      )`)
      bindings.push(likeSearch, likeSearch, likeSearch, likeSearch, likeSearch)
    }
    if (filters.actionKey) {
      where.push(`action_key = ?`)
      bindings.push(filters.actionKey)
    }
    if (filters.entityType) {
      where.push(`entity_type = ?`)
      bindings.push(filters.entityType)
    }
    if (filters.actorRoleKey) {
      where.push(`actor_role_key = ?`)
      bindings.push(filters.actorRoleKey)
    }
    if (filters.startDate) {
      where.push(`created_at >= ?`)
      bindings.push(dateStartIso(filters.startDate))
    }
    if (filters.endDate) {
      where.push(`created_at <= ?`)
      bindings.push(dateEndIso(filters.endDate))
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await dbAll<{
      id: string
      actorDisplayName: string
      actorRoleKey: string | null
      actionKey: string
      entityType: string
      entityId: string
      requestId: string | null
      ipAddress: string | null
      userAgent: string | null
      beforeJson: string | null
      afterJson: string | null
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
          request_id AS requestId,
          ip_address AS ipAddress,
          user_agent AS userAgent,
          before_json AS beforeJson,
          after_json AS afterJson,
          note,
          created_at AS createdAt
        FROM audit_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...bindings, filters.pageSize, (filters.page - 1) * filters.pageSize],
    )

    const total = await dbFirst<{ total: number }>(
      c.env.DB,
      `
        SELECT COUNT(*) AS total
        FROM audit_logs
        ${whereClause}
      `,
      bindings,
    )

    return apiOk(c, {
      items: rows.map((row) => ({
        id: row.id,
        actorDisplayName: row.actorDisplayName,
        actorRoleKey: row.actorRoleKey,
        actionKey: row.actionKey,
        entityType: row.entityType,
        entityId: row.entityId,
        requestId: row.requestId,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        before: safeJsonObject(row.beforeJson),
        after: safeJsonObject(row.afterJson),
        note: row.note,
        createdAt: row.createdAt,
      })),
      page: filters.page,
      pageSize: filters.pageSize,
      total: Number(total?.total ?? 0),
      filters,
    })
  })

  return app
}
