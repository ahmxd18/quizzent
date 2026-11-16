# Quizzent

A real-time online MCQ competition platform, built step by step as a learning and portfolio project.

## Current status

The frontend has a plum/citron theme, reusable UI primitives, a responsive homepage, and client-side routes. Organisers can sign up, log in, and manage private competition drafts. They can add/edit/remove four-option questions, choose one correct answer, and publish a validated competition to lock its content and timing. PostgreSQL stores accounts, hashed sessions, competitions, questions, and options. Room hosting and guest admission are next; sockets are not implemented yet.

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

The API now requires `DATABASE_URL`: copy `server/.env.example` to `server/.env` and configure your local credentials if not already set up. Node loads this ignored file for the backend. Start Postgres.app and apply migrations before signup requests. If you change `PORT`, also update Vite's proxy target. Never put backend secrets in frontend `VITE_` variables.

```sh
npm run lint       # Check for code issues
npm run build      # Build the frontend and type-check/compile the backend
npm run preview    # Preview the frontend build only
npm run start:server # Run the compiled backend after building
npm run db:check    # Verify the local PostgreSQL connection
npm run db:migrate  # Apply pending database migrations
npm run test:db     # Check migration/constraints in an isolated temporary schema
npm run test:server # Run schema, auth, and competition ownership/validation tests
```

Vite's `/api` proxy is local tooling, not a production API gateway. `preview` is also a local preview, not a deployment server. Production hosting and API routing will be configured in the deployment step; the backend currently binds to this computer only.

## Structure

```text
src/
  App.tsx              Root route composition
  main.tsx             React entry point
  app/                 Providers, routes, site shell, and not-found page
  components/ui/       Generic Button, TextField, Card, and Badge
  components/layout/   Generic PageContainer
  features/home/       Homepage sections and page composition
  features/join/       Guest join preview components and page
  features/auth/       Signup/login forms, session hooks, and protected routing
  features/organiser/  Protected organiser overview
  features/competitions/ Draft library, shared editor, API calls, and hooks
  features/questions/  Question workspace, editor, cards, API calls, and hooks
  styles/              Named colour tokens and shared base styles
  index.css            Stylesheet imports
  lib/query-client.ts  Shared TanStack Query cache
  lib/http.ts          Shared Axios JSON requests and API errors
server/
  src/app.ts           Express routes
  src/index.ts         Port configuration and local server startup
  tsconfig.json        Backend TypeScript build settings
  .env.example         Optional backend environment settings
  src/database.ts      PostgreSQL connection pool factory
  src/check-database.ts One-off database connection check
  migrations/          Numbered SQL changes
  tests/               Database integration tests
docs/
  project-decisions.md Confirmed scope and implementation notes
  development-plan.txt Ordered milestones and checks
  postgresql-setup.md   Local setup and plain-language database explanations
  database-schema.md    Account/session tables and migration commands
  organiser-signup.md   Signup API, hashing, validation, and frontend flow
  organiser-login.md    Login, cookies, session expiry, logout, and frontend flow
  competition-drafts.md Draft API, ownership, database fields, and editor behavior
  questions-and-publication.md Question IDs, transactions, publishing, and frozen content
  frontend-design.md    Palette options, contrast checks, and component boundaries
```

Keep generic primitives in `src/components/`. Feature-specific UI goes in `src/features/<feature>/components/`, with route-level composition in that feature's `pages/`. Application-wide routing/header/footer live in `src/app/`. Shared components must not import features. See the [frontend design guide](docs/frontend-design.md).

Routes: `/` (home), `/join`, `/login`, `/signup`, `/organiser` (requires login), `/organiser/competitions/new`, `/organiser/competitions/:id/edit`, `/organiser/competitions/:id/questions`, and a not-found fallback. Hosting must eventually serve `index.html` for frontend routes while preserving `/api` handling; the Vite development server already supports direct route loading.

To try authentication, create an account at `/signup`, continue to `/login`, and enter its email and password. Refresh `/organiser` to check session restoration, then log out. API clients testing login/logout must send `X-Quizzent-Request: 1` and retain the response cookie. See the [login guide](docs/organiser-login.md).

From `/organiser`, choose Create your first competition. Save a title, optional description, and question time (default 10 seconds, allowed 5–120). The draft appears in your library; select Edit draft to update it. Saving does not publish or open a room. See the [draft guide](docs/competition-drafts.md).

Choose Manage questions from the competition details. Save each question with four distinct options and one correct answer. Review before choosing Publish competition: publication permanently locks content/settings through the API and does not open a live room. See the [questions and publication guide](docs/questions-and-publication.md).

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Query, React Router, Lucide icons.
- Backend foundation: Node.js, Express, TypeScript, PostgreSQL via pg.
- Planned backend addition: Socket.IO.
- Hosting: aim for free or minimal cost; select providers when deployment is needed.

## A few explanations

- **Vite** runs the development server and prepares browser assets for deployment.
- **TypeScript** checks types before the application runs; external input still needs runtime validation.
- **Tailwind theme tokens** in `src/styles/tokens.css` create utilities such as `text-brand` and `bg-canvas`. Define colours there instead of repeating raw values in components. This uses [Tailwind's Vite plugin](https://tailwindcss.com/docs/installation/using-vite).
- **React Router** maps URLs to page components without a full-page reload. `Outlet` renders the current page inside the shared header/footer. Route changes update the page title and move focus to the new main content.
- **TanStack Query** manages account mutations and the current-session query. `QueryClientProvider` makes its shared cache available throughout React. Axios sends the HTTP requests.
- **PostgreSQL** stores related data in tables, roughly like linked spreadsheets. See the [local PostgreSQL guide](docs/postgresql-setup.md) for setup and the [schema guide](docs/database-schema.md) for the first tables.
- **Express** defines HTTP routes. `GET /api/health` responds with JSON, while unknown routes return a JSON 404. [Express introduction](https://expressjs.com/en/starter/hello-world/).
- **tsx** runs backend TypeScript during development. The build uses `tsc` to produce ordinary JavaScript in `server/dist/`. That is why `index.ts` imports `./app.js`: the import must still work after compilation.
- **NodeNext** tells TypeScript to follow Node's module rules for the backend, rather than the frontend bundler's rules.
- **The Vite proxy** forwards local `/api` requests to Express so the frontend can use relative URLs. It does not connect the database. [Vite proxy documentation](https://vite.dev/config/server-options.html#server-proxy).
- **Node's environment-file flag** loads `server/.env` if it exists, without requiring a dotenv dependency. [Node CLI documentation](https://nodejs.org/api/cli.html#--env-file-if-existsfile).

## Development workflow

The initial commit on `main` contains setup only. Continue work on a separate feature branch and merge reviewed changes through pull requests. Keep changes small and focused on one feature at a time.

Foundation, signup, login, and drafts were merged through [PR #1](https://github.com/ahmxd18/quizzent/pull/1), [PR #2](https://github.com/ahmxd18/quizzent/pull/2), [PR #3](https://github.com/ahmxd18/quizzent/pull/3), and [PR #4](https://github.com/ahmxd18/quizzent/pull/4). Question editing/publication is on `feature/question-editor`, based on updated `main`. Finish and merge each feature before starting its successor from main.

Explain unfamiliar TypeScript, Socket.IO, and PostgreSQL concepts briefly as they appear. Use short, natural code comments where they clarify a decision. Never commit real credentials or `.env` files.
