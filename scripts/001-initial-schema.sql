-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace users table
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper: check if a user belongs to a workspace
CREATE OR REPLACE FUNCTION is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_users
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
  );
$$;

-- Pipeline stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage required fields table
CREATE TABLE IF NOT EXISTS stage_required_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead custom fields definition
CREATE TABLE IF NOT EXISTS lead_custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL, -- 'text', 'number', 'date', 'select'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead custom field values
CREATE TABLE IF NOT EXISTS lead_custom_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES lead_custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  context TEXT,
  prompt TEXT,
  active BOOLEAN DEFAULT true,
  trigger_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated messages table
CREATE TABLE IF NOT EXISTS generated_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace ON workspace_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user ON workspace_users(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_workspace ON pipeline_stages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stage_required_fields_workspace ON stage_required_fields(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stage_required_fields_stage ON stage_required_fields(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_lead_custom_fields_workspace ON lead_custom_fields(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_custom_values_lead ON lead_custom_values(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_generated_messages_workspace ON generated_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_generated_messages_lead ON generated_messages(lead_id);

-- RLS Policies

-- Workspaces: users can see workspaces they are members of
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can insert workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspace owners can update"
  ON workspaces FOR UPDATE
  USING (owner_id = auth.uid());

-- Workspace users: users can view members of their workspaces
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace users"
  ON workspace_users FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert workspace users"
  ON workspace_users FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- Pipeline stages: workspace members can view and manage
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view stages"
  ON pipeline_stages FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage stages"
  ON pipeline_stages FOR ALL
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- Stage required fields: workspace members can view and manage
ALTER TABLE stage_required_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view stage required fields"
  ON stage_required_fields FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage stage required fields"
  ON stage_required_fields FOR ALL
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- Leads: workspace members can view and manage
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view leads"
  ON leads FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage leads"
  ON leads FOR ALL
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- Lead custom fields: workspace members can view and manage
ALTER TABLE lead_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view custom fields"
  ON lead_custom_fields FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage custom fields"
  ON lead_custom_fields FOR ALL
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- Lead custom values: workspace members can view and manage
ALTER TABLE lead_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view custom values"
  ON lead_custom_values FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE is_workspace_member(workspace_id, auth.uid())
    )
  );

CREATE POLICY "Workspace members can manage custom values"
  ON lead_custom_values FOR ALL
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE is_workspace_member(workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM leads WHERE is_workspace_member(workspace_id, auth.uid())
    )
  );

-- Campaigns: workspace members can view and manage
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view campaigns"
  ON campaigns FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage campaigns"
  ON campaigns FOR ALL
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- Generated messages: workspace members can view and manage
ALTER TABLE generated_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view generated messages"
  ON generated_messages FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage generated messages"
  ON generated_messages FOR ALL
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));
