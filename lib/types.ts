export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
  archived_at?: string | null
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: "admin" | "member"
  created_at: string
}

export interface PipelineStage {
  id: string
  workspace_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface Lead {
  id: string
  workspace_id: string
  stage_id: string
  campaign_ids?: string[] | null
  name: string
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  source: string | null
  notes: string | null
  responsible_user_id: string | null
  created_at: string
  updated_at: string
}

export interface LeadCustomField {
  id: string
  workspace_id: string
  name: string
  field_type: "text" | "number" | "date" | "select"
  created_at: string
}

export interface LeadCustomValue {
  id: string
  lead_id: string
  field_id: string
  value: string | null
  created_at: string
}

export interface StageRequiredField {
  id: string
  workspace_id: string
  stage_id: string
  field_key: string
  created_at: string
}

export interface Campaign {
  id: string
  workspace_id: string
  name: string
  context: string | null
  prompt: string | null
  active: boolean
  trigger_stage_id: string | null
  created_at: string
}

export interface GeneratedMessage {
  id: string
  workspace_id: string
  lead_id: string
  campaign_id: string | null
  content: string
  created_at: string
}
