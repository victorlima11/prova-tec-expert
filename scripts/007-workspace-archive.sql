-- Add soft-delete column for workspaces.
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS workspaces_archived_at_idx
ON workspaces (archived_at);
