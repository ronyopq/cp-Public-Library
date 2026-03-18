import { apiError } from './http'

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase()
}

function getExtension(fileName: string, fallback = 'bin'): string {
  const segments = fileName.split('.')
  return segments.length > 1 ? sanitizeFilename(segments.at(-1) ?? fallback) : fallback
}

export function buildR2Key(
  kind: 'branding' | 'covers' | 'members' | 'scans' | 'receipts' | 'exports' | 'reports',
  fileName: string,
): string {
  const dateFolder = new Date().toISOString().slice(0, 10)
  const extension = getExtension(fileName)
  return `${kind}/${dateFolder}/${crypto.randomUUID()}.${extension}`
}

export async function putFile(
  bucket: R2Bucket,
  key: string,
  file: File,
  metadata: Record<string, string> = {},
) {
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: metadata,
  })

  return key
}

export async function serveFile(bucket: R2Bucket, key: string) {
  const object = await bucket.get(key)

  if (!object) {
    return new Response(JSON.stringify({ ok: false, error: { code: 'file_not_found', message: 'File not found' } }), {
      status: 404,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  const headers = new Headers()
  if (object.httpMetadata?.contentType) {
    headers.set('content-type', object.httpMetadata.contentType)
  }

  return new Response(object.body, { headers })
}

export function fileErrorResponse(c: Parameters<typeof apiError>[0], message: string) {
  return apiError(c, 400, 'file_upload_invalid', message)
}
