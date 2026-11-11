import { randomBytes, scrypt } from 'node:crypto'

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
