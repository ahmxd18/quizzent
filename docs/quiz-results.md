# Quiz results and organiser progress

The organiser dashboard shows how many questions each admitted guest has resolved and how many guests have finished. Both a submitted answer and a timeout count as a resolved question. A guest who finishes early waits for the rest of the starting roster.

Once everyone has finished, the server recalculates each score from the saved answers. PostgreSQL saves the leaderboard and closes the room in one transaction, which also frees the organiser to host again. Retrying publication leaves the saved leaderboard intact.

## Ranking

The most correct answers wins. If two guests have the same score, the lower total answer time ranks higher. Total time covers all questions, including the full allotted time for each timeout. Guests who match on both score and time share a rank, so the next row after two first places is third.

Some answers saved before Step 13 have no question window. Those attempts show **Time unavailable**. Within the same score, known times come before unavailable times. Older rooms already closed before results existed keep their existing room record.

## Who can see what

- The organiser can see progress while guests answer and the final leaderboard afterward.
- Admitted guests can see the final leaderboard and review their own answers after publication.
- Other guests’ choices and the organiser’s invitation references are kept private. An early close leaves the room record available without a final leaderboard.

Run `npm run db:migrate` after pulling this change. Migration `0009` adds the published results table and publication time.
