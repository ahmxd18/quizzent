-- Up Migration

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  prompt text NOT NULL CHECK (prompt = btrim(prompt) AND char_length(prompt) BETWEEN 1 AND 1000),
  position integer NOT NULL CHECK (position > 0),
  correct_option_id uuid NOT NULL,
  UNIQUE (competition_id, position)
);

CREATE TABLE question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (text = btrim(text) AND char_length(text) BETWEEN 1 AND 200),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 4),
  UNIQUE (question_id, position),
  UNIQUE (question_id, id)
);

-- The correct option must belong to this question. Check after all four options are inserted.
ALTER TABLE questions ADD CONSTRAINT questions_correct_option_fk
  FOREIGN KEY (id, correct_option_id) REFERENCES question_options(question_id, id)
  DEFERRABLE INITIALLY DEFERRED;

-- Down Migration

ALTER TABLE questions DROP CONSTRAINT questions_correct_option_fk;
DROP TABLE question_options;
DROP TABLE questions;
