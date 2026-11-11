# Competition drafts

The organiser library at `/organiser` lists private drafts, newest update first.
Create at `/organiser/competitions/new`; edit at
`/organiser/competitions/:id/edit`. Saving returns to the library with confirmation.
Drafts do not publish, generate room codes, or admit competitors.

## Fields

- Title: required, trimmed, 1–100 characters.
- Description: optional, trimmed, at most 500 characters; defaults to empty text.
- Time per question: whole seconds from 5 to 120, default 10. Applies to every question.

Question editing and publication are available through Manage questions; see
[the question guide](questions-and-publication.md). Lobby and admission settings
will be introduced with room hosting. There is no autosave, deletion, duplication,
search, or filtering in this slice.

## API

All endpoints require an active server-side session. Writes also require JSON and
`X-Quizzent-Request: 1`; cross-site requests are rejected. Responses use no-store.

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/competitions` | `{ competitions: [...] }`, only the current account's drafts |
| POST | `/api/competitions` | 201 `{ competition }` |
| GET | `/api/competitions/:id` | `{ competition }` |
| PUT | `/api/competitions/:id` | `{ competition }`, replaces the editable settings |

Example write body:

```json
{
  "title": "Friday Brainstorm",
  "description": "A friendly challenge for curious minds.",
  "questionTimeSeconds": 10
}
```

Omitted description/question time use their defaults. Unknown fields, including
owner and status, are rejected. Validation errors return 400 with fieldErrors;
missing and other organisers' drafts both return 404. Bad UUIDs return 400,
unauthenticated/expired/suspended sessions return 401, unsupported content returns
415, oversized bodies return 413, and internal failures use the shared generic 500.

The server obtains the owner ID from its validated session, never from the body.
Read/update SQL includes both draft ID and owner ID. A frontend route guard alone
does not protect data. The shared session helpers now also protect competition APIs.

## PostgreSQL, briefly

Migration `0002_competition-drafts.sql` creates `competitions`:

- `id`: a generated UUID identifying the draft.
- `organiser_id`: a foreign key linking it to `users.id`. An absent account cannot
  own a draft. Deleting the account cascades to its drafts.
- `title`, `description`, `question_time_seconds`: editable values with database
  constraints, giving a second check behind API validation.
- `status`: draft or published after migration 0004; published_at records publication.
- `created_at`, `updated_at`: timestamps with time zone. Creation defaults come
  from PostgreSQL; the update service explicitly advances updated_at on each save.

The owner/update index helps PostgreSQL find an account's drafts in library order.
An index is a lookup structure; it does not grant access or replace ownership checks.

Apply on another installation with `npm run db:migrate`. It is already applied
locally. Existing accounts and sessions are preserved. The down migration removes
drafts, so rollback is tested only in disposable schemas.

## Frontend boundaries

- `features/competitions/api`: typed HTTP requests through the shared Axios helper.
- `hooks/useCompetitions`: list/detail queries, save mutation, cache invalidation,
  and expired-session handling. Save requests are not retried automatically.
- `CompetitionList`, `CompetitionListItem`, `CompetitionEmptyState`: the library.
- `CompetitionEditor`: page composition; `CompetitionForm`: shared create/edit form.
- `useUnsavedChanges`: React Router navigation blocking and browser unload warning.
- Generic `TextareaField` and `ConfirmDialog` live under `src/components/ui/`.

The existing React Router package now uses createBrowserRouter/RouterProvider so
the supported useBlocker hook can guard navigation. TanStack Query still handles
API state. The themed HTML dialog traps focus, focuses Keep editing, and supports
Escape; the browser controls refresh/close warning wording and availability.
There is no recovery guarantee if the browser or device terminates unexpectedly.

A failed background session check keeps an existing editor mounted. A definitive
401 signs the user out. Background draft refreshes do not replace form input.

Initial scope: the library is unpaginated, and concurrent edits use last-save-wins.
There is no conflict-resolution/version check or offline save queue. These can be
added when needed; this feature does not claim to support collaborative editing.

## Verification

Build and lint pass. All 39 database/API checks now pass in disposable schemas, covering
the migration, defaults/constraints, ownership on list/read/update, injected fields,
validation, malformed/oversized requests, ordering, and suspended/expired sessions,
alongside existing signup/session checks.

Browser checks covered empty state, create, edit, refresh persistence, focused
validation feedback, repeated Keep editing/Discard changes, and the unsaved-refresh
warning. Dialog focus restoration was observed. Library/editor layouts fit a 375px
viewport without horizontal overflow. The disposable account and linked drafts and
sessions were removed; existing organiser data was preserved.
