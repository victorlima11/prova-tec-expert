"use client"

import type React from "react"

import { useState } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { PipelineStage } from "@/lib/types"
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
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

interface CreateCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  stages: PipelineStage[]
}

export function CreateCampaignDialog({ open, onOpenChange, onSuccess, stages }: CreateCampaignDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    context: "",
    prompt: "",
    active: true,
    trigger_stage_id: "none",
  })
  const [loading, setLoading] = useState(false)
  const { currentWorkspaceId } = useWorkspace()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWorkspaceId) return

    setLoading(true)
    try {
      const { error } = await supabase.from("campaigns").insert({
        workspace_id: currentWorkspaceId,
        ...formData,
        trigger_stage_id: formData.trigger_stage_id === "none" ? null : formData.trigger_stage_id,
      })

      if (error) throw error

      toast({
        title: "Success",
        description: "Campaign created successfully",
      })

      // Reset form
      setFormData({
        name: "",
        context: "",
        prompt: "",
        active: true,
        trigger_stage_id: "none",
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
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>Set up an automated outreach campaign for your leads</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trigger">Trigger Stage (Optional)</Label>
              <Select
                value={formData.trigger_stage_id}
                onValueChange={(value) => setFormData({ ...formData, trigger_stage_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stage to trigger this campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No trigger</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="context">Context</Label>
              <Textarea
                id="context"
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                placeholder="Background information for this campaign"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="AI prompt template for generating messages"
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
