import { z } from 'zod'
import {
  ACCOUNTING_COLLECTION_MODES,
  ACCOUNTING_REPORT_PRESETS,
} from './constants'

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''))

const monthTokenSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')

export const feeTypeDefinitionSchema = z.object({
  feeCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores only'),
  nameBn: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  descriptionBn: optionalText(300),
  descriptionEn: optionalText(300),
  collectionMode: z.enum(ACCOUNTING_COLLECTION_MODES),
  defaultAmount: z.coerce.number().min(0).max(1000000),
  allowCustomAmount: z.boolean().default(true),
  allowMultiMonth: z.boolean().default(false),
  incomeAccountId: optionalText(80),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(1).max(200).default(50),
})

export const accountingCollectionSchema = z.object({
  memberId: optionalText(80),
  feeTypeId: z.string().trim().min(10).max(64),
  months: z.array(monthTokenSchema).max(24).default([]),
  amount: z.coerce.number().min(1).max(1000000),
  paymentMethodCode: z.string().trim().min(2).max(40),
  referenceNo: optionalText(120),
  note: optionalText(400),
})

export const accountingReportFilterSchema = z.object({
  preset: z.enum(ACCOUNTING_REPORT_PRESETS).default('monthly'),
  startDate: z.string().trim().min(10).max(20),
  endDate: z.string().trim().min(10).max(20),
  feeTypeId: optionalText(80),
  paymentMethodCode: optionalText(40),
  memberId: optionalText(80),
})

export const paymentVoidSchema = z.object({
  reason: z.string().trim().min(4).max(400),
})

export const accountingExportSchema = accountingReportFilterSchema.extend({
  format: z.enum(['csv', 'html']).default('csv'),
})
