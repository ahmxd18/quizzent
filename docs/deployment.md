# Free demo deployment

Live demo: **https://quizzent-076x.onrender.com**. One Render Free Node service and Neon Free PostgreSQL 18 are running in AWS Ohio. Manual deployments and Blueprint auto-sync remain off. See the dated evidence and remaining operational checks below.

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

For a fresh setup, create a **Blueprint** in Render and connect `ahmxd18/quizzent`, branch `release/dev`. The existing deployment is already configured; do not create a duplicate service. `render.yaml` defines one free Node service and no billable database/worker resources. Confirm the plan and region before creating it.

When prompted for `DATABASE_URL`, paste the Neon **direct** connection string into Render's environment-secret field. Render supplies `PORT` and `RENDER_EXTERNAL_URL`; the latter supplies the public HTTPS origin unless `PUBLIC_ORIGIN` is explicitly set.

| Setting | Value |
| --- | --- |
| Runtime | Node; `.node-version` pins the version used locally |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm run db:migrate && npm run start:server` |
| Health check | `/api/health` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY_HOPS` | `1`, trusting the immediate hosting ingress; on Render, also walk past Cloudflare's published CIDRs |
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

## Hosted evidence — 2026-11-23

The production source branch is `release/dev`; releases are manual. PR #20 was deployed successfully through the existing Blueprint on 2026-11-23. The Blueprint also tracks `release/dev`, with auto-sync off. The initial superadmin was provisioned with the existing local bootstrap service. Its previous organiser sessions were revoked; the owner must log in again. No password, cookie, database URL or dump is stored in the repository.

Verified against the public HTTPS service:

- Overview, direct login, organiser refresh, draft save, question editing and publication.
- Readiness over WSS, the five-second warning, answer submission, final results, guest refresh and logout.
- Production cookies: `__Host-` name, Secure, HttpOnly, SameSite=Lax, Path `/`.
- API `no-store`, HTML revalidation, CSP/HSTS, JSON API 404s, missing assets/dotfiles and rejection of foreign-origin writes. No document CSP errors during the UI journey.
- Desktop overview and mobile lobby/question/results passed axe WCAG A/AA scans, with no horizontal overflow in the tested viewports.
- A controlled deployment during a disposable running quiz cancelled it with `server_outage`; the guest result API reported cancellation. Previously finished 30/50-guest results remained persisted.
- A PostgreSQL 18 custom-format dump, taken with an exported repeatable-read snapshot, restored into a separate empty hosted database. Counts matched across all 16 public tables. The dump is private, outside this repository, with file permissions 600. This verifies data restoration, not a public cutover or restored-account login.

### Measured workload

Isolated Chromium contexts supplied real HTTPS cookie sessions and HTTP requests; Socket.IO clients supplied WSS lobby readiness. Each participant answered two questions, retried an accepted answer and let the third question time out. Each question allowed 10 seconds. The client ran from the developer's machine; latency includes network and browser-automation overhead.

| Competitors | Scenario errors | Answer p95 | Answer maximum | Result publication lag |
| --- | --- | --- | --- | --- |
| 30 | 0 | 1,041 ms | 1,048 ms | 297 ms |
| 50 | 0 | 1,086 ms | 1,506 ms | 371 ms |

The final release rerun on `fb9f0c4` also passed with zero scenario errors: 30 competitors had answer p95 **691 ms**, maximum **876 ms**, publication lag **688 ms**; 50 competitors had p95 **1,274 ms**, maximum **1,316 ms**, publication lag **706 ms**. The complete UI/accessibility journey passed again after the cutover.

These initial measurements used commit `0350bb3`. Read-only hosted database checks confirmed 30/50 participant results and 90/150 answer-or-timeout resolutions. They demonstrate this short single-room scenario, not sustained load, multiple-room capacity or an availability guarantee.

Earlier attempts used Node HTTP clients. The independent 30-guest run passed with answer p95 8,778 ms; the 50-guest run missed deadlines and received expected stale-answer 409 responses. A separate 20-request Chromium experiment completed in 547–768 ms, prompting the browser-HTTP rerun. The cause of the transport-dependent slowdown is unresolved. Do not present the successful browser measurement as proof that all clients or networks behave identically.

### Repeat the checks

Only target your own deployment, between real competitions. These commands create labelled accounts/competitions and saved results; they do not erase existing data. Install Edge, or set `BROWSER_CHANNEL` / `BROWSER_EXECUTABLE` for an installed Chromium browser.

```sh
QUIZZENT_HOSTED_ORIGIN=https://quizzent-076x.onrender.com npm run test:hosted
QUIZZENT_HOSTED_ORIGIN=https://quizzent-076x.onrender.com npm run test:hosted:browser
```

The hosted commands deliberately do not load local database credentials. Screenshots go to the system temporary directory unless `BROWSER_ARTIFACTS` is configured. The scenario uses the real server deadlines and timeout worker; it does not change application timing rules.

### Proxy handling and remaining operations

