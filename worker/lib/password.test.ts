import { describe, expect, it } from 'vitest'
import { createSessionToken, hashPassword, sha256Hex, verifyPassword } from './password'

describe('password helpers', () => {
  it('hashes and verifies passwords with scrypt', async () => {
    const password = 'StrongPassword123'
    const hash = await hashPassword(password)

    expect(hash.startsWith('scrypt$')).toBe(true)
    await expect(verifyPassword(password, hash)).resolves.toBe(true)
    await expect(verifyPassword('WrongPassword123', hash)).resolves.toBe(false)
  }, 15000)

  it('creates opaque session tokens and deterministic SHA-256 digests', async () => {
    const tokenA = createSessionToken()
    const tokenB = createSessionToken()

    expect(tokenA).not.toBe(tokenB)
    await expect(sha256Hex('session-token')).resolves.toHaveLength(64)
  })
})
