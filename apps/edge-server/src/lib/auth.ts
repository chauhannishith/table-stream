import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 32, SCRYPT_OPTIONS)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  const [, saltHex, hashHex] = parts
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(pin, salt, expected.length, SCRYPT_OPTIONS)

  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

/** SHA-256 hash for high-entropy device tokens (supports indexed lookup). */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function issueDeviceToken(): string {
  return randomBytes(32).toString('base64url')
}
