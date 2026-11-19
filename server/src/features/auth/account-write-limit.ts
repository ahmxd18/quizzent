import { rateLimit } from 'express-rate-limit'
import type { SessionUser } from './session.service.js'

export function accountWriteLimit() {
  return rateLimit({
    windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    // Polling stays separate from edits, and organisers sharing Wi-Fi do not share a budget.
    skip: request => ['GET', 'HEAD', 'OPTIONS'].includes(request.method),
    keyGenerator: (_request, response) => (response.locals.user as SessionUser).id,
    message: { message: 'Too many changes. Please wait a minute before trying again.' },
  })
}
