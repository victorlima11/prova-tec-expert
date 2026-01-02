"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { invokeGenerateMessages } from "@/lib/supabase/edge"
import { useWorkspace } from "@/lib/workspace-context"
import { useAuth } from "@/lib/auth-context"
import type { Campaign, LeadCustomField, PipelineStage, WorkspaceMember } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface CreateLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateLeadDialog({ open, onOpenChange, onSuccess }: CreateLeadDialogProps) {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [customFields, setCustomFields] = useState<LeadCustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [requiredFieldsByStage, setRequiredFieldsByStage] = useState<Record<string, string[]>>({})
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    job_title: "",
    source: "",
    notes: "",
    stage_id: "",
    responsible_user_id: "none",
  })
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceMember[]>([])
  const [triggerCampaigns, setTriggerCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const { currentWorkspaceId } = useWorkspace()
  const { session } = useAuth()
  const { toast } = useToast()
  const supabase = getSupabaseClient()


  useEffect(() => {
    if (open && currentWorkspaceId) {
      setCustomValues({})
      setSelectedCampaignId("none")
      fetchStages()
      fetchCustomFields()
      fetchRequiredFields()
      fetchWorkspaceUsers()
      fetchTriggerCampaigns()
    }
  }, [open, currentWorkspaceId])

  const fetchStages = async () => {
    if (!currentWorkspaceId) return

    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("workspace_id", currentWorkspaceId)
      .order("sort_order")

    if (!error && data) {
      setStages(data)
      if (data.length > 0 && !formData.stage_id) {
        setFormData((prev) => ({ ...prev, stage_id: data[0].id }))
      }
    }
  }

  const fetchWorkspaceUsers = async () => {
    if (!currentWorkspaceId) return

    const { data, error } = await supabase
      .from("workspace_users")
      .select("*")
      .eq("workspace_id", currentWorkspaceId)
      .order("created_at", { ascending: true })

    if (!error && data) {
      setWorkspaceUsers(data)
    }
  }

  const fetchCustomFields = async () => {
    if (!currentWorkspaceId) return

    const { data, error } = await supabase
      .from("lead_custom_fields")
      .select("*")
      .eq("workspace_id", currentWorkspaceId)
      .order("created_at")

    if (!error && data) {
      setCustomFields(data)
    }
  }

  const fetchRequiredFields = async () => {
    if (!currentWorkspaceId) return

    const { data, error } = await supabase
      .from("stage_required_fields")
      .select("stage_id, field_key")
      .eq("workspace_id", currentWorkspaceId)

    if (!error && data) {
      const grouped: Record<string, string[]> = {}
      data.forEach((row) => {
        if (!grouped[row.stage_id]) grouped[row.stage_id] = []
        grouped[row.stage_id].push(row.field_key)
      })
      setRequiredFieldsByStage(grouped)
    }
  }

  const getMissingRequiredFields = () => {
    const stageId = formData.stage_id
    if (!stageId) return []

    const requiredKeys = requiredFieldsByStage[stageId] || []
    if (requiredKeys.length === 0) return []

    const standardLabelMap: Record<string, string> = {
      name: "Nome",
      email: "Email",
      phone: "Telefone",
      company: "Empresa",
      job_title: "Cargo",
      source: "Origem",
      notes: "Observações",
      responsible_user_id: "Responsável",
    }

    const missing: string[] = []
    const customFieldIds: string[] = []

    requiredKeys.forEach((key) => {
      if (key.startsWith("custom:")) {
        customFieldIds.push(key.replace("custom:", ""))
        return
      }

      const value = (formData as any)[key]
      if (key === "responsible_user_id") {
        if (!value || value === "none") {
          missing.push(standardLabelMap[key] || key)
        }
        return
      }

      if (value === null || value === undefined || `${value}`.trim() === "") {
        missing.push(standardLabelMap[key] || key)
      }
    })

    if (customFieldIds.length > 0) {
      customFieldIds.forEach((fieldId) => {
        const value = customValues[fieldId]
        if (!value || value.trim() === "") {
          const fieldName = customFields.find((field) => field.id === fieldId)?.name
          missing.push(fieldName ? `${fieldName} (Personalizado)` : `Campo ${fieldId}`)
        }
      })
    }

    return missing
  }

  const fetchTriggerCampaigns = async () => {
    if (!currentWorkspaceId) return

    const { data, error } = await supabase
      .from("campaigns")
      .select("id, trigger_stage_id, active, name, workspace_id, context, prompt, created_at")
      .eq("workspace_id", currentWorkspaceId)
      .eq("active", true)

    if (!error && data) {
      setTriggerCampaigns(data)
      setCampaigns(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWorkspaceId) return

    setLoading(true)
    try {
      const missingFields = getMissingRequiredFields()
      if (missingFields.length > 0) {
        toast({
          title: "Campos obrigatórios faltando",
          description: `Preencha: ${missingFields.join(", ")}`,
          variant: "destructive",
        })
        return
      }

      const { data, error } = await supabase
        .from("leads")
        .insert({
          workspace_id: currentWorkspaceId,
          ...formData,
          responsible_user_id: formData.responsible_user_id === "none" ? null : formData.responsible_user_id,
        })
        .select("id, stage_id")
        .single()

      if (error) throw error

      if (data && customFields.length > 0) {
        const customValueInserts = customFields
          .map((field) => {
            const value = customValues[field.id]
            if (!value || value.trim() === "") return null
            return {
              lead_id: data.id,
              field_id: field.id,
              value,
            }
          })
          .filter(Boolean)

        if (customValueInserts.length > 0) {
          const { error: customError } = await supabase.from("lead_custom_values").insert(customValueInserts)
          if (customError) throw customError
        }
      }

      toast({
        title: "Sucesso",
        description: "Lead criado com sucesso",
      })

      if (data) {
        const campaignIds = new Set<string>()
        const campaignsToTrigger = triggerCampaigns.filter((campaign) => campaign.trigger_stage_id === data.stage_id)
        campaignsToTrigger.forEach((campaign) => campaignIds.add(campaign.id))

        if (selectedCampaignId !== "none") {
          campaignIds.add(selectedCampaignId)
        }

        if (campaignIds.size > 0) {
          if (!session?.access_token) {
            toast({
              title: "Sessão expirada",
              description: "Faça login novamente para gerar mensagens.",
              variant: "destructive",
            })
            return
          }
          const results = await Promise.allSettled(
            Array.from(campaignIds).map((campaignId) =>
              invokeGenerateMessages({ lead_id: data.id, campaign_id: campaignId }, session.access_token),
            ),
          )
          const failed = results.find((result) => result.status === "rejected")
          if (failed) {
            toast({
              title: "Aviso",
              description: "Não foi possível gerar mensagens automaticamente.",
              variant: "destructive",
            })
          }
        }
      }

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        company: "",
        job_title: "",
        source: "",
        notes: "",
        stage_id: stages[0]?.id || "",
        responsible_user_id: "none",
      })
      setCustomValues({})
      setSelectedCampaignId("none")
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar novo lead</DialogTitle>
          <DialogDescription>Adicione um novo lead ao funil</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage">Etapa *</Label>
                <Select
                  value={formData.stage_id}
                  onValueChange={(value) => setFormData({ ...formData, stage_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Cargo</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Origem</Label>
              <Input
                id="source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            {customFields.length > 0 && (
              <div className="space-y-4">
                <Label>Campos personalizados</Label>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>{field.name}</Label>
                    <Input
                      id={field.id}
                      type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                      value={customValues[field.id] || ""}
                      onChange={(e) => setCustomValues({ ...customValues, [field.id]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
            {campaigns.length > 0 && (
              <div className="space-y-2">
                <Label>Campanha para mensagens (opcional)</Label>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="responsible-user">Responsável</Label>
              <Select
                value={formData.responsible_user_id}
                onValueChange={(value) => setFormData({ ...formData, responsible_user_id: value })}
              >
                <SelectTrigger id="responsible-user">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {workspaceUsers.map((user) => (
                    <SelectItem key={user.id} value={user.user_id}>
                      {user.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
