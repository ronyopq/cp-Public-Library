import { z } from 'zod'
import {
  ACQUISITION_TYPES,
  APP_ROLES,
  APP_NAV_ITEMS,
  BANGLADESH_DIVISIONS,
  BOOK_RECORD_STATUSES,
  COMPETITION_STATUSES,
  COPY_CONDITIONS,
  DASHBOARD_WIDGET_KEYS,
  FEATURE_FLAG_KEYS,
  FEE_TYPE_CODES,
  MEMBER_STATUSES,
  PERMISSION_KEYS,
} from './constants'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
})

export const setupSchema = z.object({
  libraryNameBn: z.string().trim().min(3).max(120),
  libraryNameEn: z.string().trim().min(3).max(120),
  adminNameBn: z.string().trim().min(3).max(120),
  adminNameEn: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.email(),
  phone: z.string().trim().min(8).max(20),
  password: z
    .string()
    .min(12)
    .max(72)
    .regex(/[A-Z]/, 'At least one uppercase letter is required')
    .regex(/[a-z]/, 'At least one lowercase letter is required')
    .regex(/[0-9]/, 'At least one digit is required'),
})

export const passwordSchema = z
  .string()
  .min(12)
  .max(72)
  .regex(/[A-Z]/, 'At least one uppercase letter is required')
  .regex(/[a-z]/, 'At least one lowercase letter is required')
  .regex(/[0-9]/, 'At least one digit is required')

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1).max(72),
  })
  .refine((payload) => payload.newPassword === payload.confirmPassword, {
    message: 'New password confirmation does not match',
    path: ['confirmPassword'],
  })

export const adminResetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1).max(72),
    requireChangeAtNextLogin: z.boolean().default(true),
  })
  .refine((payload) => payload.newPassword === payload.confirmPassword, {
    message: 'Password confirmation does not match',
    path: ['confirmPassword'],
  })

export const featureFlagSchema = z.record(
  z.enum(FEATURE_FLAG_KEYS),
  z.boolean(),
)

export const permissionOverrideSchema = z.object({
  permissionKey: z.enum(PERMISSION_KEYS),
  effect: z.enum(['allow', 'deny']),
})

export const userCreateSchema = z.object({
  email: z.email(),
  fullNameBn: z.string().trim().min(2).max(120),
  fullNameEn: z.string().trim().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  password: passwordSchema,
  mustChangePassword: z.boolean().default(true),
  roles: z.array(z.enum(APP_ROLES)).min(1).max(5),
  permissionOverrides: z.array(permissionOverrideSchema).max(20).default([]),
})

export const userEditSchema = z.object({
  fullNameBn: z.string().trim().min(2).max(120),
  fullNameEn: z.string().trim().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  mustChangePassword: z.boolean().default(false),
  roles: z.array(z.enum(APP_ROLES)).min(1).max(5),
  permissionOverrides: z.array(permissionOverrideSchema).max(20).default([]),
})

export const socialLinkSchema = z.object({
  id: z.string().trim().min(2).max(80),
  label: z.string().trim().min(2).max(40),
  url: z.url(),
})

const menuKeys = APP_NAV_ITEMS.map((item) => item.key) as [
  (typeof APP_NAV_ITEMS)[number]['key'],
  ...(typeof APP_NAV_ITEMS)[number]['key'][],
]

export const menuConfigSchema = z.array(
  z.object({
    key: z.enum(menuKeys),
    enabled: z.boolean(),
    order: z.coerce.number().int().min(1).max(50),
  }),
)

export const dashboardWidgetConfigSchema = z.array(
  z.object({
    key: z.enum(DASHBOARD_WIDGET_KEYS),
    enabled: z.boolean(),
    order: z.coerce.number().int().min(1).max(50),
    minRole: z.enum(APP_ROLES),
  }),
)

export const siteProfileSchema = z.object({
  siteNameBn: z.string().trim().min(2).max(160),
  siteNameEn: z.string().trim().min(2).max(160),
  taglineBn: z.string().trim().max(200).default(''),
  taglineEn: z.string().trim().max(200).default(''),
  logoKey: z.string().trim().max(255).nullable().default(null),
  faviconKey: z.string().trim().max(255).nullable().default(null),
})

