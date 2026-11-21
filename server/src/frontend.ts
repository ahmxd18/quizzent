import express from 'express'
import { existsSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import type { FrontendSettings } from './runtime-config.js'

export function createFrontendRouter({ directory, origin }: FrontendSettings) {
  const router = express.Router()
  const index = resolve(directory, 'index.html')
  if (!existsSync(index)) throw new Error('Build the frontend before starting in production.')
  const websocketOrigin = origin.replace(/^https:/, 'wss:')
  router.use((request, response, next) => {
    response.set({
      'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${websocketOrigin}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000',
      'Cache-Control': 'no-cache',
    })
    let path: string
    try { path = decodeURIComponent(request.path) }
    catch { response.status(400).json({ message: 'Invalid URL.' }); return }
    if (path.split('/').some(part => part.startsWith('.'))) {
      response.status(404).json({ message: 'Route not found' })
      return
    }
    next()
  })
  router.use(express.static(directory, {
    index: false, dotfiles: 'deny',
    setHeaders(response, path) {
      // Vite fingerprints these files, so a new build gets new asset URLs.
      if (path.startsWith(resolve(directory, 'assets') + sep)) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    },
  }))
  router.get('/{*path}', (request, response, next) => {
    // A missing script/image must stay a 404, not receive the app's HTML.
    if (extname(request.path)) { next(); return }
    response.sendFile(index)
  })
  return router
}
