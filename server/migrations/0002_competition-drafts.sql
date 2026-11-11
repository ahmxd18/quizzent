-- Up Migration

CREATE TABLE competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organiser_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  question_time_seconds integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitions_title_valid CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 100),
  CONSTRAINT competitions_description_valid CHECK (char_length(description) <= 500),
  CONSTRAINT competitions_question_time_valid CHECK (question_time_seconds BETWEEN 5 AND 120),
  CONSTRAINT competitions_status_valid CHECK (status = 'draft')
);

-- Match the owner-filtered, most-recently-updated library query.
CREATE INDEX competitions_organiser_updated_idx ON competitions (organiser_id, updated_at DESC, id DESC);

-- Down Migration

DROP TABLE competitions;
