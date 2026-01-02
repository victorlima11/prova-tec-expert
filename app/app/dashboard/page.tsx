"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { PipelineStage } from "@/lib/types"
import { getStageColor } from "@/lib/stage-colors"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Users, TrendingUp } from "lucide-react"
import { Cell, Pie, PieChart } from "recharts"
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
        title: "Erro",
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
        <p className="text-muted-foreground">Carregando painel...</p>
      </div>
    )
  }

  const chartData = leadsByStage
    .map(({ stage, count }, index) => ({
      name: stage.name,
      value: count,
      color: getStageColor(index),
    }))
    .filter((entry) => entry.value > 0)

  const chartConfig = chartData.reduce<ChartConfig>((acc, entry) => {
    acc[entry.name] = { label: entry.name, color: entry.color }
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Painel</h1>
        <p className="text-sm text-muted-foreground">Visao geral do funil e do volume de leads</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="bg-gradient-to-br from-background via-background to-muted/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold tracking-tight">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">Todos os leads do workspace</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background via-background to-muted/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Etapas ativas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold tracking-tight">{leadsByStage.length}</div>
            <p className="text-xs text-muted-foreground">Etapas configuradas no funil</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por etapa</CardTitle>
          <CardDescription>Visao consolidada dos leads no funil</CardDescription>
        </CardHeader>
        <CardContent>
          {totalLeads === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há leads para mostrar.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    strokeWidth={1}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>

              <div className="grid gap-3">
                {leadsByStage.map(({ stage, count }, index) => {
                  const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0
                  const stageColor = getStageColor(index)
                  return (
                    <div key={stage.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stageColor }} />
                          <span className="font-medium">{stage.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {count} leads · {percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: stageColor }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
