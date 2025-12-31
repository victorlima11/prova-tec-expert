"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { Lead, PipelineStage, LeadCustomField } from "@/lib/types"
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
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [customFields, setCustomFields] = useState<LeadCustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
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

    setSaving(true)
    try {
      // Update lead basic fields
      const { error: leadError } = await supabase.from("leads").update(lead).eq("id", id)

      if (leadError) throw leadError

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
              <Input
                id="responsible"
                value="Not assigned"
                disabled
                className="text-muted-foreground"
                placeholder="Coming soon"
              />
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
      </div>
    </div>
  )
}
