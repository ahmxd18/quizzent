export function isSameOrigin(origin: string, host: string | undefined) {
  const scheme = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  // Preserve the public Host through the proxy; do not trust arbitrary forwarded headers.
  return !!host && origin === `${scheme}://${host}`
}
