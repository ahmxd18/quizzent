-- Up Migration

ALTER TABLE rooms ADD COLUMN results_published_at timestamptz,
  ADD CONSTRAINT rooms_results_require_finish CHECK (
    results_published_at IS NULL OR (
      started_at IS NOT NULL AND status = 'closed' AND results_published_at = closed_at
    )
  );

CREATE TABLE quiz_results (
  participant_id uuid PRIMARY KEY REFERENCES quiz_attempts(participant_id) ON DELETE CASCADE,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 50),
  correct_count smallint NOT NULL CHECK (correct_count BETWEEN 0 AND 100),
  total_time_ms integer CHECK (total_time_ms >= 0)
);

-- Down Migration

-- Closed rooms remain closed when rolling back. Preserve published history instead.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM quiz_results) THEN
    RAISE EXCEPTION 'Cannot remove quiz results after publication';
  END IF;
END $$;
DROP TABLE quiz_results;
ALTER TABLE rooms DROP COLUMN results_published_at;
