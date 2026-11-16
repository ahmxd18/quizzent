-- Up Migration

ALTER TABLE competitions DROP CONSTRAINT competitions_status_valid;
ALTER TABLE competitions ADD CONSTRAINT competitions_status_valid CHECK (status IN ('draft', 'published'));
ALTER TABLE competitions ADD COLUMN published_at timestamptz;
ALTER TABLE competitions ADD CONSTRAINT competitions_publication_valid CHECK (
  (status = 'draft' AND published_at IS NULL) OR (status = 'published' AND published_at IS NOT NULL)
);

-- Down Migration

-- This rollback fails if published rows exist; never silently turn them into editable drafts.
ALTER TABLE competitions DROP CONSTRAINT competitions_publication_valid;
ALTER TABLE competitions DROP CONSTRAINT competitions_status_valid;
ALTER TABLE competitions ADD CONSTRAINT competitions_status_valid CHECK (status = 'draft');
ALTER TABLE competitions DROP COLUMN published_at;
