# Quiz attempts and answers

When a room starts, PostgreSQL assigns each admitted guest their own question order and option order. The guest sees one question at a time with a progress label. After the last answer, the guest sees how many answers were saved.

## What PostgreSQL saves

| Table | What it holds |
| --- | --- |
| `quiz_attempts` | One row per admitted participant, with their total questions and next question position. |
| `quiz_attempt_questions` | The saved question sequence and the four option IDs in display order for each question. |
| `quiz_answers` | The selected option and request ID for each answered question. |

The start transaction saves the starting roster and the assignments together. Each guest gets a separate shuffle, and their order stays the same on refresh. Migration `0007` also assigns questions to admitted guests in any room that has already started and remains open.

## Why a retry is safe

The guest's cookie identifies which attempt to load. The read endpoint returns the current prompt and options, or progress if the guest has finished. Correct options, future questions, and other guests' answers stay on the server.

The browser sends the current question ID, selected option ID, and a request ID. The server briefly locks that guest's attempt row. A second submission for the same guest waits for the first, while other guests can keep answering. In the same transaction, PostgreSQL saves the answer and moves the guest to the next question. Either both changes succeed or both are rolled back.

If the server saves an answer but the response is lost, the browser can resend the same request ID and choice. The server recognises the saved request and returns current progress without a second write. If someone tries to submit a different answer after the question has advanced, the server rejects it.

Run `npm run db:migrate` after pulling this change. Per-question deadlines and automatic timeouts arrive in Step 13.
