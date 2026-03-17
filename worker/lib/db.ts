import type { PaginatedResult } from '@shared/index'

export async function dbAll<T>(
  db: D1Database,
  query: string,
  bindings: unknown[] = [],
): Promise<T[]> {
  const result = await db.prepare(query).bind(...bindings).all<T>()
  return result.results ?? []
}

export async function dbFirst<T>(
  db: D1Database,
  query: string,
  bindings: unknown[] = [],
): Promise<T | null> {
  return db.prepare(query).bind(...bindings).first<T>()
}

export async function dbRun(
  db: D1Database,
  query: string,
  bindings: unknown[] = [],
): Promise<void> {
  const result = await db.prepare(query).bind(...bindings).run()
  if (!result.success) {
    throw new Error(`D1 run failed for query: ${query}`)
  }
}

export async function dbValue<T>(
  db: D1Database,
  query: string,
  bindings: unknown[] = [],
): Promise<T | null> {
  const row = await db.prepare(query).bind(...bindings).first<Record<string, T>>()
  if (!row) {
    return null
  }

  const firstKey = Object.keys(row)[0]
  return firstKey ? row[firstKey] : null
}

export function jsonArray(value?: string | null): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function jsonObject<T>(value?: string | null, fallback?: T): T {
  try {
    return value ? (JSON.parse(value) as T) : (fallback as T)
  } catch {
    return fallback as T
  }
}

export function boolToInt(value: boolean): number {
  return value ? 1 : 0
}

export function intToBool(value: number | string | null | undefined): boolean {
  return Number(value ?? 0) === 1
}

export function paginated<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResult<T> {
  return {
    items,
    page,
    pageSize,
    total,
  }
}
