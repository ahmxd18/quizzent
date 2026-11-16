-- Up Migration

ALTER TABLE competitions ADD CONSTRAINT competitions_id_owner_unique UNIQUE (id, organiser_id);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL,
  organiser_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{8}$'),
  admission_mode text NOT NULL CHECK (admission_mode IN ('open', 'invitation')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  FOREIGN KEY (competition_id, organiser_id) REFERENCES competitions(id, organiser_id) ON DELETE CASCADE,
  CHECK ((status = 'open' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX rooms_one_open_per_organiser ON rooms (organiser_id) WHERE status = 'open';
CREATE INDEX rooms_owner_created_idx ON rooms (organiser_id, created_at DESC);

-- Permanent guest records outlive their login cookies, preserving room history.
CREATE TABLE guests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX guest_sessions_guest_idx ON guest_sessions (guest_id);

CREATE TABLE room_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  reference text NOT NULL CHECK (reference = btrim(reference) AND char_length(reference) BETWEEN 1 AND 100),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, id)
);
CREATE UNIQUE INDEX room_invitations_reference_unique ON room_invitations (room_id, lower(reference));

CREATE TABLE room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id),
  invitation_id uuid UNIQUE,
  participant_number smallint NOT NULL CHECK (participant_number BETWEEN 1 AND 50),
  nickname text NOT NULL CHECK (nickname = btrim(nickname) AND char_length(nickname) BETWEEN 1 AND 32),
  joined_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (room_id, invitation_id) REFERENCES room_invitations(room_id, id),
  UNIQUE (room_id, guest_id),
  -- Fifty distinct numbered slots also enforce capacity at the database level.
  UNIQUE (room_id, participant_number)
);
CREATE UNIQUE INDEX room_participants_nickname_unique ON room_participants (room_id, lower(nickname));

-- Down Migration

DROP TABLE room_participants;
DROP TABLE room_invitations;
DROP TABLE guest_sessions;
DROP TABLE guests;
DROP TABLE rooms;
ALTER TABLE competitions DROP CONSTRAINT competitions_id_owner_unique;
