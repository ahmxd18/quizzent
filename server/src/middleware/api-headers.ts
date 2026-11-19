import type { RequestHandler } from 'express'

export const apiHeaders: RequestHandler = (_request, response, next) => {
  // These responses are JSON, never pages or reusable public assets.
  response.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'same-origin',
  })
  next()
}
