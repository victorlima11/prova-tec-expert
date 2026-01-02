"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { invokeGenerateMessages } from "@/lib/supabase/edge"
import { useWorkspace } from "@/lib/workspace-context"
import type { Campaign, Lead, LeadCustomField, PipelineStage } from "@/lib/types"
import { getStageColor } from "@/lib/stage-colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CreateLeadDialog } from "@/components/create-lead-dialog"

export default function LeadsPage() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [customFields, setCustomFields] = useState<LeadCustomField[]>([])
  const [requiredFieldsByStage, setRequiredFieldsByStage] = useState<Record<string, string[]>>({})
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [triggerCampaigns, setTriggerCampaigns] = useState<Campaign[]>([])
  const [campaignFilterId, setCampaignFilterId] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const { currentWorkspaceId } = useWorkspace()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()


  useEffect(() => {
    if (!currentWorkspaceId) {
      router.push("/onboarding/workspace")
      return
    }
    fetchData()
  }, [currentWorkspaceId])

  const fetchData = async () => {
    if (!currentWorkspaceId) return

    try {
      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("sort_order")

      if (stagesError) throw stagesError
      setStages(stagesData || [])

      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("created_at", { ascending: false })

      if (leadsError) throw leadsError
      setLeads(leadsData || [])

      const { data: fieldsData, error: fieldsError } = await supabase
        .from("lead_custom_fields")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("created_at")

      if (fieldsError) throw fieldsError
      setCustomFields(fieldsData || [])

      const { data: requiredData, error: requiredError } = await supabase
        .from("stage_required_fields")
        .select("stage_id, field_key")
        .eq("workspace_id", currentWorkspaceId)

      if (requiredError) throw requiredError
      const grouped: Record<string, string[]> = {}
      requiredData?.forEach((row) => {
        if (!grouped[row.stage_id]) grouped[row.stage_id] = []
        grouped[row.stage_id].push(row.field_key)
      })
      setRequiredFieldsByStage(grouped)

      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, trigger_stage_id, active, name, workspace_id, context, prompt, created_at")
        .eq("workspace_id", currentWorkspaceId)
        .order("created_at", { ascending: false })

      if (campaignsError) throw campaignsError
      setCampaigns(campaignsData || [])
      setTriggerCampaigns((campaignsData || []).filter((campaign) => campaign.active))
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

  const getLeadsByStage = (stageId: string) => {
    return getFilteredLeads().filter((lead) => lead.stage_id === stageId)
  }

  const getFilteredLeads = () => {
    const query = searchQuery.trim().toLowerCase()
    return leads.filter((lead) => {
      if (campaignFilterId !== "all") {
        const campaignIds = (lead.campaign_ids || []).filter(Boolean)
        if (!campaignIds.includes(campaignFilterId)) return false
      }

      if (!query) return true

      const haystack = [
        lead.name,
        lead.email,
        lead.phone,
        lead.company,
        lead.job_title,
        lead.source,
        lead.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }

  const getMissingRequiredFields = async (lead: Lead, stageId: string) => {
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

      const value = (lead as any)[key]
      if (value === null || value === undefined || `${value}`.trim() === "") {
        missing.push(standardLabelMap[key] || key)
      }
    })

    if (customFieldIds.length > 0) {
      const { data, error } = await supabase
        .from("lead_custom_values")
        .select("field_id, value")
        .eq("lead_id", lead.id)
        .in("field_id", customFieldIds)

      if (error) throw error

      const valueMap = new Map<string, string | null>()
      data?.forEach((item) => valueMap.set(item.field_id, item.value))

      customFieldIds.forEach((fieldId) => {
        const value = valueMap.get(fieldId)
        if (value === null || value === undefined || value.trim() === "") {
          const fieldName = customFields.find((field) => field.id === fieldId)?.name
          missing.push(fieldName ? `${fieldName} (Personalizado)` : `Campo ${fieldId}`)
        }
      })
    }

    return missing
  }

  const handleMoveLead = async (leadId: string, stageId: string) => {
    const targetLead = leads.find((lead) => lead.id === leadId)
    if (!targetLead || targetLead.stage_id === stageId) return

    setMovingLeadId(leadId)
    try {
      const missingFields = await getMissingRequiredFields(targetLead, stageId)
      if (missingFields.length > 0) {
        toast({
          title: "Campos obrigatórios faltando",
          description: `Preencha: ${missingFields.join(", ")}`,
          variant: "destructive",
        })
        return
      }

      const leadCampaignIds = (targetLead.campaign_ids || []).filter(Boolean)
      const campaignsToTrigger = triggerCampaigns.filter((campaign) => campaign.trigger_stage_id === stageId)
      const campaignsForLead =
        leadCampaignIds.length > 0
          ? campaignsToTrigger.filter((campaign) => leadCampaignIds.includes(campaign.id))
          : campaignsToTrigger

      const updatePayload: Partial<Lead> = { stage_id: stageId }
      let nextCampaignIds = leadCampaignIds
      if (leadCampaignIds.length === 0 && campaignsToTrigger.length > 0) {
        nextCampaignIds = campaignsToTrigger.map((campaign) => campaign.id)
        updatePayload.campaign_ids = nextCampaignIds
      }

      const { error } = await supabase.from("leads").update(updatePayload).eq("id", leadId)

      if (error) throw error

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, stage_id: stageId, campaign_ids: nextCampaignIds } : lead,
        ),
      )

      if (campaignsForLead.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (!accessToken) {
          toast({
            title: "Sessão expirada",
            description: "Faça login novamente para gerar mensagens.",
            variant: "destructive",
          })
          return
        }
        const results = await Promise.allSettled(
          campaignsForLead.map((campaign) =>
            invokeGenerateMessages({ lead_id: leadId, campaign_id: campaign.id }, accessToken),
          ),
        )
        const failed = results.find((result) => result.status === "rejected")
        if (failed) {
          const message =
            failed.status === "rejected" && failed.reason instanceof Error
              ? failed.reason.message
              : "Não foi possível gerar mensagens automaticamente."
          toast({
            title: "Aviso",
            description: message,
            variant: "destructive",
          })
        }
      }

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setMovingLeadId(null)
    }
  }

  if (!currentWorkspaceId) {
    return null
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Carregando leads...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus leads em um kanban</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo lead
        </Button>
      </div>

      <div className="mb-4 flex justify-start">
        <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border bg-background/70 px-3 py-2 shadow-sm md:w-fit">
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Label htmlFor="lead-search" className="sr-only">
              Buscar
            </Label>
            <div className="relative w-full md:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="lead-search"
                placeholder="Buscar por nome, empresa ou email"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-9 w-full pl-8 text-sm"
              />
            </div>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Label className="sr-only">Campanha</Label>
            <Select value={campaignFilterId} onValueChange={setCampaignFilterId}>
              <SelectTrigger className="h-9 w-full text-sm md:w-44">
                <SelectValue placeholder="Todas as campanhas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-xs"
              onClick={() => {
                setSearchQuery("")
                setCampaignFilterId("all")
              }}
            >
              Limpar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
          {stages.map((stage, stageIndex) => {
            const stageLeads = getLeadsByStage(stage.id)
            const stageColor = getStageColor(stageIndex)
            return (
              <div
                key={stage.id}
                className="flex w-80 flex-col"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const leadId = event.dataTransfer.getData("text/plain")
                  if (leadId) {
                    handleMoveLead(leadId, stage.id)
                  }
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stageColor }} />
                    <h3 className="font-semibold">{stage.name}</h3>
                    <Badge variant="secondary" className="ml-1">
                      {stageLeads.length}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  {stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="cursor-pointer hover:border-primary"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", lead.id)
                        event.dataTransfer.effectAllowed = "move"
                      }}
                      onClick={() => router.push(`/app/leads/${lead.id}`)}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm font-medium">{lead.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {lead.company && <p>{lead.company}</p>}
                          {lead.email && <p>{lead.email}</p>}
                        </div>
                        {movingLeadId === lead.id && (
                          <p className="mt-2 text-xs text-muted-foreground">Movendo...</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <CreateLeadDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={fetchData} />
    </div>
  )
}
