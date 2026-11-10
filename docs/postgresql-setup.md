# Local PostgreSQL setup

## What is ready on this Mac

- Postgres.app is installed in `~/Applications/Postgres.app`.
- PostgreSQL 18 runs locally on port 5432. Open Postgres.app to start or stop it.
- `quizzent_dev` is the development database.
- `quizzent` is its login and owner, without superuser, role-management, or database-creation privileges.
- The generated password is saved only in ignored `server/.env`, readable by this macOS user.
- Password authentication is required for this login's IPv4 localhost connection.
- No application tables exist yet. Account/session tables come in the first migration.

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

We will introduce the first tables in a separate change. No ORM, cloud database, or Redis is needed for this connection step.

Connection code follows [node-postgres pooling guidance](https://node-postgres.com/features/pooling).
