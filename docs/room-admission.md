# Room admission

From a published competition, use **Host room**. Choose **Open with room code** to admit anyone who knows the code, or **Personal invitations only** to require an invitation. An open room can also use personal invitations. Closing a room stops admission, keeps its roster visible from the organiser dashboard, and lets the organiser host again.

## Who is who?

| Field | Example | What it tells the organiser |
| --- | --- | --- |
| Nickname | ThunderGuy | The name a guest chose before joining. |
| Participant number | P001 | The room's permanent roster label for this guest record. The app stores a UUID behind it. |
| Organiser reference | John · Student 1042 | The label the organiser assigned to the single-use invitation used to join. |

If Mike joins as `John` with Mike's invitation, his row still shows Mike's reference. If he uses only the room code, the row shows **Unverified code join**. An invitation identifies which link was used; anyone who obtains the link can use it first. Share it privately with the intended guest. A link does not reserve a place.

The server suggests a name from two short English word lists. Guests can edit it before joining. The server normalises pasted text and whitespace, and PostgreSQL enforces uniqueness on `(room_id, lower(nickname))`. Think of this as a rule that allows each room and lowercase name pair only once. If two guests submit `John` and `JOHN` together, only one succeeds. The winning spelling stays on display. Lowercasing does not detect visually similar letters.

## How it is stored

- `rooms` holds the code, admission mode, status, and competition/organiser links. An index that applies only to open rooms allows each organiser to have one open room and multiple closed ones.
- `room_invitations` holds the organiser's reference and a hash (a one-way fingerprint) of the random link token. If an unused link is lost, the organiser can replace it. Replacement invalidates the previous link.
- `guests` and `guest_sessions` separate the permanent guest record from the private browser cookie. The cookie lasts 24 hours from creation. The same valid cookie restores the same participant in a room on refresh. Losing the cookie loses access to that guest session; an already-used invitation cannot be reclaimed. Expiry does not erase the organiser's roster.
- `room_participants` connects a room and guest to their nickname, number, and optional invitation. The join operation locks the room row while it checks capacity and saves the guest. Other join, close, and link replacement requests for that room wait their turn. This keeps two guests from taking the last seat or claiming one invitation together.

The invitation secret lives in the link's URL fragment (the part after `#`), so it stays out of normal URL requests. The page sends it in the join POST, then removes it from the URL after a successful join. Guests can see their own participant record. Only the room owner can see the roster and organiser references.

## Try it locally

1. Start Postgres.app, apply migrations with `npm run db:migrate`, then run the frontend and backend as described in the [README](../README.md).
2. Publish a competition, host an open room, and create a personal invitation with a reference you recognise.
3. Open the link in another browser profile or a private window. Pick a nickname and join. Refresh to check that the participant number stays the same. Use separate browser profiles to simulate multiple guests.
4. Refresh the organiser roster. Check that the reference and nickname appear separately. For a code-only guest, check that the row is unverified.
5. Close the room and reopen its dashboard from the organiser's room list. The roster is still there.

The organiser roster updates automatically while the live connection is available. See the [live lobby guide](competition-runtime.md#lobby-and-readiness) for online counts and readiness.
