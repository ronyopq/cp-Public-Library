import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { APP_TIMEZONE } from './constants'

dayjs.extend(utc)
dayjs.extend(timezone)

export function normalizeText(input: string | null | undefined): string {
  return (input ?? '')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function tokenize(input: string | null | undefined): string[] {
  return normalizeText(input)
    .split(' ')
    .filter((token) => token.length > 1)
}

export function similarityScore(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left))
  const rightTokens = new Set(tokenize(right))

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return (2 * shared) / (leftTokens.size + rightTokens.size)
}

export function toSlug(input: string): string {
  return normalizeText(input).replace(/\s+/g, '-')
}

export function buildPublicBookPath(id: string, title: string): string {
  const slug = toSlug(title || 'book') || 'book'
  return `/books/${encodeURIComponent(id)}/${slug}`
}

export function buildPublicCompetitionPath(slug: string): string {
  return `/competitions/${encodeURIComponent(slug)}`
}

export function buildPublicCompetitionResultsPath(slug: string): string {
  return `${buildPublicCompetitionPath(slug)}/results`
}

export function toBanglaCurrency(amount: number): string {
  return new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function dhakaNow(): string {
  return dayjs().tz(APP_TIMEZONE).toISOString()
}

export function parseDhakaInputDate(
  value?: string | null,
  options: { endOfDay?: boolean } = {},
): string | null {
  if (!value?.trim()) {
    return null
  }

  const trimmed = value.trim()
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? dayjs.tz(trimmed, APP_TIMEZONE)
    : dayjs(trimmed).tz(APP_TIMEZONE)

  if (!parsed.isValid()) {
    return null
  }

  return (options.endOfDay ? parsed.endOf('day') : parsed.startOf('day')).toISOString()
}

export function addDhakaDays(
  value: string,
  days: number,
  options: { endOfDay?: boolean } = {},
): string {
  const parsed = dayjs(value).tz(APP_TIMEZONE).add(days, 'day')
  return (options.endOfDay ? parsed.endOf('day') : parsed.startOf('day')).toISOString()
}

export function diffDhakaCalendarDays(from: string, to: string): number {
  return dayjs(to)
    .tz(APP_TIMEZONE)
    .startOf('day')
    .diff(dayjs(from).tz(APP_TIMEZONE).startOf('day'), 'day')
}

export function toDhakaDisplay(value?: string | null): string {
  if (!value) {
    return 'প্রযোজ্য নয়'
  }

  return dayjs(value).tz(APP_TIMEZONE).format('DD MMM YYYY, hh:mm A')
}

export function readCsvLines(input: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const nextChar = input[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      currentRow.push(currentCell.trim())
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell.trim())
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow)
  }

  return rows
}
