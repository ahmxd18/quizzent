# Questions and publication

Open an existing competition, then choose **Manage questions**. Save one question
at a time with a prompt, four distinct options, and one correct answer. Existing
questions can be edited or removed while the competition is a draft.

Limits: prompt 1–1,000 characters; each option 1–200 characters after trimming;
up to 100 saved questions. Option text must differ after trimming and ignoring
case. There is no reordering, bulk import, image upload, autosave, or unpublish flow.

## Publication

Review the saved answers, then choose **Publish competition** and confirm the lock.
At least one complete valid question is required. Publication checks stored data
again and records published_at. It freezes title, description, time limit, prompts,
options, correct answers, additions, and removals through the API. Repeated publish
or subsequent edits return 409. Published content remains owner-only; publishing
does not admit guests, generate a code, or open a live room.

## API

These endpoints inherit session, ownership, no-store, and write-request guards
from the competition router. Correct answers are returned only to the authenticated
owner; future competitor endpoints must use separate responses without keys.

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/competitions/:id/questions` | `{ questions }` |
| POST | `/api/competitions/:id/questions` | 201 `{ question }` |
| PUT | `/api/competitions/:id/questions/:questionId` | `{ question }` |
| DELETE | `/api/competitions/:id/questions/:questionId` | `{ message }` |
| POST | `/api/competitions/:id/publish` | `{ competition }`; send `{}` |

Question write example:

```json
{
  "prompt": "Which planet is known as the red planet?",
  "options": ["Mars", "Earth", "Venus", "Jupiter"],
  "correctOptionIndex": 0
}
```

The input index is zero-based (0 = A, 3 = D). The server assigns UUIDs; responses
contain each option's id/text and the correctOptionId. Editing preserves both the
question ID and its four option IDs. Callers cannot supply an owner, status, or IDs
in the body. Invalid input returns 400; missing or someone else's content returns
404; a frozen competition returns 409. Writes require X-Quizzent-Request: 1.

## PostgreSQL, briefly

Migration 0003 adds questions and question_options. Options reference their question;
the question references its one correct option using a composite foreign key.
That key includes both question ID and option ID, preventing a correct answer from
pointing into another question. Four-slot limits and unique positions are database
constraints; exactly four filled/distinct options are checked by saving/publication.

The correct-option foreign key is **deferred**: PostgreSQL checks it when the
transaction commits. We generate the IDs first, insert the question, and insert its
four options in that same transaction. If any step fails, none of the changes is
saved. See [deferred constraints](https://www.postgresql.org/docs/18/sql-set-constraints.html).

All question writes and publication use SELECT ... FOR UPDATE on the same owned
competition row. This is a row lock: another write to that competition waits until
the first transaction finishes, then rechecks its status. It prevents publication
from racing with edits. Other competitions can still be edited independently.
See [row locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS).

Migration 0004 adds the published state and timestamp. Database checks keep those
two fields consistent. Immutability is enforced at API/service boundaries; a trusted
database administrator can still change data directly. The down migration fails
when published rows exist rather than silently making them editable.

Both migrations are applied locally. Another installation should run npm run
db:migrate before starting the updated API. Existing organiser data is preserved.

## Code boundaries

- server/src/features/questions: schema, owner-scoped routes, and transactional writes.
- server/src/features/competitions/draft-transaction: shared draft lock and error type.
- server/src/features/competitions/publication.service: validation and publication.
- src/features/questions: API calls, query/mutation hooks, form, cards, and workspace.
- src/features/competitions: publication panel/hook and read-only details.
- Generic controls remain under src/components/ui. ConfirmDialog now supports
  custom action labels and pending state without embedding feature behavior.

The editor warns about unsaved navigation and cancellation. Publish is disabled
while editing; save or cancel the question first. Mutation retries are disabled to
avoid silently resubmitting an ambiguous request. On a publication connection
failure, refresh to check status before retrying. Draft concurrent edits still use
last-save-wins; there is no collaborative conflict resolution.

## Verification

Build and lint pass. All 39 database/API checks pass in disposable schemas. New
coverage includes validation, ownership, stable IDs, concurrent additions, a correct
answer belonging to another question, removal/cascade, invalid stored content at
publication, post-publication write rejection, and concurrent edit vs publication.

Browser checks covered create/edit, duplicate-option feedback/focus, unsaved-change
dialogs, publish cancellation/confirmation, read-only details/questions, refresh
persistence, disabled publication for empty drafts, and library status badges.
Question forms and published views fit 375px without horizontal scrolling. The
disposable account and linked competitions/questions/options/sessions were removed.
