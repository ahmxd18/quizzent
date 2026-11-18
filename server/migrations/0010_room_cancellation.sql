-- Up Migration

ALTER TABLE rooms
  ADD COLUMN cancellation_reason text,
  ADD COLUMN cancellation_note text,
  ADD CONSTRAINT rooms_cancellation_valid CHECK (
    (cancellation_reason IS NULL AND cancellation_note IS NULL) OR (
      cancellation_reason IS NOT NULL AND status = 'closed' AND results_published_at IS NULL AND (
        (cancellation_reason = 'server_outage' AND cancellation_note IS NULL) OR
        (cancellation_reason = 'organiser' AND cancellation_note IS NOT NULL
          AND char_length(btrim(cancellation_note)) BETWEEN 1 AND 200)
      )
    )
  );

-- Down Migration

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM rooms WHERE cancellation_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot remove cancellation history';
  END IF;
END $$;
ALTER TABLE rooms DROP COLUMN cancellation_note, DROP COLUMN cancellation_reason;
