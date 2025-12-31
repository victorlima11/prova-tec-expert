"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { Campaign, PipelineStage, WorkspaceMember } from "@/lib/types"
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
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (open && currentWorkspaceId) {
      fetchStages()
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

  const fetchTriggerCampaigns = async () => {
    if (!currentWorkspaceId) return

    const { data, error } = await supabase
      .from("campaigns")
      .select("id, trigger_stage_id, active, name, workspace_id, context, prompt, created_at")
      .eq("workspace_id", currentWorkspaceId)
      .eq("active", true)

    if (!error && data) {
      setTriggerCampaigns(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWorkspaceId) return

    setLoading(true)
    try {
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

      toast({
        title: "Success",
        description: "Lead created successfully",
      })

      if (data) {
        const campaignsToTrigger = triggerCampaigns.filter((campaign) => campaign.trigger_stage_id === data.stage_id)
        if (campaignsToTrigger.length > 0) {
          const results = await Promise.all(
            campaignsToTrigger.map((campaign) =>
              supabase.functions.invoke("generate-messages", {
                body: { lead_id: data.id, campaign_id: campaign.id },
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
      onOpenChange(false)
      onSuccess()
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
          <DialogDescription>Add a new lead to your pipeline</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage">Stage *</Label>
                <Select
                  value={formData.stage_id}
                  onValueChange={(value) => setFormData({ ...formData, stage_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
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
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsible-user">Responsible User</Label>
              <Select
                value={formData.responsible_user_id}
                onValueChange={(value) => setFormData({ ...formData, responsible_user_id: value })}
              >
                <SelectTrigger id="responsible-user">
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