export const siteMetadataSchema = z.object({
  metaTitleBn: z.string().trim().min(2).max(160),
  metaTitleEn: z.string().trim().min(2).max(160),
  metaDescriptionBn: z.string().trim().max(300).default(''),
  metaDescriptionEn: z.string().trim().max(300).default(''),
  canonicalUrl: z.url().nullable().or(z.literal('')).default(null),
})

export const shellSettingsSchema = z.object({
  profile: siteProfileSchema,
  metadata: siteMetadataSchema,
  socialLinks: z.array(socialLinkSchema).max(10),
  menuConfig: menuConfigSchema,
  dashboardWidgets: dashboardWidgetConfigSchema,
})

export const feeSettingSchema = z.object({
  feeTypeCode: z.enum(FEE_TYPE_CODES),
  amount: z.coerce.number().min(0).max(50000),
  labelBn: z.string().trim().min(2).max(120),
  labelEn: z.string().trim().max(120).optional().or(z.literal('')),
  active: z.boolean().default(true),
})

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))
const contributorListSchema = z.array(z.string().trim().min(2).max(120)).max(10).default([])
const optionalId = z.string().trim().min(2).max(80).optional().or(z.literal(''))
const optionalImageKey = z.string().trim().max(255).optional().or(z.literal(''))
const optionalSourceUrl = z.url().optional().or(z.literal(''))

export const bibliographicRecordSchema = z
  .object({
    recordCode: optionalText(40),
    isbn10: z
      .string()
      .trim()
      .regex(/^(|[0-9X-]{10,20})$/i, 'ISBN-10 format is invalid')
      .optional()
      .or(z.literal('')),
    isbn13: z
      .string()
      .trim()
      .regex(/^(|[0-9-]{13,20})$/i, 'ISBN-13 format is invalid')
      .optional()
      .or(z.literal('')),
    titleBn: optionalText(240),
    titleEn: optionalText(240),
    subtitleBn: optionalText(240),
    subtitleEn: optionalText(240),
    authors: contributorListSchema,
    coAuthors: contributorListSchema,
    editors: contributorListSchema,
    translators: contributorListSchema,
    publisherId: optionalId,
    publisherName: optionalText(160),
    edition: optionalText(80),
    languageCode: z.string().trim().min(2).max(10).default('bn'),
    publicationYear: z.coerce.number().int().min(1800).max(2100).optional(),
    pageCount: z.coerce.number().int().min(1).max(100000).optional(),
    categoryId: optionalId,
    subcategoryId: optionalId,
    tags: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
    summary: optionalText(4000),
    notes: optionalText(2000),
    publicVisibility: z.boolean().default(true),
    coverImageKey: optionalImageKey,
    coverThumbnailKey: optionalImageKey,
    metadataPageKey: optionalImageKey,
    sourceUrl: optionalSourceUrl,
    sourceNote: optionalText(1000),
    recordStatus: z.enum(BOOK_RECORD_STATUSES).default('draft'),
  })
  .superRefine((payload, ctx) => {
    const hasMeaningfulTitle = Boolean(payload.titleBn || payload.titleEn)
    const hasIsbn = Boolean(payload.isbn10 || payload.isbn13)
    const hasContributor = payload.authors.length > 0

    if (!hasMeaningfulTitle && !hasIsbn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least a title or ISBN is required',
        path: ['titleBn'],
      })
    }

    if (!hasMeaningfulTitle && !hasIsbn && !hasContributor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A completely blank bibliographic record cannot be saved',
        path: ['titleEn'],
      })
    }
  })

export const copyBatchSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(50).default(1),
  condition: z.enum(COPY_CONDITIONS),
  acquisitionType: z.enum(ACQUISITION_TYPES),
  acquisitionDate: z.string().trim().max(20).optional().or(z.literal('')),
  acquisitionPrice: z.coerce.number().min(0).max(1000000).optional(),
  acquisitionSource: optionalText(160),
  invoiceReference: optionalText(120),
  vendorName: z.string().trim().max(160).optional().or(z.literal('')),
  locationRoom: z.string().trim().max(80).optional().or(z.literal('')),
  locationRack: z.string().trim().max(80).optional().or(z.literal('')),
  locationShelf: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(600).optional().or(z.literal('')),
})

export const bookCreateSchema = z.object({
  record: bibliographicRecordSchema,
  copies: copyBatchSchema,
})

