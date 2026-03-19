import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  ROLE_RANK,
  memberPrintJobSchema,
  memberSchema,
  type SessionUser,
} from '@shared/index'
import type { AppEnv } from '../types'
import { requirePermission } from '../lib/auth'
import { apiError, apiOk, getPaginationQuery } from '../lib/http'
import { assertRateLimit, validateFileUpload } from '../lib/security'
import { fileErrorResponse } from '../lib/storage'
import {
  archiveMember,
  createMember,
  createMemberCardPrintJob,
  getMemberProfile,
  getSelfMemberProfile,
  listArchivedMembers,
  listMemberCardTemplates,
  listMembers,
  updateMember,
  uploadMemberPhoto,
} from '../services/members'

function requireSensitiveMemberRole(actor: SessionUser | null) {
  return Boolean(actor && ROLE_RANK[actor.role] >= ROLE_RANK.manager)
}

function requireMemberPrintAccess(actor: SessionUser | null) {
  return Boolean(
    actor &&
      actor.permissions.includes('members.manage') &&
      actor.permissions.includes('prints.manage'),
  )
}

function routeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'অপ্রত্যাশিত সমস্যা হয়েছে।'
}

export function createMemberRoutes() {
  const app = new Hono<AppEnv>()

  app.get('/self/profile', async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে আবার সাইন ইন করুন।')
    }

    if (
      !actor.permissions.includes('members.self_service') &&
      !actor.permissions.includes('loans.view_own')
    ) {
      return apiError(c, 403, 'insufficient_permission', 'আপনার এই তথ্য দেখার অনুমতি নেই।')
    }

    return apiOk(c, {
      profile: await getSelfMemberProfile(c.env.DB, actor.id),
    })
  })

  app.get('/', requirePermission('members.manage'), async (c) => {
    const query = getPaginationQuery(new URL(c.req.url).searchParams)
    return apiOk(
      c,
      await listMembers(c.env.DB, {
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
      }),
    )
  })

  app.get('/archived', requirePermission('members.manage'), async (c) => {
    const actor = c.get('sessionUser')
    if (!requireSensitiveMemberRole(actor)) {
      return apiError(c, 403, 'insufficient_role', 'আর্কাইভ সদস্য দেখতে Manager বা তার উপরের ভূমিকা প্রয়োজন।')
    }

    const query = getPaginationQuery(new URL(c.req.url).searchParams)
    return apiOk(
      c,
      await listArchivedMembers(c.env.DB, {
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
      }),
    )
  })

  app.get('/templates/cards', requirePermission('members.manage'), async (c) => {
    const actor = c.get('sessionUser')
    if (!requireMemberPrintAccess(actor)) {
      return apiError(c, 403, 'insufficient_permission', 'আইডি কার্ড টেমপ্লেট দেখার অনুমতি নেই।')
    }

    return apiOk(c, {
      templates: await listMemberCardTemplates(c.env.DB),
    })
  })

  app.post('/assets/photo', requirePermission('members.manage'), async (c) => {
    const actor = c.get('sessionUser')
    if (!requireSensitiveMemberRole(actor)) {
      return apiError(c, 403, 'insufficient_role', 'সদস্যের ছবি আপডেট করতে Manager বা তার উপরের ভূমিকা প্রয়োজন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'member-photos', 25, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const formData = await c.req.formData()
    const fileValue = formData.get('photo')
    if (!(fileValue instanceof File) || fileValue.size === 0) {
      return apiError(c, 400, 'file_missing', 'একটি সদস্য ছবি নির্বাচন করুন।')
    }

    const validationError = validateFileUpload(
      fileValue,
      ['image/jpeg', 'image/png', 'image/webp'],
      5 * 1024 * 1024,
    )
    if (validationError) {
      return fileErrorResponse(c, validationError)
    }

    return apiOk(c, await uploadMemberPhoto(c.env, fileValue), 201)
  })

  app.post('/', requirePermission('members.manage'), zValidator('json', memberSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!requireSensitiveMemberRole(actor)) {
      return apiError(c, 403, 'insufficient_role', 'সদস্য প্রোফাইল তৈরি করতে Manager বা তার উপরের ভূমিকা প্রয়োজন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'member-create', 25, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const rateLimitFailure = await assertRateLimit(c, 'member-update', 50, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    try {
      return apiOk(
        c,
        {
          member: await createMember(
            c.env,
            actor!,
            c.req.valid('json') as any,
            c.get('requestId'),
          ),
        },
        201,
      )
    } catch (error) {
      return apiError(c, 400, 'member_create_failed', routeErrorMessage(error))
    }
  })

  app.post('/print-jobs', requirePermission('members.manage'), zValidator('json', memberPrintJobSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!requireMemberPrintAccess(actor)) {
      return apiError(c, 403, 'insufficient_permission', 'আইডি কার্ড প্রিন্টের অনুমতি নেই।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'member-print-jobs', 20, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const origin = new URL(c.req.url).origin
    try {
      return apiOk(
        c,
        {
          job: await createMemberCardPrintJob(
            c.env,
            actor!,
            origin,
            c.req.valid('json') as any,
            c.get('requestId'),
          ),
        },
        201,
      )
    } catch (error) {
      return apiError(c, 400, 'member_print_failed', routeErrorMessage(error))
    }
  })

  app.get('/:memberId', requirePermission('members.manage'), async (c) => {
    const profile = await getMemberProfile(c.env.DB, c.req.param('memberId'))
    if (!profile) {
      return apiError(c, 404, 'member_not_found', 'সদস্য প্রোফাইল পাওয়া যায়নি।')
    }

    return apiOk(c, { profile })
  })

  app.patch('/:memberId', requirePermission('members.manage'), zValidator('json', memberSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!requireSensitiveMemberRole(actor)) {
      return apiError(c, 403, 'insufficient_role', 'সদস্য প্রোফাইল সম্পাদনা করতে Manager বা তার উপরের ভূমিকা প্রয়োজন।')
    }

    try {
      return apiOk(c, {
        member: await updateMember(
          c.env,
          actor!,
          c.req.param('memberId'),
          c.req.valid('json') as any,
          c.get('requestId'),
        ),
      })
    } catch (error) {
      return apiError(c, 400, 'member_update_failed', routeErrorMessage(error))
    }
  })

  app.delete('/:memberId', requirePermission('members.manage'), async (c) => {
    const actor = c.get('sessionUser')
    if (!requireSensitiveMemberRole(actor)) {
      return apiError(c, 403, 'insufficient_role', 'সদস্য আর্কাইভ করতে Manager বা তার উপরের ভূমিকা প্রয়োজন।')
    }

    try {
      await archiveMember(c.env, actor!, c.req.param('memberId'), c.get('requestId'))
      return apiOk(c, { success: true })
    } catch (error) {
      return apiError(c, 400, 'member_archive_failed', routeErrorMessage(error))
    }
  })

  return app
}
