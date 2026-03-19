import { z } from 'zod'
import { APP_ROLES } from './constants'

const optionalDate = z
  .string()
  .trim()
  .regex(/^(|\d{4}-\d{2}-\d{2})$/, 'Date must be in YYYY-MM-DD format')
  .default('')

export const auditLogFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).default(''),
  actionKey: z.string().trim().max(120).default(''),
  entityType: z.string().trim().max(120).default(''),
  actorRoleKey: z.enum(APP_ROLES).optional().or(z.literal('')).default(''),
  startDate: optionalDate,
  endDate: optionalDate,
})

export const importModeSchema = z.enum(['create_only', 'upsert']).default('create_only')

export const backupRequestSchema = z.object({
  tables: z.array(z.string().trim().min(2).max(80)).min(1).max(30),
  note: z.string().trim().max(200).optional().or(z.literal('')),
})
