import { fileURLToPath } from 'node:url'

export type FrontendSettings = { directory: string; origin: string }
export type ServerSettings = { host?: string; trustedProxyHops?: number; frontend?: FrontendSettings }

export function readRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === 'production'
  const port = Number(env.PORT ?? 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.')
  const host = env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1')
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('HOST must be 127.0.0.1 or 0.0.0.0.')
  const trustedProxyHops = Number(env.TRUST_PROXY_HOPS ?? 0)
  if (![0, 1].includes(trustedProxyHops)) throw new Error('TRUST_PROXY_HOPS must be 0 or 1.')
  let frontend: FrontendSettings | undefined
  if (production) {
    const value = env.PUBLIC_ORIGIN ?? env.RENDER_EXTERNAL_URL
    if (!value) throw new Error('Set PUBLIC_ORIGIN to the HTTPS website origin.')
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== value.replace(/\/$/, '')) {
      throw new Error('PUBLIC_ORIGIN must be an HTTPS origin without a path, credentials, query or fragment.')
    }
    frontend = { origin: url.origin, directory: fileURLToPath(new URL('../../dist/', import.meta.url)) }
  }
  return { port, host, trustedProxyHops, frontend }
}
