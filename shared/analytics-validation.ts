import { z } from 'zod'

const optionalDate = z.string().trim().max(20).optional().or(z.literal(''))

export const analyticsFilterSchema = z
  .object({
    preset: z.enum(['month', 'year', 'custom']).default('month'),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .superRefine((payload, ctx) => {
    const hasStart = Boolean(payload.startDate)
    const hasEnd = Boolean(payload.endDate)

    if (payload.preset === 'custom') {
      if (!hasStart || !hasEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Custom range requires both start and end dates',
          path: ['startDate'],
        })
      }

      if (hasStart && hasEnd && payload.startDate! > payload.endDate!) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date cannot be after end date',
          path: ['endDate'],
        })
      }
    }
  })

export const analyticsExportSchema = analyticsFilterSchema.extend({
  format: z.enum(['csv', 'html']),
})
