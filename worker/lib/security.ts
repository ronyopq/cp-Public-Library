import type { Context, MiddlewareHandler } from 'hono'
import { apiError } from './http'

export function getClientIp(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

function isLocalAddress(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    c.res.headers.set('x-content-type-options', 'nosniff')
    c.res.headers.set('x-frame-options', 'DENY')
    c.res.headers.set('referrer-policy', 'strict-origin-when-cross-origin')
    c.res.headers.set('x-xss-protection', '0')
  }
}

export function originGuard(): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await next()
      return
    }

    const origin = c.req.header('origin')
    if (!origin) {
      await next()
      return
    }

    const originUrl = new URL(origin)
    const requestUrl = new URL(c.req.url)
    const sameHost = originUrl.host === requestUrl.host
    const sameLocalHost =
      isLocalAddress(originUrl.hostname) && isLocalAddress(requestUrl.hostname)

    if (!sameHost && !sameLocalHost) {
      c.res = apiError(c, 403, 'origin_not_allowed', 'Origin not allowed')
      return
    }

    await next()
  }
}

export async function assertRateLimit(
  c: Context,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
  const rateKey = `ratelimit:${key}:${getClientIp(c)}:${bucket}`
  const current = Number((await c.env.APP_CACHE.get(rateKey)) ?? '0')

  if (current >= limit) {
    return apiError(c, 429, 'rate_limited', 'Too many requests. Please try again shortly.')
  }

  await c.env.APP_CACHE.put(rateKey, String(current + 1), {
    expirationTtl: windowSeconds + 10,
  })

  return null
}

export function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSizeBytes: number,
): string | null {
  if (!allowedTypes.includes(file.type)) {
    return 'Unsupported file type'
  }

  if (file.size > maxSizeBytes) {
    return `File exceeds the ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`
  }

  return null
}
