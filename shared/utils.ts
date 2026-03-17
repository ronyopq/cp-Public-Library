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

export function toDhakaDisplay(value?: string | null): string {
  if (!value) {
    return 'প্রযোজ্য নয়'
  }

  return dayjs(value).tz(APP_TIMEZONE).format('DD MMM YYYY, hh:mm A')
}

export function readCsvLines(input: string): string[][] {
  return input
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim()))
}
