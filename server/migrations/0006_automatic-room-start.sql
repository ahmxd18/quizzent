-- Up Migration

ALTER TABLE rooms
  ADD COLUMN min_ready smallint NOT NULL DEFAULT 2 CHECK (min_ready BETWEEN 1 AND 50),
  ADD COLUMN lobby_ends_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '60 seconds'),
  ADD COLUMN warning_ends_at timestamptz,
  ADD COLUMN started_at timestamptz,
  ADD CONSTRAINT rooms_warning_requires_lobby CHECK (
    warning_ends_at IS NULL OR (status = 'open' AND started_at IS NULL AND warning_ends_at >= lobby_ends_at)
  ),
  ADD CONSTRAINT rooms_start_after_lobby CHECK (started_at IS NULL OR started_at >= lobby_ends_at);

ALTER TABLE room_participants ADD COLUMN admitted boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE room_participants DROP COLUMN admitted;
ALTER TABLE rooms DROP COLUMN started_at, DROP COLUMN warning_ends_at, DROP COLUMN lobby_ends_at, DROP COLUMN min_ready;
