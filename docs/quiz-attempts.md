# Quiz attempts and answers

When a room starts, PostgreSQL assigns each admitted guest their own question order and option order. The guest sees one question at a time with a progress label. After the last answer, the guest sees how many answers were saved.

## What PostgreSQL saves

| Table | What it holds |
| --- | --- |
| `quiz_attempts` | One row per admitted participant, with their next question position and its issue time and deadline. |
| `quiz_attempt_questions` | The saved question sequence and the four option IDs in display order for each question. |
| `quiz_answers` | Each answer or timeout, with the original question window and its resolution time. |

The start transaction saves the starting roster and the assignments together. Each guest gets a separate shuffle, and their order stays the same on refresh. Migration `0007` also assigns questions to admitted guests in any room that has already started and remains open.

## Why a retry is safe

The guest's cookie identifies which attempt to load. The read endpoint returns the current prompt and options, or progress if the guest has finished. Correct options, future questions, and other guests' answers stay on the server.

The browser sends the current question ID, selected option ID, and a request ID. The server briefly locks that guest's attempt row. A second submission for the same guest waits for the first, while other guests can keep answering. In the same transaction, PostgreSQL saves the answer and moves the guest to the next question. Either both changes succeed or both are rolled back.

If the server saves an answer but the response is lost, the browser can resend the same request ID and choice. The server recognises the saved request and returns current progress without a second write. If someone tries to submit a different answer after the question has advanced, the server rejects it.

## Question deadlines and reconnecting

Every question uses the published competition's time limit, which defaults to 10 seconds. The browser displays the remaining time from the server response. PostgreSQL supplies the time used to accept submissions. At the deadline or later, the question has expired. The server checks this after acquiring the same attempt lock for both answering and timing out.

An answer starts the next question's timer when the server accepts it. A timeout uses the full limit, and the next timer starts at the expired deadline. For example, with a 10-second limit, a guest who goes offline at the beginning and returns 24 seconds later has missed two questions and has about six seconds left on question three. The saved question order stays the same.

A background task advances expired attempts. A refresh or a submission also checks for missed deadlines before returning. If the task runs late, it uses the original deadlines to catch up. A timeout is stored as an unanswered question with its resolution time set to the deadline.

Run `npm run db:migrate` after pulling Step 13. Migration `0008` gives any current question in an existing open attempt a fresh window. Previously saved answers keep their original submission times and have no recorded question window. Ranking arrives in Step 14.
