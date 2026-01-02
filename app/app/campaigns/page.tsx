"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { Campaign, PipelineStage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CreateCampaignDialog } from "@/components/create-campaign-dialog"
import { EditCampaignDialog } from "@/components/edit-campaign-dialog"

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
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
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("created_at", { ascending: false })

      if (campaignsError) throw campaignsError
      setCampaigns(campaignsData || [])

      // Fetch stages for trigger selection
      const { data: stagesData, error: stagesError } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("sort_order")

      if (stagesError) throw stagesError
      setStages(stagesData || [])
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

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return

    try {
      const { error } = await supabase.from("campaigns").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Campanha excluída com sucesso",
      })
      fetchData()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const getTriggerStageName = (stageId: string | null) => {
    if (!stageId) return "Sem gatilho"
    const stage = stages.find((s) => s.id === stageId)
    return stage?.name || "Etapa desconhecida"
  }

  if (!currentWorkspaceId) {
    return null
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Carregando campanhas...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Gerencie campanhas de abordagem automatizada</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova campanha
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-muted-foreground">Nenhuma campanha ainda. Crie a primeira!</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant={campaign.active ? "default" : "secondary"} className="mt-1">
                        {campaign.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingCampaign(campaign)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(campaign.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Gatilho: </span>
                  <span className="text-muted-foreground">{getTriggerStageName(campaign.trigger_stage_id)}</span>
                </div>
                {campaign.context && (
                  <div>
                    <span className="font-medium">Contexto: </span>
                    <p className="text-muted-foreground">{campaign.context.slice(0, 100)}...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchData}
        stages={stages}
      />

      {editingCampaign && (
        <EditCampaignDialog
          campaign={editingCampaign}
          open={!!editingCampaign}
          onOpenChange={(open) => !open && setEditingCampaign(null)}
          onSuccess={fetchData}
          stages={stages}
        />
      )}
    </div>
  )
}