export const bookIntakeSeedSchema = z
  .object({
    isbn: z.string().trim().max(20).optional().or(z.literal('')),
    sourceUrl: optionalSourceUrl,
    manualTitle: optionalText(240),
    manualAuthor: optionalText(120),
    manualPublisher: optionalText(160),
    metadataPageKey: optionalImageKey,
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .superRefine((payload, ctx) => {
    const hasSeed = Boolean(
      payload.isbn ||
        payload.manualTitle ||
        payload.sourceUrl ||
        payload.metadataPageKey,
    )

    if (!hasSeed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one seed input: ISBN, title, source URL, or metadata page image',
        path: ['isbn'],
      })
    }
  })

export const aiBookIntakeSchema = bookIntakeSeedSchema

export const duplicateResolutionSchema = z
  .object({
    strategy: z.enum([
      'create_new_record',
      'use_existing_record',
      'add_copy_to_existing_record',
    ]),
    existingRecordId: z.string().trim().max(80).optional().or(z.literal('')),
  })
  .superRefine((payload, ctx) => {
    if (payload.strategy !== 'create_new_record' && !payload.existingRecordId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select an existing bibliographic record',
        path: ['existingRecordId'],
      })
    }
  })

export const bookIntakeSaveSchema = z.object({
  seed: bookIntakeSeedSchema,
  record: bibliographicRecordSchema,
  copies: copyBatchSchema,
  duplicateResolution: duplicateResolutionSchema,
})

export const memberSchema = z.object({
  fullNameBn: z.string().trim().min(2).max(120),
  fullNameEn: z.string().trim().max(120).optional().or(z.literal('')),
  guardianName: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.email().optional().or(z.literal('')),
  phone: z.string().trim().min(8).max(20),
  nationalId: z.string().trim().max(40).optional().or(z.literal('')),
  addressLine: z.string().trim().min(6).max(240),
  area: z.string().trim().max(120).optional().or(z.literal('')),
  district: z.enum(BANGLADESH_DIVISIONS).optional(),
  dateOfBirth: z.string().trim().max(20).optional().or(z.literal('')),
  membershipExpiresAt: z.string().trim().max(20).optional().or(z.literal('')),
  memberStatus: z.enum(MEMBER_STATUSES).default('active'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const issueSchema = z.object({
  memberId: z.string().trim().min(10).max(64),
  copyItemId: z.string().trim().min(10).max(64),
  dueAt: z.string().trim().min(8).max(40),
})

export const returnSchema = z.object({
  loanId: z.string().trim().min(10).max(64),
  condition: z.enum(COPY_CONDITIONS).optional(),
  waiveFine: z.boolean().default(false),
  finePaid: z.coerce.number().min(0).max(100000).default(0),
})

export const renewSchema = z.object({
  loanId: z.string().trim().min(10).max(64),
  dueAt: z.string().trim().min(8).max(40),
})

export const transactionSchema = z.object({
  memberId: z.string().trim().min(10).max(64).optional().or(z.literal('')),
  loanId: z.string().trim().min(10).max(64).optional().or(z.literal('')),
  feeTypeCode: z.enum(FEE_TYPE_CODES),
  amount: z.coerce.number().min(0).max(1000000),
  direction: z.enum(['debit', 'credit']),
  paymentMethod: z.string().trim().min(2).max(40),
  notes: z.string().trim().max(400).optional().or(z.literal('')),
})

export const competitionSchema = z.object({
  titleBn: z.string().trim().min(2).max(160),
  titleEn: z.string().trim().max(160).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  registrationOpensAt: z.string().trim().max(40).optional().or(z.literal('')),
  registrationClosesAt: z.string().trim().max(40).optional().or(z.literal('')),
  eventDate: z.string().trim().max(40).optional().or(z.literal('')),
  resultPublishedAt: z.string().trim().max(40).optional().or(z.literal('')),
  status: z.enum(COMPETITION_STATUSES).default('draft'),
})

export const competitionRegistrationSchema = z.object({
  competitionId: z.string().trim().min(10).max(64),
  participantName: z.string().trim().min(2).max(120),
  guardianName: z.string().trim().max(120).optional().or(z.literal('')),
  phone: z.string().trim().min(8).max(20),
  email: z.email().optional().or(z.literal('')),
  category: z.string().trim().max(80).optional().or(z.literal('')),
})

export const userUpdateSchema = z.object({
  role: z.enum(APP_ROLES),
})

export const exportRequestSchema = z.object({
  tables: z.array(z.string().trim().min(2).max(80)).min(1).max(25),
})
