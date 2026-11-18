# Competition cancellation and server recovery

During a quiz, the organiser can choose **Cancel competition** and enter a reason. Guests in the room see that message. The room keeps participant and answer records for history and frees the organiser to host again.

Cancellation takes the same PostgreSQL room lock as answer submission and result publication. An answer that finished saving first remains in the record. Once cancellation is saved, the server rejects new answers and skips the room when processing timeouts and results. Published leaderboards cannot be cancelled.

## When the connection drops

A guest's browser can lose contact with Quizzent for several reasons. While disconnected, the page shows a connection warning and disables answering. If only the guest's connection dropped, they return to whichever question the server has reached. Their timer continues during the disconnect.

On server restart, Quizzent checks PostgreSQL before it serves the app or processes any timeouts. It cancels competitions that had already started and were still open. When guests reconnect, they see the saved message that the server went down. Waiting lobbies can accept guests again, with readiness rebuilt from fresh connections. Published results stay available in room history.

This recovery rule assumes one Quizzent API process per database. Run `npm run db:migrate` before starting the server with Step 15. Migration `0010` adds the cancellation reason and organiser message.
