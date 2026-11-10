# Quizzent

A real-time online MCQ competition platform, built step by step as a learning and portfolio project.

## Current status

Project setup only: React, TypeScript, Vite, Tailwind CSS, and a TanStack Query provider. The starting screen is a placeholder. Authentication, competitions, sockets, and the database are not implemented yet.

The frontend was scaffolded with `npm create vite@latest . -- --template react-ts --no-interactive`. Dependency versions are recorded in `package-lock.json`.

## Run locally

Use a supported Node.js version compatible with Vite (22.12+ or 24+).

```sh
npm ci
npm run dev
```

```sh
npm run lint       # Check for code issues
npm run build      # Check TypeScript and create the production build
npm run preview    # Preview that build locally
```

## Structure

```text
src/
  App.tsx              Starting screen
  main.tsx             React entry point and app providers
  index.css            Tailwind import, named colour tokens, and base styles
  lib/query-client.ts  Shared TanStack Query cache
docs/
  project-decisions.md Confirmed scope and implementation notes
```

Add reusable components to `src/components/` when there is an actual component to share. Keep feature-specific components beside their feature. Avoid creating empty layers in advance.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Query.
- Planned backend: Node.js, Express, TypeScript, Socket.IO, PostgreSQL.
- Hosting: aim for free or minimal cost; select providers when deployment is needed.

## A few explanations

- **Vite** runs the development server and prepares browser assets for deployment.
- **TypeScript** checks types before the application runs; external input still needs runtime validation.
- **Tailwind theme tokens** in `src/index.css` create utilities such as `text-brand` and `bg-canvas`. Define colours there instead of repeating raw values in components. This uses [Tailwind's Vite plugin](https://tailwindcss.com/docs/installation/using-vite).
- **TanStack Query** will manage data fetched from the backend. `QueryClientProvider` makes its shared cache available throughout React. No API calls are made yet.
- **PostgreSQL** will store related data in tables, roughly like linked spreadsheets. We will introduce its tables, constraints, and transactions with small examples when building the backend.

## Development workflow

The initial commit on `main` contains setup only. Continue work on a separate feature branch and merge reviewed changes through pull requests. Keep changes small and focused on one feature at a time.

Explain unfamiliar TypeScript, Socket.IO, and PostgreSQL concepts briefly as they appear. Use short, natural code comments where they clarify a decision. Never commit real credentials or `.env` files.
