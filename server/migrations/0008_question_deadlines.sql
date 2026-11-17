-- Up Migration

ALTER TABLE quiz_attempts
  ADD COLUMN issued_at timestamptz,
  ADD COLUMN deadline_at timestamptz,
  ADD CONSTRAINT quiz_attempt_timer_valid CHECK (
    (issued_at IS NULL AND deadline_at IS NULL) OR
    (issued_at IS NOT NULL AND deadline_at > issued_at AND deadline_at IS NOT NULL AND next_position <= total_questions)
  );
CREATE INDEX quiz_attempts_due ON quiz_attempts (deadline_at) WHERE deadline_at IS NOT NULL;

ALTER TABLE quiz_answers
  ALTER COLUMN request_id DROP NOT NULL,
  ALTER COLUMN option_id DROP NOT NULL,
  ADD COLUMN issued_at timestamptz,
  ADD COLUMN deadline_at timestamptz,
  ADD CONSTRAINT quiz_answer_resolution_valid CHECK (
    (request_id IS NOT NULL AND option_id IS NOT NULL AND (
      (issued_at IS NULL AND deadline_at IS NULL) OR
      (issued_at IS NOT NULL AND deadline_at IS NOT NULL AND submitted_at >= issued_at AND submitted_at < deadline_at)
    )) OR (
      request_id IS NULL AND option_id IS NULL AND issued_at IS NOT NULL AND
      deadline_at IS NOT NULL AND deadline_at > issued_at AND submitted_at = deadline_at
    )
  );

CREATE FUNCTION start_quiz_timers(target_room uuid) RETURNS void LANGUAGE sql AS $$
  WITH stamp AS MATERIALIZED (SELECT date_trunc('milliseconds', clock_timestamp()) AS issued)
  UPDATE quiz_attempts a
  SET issued_at = stamp.issued, deadline_at = stamp.issued + c.question_time_seconds * interval '1 second'
  FROM stamp, room_participants p
  JOIN rooms r ON r.id = p.room_id
  JOIN competitions c ON c.id = r.competition_id
  WHERE p.id = a.participant_id AND r.status = 'open' AND r.started_at IS NOT NULL
    AND (target_room IS NULL OR r.id = target_room)
    AND a.next_position <= a.total_questions AND a.issued_at IS NULL;
$$;

-- Existing answers were untimed. Give only current questions a new deadline on upgrade.
SELECT start_quiz_timers(NULL::uuid);

-- Down Migration

-- Preserve timeout records and progress if someone has already played with the new rules.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM quiz_answers WHERE request_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot remove quiz deadlines while timeout records exist';
  END IF;
END $$;
DROP FUNCTION start_quiz_timers(uuid);
ALTER TABLE quiz_answers DROP CONSTRAINT quiz_answer_resolution_valid,
  DROP COLUMN issued_at, DROP COLUMN deadline_at,
  ALTER COLUMN request_id SET NOT NULL, ALTER COLUMN option_id SET NOT NULL;
DROP INDEX quiz_attempts_due;
ALTER TABLE quiz_attempts DROP COLUMN issued_at, DROP COLUMN deadline_at;
