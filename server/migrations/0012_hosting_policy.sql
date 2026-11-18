-- Up Migration

ALTER TABLE users ADD COLUMN hosting_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN weekly_hosting_limit integer CHECK (weekly_hosting_limit >= 0);
ALTER TABLE admin_audit DROP CONSTRAINT admin_audit_action_check;
ALTER TABLE admin_audit ADD CONSTRAINT admin_audit_action_check
  CHECK (action IN ('bootstrap', 'role_changed', 'status_changed', 'room_cancelled', 'hosting_changed'));

-- Down Migration

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE hosting_restricted OR weekly_hosting_limit IS NOT NULL)
    OR EXISTS (SELECT 1 FROM admin_audit WHERE action = 'hosting_changed') THEN
    RAISE EXCEPTION 'Cannot remove configured hosting policies or their audit history';
  END IF;
END $$;
ALTER TABLE admin_audit DROP CONSTRAINT admin_audit_action_check;
ALTER TABLE admin_audit ADD CONSTRAINT admin_audit_action_check
  CHECK (action IN ('bootstrap', 'role_changed', 'status_changed', 'room_cancelled'));
ALTER TABLE users DROP COLUMN weekly_hosting_limit, DROP COLUMN hosting_restricted;
