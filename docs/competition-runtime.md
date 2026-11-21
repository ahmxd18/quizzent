# Competition runtime

Room admission is covered in [room admission](room-admission.md). This guide follows a joined guest through readiness, timed answers, results and cancellation.

## Lobby and readiness

Open a room from a published competition. In a separate browser profile, join by code or personal invitation. The organiser sees the guest appear in the roster automatically. Click **I’m ready** as the guest to update both screens, or **Mark as not ready** to change your choice.

### How the count works

- **Joined** counts saved room memberships in PostgreSQL. Leaving the lobby preserves that record.
- **Online** counts distinct participants with a live connection. Each tab has its own connection, but tabs in the same guest session share a participant ID.
- **Ready** counts only the online participants who selected **I’m ready**. If the server detects that the last tab disconnected, the guest drops out of both live counts.
- A guest who reconnects within eight seconds of the server detecting their disconnect gets their last ready choice back. After that, they can mark themselves ready again. If a network connection disappears without warning, Socket.IO's built-in heartbeat detects it, normally within about ten seconds.

### How it fits together

The existing HTTP routes still handle joins, invitations, and room history. Socket.IO keeps a connection open so the server can send a lobby snapshot whenever something changes. The browser sends a ready event and waits for an acknowledgement, which is the server's reply confirming or rejecting the change. Host pages fetch the private roster through the existing authorised HTTP route when admission changes. Guest sockets receive their own readiness and the room totals.

The server checks the existing session cookie and looks up the organiser's room ownership or the guest's room membership before subscribing. Readiness lives in memory on our single backend process and resets on a restart. Room membership and the organiser's saved roster stay in PostgreSQL, so there is no new migration for this step.

Vite proxies both HTTP requests and the `/socket.io` WebSocket connection to the same backend. The browser connects using the app's origin. A future production proxy must preserve the public host and forward WebSocket upgrades. See the [Socket.IO server options](https://socket.io/docs/v4/server-options/).

### Automatic start

When opening a room, the organiser sets the lobby duration and minimum number of ready guests. The defaults are 60 seconds and two ready guests. Setting the duration to zero skips the initial timer. Once the lobby timer ends and enough guests are online and ready, the server starts a five-second warning. If readiness drops below the minimum during that warning, the server waits for the minimum and begins a fresh warning.

PostgreSQL stores the lobby deadline, warning deadline, and committed start time. The browser displays the deadlines using the server time from Socket.IO. On the server, joining, closing, and starting all lock the same room row. A lock lets one of those operations work on the room at a time. The start transaction rechecks readiness, saves the starting roster, and closes admission together. After commit, participants can refresh to see whether they were admitted. A warning saved before a server restart is checked against current readiness when the lobby is next opened in a browser.

## Attempts and answers

When a room starts, PostgreSQL assigns each admitted guest their own question order and option order. The guest sees one question at a time with a progress label. After the last answer, the guest sees how many answers were saved.

### What PostgreSQL saves

| Table | What it holds |
| --- | --- |
| `quiz_attempts` | One row per admitted participant, with their next question position and its issue time and deadline. |
| `quiz_attempt_questions` | The saved question sequence and the four option IDs in display order for each question. |
| `quiz_answers` | Each answer or timeout, with the original question window and its resolution time. |

The start transaction saves the starting roster and the assignments together. Each guest gets a separate shuffle, and their order stays the same on refresh.

### Why a retry is safe

The guest's cookie identifies which attempt to load. The read endpoint returns the current prompt and options, or progress if the guest has finished. Correct options, future questions, and other guests' answers stay on the server.

The browser sends the current question ID, selected option ID, and a request ID. The server briefly locks that guest's attempt row. A second submission for the same guest waits for the first, while other guests can keep answering. In the same transaction, PostgreSQL saves the answer and moves the guest to the next question. Either both changes succeed or both are rolled back.

If the server saves an answer but the response is lost, the browser can resend the same request ID and choice. The server recognises the saved request and returns current progress without a second write. If someone tries to submit a different answer after the question has advanced, the server rejects it.

### Question deadlines and reconnecting

Every question uses the published competition's time limit, which defaults to 10 seconds. The browser displays the remaining time from the server response. PostgreSQL supplies the time used to accept submissions. At the deadline or later, the question has expired. The server checks this after acquiring the same attempt lock for both answering and timing out.

An answer starts the next question's timer when the server accepts it. A timeout uses the full limit, and the next timer starts at the expired deadline. For example, with a 10-second limit, a guest who goes offline at the beginning and returns 24 seconds later has missed two questions and has about six seconds left on question three. The saved question order stays the same.

A background task advances expired attempts. A refresh or a submission also checks for missed deadlines before returning. If the task runs late, it uses the original deadlines to catch up. A timeout is stored as an unanswered question with its resolution time set to the deadline.

## Results and organiser progress

The organiser dashboard shows how many questions each admitted guest has resolved and how many guests have finished. Both a submitted answer and a timeout count as a resolved question. A guest who finishes early waits for the rest of the starting roster.

Once everyone has finished, the server recalculates each score from the saved answers. PostgreSQL saves the leaderboard and closes the room in one transaction, which also frees the organiser to host again. Retrying publication leaves the saved leaderboard intact.

### Ranking

The most correct answers wins. If two guests have the same score, the lower total answer time ranks higher. Total time covers all questions, including the full allotted time for each timeout. Guests who match on both score and time share a rank, so the next row after two first places is third.

Some answers saved before Step 13 have no question window. Those attempts show **Time unavailable**. Within the same score, known times come before unavailable times. Older rooms already closed before results existed keep their existing room record.

### Who can see what

- The organiser can see progress while guests answer and the final leaderboard afterward.
- Admitted guests can see the final leaderboard and review their own answers after publication.
- Other guests’ choices and the organiser’s invitation references are kept private. A cancellation leaves the room record available without a final leaderboard.

Apply all pending migrations before starting the API. Migration `0009` adds the published results table and publication time.

## Cancellation and recovery

During a quiz, the organiser can choose **Cancel competition** and enter a reason. Guests in the room see that message. The room keeps participant and answer records for history and frees the organiser to host again.

Cancellation takes the same PostgreSQL room lock as answer submission and result publication. An answer that finished saving first remains in the record. Once cancellation is saved, the server rejects new answers and skips the room when processing timeouts and results. Published leaderboards cannot be cancelled.

### When the connection drops

A guest's browser can lose contact with Quizzent for several reasons. While disconnected, the page shows a connection warning and disables answering. If only the guest's connection dropped, they return to whichever question the server has reached. Their timer continues during the disconnect.

On server restart, Quizzent checks PostgreSQL before it serves the app or processes any timeouts. It cancels competitions that had already started and were still open. When guests reconnect, they see the saved message that the server went down. Waiting lobbies can accept guests again, with readiness rebuilt from fresh connections. Published results stay available in room history.

This recovery rule assumes one Quizzent API process per database. Migration `0010` stores the cancellation reason and organiser message.
