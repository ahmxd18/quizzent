# Organiser login and sessions

Login proves that an account's password is correct. A session remembers that proof
for later requests, so the browser does not keep resending the password.

## API

- `POST /api/auth/login`: JSON `{ email, password }`; returns `{ user }` and sets a cookie.
- `GET /api/auth/session`: returns `{ user }`, or 401 when no valid session exists.
- `POST /api/auth/logout`: deletes this session and clears its cookie; safe to repeat.
- Login and logout require `X-Quizzent-Request: 1`. The frontend supplies it automatically.
  Add this header when testing these endpoints in an API client too.

Passwords use the existing salted scrypt format. Verification derives the same key
and compares it using Node's constant-time comparison. Email is normalised, while
password spaces are preserved. Wrong credentials, unknown emails, and suspended
accounts get the same 401 message. Unknown emails also perform a password check;
this reduces timing differences, but is not a guarantee of identical response times.
Login allows ten attempts per IP in fifteen minutes, using an in-memory limiter.
This resets on restart and assumes one API process for now.

## What PostgreSQL stores

The existing `user_sessions` table needs no new migration:

- `user_id`: the account this session belongs to, linked by a foreign key.
- `token_hash`: SHA-256 of a random 32-byte token. The raw token stays in the cookie.
- `expires_at`: the fixed expiry, 24 hours after login. Requests do not extend it.

Every session lookup checks expiry and the account's active status. Logout deletes
the row, so replaying its old cookie fails. A successful login replaces the incoming
browser session in a transaction: both deletion and insertion succeed together.
Other devices remain signed in. Expired rows for the account are removed on login;
a scheduled database-wide cleanup can be added during deployment hardening.

## Browser security

Cookies are HttpOnly (unreadable by browser JavaScript), SameSite=Lax, and Path=/.
With `NODE_ENV=production`, they also use Secure and the `__Host-` prefix, requiring
HTTPS and preventing a Domain attribute. Local HTTP development uses the name
`quizzent_session`; production uses `__Host-quizzent_session`.

Mutating session requests require a custom header and reject `Sec-Fetch-Site:
cross-site`. Cross-origin JavaScript needs a CORS preflight to send that header;
the API does not enable CORS. Keep the frontend and `/api` on the same origin in
production, as Vite's development proxy does locally. Do not add permissive CORS
without revisiting this protection. Responses use Cache-Control: no-store.

No passwords or session tokens are stored in localStorage or returned in JSON.
These choices follow the [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Verification

`npm run test:server` creates disposable PostgreSQL schemas. Session tests cover
password checks, safe responses, hashed token storage, restoration, rotation,
logout/replay, expiry, suspension, cross-site protection, bounded input, rate limits,
and production cookie settings. Existing signup/schema tests also run.
