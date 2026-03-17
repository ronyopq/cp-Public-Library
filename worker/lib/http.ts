import type { Context } from 'hono'

export function apiOk<T>(c: Context, data: T, status = 200) {
  return c.json({ ok: true, data }, status as any)
}

export function apiError(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return c.json(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    },
    status as any,
  )
}

export function getPaginationQuery(
  searchParams: URLSearchParams,
  defaultPageSize = 20,
) {
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.max(
    1,
    Math.min(100, Number(searchParams.get('pageSize') ?? defaultPageSize)),
  )
  const search = searchParams.get('search')?.trim() ?? ''
  const status = searchParams.get('status')?.trim() ?? ''

  return {
    page,
    pageSize,
    search,
    status,
    offset: (page - 1) * pageSize,
  }
}
