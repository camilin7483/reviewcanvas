import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const secretOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, secretOptions, (error, key) => error ? reject(error) : resolve(key)))
}
export async function hashPassword(password: string) {
  const salt = randomBytes(24).toString('hex')
  const key = await derive(password, salt)
  return `${salt}:${key.toString('hex')}`
}
export async function matchesPassword(password: string, value: string) {
  const [salt, target] = value.split(':')
  const actual = await derive(password, salt)
  const key = Buffer.from(target, 'hex')
  return key.length === actual.length && timingSafeEqual(key, actual)
}

export const dummyPasswordHash = `${'0'.repeat(48)}:${'0'.repeat(128)}`
export const makeToken = () => randomBytes(32).toString('base64url')
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export const sessionDuration = 14 * 24 * 60 * 60
