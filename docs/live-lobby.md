# Live lobby and readiness

Open a room from a published competition. In a separate browser profile, join by code or personal invitation. The organiser sees the guest appear in the roster automatically. Click **I’m ready** as the guest to update both screens, or **Mark as not ready** to change your choice.

## How the count works

- **Joined** counts saved room memberships in PostgreSQL. Leaving the lobby preserves that record.
- **Online** counts distinct participants with a live connection. Each tab has its own connection, but tabs in the same guest session share a participant ID.
- **Ready** counts only the online participants who selected **I’m ready**. If the server detects that the last tab disconnected, the guest drops out of both live counts.
- A guest who reconnects within eight seconds of the server detecting their disconnect gets their last ready choice back. After that, they can mark themselves ready again. If a network connection disappears without warning, Socket.IO's built-in heartbeat detects it, normally within about ten seconds.

## How it fits together

The existing HTTP routes still handle joins, invitations, and room history. Socket.IO keeps a connection open so the server can send a lobby snapshot whenever something changes. The browser sends a ready event and waits for an acknowledgement, which is the server's reply confirming or rejecting the change. Host pages fetch the private roster through the existing authorised HTTP route when admission changes. Guest sockets receive their own readiness and the room totals.

The server checks the existing session cookie and looks up the organiser's room ownership or the guest's room membership before subscribing. Readiness lives in memory on our single backend process and resets on a restart. Room membership and the organiser's saved roster stay in PostgreSQL, so there is no new migration for this step.

Vite proxies both HTTP requests and the `/socket.io` WebSocket connection to the same backend. The browser connects using the app's origin. A future production proxy must preserve the public host and forward WebSocket upgrades. See the [Socket.IO server options](https://socket.io/docs/v4/server-options/).

## Automatic start

When opening a room, the organiser sets the lobby duration and minimum number of ready guests. The defaults are 60 seconds and two ready guests. Setting the duration to zero skips the initial timer. Once the lobby timer ends and enough guests are online and ready, the server starts a five-second warning. If readiness drops below the minimum during that warning, the server waits for the minimum and begins a fresh warning.

PostgreSQL stores the lobby deadline, warning deadline, and committed start time. The browser displays the deadlines using the server time from Socket.IO. On the server, joining, closing, and starting all lock the same room row. A lock lets one of those operations work on the room at a time. The start transaction rechecks readiness, saves the starting roster, and closes admission together. After commit, participants can refresh to see whether they were admitted. A warning saved before a server restart is checked against current readiness when the lobby is next opened in a browser.

Run `npm run db:migrate` after pulling Step 11. Migration 0006 adds these fields and gives rooms already in the database the default minimum and a lobby deadline 60 seconds after migration. Question delivery begins in Step 12.