The initial one-hop setting produced rotating rate-limit partition keys for one browser. The first Cloudflare-only correction also left those partitions rotating, because Render appends a private load-balancer address too. Render routes requests through Cloudflare and its load balancer. The fix trusts the immediate ingress and, only with Render's platform `RENDER=true` marker and `TRUST_PROXY_HOPS=1`, Cloudflare's published address ranges and the private 10/8 load-balancer address immediately after the socket peer. Other private addresses earlier in the chain are not trusted. This private-ingress position also appears in [Arcjet's captured Render request](https://github.com/arcjet/arcjet-js/issues/3899). Express then stops at the first untrusted visitor address, before caller-supplied earlier entries. Direct/local deployments do not enable this extra trust. Never set `trust proxy: true` or choose an arbitrary larger hop count. Recheck the CIDRs when changing hosting or adding another proxy. [Render ingress](https://render.com/articles/how-render-handles-ddos-attacks), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/), [Cloudflare ranges](https://www.cloudflare.com/ips/).

- [x] Verified on release commit `fb9f0c4`: one stable budget across requests, then signup 429 with Retry-After. Forged earlier `X-Forwarded-For` values retained that exhausted budget. Requests also forging provider-specific client-IP headers were rejected with 403; they did not obtain a fresh budget.
- [ ] Confirm independent budgets from a second real network. Local regression tests cover distinct visitor addresses; a physical second-network check remains separate.
- [ ] Record a timed cold start after at least 15 idle minutes. An earlier sleeping-service request resumed successfully, but its wake-up time was not measured.
- Review Render/Neon usage before interviews and after load tests. Quota exhaustion was not deliberately triggered, because it could suspend the demo. Free plans and database auto-suspend remain enabled; no uptime pinger or paid resources were added.

Only deploy when no competition is running. Every release restarts the server; the agreed recovery rule cancels interrupted running competitions. Keep a local demo/screenshots ready for cold starts, quota limits or provider outages.

## Backups, restore and rollback

Saved data belongs in Neon, never Render's ephemeral filesystem. Before a schema change, take a PostgreSQL custom-format dump using PostgreSQL 18 client tools. Store the remote connection privately in the ignored file above and use a local terminal session with `DATABASE_URL` set; do not type the actual URL directly into shell history:

```sh
pg_dump --dbname="$DATABASE_URL" --format=custom --file=/private/tmp/quizzent-demo.dump
```

The dump contains account hashes, invitation/session hashes and quiz data. Keep it outside the repo. Restore into a **new empty database**, never over the live one:

```sh
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-privileges /private/tmp/quizzent-demo.dump
```

The destination variable must refer to that new database. Verify counts and login there, and revoke restored sessions before any public cutover. The 2026-11-23 drill verified hosted schema/data counts; restored login/cutover was not attempted. Two isolated restore-test databases remain disconnected from the application; inspect and remove them in Neon when no longer needed. Do not assume a free plan's history window is a permanent backup.

To roll back application code, redeploy a previously verified commit after checking migration compatibility. Do not blindly run down migrations on user data. Logs intentionally omit secrets and request bodies; use Render's process logs and Neon usage/error dashboards, not public diagnostic endpoints.

## Deploy your next code change

`release/dev` is the production branch despite the `/dev` name. It is not a second development environment, and it still uses the same live Neon database. `main` is the integration branch: code can be merged there without changing the website.

1. Start from updated `main`, then create a feature branch:

   ```sh
   git switch main
   git pull --ff-only origin main
   git switch -c codex/your-change
   ```

2. Make one focused change, test it locally, and commit small pieces. Run `npm run lint` and `npm run build`. For backend changes, run `npm run test:server` against the **local development database**; use load/browser checks when the change affects those flows. Keep `server/.env` pointed at local PostgreSQL, never production for these tests.
3. Push the feature branch and open a GitHub PR with **base `main`**, **compare your feature branch**. Review the diff and merge after checks pass. Do not commit directly to `release/dev`.
4. Open a second PR with **base `release/dev`**, **compare `main`**. Title it for the release and check every included commit. Merge using **Create a merge commit** so the long-lived branches retain shared ancestry; avoid repeatedly squash-merging `main` into the release branch.
5. Before deploying, check the admin directory for running quizzes. Do not release during one: a server restart deliberately cancels it. If the release includes a database migration, take a private backup first and review compatibility. A migration is a versioned SQL change in `server/migrations/`; startup applies new ones automatically. Do not edit an already-applied migration.
6. Open the [Render service](https://dashboard.render.com/web/srv-dc0psrks728c73b18np0). Confirm Settings → Branch is **`release/dev`** and Auto-Deploy is **Off**. Select **Manual Deploy → Deploy latest commit**. Check that the displayed commit is the release PR's merge commit. A normal release does not need a cleared build cache. [Manual deploys](https://render.com/docs/deploys#manual-deploys).
7. Follow the deploy logs. Render installs dependencies, builds both apps, runs pending migrations, and starts the server. Wait for **Live**; a successful merge alone does not mean the website is updated.
8. Open `/api/health`, log in, refresh a page, and run a short disposable organiser/guest quiz. Check results and logs. Run the hosted test commands above only when you intend to create their labelled test data.
9. If a release fails, inspect its error before retrying. For incompatible behaviour, redeploy a previous verified commit from Render's Events/deploy controls **only after checking database compatibility**. Redeploying old code does not undo schema changes. Prepare a forward fix in a new feature PR and repeat this flow.

The branch rule requires PRs, resolved conversations, and applies to administrators. Force pushes and deletion are disabled. Required approvals are not enabled because a solo PR author cannot approve their own PR. No automated required CI check has been configured; the commands above are currently a manual release gate. A repository owner can still edit protection settings, so this is protection against accidental direct pushes, not an immutable security boundary. [GitHub protections](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

Blueprint auto-sync is also off. If a future change edits `render.yaml`, explicitly review/sync the Blueprint separately; merging that file and manually deploying application code does not automatically apply every infrastructure setting.
