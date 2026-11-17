-- Up Migration

CREATE TABLE quiz_attempts (
  participant_id uuid PRIMARY KEY REFERENCES room_participants(id) ON DELETE CASCADE,
  total_questions smallint NOT NULL CHECK (total_questions BETWEEN 1 AND 100),
  next_position smallint NOT NULL DEFAULT 1 CHECK (next_position BETWEEN 1 AND total_questions + 1)
);

CREATE TABLE quiz_attempt_questions (
  participant_id uuid NOT NULL REFERENCES quiz_attempts(participant_id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 100),
  option_order uuid[] NOT NULL CHECK (cardinality(option_order) = 4),
  PRIMARY KEY (participant_id, position),
  UNIQUE (participant_id, question_id)
);

CREATE TABLE quiz_answers (
  participant_id uuid NOT NULL,
  question_id uuid NOT NULL,
  option_id uuid NOT NULL,
  request_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (participant_id, question_id),
  UNIQUE (participant_id, request_id),
  FOREIGN KEY (participant_id, question_id) REFERENCES quiz_attempt_questions(participant_id, question_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id, option_id) REFERENCES question_options(question_id, id)
);

-- Only new attempts are shuffled. Returning guests always keep their saved order.
CREATE FUNCTION assign_quiz_attempts(target_room uuid) RETURNS integer LANGUAGE sql AS $$
  WITH new_attempts AS (
    INSERT INTO quiz_attempts (participant_id, total_questions)
    SELECT p.id, count(*)::smallint
    FROM room_participants p
    JOIN rooms r ON r.id = p.room_id
    JOIN questions q ON q.competition_id = r.competition_id
    WHERE p.admitted AND r.status = 'open' AND r.started_at IS NOT NULL
      AND (target_room IS NULL OR r.id = target_room)
    GROUP BY p.id
    ON CONFLICT (participant_id) DO NOTHING
    RETURNING participant_id
  ), assigned AS (
    INSERT INTO quiz_attempt_questions (participant_id, question_id, position, option_order)
    SELECT a.participant_id, q.id,
      row_number() OVER (PARTITION BY a.participant_id ORDER BY random())::smallint,
      array_agg(o.id ORDER BY random())
    FROM new_attempts a
    JOIN room_participants p ON p.id = a.participant_id
    JOIN rooms r ON r.id = p.room_id
    JOIN questions q ON q.competition_id = r.competition_id
    JOIN question_options o ON o.question_id = q.id
    GROUP BY a.participant_id, q.id
    RETURNING participant_id
  )
  SELECT count(DISTINCT participant_id)::integer FROM assigned;
$$;

-- Open rooms started before this migration can continue with their existing roster.
SELECT assign_quiz_attempts(NULL::uuid);

-- Down Migration

DROP FUNCTION assign_quiz_attempts(uuid);
DROP TABLE quiz_answers;
DROP TABLE quiz_attempt_questions;
DROP TABLE quiz_attempts;
