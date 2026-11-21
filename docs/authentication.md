# Organiser authentication

## Signup

### Signup API

`POST /api/auth/signup` accepts JSON with exactly these fields:

```json
{
  "displayName": "Alex",
  "email": "alex@example.com",
  "password": "a sufficiently long passphrase"
}
```

- Name: trimmed, 1–80 characters.
- Email: trimmed, lowercased, valid format, at most 254 characters.
- Password: 15–128 characters. Spaces are preserved. No mandatory punctuation rules.
- Other fields, including `role` and `status`, are rejected.

A successful `201` response contains only `user.id`, `user.displayName`, `user.email`, and `user.role`. The role is always `organiser`. No session or cookie is issued by signup; the success screen links to the separate login flow. See [login and sessions](#login-and-sessions). Email verification and recovery are not implemented yet.

| Status | Meaning |
| --- | --- |
| 400 | Invalid fields or malformed JSON |
| 409 | Email already registered; includes an email field error |
| 413 | Body exceeds 8 KiB |
| 415 | Content type is not JSON |
| 429 | More than 10 signup attempts from one IP in 15 minutes |
| 500 | Unexpected failure; response excludes internal details |

Returning 409 deliberately reveals that an email is registered, in exchange for a clear MVP signup experience. The limiter reduces basic abuse; it does not make enumeration impossible. Its in-memory store is for the current single-server deployment. Do not trust arbitrary forwarded IP headers; configure known proxy handling when deploying.

### How the code is separated

- `signup.schema.ts`: Zod checks unknown input at runtime and normalises name/email. TypeScript alone cannot validate an HTTP request.
- `password.ts`: asynchronous Node scrypt with a fresh random salt. A salt makes identical passwords produce different hashes. The saved format includes algorithm, work parameters, salt, and derived hash for login verification.
- `signup.service.ts`: hashes the password and inserts a fixed-role organiser using SQL parameters (`$1`, `$2`, `$3`). The email unique index handles concurrent duplicates.
- `signup.routes.ts`: HTTP parsing, limits, validation, status codes, and safe response fields.
- `middleware/error-handler.ts`: consistent errors without exposing request bodies, passwords, or database details.
- `app.ts`: composes routes around one injected database pool; tests supply a pool scoped to an isolated schema.
- `index.ts`: creates the shared pool and closes it when the server shuts down.

Scrypt uses `N=32768`, `r=8`, `p=3`, one of OWASP's minimum configurations. It is chosen here because Node provides it without a native addon. Argon2id remains OWASP's preferred general recommendation. Review hashing cost on the deployment machine before production use; this project does not claim a capacity guarantee.

### Run and verify

The `/signup` page is connected. Native input constraints handle basic required/length checks; the server is authoritative. The screen shows pending, server field errors, network failures, and success. Duplicate-email errors retain entered values. The successful form unmounts, releasing its password input; its mutation has no persistent cache storage. No credentials are stored in localStorage.

Frontend separation: `api/signup.ts` describes the request, `hooks/useSignup.ts` configures TanStack Query, `SignupForm` handles form interaction, `SignupPanel` composes the account UI, and `SignupSuccess` confirms account creation without claiming a login session. The generic HTTP/error helper lives in `src/lib/http.ts`. It uses one Axios instance with a 15-second timeout and maps server errors into `ApiError`, so form components do not depend on Axios-specific response shapes. Axios performs HTTP transport; TanStack Query manages the mutation's pending/error/success state.

Mutations do not automatically retry, because an interrupted response might follow a committed account creation. A subsequent duplicate response should be treated as an existing account, not proof that the previous request failed to save it.

Start Postgres.app, apply migrations, and ensure `server/.env` contains `DATABASE_URL` before starting the API:

```sh
npm run db:migrate
npm run dev:server
```

```sh
npm run test:server
```

The tests use isolated PostgreSQL schemas and real HTTP requests. They cover hash verification and unique salts, normalisation, privilege injection, invalid requests, simultaneous duplicate emails, request limits, and database failure responses. No application test accounts remain in public tables.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Node crypto](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [Zod](https://zod.dev/api), [express-rate-limit](https://express-rate-limit.mintlify.app/quickstart/usage).

## Login and sessions

Login proves that an account's password is correct. A session remembers that proof
for later requests, so the browser does not keep resending the password.

### Login and session API

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

### What PostgreSQL stores

`user_sessions` stores the login proof:

- `user_id`: the account this session belongs to, linked by a foreign key.
- `token_hash`: SHA-256 of a random 32-byte token. The raw token stays in the cookie.
- `expires_at`: the fixed expiry, 24 hours after login. Requests do not extend it.

Every session lookup checks expiry and the account's active status. Logout deletes
the row, so replaying its old cookie fails. A successful login replaces the incoming
browser session in a transaction: both deletion and insertion succeed together.
Other devices remain signed in. Expired rows for the account are removed on login;
a scheduled database-wide cleanup can be added during deployment hardening.

### Browser security

Cookies are HttpOnly (unreadable by browser JavaScript), SameSite=Lax, and Path=/.
With `NODE_ENV=production`, they also use Secure and the `__Host-` prefix, requiring
HTTPS and preventing a Domain attribute. Local HTTP development uses the name
`quizzent_session`; production uses `__Host-quizzent_session`.

Mutating session requests require a custom header, reject `Sec-Fetch-Site:
cross-site`, and reject any supplied Origin that differs from the public scheme, Host and port. Cross-origin JavaScript needs a CORS preflight to send that header;
the API does not enable CORS. Keep the frontend and `/api` on the same origin in
production, as Vite's development proxy does locally. Do not add permissive CORS
without revisiting this protection. Responses use Cache-Control: no-store.

No passwords or session tokens are stored in localStorage or returned in JSON.
These choices follow the [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### Verification

`npm run test:server` creates disposable PostgreSQL schemas. Session tests cover
password checks, safe responses, hashed token storage, restoration, rotation,
logout/replay, expiry, suspension, cross-site protection, bounded input, rate limits,
and production cookie settings. Existing signup/schema tests also run.

### Frontend flow

`LoginForm` → `useLogin` → feature API → shared Axios helper → Express.
`useSession` uses TanStack Query to share the current user between the header and
protected page. A 401 means signed out; network/server failures show a retry state.
Refreshing asks the server again using the browser's HttpOnly cookie. Nothing is
persisted in localStorage. Logout removes cached private data after the server
confirms revocation. Other tabs recheck on focus; they do not receive a live logout
notification yet.

`RequireSession` redirects signed-out visitors to login. This is a navigation
convenience, not backend authorisation: competition endpoints validate the cookie and ownership themselves. The organiser
space contains the competition library and room history.

Browser checks are maintained in `server/checks/browser.mjs`; see the [hardening report](mvp-hardening.md) for the current coverage.
