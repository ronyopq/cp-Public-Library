import { z } from 'zod'
import { COMPETITION_STATUSES } from './constants'

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

export const publicSiteSettingsSchema = z.object({
  menu: z.object({
    catalog: z.boolean().default(true),
    competitions: z.boolean().default(true),
    results: z.boolean().default(true),
  }),
  catalogFields: z.object({
    subtitle: z.boolean().default(true),
    authors: z.boolean().default(true),
    publisher: z.boolean().default(true),
    language: z.boolean().default(true),
    publicationYear: z.boolean().default(true),
    edition: z.boolean().default(true),
    pageCount: z.boolean().default(true),
    category: z.boolean().default(true),
    summary: z.boolean().default(true),
    tags: z.boolean().default(true),
    availability: z.boolean().default(true),
    cover: z.boolean().default(true),
  }),
  competition: z.object({
    resultsVisible: z.boolean().default(true),
    printableAcknowledgement: z.boolean().default(true),
    showFeeNotice: z.boolean().default(true),
  }),
})

export const competitionManageSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and hyphens'),
  titleBn: z.string().trim().min(2).max(160),
  titleEn: optionalText(160),
  description: optionalText(2000),
  registrationFeeAmount: z.coerce.number().min(0).max(100000).default(0),
  registrationOpensAt: optionalText(40),
  registrationClosesAt: optionalText(40),
  eventDate: optionalText(40),
  resultPublishedAt: optionalText(40),
  status: z.enum(COMPETITION_STATUSES).default('draft'),
  visibleToPublic: z.boolean().default(true),
})

export const competitionResultEntrySchema = z.object({
  id: z.string().trim().max(80).optional().or(z.literal('')),
  registrationId: z.string().trim().max(80).optional().or(z.literal('')),
  positionRank: z.coerce.number().int().min(1).max(999).optional(),
  positionLabel: z.string().trim().min(1).max(120),
  score: z.coerce.number().min(0).max(100000).optional(),
  publishedNote: optionalText(500),
})

export const competitionResultsUpdateSchema = z.object({
  results: z.array(competitionResultEntrySchema).max(200),
})

export const publicCompetitionRegistrationSchema = z.object({
  participantName: z.string().trim().min(2).max(120),
  guardianName: optionalText(120),
  phone: z.string().trim().min(8).max(20),
  email: z.email().optional().or(z.literal('')),
  category: optionalText(80),
  note: optionalText(500),
})
