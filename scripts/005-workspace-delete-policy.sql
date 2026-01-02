-- Allow workspace owners to delete their workspace
CREATE POLICY "Workspace owners can delete"
  ON workspaces FOR DELETE
  USING (owner_id = auth.uid());
