import type { ApiResult } from '@shared/index'

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function apiRequest<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? ((await response.json()) as ApiResult<T>) : null

  if (!response.ok || !payload?.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'request_failed',
      payload?.error?.message ?? 'Request failed',
      payload?.error?.details,
    )
  }

  return payload.data as T
}

export function apiPost<T>(input: string, body: unknown) {
  return apiRequest<T>(input, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function apiPut<T>(input: string, body: unknown) {
  return apiRequest<T>(input, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function apiPatch<T>(input: string, body: unknown) {
  return apiRequest<T>(input, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function mediaUrl(key?: string | null) {
  return key ? `/files/${encodeURIComponent(key)}` : null
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'অপ্রত্যাশিত সমস্যা হয়েছে।'
}
