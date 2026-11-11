# Organiser signup

## API

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
- Password: 15–128 characters. Spaces are preserved. This is the initial password policy; no mandatory punctuation rules.
- Other fields, including `role` and `status`, are rejected.

A successful `201` response contains only `user.id`, `user.displayName`, `user.email`, and `user.role`. The role is always `organiser`. No session or cookie is issued by signup; the success screen links to the separate login flow. See [login and sessions](organiser-login.md). Email verification and recovery are not implemented yet.

| Status | Meaning |
| --- | --- |
| 400 | Invalid fields or malformed JSON |
| 409 | Email already registered; includes an email field error |
| 413 | Body exceeds 8 KiB |
| 415 | Content type is not JSON |
| 429 | More than 10 signup attempts from one IP in 15 minutes |
| 500 | Unexpected failure; response excludes internal details |

Returning 409 deliberately reveals that an email is registered, in exchange for a clear MVP signup experience. The limiter reduces basic abuse; it does not make enumeration impossible. Its in-memory store is for the current single-server deployment. Do not trust arbitrary forwarded IP headers; configure known proxy handling when deploying.

## How the code is separated

- `signup.schema.ts`: Zod checks unknown input at runtime and normalises name/email. TypeScript alone cannot validate an HTTP request.
- `password.ts`: asynchronous Node scrypt with a fresh random salt. A salt makes identical passwords produce different hashes. The saved format includes algorithm, work parameters, salt, and derived hash for login verification.
- `signup.service.ts`: hashes the password and inserts a fixed-role organiser using SQL parameters (`$1`, `$2`, `$3`). The email unique index handles concurrent duplicates.
- `signup.routes.ts`: HTTP parsing, limits, validation, status codes, and safe response fields.
- `middleware/error-handler.ts`: consistent errors without exposing request bodies, passwords, or database details.
- `app.ts`: composes routes around one injected database pool; tests supply a pool scoped to an isolated schema.
- `index.ts`: creates the shared pool and closes it when the server shuts down.

Scrypt uses `N=32768`, `r=8`, `p=3`, one of OWASP's minimum configurations. It is chosen here because Node provides it without a native addon. Argon2id remains OWASP's preferred general recommendation. Review hashing cost on the deployment machine before production use; this project does not claim a capacity guarantee.

## Run and verify

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

Browser checks covered real account creation, pending controls, success focus, and case-insensitive duplicate-email feedback. The single browser-test account was removed afterward.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Node crypto](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [Zod](https://zod.dev/api), [express-rate-limit](https://express-rate-limit.mintlify.app/quickstart/usage).
