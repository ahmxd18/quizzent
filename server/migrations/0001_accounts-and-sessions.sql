-- Up Migration

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'organiser',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_display_name_valid CHECK (
    display_name = btrim(display_name) AND char_length(display_name) BETWEEN 1 AND 80
  ),
  CONSTRAINT users_email_valid CHECK (
    email = btrim(email) AND char_length(email) BETWEEN 3 AND 254
  ),
  CONSTRAINT users_password_hash_present CHECK (char_length(btrim(password_hash)) > 0),
  CONSTRAINT users_role_valid CHECK (role IN ('organiser', 'superadmin')),
  CONSTRAINT users_status_valid CHECK (status IN ('active', 'suspended'))
);

-- Treat different capitalisation of an email as the same account.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Store a SHA-256 hash of the random token, never the browser's raw token.
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT user_sessions_token_hash_valid CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT user_sessions_expiry_valid CHECK (expires_at > created_at)
);

CREATE INDEX user_sessions_user_id_idx ON user_sessions (user_id);
CREATE INDEX user_sessions_expires_at_idx ON user_sessions (expires_at);

-- Down Migration

-- Only roll this back on a disposable database: it removes accounts and sessions.
DROP TABLE user_sessions;
DROP TABLE users;
