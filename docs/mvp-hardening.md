# MVP hardening — Step 18

## Scope and repeatable checks

Run from the project root with local PostgreSQL configured in `server/.env`:

```sh
npm run build
npm run lint
npm run test:server
npm run test:load
npm run test:browser
npm audit
```

The database checks create randomly named **schemas** and remove them afterward. A schema is a separate namespace for tables, so the checks do not delete or alter your normal competition data. They still need permission to create schemas in the configured database. Use a development database, never a production connection.

The browser check uses Playwright Core with an installed Microsoft Edge by default. It does not download a browser. Set `BROWSER_CHANNEL=chrome` to use installed Chrome, or set `BROWSER_EXECUTABLE` to another compatible Chromium executable. Screenshots and the Vite cache go to the system temporary folder under `quizzent-browser-checks`; `BROWSER_ARTIFACTS` can override this folder. Playwright Core and axe-core are development dependencies only.

## Security changes

- Express API responses, including errors and missing routes, use `no-store`, `nosniff`, a no-referrer policy, same-origin resource policy, and framing restrictions. The API's restrictive CSP applies to JSON responses; it is not the frontend document policy.
- Cookie-authenticated writes require `X-Quizzent-Request: 1`, reject cross-site Fetch Metadata, and reject any supplied Origin that differs from the expected scheme, Host and port. CORS remains disabled. Command-line clients can omit Origin but still need the custom header and their cookie.
- The Vite proxy explicitly preserves the public Host for both HTTP and Socket.IO. Otherwise valid browser origins can fail the API's same-origin checks. A deployment proxy must preserve the public Host too; production checks expect HTTPS. Arbitrary forwarded headers are not trusted.
- Competition, room and admin routers each allow 60 writes per minute per authenticated account. Opening another session does not reset that account's budget. Reads/polling do not consume it. A rejected write returns 429 with `Retry-After`.
- Readiness allows 20 updates per 10 seconds per participant across tabs and reconnects. Rejections happen before the readiness database query. Expired budgets are pruned and cleared during shutdown.
- Existing signup/login limits, per-guest polling/answer limits, and the shared five-attempt admin password-verification budget remain in place. The limits still allow a 50-person classroom sharing one IP to join.

**Middleware** is a function Express runs before a route. These middleware functions add response headers or reject an inappropriate request before its main handler runs. A **rate limit** gives a caller a request budget over a time window; it limits abuse without changing permissions.

