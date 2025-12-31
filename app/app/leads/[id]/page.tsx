"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { Campaign, GeneratedMessage, Lead, LeadCustomField, PipelineStage, WorkspaceMember } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Trash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface LeadDetailPageProps {
  params: { id: string }
}

export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = params
  const [lead, setLead] = useState<Lead | null>(null)
  const [initialStageId, setInitialStageId] = useState<string | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [customFields, setCustomFields] = useState<LeadCustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceMember[]>([])
  const [requiredFieldsByStage, setRequiredFieldsByStage] = useState<Record<string, string[]>>({})
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("")
  const [generatedMessages, setGeneratedMessages] = useState<GeneratedMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
  }, [id, currentWorkspaceId])

  const fetchData = async () => {
    if (!currentWorkspaceId) return

    try {
      // Fetch lead
      const { data: leadData, error: leadError } = await supabase.from("leads").select("*").eq("id", id).single()

      if (leadError) throw leadError
      setLead(leadData)
      setInitialStageId(leadData?.stage_id ?? null)

      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("sort_order")

      if (stagesError) throw stagesError
      setStages(stagesData || [])

      // Fetch custom fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("lead_custom_fields")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("created_at")

      if (fieldsError) throw fieldsError
      setCustomFields(fieldsData || [])

      // Fetch custom values
      const { data: valuesData, error: valuesError } = await supabase
        .from("lead_custom_values")
        .select("*")
        .eq("lead_id", id)

      if (valuesError) throw valuesError

      const valuesMap: Record<string, string> = {}
      valuesData?.forEach((v) => {
        valuesMap[v.field_id] = v.value || ""
      })
      setCustomValues(valuesMap)

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

      const { data: usersData, error: usersError } = await supabase
        .from("workspace_users")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("created_at", { ascending: true })

      if (usersError) throw usersError
      setWorkspaceUsers(usersData || [])

      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .eq("active", true)
        .order("created_at", { ascending: false })

      if (campaignsError) throw campaignsError
      setCampaigns(campaignsData || [])
      if (campaignsData?.length && !selectedCampaignId) {
        setSelectedCampaignId(campaignsData[0].id)
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from("generated_messages")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })

      if (messagesError) throw messagesError
      setGeneratedMessages(messagesData || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!lead) return

    try {
      const requiredKeys = requiredFieldsByStage[lead.stage_id] || []
      if (requiredKeys.length > 0) {
        const standardLabelMap: Record<string, string> = {
          name: "Nome",
          email: "Email",
          phone: "Telefone",
          company: "Empresa",
          job_title: "Cargo",
          source: "Origem",
          notes: "Observacoes",
          responsible_user_id: "Responsavel",
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
          customFieldIds.forEach((fieldId) => {
            const value = customValues[fieldId]
            if (!value || value.trim() === "") {
              const fieldName = customFields.find((field) => field.id === fieldId)?.name
              missing.push(fieldName ? `${fieldName} (Personalizado)` : `Campo ${fieldId}`)
            }
          })
        }

        if (missing.length > 0) {
          toast({
            title: "Campos obrigatorios faltando",
            description: `Preencha: ${missing.join(", ")}`,
            variant: "destructive",
          })
          return
        }
      }

      setSaving(true)

      // Update lead basic fields
      const { error: leadError } = await supabase.from("leads").update(lead).eq("id", id)

      if (leadError) throw leadError

      if (lead.stage_id && lead.stage_id !== initialStageId) {
        const campaignsToTrigger = campaigns.filter((campaign) => campaign.trigger_stage_id === lead.stage_id)
        if (campaignsToTrigger.length > 0) {
          const results = await Promise.all(
            campaignsToTrigger.map((campaign) =>
              supabase.functions.invoke("generate-messages", {
                body: { lead_id: id, campaign_id: campaign.id },
              }),
            ),
          )
          const failed = results.find((result) => result.error)
          if (failed?.error) {
            toast({
              title: "Aviso",
              description: "Nao foi possivel gerar mensagens automaticamente.",
              variant: "destructive",
            })
          }
        }
        setInitialStageId(lead.stage_id)
      }

      // Update custom values
      for (const fieldId in customValues) {
        const { error: valueError } = await supabase.from("lead_custom_values").upsert(
          {
            lead_id: id,
            field_id: fieldId,
            value: customValues[fieldId],
          },
          {
            onConflict: "lead_id,field_id",
          },
        )

        if (valueError) throw valueError
      }

      toast({
        title: "Success",
        description: "Lead updated successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this lead?")) return

    try {
      const { error } = await supabase.from("leads").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Lead deleted successfully",
      })
      router.push("/app/leads")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleGenerateMessages = async () => {
    if (!selectedCampaignId) {
      toast({
        title: "Selecione uma campanha",
        description: "Escolha uma campanha ativa para gerar mensagens.",
        variant: "destructive",
      })
      return
    }

    setGenerating(true)
    try {
      const { error } = await supabase.functions.invoke("generate-messages", {
        body: {
          lead_id: id,
          campaign_id: selectedCampaignId,
        },
      })

      if (error) throw error

      const { data: messagesData, error: messagesError } = await supabase
        .from("generated_messages")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })

      if (messagesError) throw messagesError
      setGeneratedMessages(messagesData || [])

      toast({
        title: "Success",
        description: "Mensagens geradas",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleSendMessage = async () => {
    if (!lead) return

    setSending(true)
    try {
      const targetStage = stages.find((stage) => stage.name.toLowerCase() === "tentando contato")
      if (targetStage && lead.stage_id !== targetStage.id) {
        const { error } = await supabase.from("leads").update({ stage_id: targetStage.id }).eq("id", id)
        if (error) throw error
        setLead({ ...lead, stage_id: targetStage.id })
      }

      toast({
        title: "Success",
        description: "Mensagem enviada (simulado). Lead movido para Tentando Contato.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  if (!currentWorkspaceId) {
    return null
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading lead...</p>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core details about this lead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage">Stage *</Label>
                <Select value={lead.stage_id} onValueChange={(value) => setLead({ ...lead, stage_id: value })}>
                  <SelectTrigger>
                    <SelectValue />
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
                  value={lead.email || ""}
                  onChange={(e) => setLead({ ...lead, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={lead.phone || ""}
                  onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={lead.company || ""}
                  onChange={(e) => setLead({ ...lead, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={lead.job_title || ""}
                  onChange={(e) => setLead({ ...lead, job_title: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={lead.source || ""}
                onChange={(e) => setLead({ ...lead, source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={lead.notes || ""}
                onChange={(e) => setLead({ ...lead, notes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsible User</Label>
              <Select
                value={lead.responsible_user_id ?? "none"}
                onValueChange={(value) =>
                  setLead({ ...lead, responsible_user_id: value === "none" ? null : value })
                }
              >
                <SelectTrigger id="responsible">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {workspaceUsers.map((user) => (
                    <SelectItem key={user.id} value={user.user_id}>
                      {user.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {customFields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>Additional information specific to your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Mensagens IA</CardTitle>
            <CardDescription>Gere mensagens personalizadas para este lead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>Campanha ativa</Label>
                <Select value={selectedCampaignId} onValueChange={(value) => setSelectedCampaignId(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={handleGenerateMessages} disabled={generating || !selectedCampaignId}>
                  {generating ? "Gerando..." : "Gerar mensagens"}
                </Button>
                <Button type="button" variant="outline" onClick={handleSendMessage} disabled={sending}>
                  {sending ? "Enviando..." : "Enviar (simulado)"}
                </Button>
              </div>
            </div>

            {generatedMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem gerada ainda.</p>
            ) : (
              <div className="space-y-3">
                {generatedMessages.map((message) => (
                  <Card key={message.id} className="border-dashed">
                    <CardContent className="p-4">
                      <p className="text-sm">{message.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
