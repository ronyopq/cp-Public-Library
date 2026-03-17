import { scryptAsync } from '@noble/hashes/scrypt.js'

const textEncoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'))
}

function constantTimeEquals(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }

  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await scryptAsync(textEncoder.encode(password), salt, {
    N: 1 << 15,
    r: 8,
    p: 1,
    dkLen: 32,
  })

  return ['scrypt', '32768', '8', '1', toBase64Url(salt), toBase64Url(derived)].join(
    '$',
  )
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, nValue, rValue, pValue, saltBase64, hashBase64] =
    storedHash.split('$')

  if (
    algorithm !== 'scrypt' ||
    !nValue ||
    !rValue ||
    !pValue ||
    !saltBase64 ||
    !hashBase64
  ) {
    return false
  }

  const salt = fromBase64Url(saltBase64)
  const expected = fromBase64Url(hashBase64)
  const derived = await scryptAsync(textEncoder.encode(password), salt, {
    N: Number(nValue),
    r: Number(rValue),
    p: Number(pValue),
    dkLen: expected.length,
  })

  return constantTimeEquals(derived, expected)
}

export function createSessionToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function sha256Hex(input: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', textEncoder.encode(input))
  return Buffer.from(buffer).toString('hex')
}
