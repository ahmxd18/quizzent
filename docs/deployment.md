# Free demo deployment

Status: configuration and local checks are prepared; no hosted URL is verified yet. Step 19 stays open until the deployed checks below pass.

## Target and limits

Use one **Render Free web service** for React, Express and Socket.IO, with **Neon Free PostgreSQL**. A web service is a running Node process; Neon stores the database separately, so a web-service restart does not erase saved competitions. This is a portfolio demo with a ₹0 target, not an always-available production service.

Checked against provider documentation on 2026-11-21:

| Option | Decision |
| --- | --- |
| Render Free web service | Supports WebSockets and sleeps after 15 minutes without inbound HTTP/WebSocket traffic. Cold starts can delay an interview demo. |
| Render Free PostgreSQL | Avoid for persistent demo data: expires after 30 days. |
| Neon Free | No time limit or credit card requirement; currently 100 CU-hours and 1 GB PostgreSQL storage per project. Usage/storage limits still apply. |
| Separate frontend hosting | Unnecessary here: Express serves the React build and API from the same origin. |

Render's 750 monthly free instance hours are shared across the workspace. Outbound bandwidth and build minutes have limits too; without a payment method, excess usage can suspend free services or builds. Stay on Free, avoid paid resources/payment methods, and inspect both dashboards' usage. Do not add an uptime pinger to defeat sleeping. Recheck terms before provisioning: [Render Free](https://render.com/docs/free), [WebSockets](https://render.com/docs/websocket), [Neon Free](https://neon.com/pricing).

The timeout worker stops querying when there are no running competitions and wakes after committed room changes. Live lobbies and competitions still need database activity. A CU-hour measures database compute size multiplied by running hours; it is not a request count. The local 50-guest result does not establish capacity on a shared free instance.

## 1. Create the database

1. Create a Neon account and choose **Free**, not a paid plan or trial upgrade.
2. Create one project, using PostgreSQL 18 to match the local database/migrations. Pick a region close to the Render service; use a pair available on both Free plans.
3. Use a new demo database rather than importing local test users. Open **Connect** and select a **direct** connection, not the pooled/PgBouncer endpoint. This app has a five-connection pool; migrations also use session-level behaviour.
4. Copy the connection string privately. Keep certificate verification enabled; `sslmode=verify-full` explicitly verifies the certificate and hostname. Never use `rejectUnauthorized: false` or paste the string into GitHub/chat. See [Neon connections](https://neon.com/docs/connect/connect-from-any-app).

The URL contains a database password. It is a secret, not the public website address.

## 2. Create the web service

After this feature branch is reviewed/merged, create a **Blueprint** in Render and connect `ahmxd18/quizzent`, branch `main`. `render.yaml` defines one free Node service and no billable database/worker resources. Confirm the plan and region before creating it.

When prompted for `DATABASE_URL`, paste the Neon **direct** connection string into Render's environment-secret field. Render supplies `PORT` and `RENDER_EXTERNAL_URL`; the latter supplies the public HTTPS origin unless `PUBLIC_ORIGIN` is explicitly set.

| Setting | Value |
| --- | --- |
| Runtime | Node; `.node-version` pins the version used locally |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm run db:migrate && npm run start:server` |
| Health check | `/api/health` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY_HOPS` | `1`, for this service behind the hosting ingress; verify its client-IP behaviour below |
| Auto-deploy | Off; deploy manually between competitions |

Migrations run before startup because Render's separate pre-deploy command is paid-only. A migration failure stops startup. Do not put migrations in the build command: builds should not modify the live database. Only one service/process may use this deployment; starting another copy against the same database can cancel an active competition during recovery.

Render terminates HTTPS and forwards traffic to the Node port. **Same origin** means the browser sees one scheme, hostname and port for React, `/api` and `/socket.io`. Keep the public Host unchanged and allow WebSocket upgrades. Custom domains require updating `PUBLIC_ORIGIN`; otherwise retain the free `onrender.com` address. [Port binding](https://render.com/docs/web-services#port-binding), [Blueprint settings](https://render.com/docs/blueprint-spec), [Proxy trust](https://expressjs.com/en/guide/behind-proxies/).

## 3. First accounts

Use `/signup` to create your own organiser account, then log in. Never use a documented/shared admin password or put an admin cookie in screenshots.

If superadmin access is needed, register that account first, then run the existing bootstrap command **locally against the remote database**, since Free does not provide an interactive service shell. Put only the remote `DATABASE_URL` in an ignored `server/.env.production.local` file, then run:

```sh
node --env-file=server/.env.production.local --import tsx server/src/bootstrap-superadmin.ts your-email@example.com
```

This deliberately does not load `server/.env`, so it cannot silently bootstrap your local database instead. Protect the remote file and remove it once the administrative work is finished. Log in again after changing roles. Do not expose bootstrap as a public API.

## 4. Hosted verification — still pending

- [ ] `/`, direct `/login`, `/organiser` refresh and missing frontend routes render correctly. `/api/not-a-route` returns a JSON 404, never React HTML. Missing assets and dotfiles stay 404.
- [ ] `/api/health` reports readiness. It checks process readiness, not database availability; verify a draft can actually be saved and loaded too.
- [ ] The HTTPS session cookie has `Secure`, `HttpOnly`, `SameSite=Lax`, Path `/`, and the `__Host-` name. Login, logout and refresh work without CORS changes.
- [ ] A separate guest browser joins and receives live readiness updates over WSS; another organiser cannot inspect the room. Confirm 50 joins from one network fit the public request budgets.
- [ ] Run a short quiz with at least two guest contexts: readiness threshold, five-second warning, answer submission, offline timeout, results and guest refresh all behave correctly.
- [ ] Verify host forwarding and client-IP handling: on a fresh signup limiter, a forged earlier `X-Forwarded-For` value must not reset the same client's exhausted budget. A second real network must get its own budget. If either fails, stop and inspect the actual ingress chain; do not switch to `trust proxy: true`.
- [ ] Check response CSP and caching in developer tools: HTML revalidates, fingerprinted assets cache, API responses use `no-store`. No CSP/WebSocket errors appear in the console.
- [ ] Restart during a disposable running quiz: guests reconnect to cancellation, the reason is visible, and no leaderboard is published. Old finished results remain available.
- [ ] Let the service sleep, visit again, record cold-start behaviour, and warm it before presenting. Do not promise an always-on demo.
- [ ] Measure the hosted 30–50 guest scenario separately from the local benchmark, review provider usage, and add the verified live URL/screenshots to the README.

Only deploy when no competition is running. Every release restarts the server; the agreed recovery rule cancels interrupted running competitions.

## Backups, restore and rollback

Saved data belongs in Neon, never Render's ephemeral filesystem. Before a schema change, take a PostgreSQL custom-format dump using PostgreSQL 18 client tools. Store the remote connection privately in the ignored file above and use a local terminal session with `DATABASE_URL` set; do not type the actual URL directly into shell history:

```sh
pg_dump --dbname="$DATABASE_URL" --format=custom --file=/private/tmp/quizzent-demo.dump
```

The dump contains account hashes, invitation/session hashes and quiz data. Keep it outside the repo. Restore into a **new empty database**, never over the live one:

```sh
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-privileges /private/tmp/quizzent-demo.dump
```

The destination variable must refer to that new database. Verify counts and login there, and revoke restored sessions before any public cutover. A restore drill is not complete until tested against a disposable hosted database. Do not assume a free plan's history window is a permanent backup.

To roll back application code, redeploy a previously verified commit after checking migration compatibility. Do not blindly run down migrations on user data. Logs intentionally omit secrets and request bodies; use Render's process logs and Neon usage/error dashboards, not public diagnostic endpoints.
