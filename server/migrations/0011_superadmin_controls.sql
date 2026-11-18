-- Up Migration

CREATE TABLE admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_label text NOT NULL,
  action text NOT NULL CHECK (action IN ('bootstrap', 'role_changed', 'status_changed', 'room_cancelled')),
  target_id uuid NOT NULL,
  target_label text NOT NULL,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX admin_audit_recent ON admin_audit (created_at DESC, id DESC);

ALTER TABLE rooms DROP CONSTRAINT rooms_cancellation_valid;
ALTER TABLE rooms ADD CONSTRAINT rooms_cancellation_valid CHECK (
  (cancellation_reason IS NULL AND cancellation_note IS NULL) OR (
    cancellation_reason IS NOT NULL AND status = 'closed' AND results_published_at IS NULL AND (
      (cancellation_reason = 'server_outage' AND cancellation_note IS NULL) OR
      (cancellation_reason IN ('organiser', 'superadmin') AND cancellation_note IS NOT NULL
        AND char_length(btrim(cancellation_note)) BETWEEN 1 AND 200)
    )
  )
);

-- Down Migration

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM admin_audit) OR EXISTS (SELECT 1 FROM rooms WHERE cancellation_reason = 'superadmin') THEN
    RAISE EXCEPTION 'Cannot remove superadmin audit history';
  END IF;
END $$;
ALTER TABLE rooms DROP CONSTRAINT rooms_cancellation_valid;
ALTER TABLE rooms ADD CONSTRAINT rooms_cancellation_valid CHECK (
  (cancellation_reason IS NULL AND cancellation_note IS NULL) OR (
    cancellation_reason IS NOT NULL AND status = 'closed' AND results_published_at IS NULL AND (
      (cancellation_reason = 'server_outage' AND cancellation_note IS NULL) OR
      (cancellation_reason = 'organiser' AND cancellation_note IS NOT NULL
        AND char_length(btrim(cancellation_note)) BETWEEN 1 AND 200)
    )
  )
);
DROP TABLE admin_audit;
