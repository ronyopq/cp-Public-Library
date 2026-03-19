import { describe, expect, it } from 'vitest'
import type { CirculationSettings } from '@shared/index'
import { issueSchema, renewSchema, returnSchema } from '@shared/index'
import { calculateLoanAging } from './circulation'

const settings = {
  policy: {
    graceDays: 1,
    overdueFinePerDay: 5,
    maxFineAmount: 10,
  },
} as CirculationSettings

describe('circulation rules', () => {
  it('calculates overdue days and fine caps in Dhaka time', () => {
    const aging = calculateLoanAging(
      '2026-03-01T23:59:59.000Z',
      '2026-03-05T10:00:00.000Z',
      settings,
    )

    expect(aging.overdueDays).toBe(2)
    expect(aging.fineAmount).toBe(10)
  })

  it('requires a copy reference before issuing a loan', () => {
    const parsed = issueSchema.safeParse({
      memberId: 'member-0001',
    })

    expect(parsed.success).toBe(false)
  })

  it('requires a loan or barcode reference before returning a loan', () => {
    const parsed = returnSchema.safeParse({
      outcome: 'returned',
      waiveFine: false,
      finePaid: 0,
    })

    expect(parsed.success).toBe(false)
  })

  it('accepts a quick renew request when a loan id is present', () => {
    const parsed = renewSchema.safeParse({
      loanId: 'loan-00001',
      remarks: 'Quick renew',
    })

    expect(parsed.success).toBe(true)
  })
})