The choices were checked against [Express security guidance](https://expressjs.com/en/advanced/best-practice-security/) and [OWASP's CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). The development proxy follows [Vite's proxy options](https://vite.dev/config/server-options.html#server-proxy), without rewriting WebSocket Origin.

## Existing security boundaries reviewed

- Public signup cannot assign privileged roles. Passwords use salted scrypt; session and invitation secrets are random and stored as hashes. Account and guest cookies are HttpOnly, SameSite=Lax, and Secure with a `__Host-` name in production.
- Each organiser query checks ownership. Admin changes recheck the acting account inside a serialised transaction, require password verification for role changes/suspension, revoke affected sessions, and record an audit entry. Suspended organisers cannot become superadmins; superadmins cannot be suspended.
- Room admission uses database uniqueness and locks for case-insensitive names, one membership per guest, one active room per organiser, invitation claims, capacity and hosting quotas. Display names do not establish real-world identity.
- Questions and options are assigned once. The server supplies only the current question, accepts one immutable resolution, checks its own deadline after locking, and uses request IDs for safe retries. Answer keys/reviews stay private until results publication; guests receive only their own review.
- Concurrent answer/timeout/cancellation and simultaneous finishes remain covered by the server suite. Restart recovery cancels interrupted competitions before serving requests. A second server failing to bind the same port does not cancel the live server's rooms.
- JSON sizes and strict input schemas are bounded; SQL uses parameters for external values. React renders user text without raw HTML. Expected errors are specific; internal/database errors return generic JSON without exposing credentials.
- The tracked-file check found no private-key blocks, recognised GitHub/AWS token patterns, or committed real `.env` files. Git history also contained no `.env` or `server/.env` paths. This is a targeted review, not a guarantee that a secret scanner could find nothing else.
- `npm audit` reported zero known vulnerabilities on 2026-11-21, including after installing the browser-check dependencies. Future advisory results can change.

## Measured room load

Measured on 2026-11-19 locally on macOS 27.2 with Node 26.5.0 and local PostgreSQL, one API process and a five-connection database pool. Both scenarios use real HTTP, cookie sessions and WebSockets, the normal five-second start warning, and three questions with five-second limits. HTTP timings include JSON consumption. They exclude internet latency and hosting limits.

Each scenario signs up/logs in an organiser, creates and publishes questions through the API, concurrently admits guests, opens guest and organiser sockets, marks everyone ready, answers two questions in bursts, retries the accepted answers, and leaves the last question to the real timeout worker. It then fetches every guest's results and checks the saved database counts. Any unexpected response or invariant fails the command.

| Measurement | 30 competitors | 50 competitors |
| --- | ---: | ---: |
| HTTP requests | 347 | 507 |
| Unexpected errors | 0 | 0 |
| End-to-end duration | 11,266 ms | 11,300 ms |
| Join p95 | 25 ms | 25 ms |
| Socket connection p95 | 17 ms | 27 ms |
| Ready acknowledgement p95 | 13 ms | 25 ms |
| Attempt read p95 | 40 ms | 30 ms |
| Answer submission p95 | 21 ms | 21 ms |
| Answer retry p95 | 15 ms | 18 ms |
| Results read p95 | 39 ms | 43 ms |
| Publication after the final deadline | 459 ms | 509 ms |
| Saved resolutions / timeout resolutions / results | 90 / 30 / 30 | 150 / 50 / 50 |

**p95** means 95% of the measured requests finished within that duration. These are a single pair of local scenario runs, not a sustained throughput benchmark, a limit on all rooms combined, or a production latency promise. `test:load` prints the full p50/p95/p99/max breakdown for each run.

## Browser and accessibility review

The final Edge run on 2026-11-21 passed the full journey and all 14 axe scans with no detected violations in the selected WCAG A/AA rule sets.

The browser check covers signed-in/out navigation, direct signup redirects, organiser label/checkbox selection and deselection, combined directory filters, 10/25 row pagination, responsive layouts, modal outside-click/Escape/focus restoration, password-protected suspension, and closed-room request behaviour. It checks notification countdown, hover pause, whole-card dismissal, and desktop top-right positioning.

The complete UI journey creates a draft, saves a question, publishes, opens a room, joins in a separate guest context, becomes ready, answers, views results, and restores the guest result after refresh. axe checks run against home, signup/login, admin directory, the admin modal, organiser space/question editing/live room, guest admission/lobby/question/results. The run checks horizontal overflow at mobile widths and retains the directory's intentional internal table scrolling. The homepage demo also supports pause and reduced motion.

Rechecked token contrast: on-brand/plum 10.55:1; foreground/citron 11.09:1; muted/surface 5.76:1; muted/canvas 5.47:1; control boundary/surface 3.46:1; focus/canvas 6.63:1; danger/surface and success/surface both 6.28:1. Text, icons and labels supplement status colours. Automated accessibility checks cannot replace a screen-reader and real-device review.

## Deliberate boundaries and Step 19 checks

- Run one API process. Readiness, start scheduling and request budgets are in memory. They reset on restart and are not shared across instances. Horizontal scaling requires a different design.
- Stolen session cookies remain bearer credentials until expiry or revocation. HttpOnly prevents JavaScript cookie reads; it cannot prevent someone with browser/device access from copying a cookie. A copied organiser cookie cannot grant an admin role, but a copied admin cookie carries admin read privileges; sensitive role/suspension changes additionally require the password. Passwords, devices and TLS still matter.
- No MFA, password reset/email verification, verified guest identity, distributed rate limiting, or infrastructure DDoS protection is provided. Socket authentication is checked on connect/readiness updates and periodically every 20 seconds, so passive revocation is not instantaneous.
- The load check is one short room at a time, with simulated clients. It does not establish multi-room capacity, hours-long stability, mobile network behaviour, or the capacity of a free hosting tier.
- Step 19 must verify HTTPS, public Host forwarding, a same-origin frontend/API setup, WebSocket upgrades, frontend document security headers, trusted-proxy/IP handling if required, idle suspension, database TLS and connection limits, backup/restore and real deployment outage behaviour. Vite's proxy only applies during development.

Step 18 supplies tested application hardening and measured local evidence. Deployment remains a separate milestone.
