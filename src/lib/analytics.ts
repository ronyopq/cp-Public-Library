import type { AnalyticsPreset } from '@shared/index'
import { APP_TIMEZONE } from '@shared/index'

export interface AnalyticsFilterDraft {
  preset: AnalyticsPreset
  month: string
  year: string
  startDate: string
  endDate: string
}

export const analyticsMonthOptions = [
  { value: '1', label: 'জানুয়ারি' },
  { value: '2', label: 'ফেব্রুয়ারি' },
  { value: '3', label: 'মার্চ' },
  { value: '4', label: 'এপ্রিল' },
  { value: '5', label: 'মে' },
  { value: '6', label: 'জুন' },
  { value: '7', label: 'জুলাই' },
  { value: '8', label: 'আগস্ট' },
  { value: '9', label: 'সেপ্টেম্বর' },
  { value: '10', label: 'অক্টোবর' },
  { value: '11', label: 'নভেম্বর' },
  { value: '12', label: 'ডিসেম্বর' },
]

function dhakaYearMonth(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  return {
    year: parts.find((part) => part.type === 'year')?.value ?? '1970',
    month: String(Number(parts.find((part) => part.type === 'month')?.value ?? '1')),
  }
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function createDefaultAnalyticsFilterDraft(): AnalyticsFilterDraft {
  const current = dhakaYearMonth()
  const year = Number(current.year)
  const month = Number(current.month)
  const monthToken = String(month).padStart(2, '0')
  return {
    preset: 'month',
    month: current.month,
    year: current.year,
    startDate: `${year}-${monthToken}-01`,
    endDate: `${year}-${monthToken}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`,
  }
}

export function analyticsFilterDraftFromSearchParams(
  searchParams: URLSearchParams,
): AnalyticsFilterDraft {
  const defaults = createDefaultAnalyticsFilterDraft()
  return {
    preset:
      searchParams.get('preset') === 'custom' || searchParams.get('preset') === 'year'
        ? (searchParams.get('preset') as AnalyticsPreset)
        : defaults.preset,
    month: searchParams.get('month') ?? defaults.month,
    year: searchParams.get('year') ?? defaults.year,
    startDate: searchParams.get('startDate') ?? defaults.startDate,
    endDate: searchParams.get('endDate') ?? defaults.endDate,
  }
}

export function buildAnalyticsSearchParams(draft: AnalyticsFilterDraft) {
  const next = new URLSearchParams()
  next.set('preset', draft.preset)
  next.set('year', draft.year)

  if (draft.preset === 'month') {
    next.set('month', draft.month)
  }

  if (draft.preset === 'custom') {
    next.set('startDate', draft.startDate)
    next.set('endDate', draft.endDate)
  }

  return next
}
