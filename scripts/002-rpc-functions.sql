-- Helper: check if a user belongs to a workspace
CREATE OR REPLACE FUNCTION is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_users
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
  );
$$;

-- RPC function to create default pipeline stages
CREATE OR REPLACE FUNCTION create_default_pipeline(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO pipeline_stages (workspace_id, name, sort_order)
  VALUES
    (p_workspace_id, 'Base', 1),
    (p_workspace_id, 'Lead Mapeado', 2),
    (p_workspace_id, 'Tentando Contato', 3),
    (p_workspace_id, 'Conexão Iniciada', 4),
    (p_workspace_id, 'Desqualificado', 5),
    (p_workspace_id, 'Qualificado', 6),
    (p_workspace_id, 'Reunião Agendada', 7);
END;
$$;

-- RPC function to create workspace with defaults
CREATE OR REPLACE FUNCTION create_workspace_with_defaults(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create workspace
  INSERT INTO workspaces (name, owner_id)
  VALUES (p_name, v_user_id)
  RETURNING id INTO v_workspace_id;

  -- Add creator as admin
  INSERT INTO workspace_users (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'admin');

  -- Create default pipeline stages
  PERFORM create_default_pipeline(v_workspace_id);

  RETURN v_workspace_id;
END;
$$;
