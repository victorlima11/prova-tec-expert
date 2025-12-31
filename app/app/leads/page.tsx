"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { Lead, PipelineStage } from "@/lib/types"
import { getStageColor } from "@/lib/stage-colors"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CreateLeadDialog } from "@/components/create-lead-dialog"

export default function LeadsPage() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
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

  const getLeadsByStage = (stageId: string) => {
    return leads.filter((lead) => lead.stage_id === stageId)
  }

  const handleMoveLead = async (leadId: string, stageId: string) => {
    const targetLead = leads.find((lead) => lead.id === leadId)
    if (!targetLead || targetLead.stage_id === stageId) return

    setMovingLeadId(leadId)
    try {
      const { error } = await supabase.from("leads").update({ stage_id: stageId }).eq("id", leadId)

      if (error) throw error

      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, stage_id: stageId } : lead)))
    } catch (error: any) {
      toast({
        title: "Error",
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
        <p className="text-muted-foreground">Loading leads...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">Manage your sales leads in a kanban board</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
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
                          <p className="mt-2 text-xs text-muted-foreground">Moving...</p>
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
