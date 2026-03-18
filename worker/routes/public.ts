import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  publicCompetitionRegistrationSchema,
  setupSchema,
  type AppRole,
} from '@shared/index'
import { dhakaNow } from '@shared/utils'
import type { AppEnv } from '../types'
import { createSession } from '../lib/auth'
import { writeAudit } from '../lib/audit'
import { dbFirst, dbValue } from '../lib/db'
import { apiError, apiOk } from '../lib/http'
import { hashPassword } from '../lib/password'
import {
  getFeatureFlags,
  getPublicSiteSettings,
  getShellSettings,
  saveShellSettings,
} from '../lib/settings'
import {
  getCompetitionAcknowledgement,
  getPublicCompetitionDetail,
  listPublicCompetitions,
  registerPublicCompetition,
} from '../services/competitions'
import {
  getPublicBookDetail,
  listPublicCatalog,
  parsePublicCatalogQuery,
  resolvePublicQr,
} from '../services/public'

export function createPublicRoutes() {
  const app = new Hono<AppEnv>()

  app.get('/health', (c) =>
    apiOk(c, {
      status: 'ok',
      time: dhakaNow(),
      timezone: c.env.APP_TIMEZONE,
    }),
  )

  app.get('/setup/status', async (c) => {
    const userCount = await dbValue<number>(
      c.env.DB,
      `SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL`,
    )
    const shellSettings = await getShellSettings(c.env.DB, c.env)

    return apiOk(c, {
      bootstrapRequired: Number(userCount ?? 0) === 0,
      profile: shellSettings.profile,
      metadata: shellSettings.metadata,
    })
  })

  app.get('/site-config', async (c) => {
    const featureFlags = await getFeatureFlags(c.env)
    const shellSettings = await getShellSettings(c.env.DB, c.env)
    const publicSettings = await getPublicSiteSettings(c.env.DB)

    return apiOk(c, {
      profile: shellSettings.profile,
      metadata: shellSettings.metadata,
      socialLinks: shellSettings.socialLinks,
      publicSettings,
      featureFlags: {
        public_catalog_enabled: featureFlags.public_catalog_enabled,
        competitions_module_enabled: featureFlags.competitions_module_enabled,
        online_registration_enabled: featureFlags.online_registration_enabled,
      },
    })
  })

  app.get('/catalog', async (c) => {
    const featureFlags = c.get('featureFlags')
    if (!featureFlags.public_catalog_enabled) {
      return apiError(c, 404, 'catalog_disabled', 'পাবলিক ক্যাটালগ এখন বন্ধ আছে।')
    }

    return apiOk(c, await listPublicCatalog(c.env, parsePublicCatalogQuery(new URL(c.req.url).searchParams)))
  })

  app.get('/catalog/:recordId', async (c) => {
    const featureFlags = c.get('featureFlags')
    if (!featureFlags.public_catalog_enabled) {
      return apiError(c, 404, 'catalog_disabled', 'পাবলিক ক্যাটালগ এখন বন্ধ আছে।')
    }

    const detail = await getPublicBookDetail(c.env, c.req.param('recordId'))
    if (!detail) {
      return apiError(c, 404, 'book_not_found', 'পাবলিক বইয়ের পাতা পাওয়া যায়নি।')
    }

    return apiOk(c, detail)
  })

  app.get('/qr/:shortCode', async (c) => {
    const resolution = await resolvePublicQr(c.env.DB, c.req.param('shortCode'))
    if (!resolution) {
      return apiError(c, 404, 'qr_not_found', 'এই QR লিংকটি পাওয়া যায়নি।')
    }

    return apiOk(c, resolution)
  })

  app.get('/competition-acknowledgements/:registrationId', async (c) => {
    const featureFlags = c.get('featureFlags')
    if (!featureFlags.competitions_module_enabled) {
      return apiError(c, 404, 'competitions_disabled', 'প্রতিযোগিতা মডিউল এখন বন্ধ আছে।')
    }

    const acknowledgement = await getCompetitionAcknowledgement(
      c.env.DB,
      c.req.param('registrationId'),
    )
    if (!acknowledgement) {
      return apiError(c, 404, 'acknowledgement_not_found', 'নিবন্ধনের রসিদ পাওয়া যায়নি।')
    }

    return apiOk(c, { acknowledgement })
  })

  app.get('/competitions', async (c) => {
    const featureFlags = c.get('featureFlags')
    if (!featureFlags.competitions_module_enabled) {
      return apiOk(c, { items: [] as never[] })
    }

    return apiOk(c, {
      items: await listPublicCompetitions(c.env.DB),
    })
  })

  app.get('/competitions/:slug', async (c) => {
    const featureFlags = c.get('featureFlags')
    if (!featureFlags.competitions_module_enabled) {
      return apiError(c, 404, 'competitions_disabled', 'প্রতিযোগিতা মডিউল এখন বন্ধ আছে।')
    }

    const detail = await getPublicCompetitionDetail(c.env.DB, c.req.param('slug'))
    if (!detail) {
      return apiError(c, 404, 'competition_not_found', 'প্রতিযোগিতার তথ্য পাওয়া যায়নি।')
    }

    return apiOk(c, { detail })
  })

  app.post(
    '/competitions/:slug/register',
    zValidator('json', publicCompetitionRegistrationSchema),
    async (c) => {
      const featureFlags = c.get('featureFlags')
      if (!featureFlags.competitions_module_enabled || !featureFlags.online_registration_enabled) {
        return apiError(c, 403, 'registration_disabled', 'অনলাইন নিবন্ধন এখন বন্ধ আছে।')
      }

      const payload = c.req.valid('json')
      const acknowledgement = await registerPublicCompetition(
        c.env,
        {
          competitionSlug: c.req.param('slug'),
          participantName: payload.participantName,
          guardianName: payload.guardianName || undefined,
          phone: payload.phone,
          email: payload.email || undefined,
          category: payload.category || undefined,
          note: payload.note || undefined,
        },
        c.get('requestId'),
      )

      return apiOk(c, { acknowledgement }, 201)
    },
  )

  app.post('/setup/bootstrap', zValidator('json', setupSchema), async (c) => {
    const existingUser = await dbFirst<{ id: string }>(
      c.env.DB,
      `SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1`,
    )

    if (existingUser) {
      return apiError(
        c,
        409,
        'already_bootstrapped',
        'প্রাথমিক সেটআপ ইতোমধ্যে সম্পন্ন হয়েছে।',
      )
    }

    const payload = c.req.valid('json')
    const now = dhakaNow()
    const userId = crypto.randomUUID()
    const roleIdRow = await dbFirst<{ id: string }>(
      c.env.DB,
      `SELECT id FROM roles WHERE role_key = 'super_admin' LIMIT 1`,
    )

    if (!roleIdRow) {
      return apiError(c, 500, 'missing_roles', 'Super Admin role seed পাওয়া যায়নি।')
    }

    await c.env.DB.batch([
      c.env.DB.prepare(
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
          VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)
        `,
      ).bind(
        userId,
        payload.email.toLowerCase(),
        await hashPassword(payload.password),
        payload.adminNameBn,
        payload.adminNameEn || null,
        payload.phone,
        now,
        now,
      ),
      c.env.DB.prepare(
        `
          INSERT INTO user_roles (
            user_id,
            role_id,
            is_primary,
            assigned_at,
            assigned_by_user_id
          )
          VALUES (?, ?, 1, ?, NULL)
        `,
      ).bind(userId, roleIdRow.id, now),
    ])

    const shellSettings = await getShellSettings(c.env.DB, c.env)
    await saveShellSettings(c.env.DB, userId, {
      ...shellSettings,
      profile: {
        ...shellSettings.profile,
        siteNameBn: payload.libraryNameBn,
        siteNameEn: payload.libraryNameEn,
      },
      metadata: {
        ...shellSettings.metadata,
        metaTitleBn: payload.libraryNameBn,
        metaTitleEn: payload.libraryNameEn,
      },
    })

    const actor = {
      id: userId,
      email: payload.email.toLowerCase(),
      nameBn: payload.adminNameBn,
      nameEn: payload.adminNameEn || null,
      phone: payload.phone,
      status: 'active',
      role: 'super_admin' as AppRole,
      roles: ['super_admin'] as AppRole[],
      permissions: [] as never[],
      mustChangePassword: false,
    }

    await createSession(c, userId)
    await writeAudit(
      c.env.DB,
      actor,
      'auth.bootstrap',
      'user',
      userId,
      'প্রথম সুপার অ্যাডমিন তৈরি করা হয়েছে।',
      {
        requestId: c.get('requestId'),
        ipAddress: c.req.header('cf-connecting-ip') ?? null,
        userAgent: c.req.header('user-agent') ?? null,
        after: {
          email: payload.email.toLowerCase(),
          role: 'super_admin',
        },
      },
    )

    return apiOk(
      c,
      {
        user: actor,
      },
      201,
    )
  })

  return app
}
