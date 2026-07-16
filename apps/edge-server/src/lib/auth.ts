import { randomBytes, scryptSync } from 'node:crypto'

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
