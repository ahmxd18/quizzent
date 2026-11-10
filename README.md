# Quizzent

A real-time online MCQ competition platform, built step by step as a learning and portfolio project.

## Current status

Frontend setup: React, TypeScript, Vite, Tailwind CSS, and a TanStack Query provider. The starting screen is a placeholder. A small Express/TypeScript API provides a health endpoint. PostgreSQL connection setup is ready; application tables, authentication, competitions, and sockets are not implemented yet.

Follow [the ordered development plan](docs/development-plan.txt) for the next steps.

The frontend was scaffolded with `npm create vite@latest . -- --template react-ts --no-interactive`. Dependency versions are recorded in `package-lock.json`.

## Run locally

Use a supported Node.js version compatible with Vite (22.12+ or 24+).

```sh
npm ci
npm run dev
```

In a second terminal, from the same project folder:

```sh
npm run dev:server
```

The API runs at `http://127.0.0.1:3001`. Open `/api/health` on the frontend's Vite URL to check the development proxy, or call the API directly:

```sh
curl http://127.0.0.1:3001/api/health
```

Expected response: `{"status":"ok","service":"quizzent-api"}`. This checks the API process only; it does not check PostgreSQL.

Optionally copy `server/.env.example` to `server/.env`. Node loads this file for the backend; it is ignored by Git. If you change `PORT`, also update Vite's proxy target. Never put backend secrets in frontend `VITE_` variables.

```sh
npm run lint       # Check for code issues
npm run build      # Build the frontend and type-check/compile the backend
npm run preview    # Preview the frontend build only
npm run start:server # Run the compiled backend after building
npm run db:check    # Verify the local PostgreSQL connection
```

Vite's `/api` proxy is local tooling, not a production API gateway. `preview` is also a local preview, not a deployment server. Production hosting and API routing will be configured in the deployment step; the backend currently binds to this computer only.

## Structure

```text
src/
  App.tsx              Starting screen
  main.tsx             React entry point and app providers
  index.css            Tailwind import, named colour tokens, and base styles
  lib/query-client.ts  Shared TanStack Query cache
server/
  src/app.ts           Express routes
  src/index.ts         Port configuration and local server startup
  tsconfig.json        Backend TypeScript build settings
  .env.example         Optional backend environment settings
  src/database.ts      PostgreSQL connection pool factory
  src/check-database.ts One-off database connection check
docs/
  project-decisions.md Confirmed scope and implementation notes
  development-plan.txt Ordered milestones and checks
  postgresql-setup.md   Local setup and plain-language database explanations
```

Add reusable components to `src/components/` when there is an actual component to share. Keep feature-specific components beside their feature. Avoid creating empty layers in advance.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Query.
- Backend foundation: Node.js, Express, TypeScript, PostgreSQL via pg.
- Planned backend addition: Socket.IO.
- Hosting: aim for free or minimal cost; select providers when deployment is needed.

## A few explanations

- **Vite** runs the development server and prepares browser assets for deployment.
- **TypeScript** checks types before the application runs; external input still needs runtime validation.
- **Tailwind theme tokens** in `src/index.css` create utilities such as `text-brand` and `bg-canvas`. Define colours there instead of repeating raw values in components. This uses [Tailwind's Vite plugin](https://tailwindcss.com/docs/installation/using-vite).
- **TanStack Query** will manage data fetched from the backend. `QueryClientProvider` makes its shared cache available throughout React. No API calls are made yet.
- **PostgreSQL** stores related data in tables, roughly like linked spreadsheets. The connection is ready; tables come next. See the [local PostgreSQL guide](docs/postgresql-setup.md) for setup and terminology.
- **Express** defines HTTP routes. `GET /api/health` responds with JSON, while unknown routes return a JSON 404. [Express introduction](https://expressjs.com/en/starter/hello-world/).
- **tsx** runs backend TypeScript during development. The build uses `tsc` to produce ordinary JavaScript in `server/dist/`. That is why `index.ts` imports `./app.js`: the import must still work after compilation.
- **NodeNext** tells TypeScript to follow Node's module rules for the backend, rather than the frontend bundler's rules.
- **The Vite proxy** forwards local `/api` requests to Express so the frontend can use relative URLs. It does not connect the database. [Vite proxy documentation](https://vite.dev/config/server-options.html#server-proxy).
- **Node's environment-file flag** loads `server/.env` if it exists, without requiring a dotenv dependency. [Node CLI documentation](https://nodejs.org/api/cli.html#--env-file-if-existsfile).

## Development workflow

The initial commit on `main` contains setup only. Continue work on a separate feature branch and merge reviewed changes through pull requests. Keep changes small and focused on one feature at a time.

Explain unfamiliar TypeScript, Socket.IO, and PostgreSQL concepts briefly as they appear. Use short, natural code comments where they clarify a decision. Never commit real credentials or `.env` files.
