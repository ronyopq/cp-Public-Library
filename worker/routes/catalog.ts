import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { bookIntakeSaveSchema, bookIntakeSeedSchema } from '@shared/index'
import type { AppEnv } from '../types'
import { requirePermission } from '../lib/auth'
import { apiError, apiOk } from '../lib/http'
import { assertRateLimit, validateFileUpload } from '../lib/security'
import { fileErrorResponse } from '../lib/storage'
import {
  buildBookIntakeDraft,
  getCatalogOptions,
  saveCatalogIntake,
  uploadCatalogAsset,
} from '../services/catalog'

const imageTypes = ['image/jpeg', 'image/png', 'image/webp']

export function createCatalogRoutes() {
  const app = new Hono<AppEnv>()

  app.use('*', requirePermission('catalog.manage_metadata'))

  app.get('/options', async (c) => {
    return apiOk(c, await getCatalogOptions(c.env.DB))
  })

  app.post('/intake/assets', async (c) => {
    const rateLimitFailure = await assertRateLimit(c, 'catalog-assets', 30, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const formData = await c.req.formData()
    const kindValue = String(formData.get('kind') ?? '')
    const fileValue = formData.get('file')

    if (!(fileValue instanceof File) || fileValue.size === 0) {
      return apiError(c, 400, 'file_missing', 'একটি ফাইল নির্বাচন করুন।')
    }

    if (
      kindValue !== 'cover' &&
      kindValue !== 'cover_thumbnail' &&
      kindValue !== 'metadata_page'
    ) {
      return apiError(c, 400, 'asset_kind_invalid', 'Asset kind সঠিক নয়।')
    }

    const validationError = validateFileUpload(
      fileValue,
      imageTypes,
      kindValue === 'cover_thumbnail' ? 2 * 1024 * 1024 : 8 * 1024 * 1024,
      { allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'] },
    )
    if (validationError) {
      return fileErrorResponse(c, validationError)
    }

    const asset = await uploadCatalogAsset(c.env, kindValue, fileValue)
    return apiOk(c, asset, 201)
  })

  app.post('/intake/draft', async (c) => {
    const rateLimitFailure = await assertRateLimit(c, 'catalog-draft', 15, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const formData = await c.req.formData()
    const pageImage = formData.get('metadataPage')
    let metadataAsset: Awaited<ReturnType<typeof uploadCatalogAsset>> | null = null

    if (pageImage instanceof File && pageImage.size > 0) {
      const validationError = validateFileUpload(pageImage, imageTypes, 10 * 1024 * 1024, {
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      })
      if (validationError) {
        return fileErrorResponse(c, validationError)
      }
      metadataAsset = await uploadCatalogAsset(c.env, 'metadata_page', pageImage)
    }

    const seedPayload = {
      isbn: String(formData.get('isbn') ?? ''),
      sourceUrl: String(formData.get('sourceUrl') ?? ''),
      manualTitle: String(formData.get('manualTitle') ?? ''),
      manualAuthor: String(formData.get('manualAuthor') ?? ''),
      manualPublisher: String(formData.get('manualPublisher') ?? ''),
      metadataPageKey: metadataAsset?.key ?? String(formData.get('metadataPageKey') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    }

    const parsedSeed = bookIntakeSeedSchema.safeParse(seedPayload)
    if (!parsedSeed.success) {
      return apiError(
        c,
        400,
        'seed_invalid',
        parsedSeed.error.issues[0]?.message ?? 'Seed input সঠিক নয়।',
        parsedSeed.error.flatten(),
      )
    }

    const draft = await buildBookIntakeDraft(c.env, {
      ...parsedSeed.data,
      coverImageKey: String(formData.get('coverImageKey') ?? '') || null,
      coverThumbnailKey: String(formData.get('coverThumbnailKey') ?? '') || null,
      metadataPageKey: parsedSeed.data.metadataPageKey || null,
      pageImage: pageImage instanceof File && pageImage.size > 0 ? pageImage : null,
    })

    return apiOk(c, {
      draft,
      uploadedAssets: {
        metadataPage: metadataAsset,
      },
    })
  })

  app.post('/intake/save', zValidator('json', bookIntakeSaveSchema), async (c) => {
    const actor = c.get('sessionUser')
    if (!actor) {
      return apiError(c, 401, 'unauthorized', 'অনুগ্রহ করে আবার সাইন ইন করুন।')
    }

    const rateLimitFailure = await assertRateLimit(c, 'catalog-save', 25, 300)
    if (rateLimitFailure) {
      return rateLimitFailure
    }

    const result = await saveCatalogIntake(
      c.env,
      actor,
      c.req.valid('json') as any,
      c.get('requestId'),
    )

    return apiOk(c, result, 201)
  })

  return app
}
