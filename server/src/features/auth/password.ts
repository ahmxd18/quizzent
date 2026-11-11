import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  // OWASP's 32 MiB scrypt option; Node's built-in implementation is asynchronous.
  const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })

  // Keep the parameters and salt with the hash so login can verify it later.
  return `scrypt$${options.N}$${options.r}$${options.p}$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, r, p, salt, hash, extra] = stored.split('$')
  // Accept only our stored format; never let database values choose arbitrary work limits.
  if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || extra !== undefined
    || !/^[0-9a-f]{32}$/.test(salt ?? '') || !/^[0-9a-f]{128}$/.test(hash ?? '')) return false

  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, derived) => error ? reject(error) : resolve(derived))
  })
  return timingSafeEqual(key, Buffer.from(hash, 'hex'))
}
