"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { PipelineStage } from "@/lib/types"
import { getStageColor } from "@/lib/stage-colors"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, TrendingUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function DashboardPage() {
  const [totalLeads, setTotalLeads] = useState(0)
  const [leadsByStage, setLeadsByStage] = useState<{ stage: PipelineStage; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const { currentWorkspaceId } = useWorkspace()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!currentWorkspaceId) {
      router.push("/onboarding/workspace")
      return
    }
    fetchDashboardData()
  }, [currentWorkspaceId])

  const fetchDashboardData = async () => {
    if (!currentWorkspaceId) return

    try {
      // Fetch all leads
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)

      if (leadsError) throw leadsError

      setTotalLeads(leadsData?.length || 0)

      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .order("sort_order")

      if (stagesError) throw stagesError

      // Calculate leads per stage
      const stageStats = stagesData?.map((stage) => {
        const count = leadsData?.filter((lead) => lead.stage_id === stage.id).length || 0
        return { stage, count }
      })

      setLeadsByStage(stageStats || [])
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

  if (!currentWorkspaceId) {
    return null
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your sales pipeline</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Leads Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">All leads in your workspace</p>
          </CardContent>
        </Card>

        {/* Active Stages Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Stages</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadsByStage.length}</div>
            <p className="text-xs text-muted-foreground">Active stages in pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Leads by Stage */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Leads by Stage</CardTitle>
            <CardDescription>Distribution of leads across your pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leadsByStage.map(({ stage, count }, index) => {
                const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0
                const stageColor = getStageColor(index)
                return (
                  <div key={stage.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stageColor }} />
                        <span className="font-medium">{stage.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: stageColor,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
