# Project decisions

## Purpose and approach

Quizzent is a learning and resume project. Build one feature at a time, keep the design simple, and explain unfamiliar concepts. TypeScript familiarity is basic; PostgreSQL is new; Socket.IO needs brief explanations.

## Confirmed requirements

- Stack: React with Vite and TypeScript, Tailwind CSS, TanStack Query, Express on Node.js, Socket.IO, and PostgreSQL.
- Use reusable components where they are useful and named CSS colour variables instead of inline colour values.
- Avoid blue branding. The current design uses deep plum, soft citron, and warm ivory.
- Keep generic UI in src/components/ and feature-specific UI in src/features/<feature>/components/; keep routes/providers and application chrome in src/app/.
- Organisers register through organiser signup. Superadmin privileges are never granted through public signup.
- Competitors join as guests. Open rooms accept a code or personal invitation; invitation-only rooms require a personal invitation.
- Suggest names from local English word lists. Guests may edit before joining. Nicknames are unique within a room after normalising whitespace and ignoring capitalisation.
- Give each participant a stable room number and UUID. Use a separate private browser session to restore membership for up to 24 hours.
- Show the organiser's private reference when a guest used their personal invitation; mark code-only joins unverified. Possession of a link does not establish real-world identity.
- Target 30–50 competitors per room, capped at 50 for the MVP. This is a target to validate, not a measured capacity guarantee.
- An organiser may host only one active room at a time.
- Every question in a competition uses the same organiser-configured time limit, defaulting to 10 seconds.
- Drafts use a compact library and dedicated create/edit pages, with manual saving and unsaved-change warnings.
- Draft title: trimmed 1–100 characters; optional description: trimmed up to 500 characters; question time: whole seconds from 5 to 120.
- The initial question editor uses four distinct options and one correct answer, with up to 100 questions, 1,000 characters per prompt, and 200 per option.
- Publication locks competition details, timing, questions, and answers. Opening a room reveals the title to guests; question contents remain private until the timed question flow is implemented.
- Count only currently ready competitors toward the minimum.
- After the configured lobby countdown expires, reaching the minimum triggers a short five-second start countdown.
- Every competitor receives all questions in a persisted, independently randomised sequence.
- One question at a time; submitted answers cannot be changed or revisited.
- Rank by correct answers first and total answer time second.
- Cancel an affected active competition after a material server outage. Show a clear server-outage reason.
- Prefer free hosting and avoid paid services during setup.

## Proposed defaults to confirm when implementing each feature

- If ready count drops below the minimum during the five-second start countdown, return to waiting. Start a fresh five seconds when enough competitors are ready again.
- Close admission once the competition starts.
- Timers continue through an individual competitor's disconnect; reconnecting restores the same guest attempt.
- Resolve unanswered questions as incorrect with a full question-time penalty. Use shared ranks for exact score/time ties.

## Outage handling note

A browser cannot reliably distinguish its own lost connection from a server outage. During loss of contact, show a connection problem. After recovery, the backend marks affected competitions cancelled and supplies the outage reason. For the initial single-server deployment, cancel running competitions left over from the previous server process rather than resuming their timers.

## Deferred until needed

Redis, microservices, multiple backend instances, question banks, advanced anti-cheating, team competitions, and configurable scoring engines.
