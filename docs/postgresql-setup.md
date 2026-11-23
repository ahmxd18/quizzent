# Local PostgreSQL setup

## What is ready on this Mac

- Postgres.app is installed in `~/Applications/Postgres.app`.
- PostgreSQL 18 runs locally on port 5432. Open Postgres.app to start or stop it.
- `quizzent_dev` is the development database.
- `quizzent` is its login and owner, without superuser, role-management, or database-creation privileges.
- The generated password is saved only in ignored `server/.env`, readable by this macOS user.
- Password authentication is required for this login's IPv4 localhost connection.
- The first migration creates `users` and `user_sessions`. See the [schema guide](database-schema.md) for fields and commands.

Run from the project folder:

```sh
npm run db:check
```

Expected output: `PostgreSQL connection successful.`

The command executes `SELECT 1`, a tiny SQL query that returns the number 1 without creating or changing data. It closes its connections afterward. It exits unsuccessfully when configuration is missing or the connection fails.

The existing `/api/health` endpoint still checks the API process only. It does not promise that PostgreSQL is available.

## The new code, briefly

- `server/src/database.ts` creates a **pool**: a small group of reusable connections. Create one pool for the backend, not one per request. The check command creates its own short-lived pool.
- `max: 5` limits connections, not competitors. Many short queries can share those connections. This is an initial setting, not a capacity guarantee.
- `connectionTimeoutMillis: 5000` stops connection attempts waiting indefinitely.
- `server/src/check-database.ts` runs a query and closes the pool in `finally`, which runs on both success and failure.
- `DATABASE_URL` describes the login, address, port, and database. Keep it server-side; never expose it as a frontend `VITE_` variable or log it.

```text
postgresql://USERNAME:PASSWORD@127.0.0.1:5432/DATABASE_NAME
```

If entering a password manually, URL-encode special characters. For example, `@` inside the password must become `%40`. The generated local password uses only hexadecimal characters, avoiding this issue.

## Reproduce on another Mac

These installation and SQL steps are already done on this computer. Do not rerun them here.

1. Download the stable PostgreSQL 18 version from [Postgres.app](https://postgresapp.com/downloads.html), place it in your personal Applications folder, open it, and click Initialize. Do not initialise over an existing database directory.
2. Open its SQL terminal using the full path, so no system PATH changes are needed:

   ```sh
   "$HOME/Applications/Postgres.app/Contents/Versions/latest/bin/psql" -h 127.0.0.1 -d postgres
   ```

3. Create a separate application login and database:

   ```sql
   CREATE ROLE quizzent LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
   ```

   In that same SQL terminal, run `\password quizzent` and enter a new local development password. Then:

   ```sql
   CREATE DATABASE quizzent_dev OWNER quizzent;
   ```

4. In Postgres.app, use Server Settings to locate the HBA file (`pg_hba.conf`). This file decides how connections authenticate. Add this rule before the existing localhost rules:

   ```text
   host quizzent_dev quizzent 127.0.0.1/32 scram-sha-256
   ```

   This requires a password for this database/login/address. Leave unrelated rules unchanged. In the administrative SQL terminal, apply the configuration with `SELECT pg_reload_conf();`, then exit with `\q`.

5. Copy `server/.env.example` to `server/.env` and set your local credentials in `DATABASE_URL`. Run `npm run db:check`.

Postgres.app may ask permission for a local SQL client to connect during initial setup. Do not disable its permission protection. See its [installation guide](https://postgresapp.com/documentation/install.html) and [client permissions guide](https://postgresapp.com/documentation/app-permissions.html).

## Basic terms for the next step

- **Database:** the container for Quizzent's stored data.
- **Table:** rows of a particular kind of data, such as organiser accounts.
- **Primary key:** the value that identifies one row.
- **Unique constraint:** a database rule that rejects duplicates, even when requests arrive together.
- **Migration:** a numbered file that records a database structure change so another installation can apply the same change.
- **Transaction:** several database changes that either all succeed or all get rolled back.

The first tables are defined in a numbered SQL migration. `node-pg-migrate` tracks which files have run; it is not an ORM. No cloud database or Redis is needed.

Connection code follows [node-postgres pooling guidance](https://node-postgres.com/features/pooling).


## View the live production database

The hosted website uses **Neon**, not the PostgreSQL server inside Postgres.app on your Mac. Postgres.app starts a local database server; its `psql` client can also connect to Neon. The website's superadmin screens show permitted application data, while Neon's console gives direct database access.

### Easiest: Neon in your browser

1. Sign in at https://console.neon.com and open the **quizzent** project.
2. Select the **production** database branch. A Neon database branch is separate from a GitHub code branch: `release/dev` does not rename or replace it.
3. Open **SQL Editor**, select database **`neondb`**, and the existing owner role. Do not select either restore-verification database: those are isolated backup-test copies, not the database Render uses.
4. Run this first to confirm the connection:

   ```sql
   SELECT current_database(), current_user;
   ```

   The database should be `neondb`. Then inspect safe account fields:

   ```sql
   SELECT id, display_name, email, role, status, created_at
   FROM public.users
   ORDER BY created_at DESC
   LIMIT 20;
   ```

   `SELECT` reads rows; `ORDER BY` puts newest rows first; `LIMIT` keeps the result small. `public` is the schema — a namespace containing the app's tables. Passwords are not stored in readable form; avoid exporting password/session hashes or using `SELECT *` for account tables.
5. To inspect competitions and rooms:

   ```sql
   SELECT id, title, status, created_at
   FROM public.competitions
   ORDER BY created_at DESC
   LIMIT 20;

   SELECT id, code, status, started_at, closed_at
   FROM public.rooms
   ORDER BY created_at DESC
   LIMIT 20;
   ```

6. To browse tables visually, use Neon's **Tables** view, choose `neondb` and `public`, then open a table. Some table tools allow inline edits: use SQL `SELECT` for inspection when you want to avoid accidental changes. Console labels may change; [Neon's SQL Editor guide](https://neon.com/docs/get-started/query-with-neon-sql-editor) is the reference.

### Optional: connect from your Mac's terminal

1. In the same Neon project, click **Connect** and select **production → neondb → neondb_owner**. Choose the direct/unpooled connection for administrative tools. Keep the password in the console/password manager; do not paste the connection string into chat, source code, screenshots or shell history.
2. Open the Postgres.app `psql` client or a terminal with its PostgreSQL 18 tools on PATH. Use the host shown in Connect (without a password in the command):

   ```sh
   PGOPTIONS='-c default_transaction_read_only=on' psql -X \
     "host=YOUR_NEON_HOST dbname=neondb user=neondb_owner sslmode=verify-full" -W
   ```

   Replace `YOUR_NEON_HOST` with the host from Connect. `-W` prompts privately for the database password; it is not your Quizzent login password. `sslmode=verify-full` encrypts the connection and checks the server certificate. The `PGOPTIONS` setting makes this inspection session read-only by default; it is a guardrail, not a restricted database role, and an owner can override it.
3. Run `SELECT current_database(), current_user;`, then the sample queries above. `\dt public.*` lists tables; `\d public.users` shows columns; `\q` disconnects.

For routine app actions, use Quizzent's admin UI: it enforces rules and records audited changes. Direct SQL writes bypass those application checks. Keep production credentials separate from `server/.env` and local tests. If you later need a permanently restricted viewer, create a dedicated read-only database role instead of sharing the owner credential. An application superadmin and a PostgreSQL owner are different roles in different systems.
