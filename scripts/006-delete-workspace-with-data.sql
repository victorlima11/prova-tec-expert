-- Delete a workspace and all related data in a safe order.
-- Requires the caller to be the workspace owner or an admin member.
CREATE OR REPLACE FUNCTION delete_workspace_with_data(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_owner_id uuid;
  v_is_admin boolean;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM workspaces
  WHERE id = p_workspace_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM workspace_users
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) INTO v_is_admin;

  IF v_owner_id <> auth.uid() AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM generated_messages WHERE workspace_id = p_workspace_id;
  DELETE FROM lead_custom_values WHERE lead_id IN (SELECT id FROM leads WHERE workspace_id = p_workspace_id);
  DELETE FROM leads WHERE workspace_id = p_workspace_id;
  DELETE FROM stage_required_fields WHERE workspace_id = p_workspace_id;
  DELETE FROM lead_custom_fields WHERE workspace_id = p_workspace_id;
  DELETE FROM campaigns WHERE workspace_id = p_workspace_id;
  DELETE FROM pipeline_stages WHERE workspace_id = p_workspace_id;
  DELETE FROM workspace_users WHERE workspace_id = p_workspace_id;
  DELETE FROM workspaces WHERE id = p_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_workspace_with_data(uuid) TO authenticated;
