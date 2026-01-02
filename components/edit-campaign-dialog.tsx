"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import type { Campaign, PipelineStage } from "@/lib/types"
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

interface EditCampaignDialogProps {
  campaign: Campaign
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  stages: PipelineStage[]
}

export function EditCampaignDialog({ campaign, open, onOpenChange, onSuccess, stages }: EditCampaignDialogProps) {
  const [formData, setFormData] = useState({
    name: campaign.name,
    context: campaign.context || "",
    prompt: campaign.prompt || "",
    active: campaign.active,
    trigger_stage_id: campaign.trigger_stage_id ?? "none",
  })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  useEffect(() => {
    setFormData({
      name: campaign.name,
      context: campaign.context || "",
      prompt: campaign.prompt || "",
      active: campaign.active,
      trigger_stage_id: campaign.trigger_stage_id ?? "none",
    })
  }, [campaign])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({
          ...formData,
          trigger_stage_id: formData.trigger_stage_id === "none" ? null : formData.trigger_stage_id,
        })
        .eq("id", campaign.id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Campanha atualizada com sucesso",
      })

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
          <DialogTitle>Editar campanha</DialogTitle>
          <DialogDescription>Atualize as configurações da campanha</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome da campanha *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-trigger">Etapa gatilho (opcional)</Label>
              <Select
                value={formData.trigger_stage_id}
                onValueChange={(value) => setFormData({ ...formData, trigger_stage_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa gatilho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem gatilho</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-context">Contexto</Label>
              <Textarea
                id="edit-context"
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                placeholder="Informações de base para a campanha"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-prompt">Prompt</Label>
              <Textarea
                id="edit-prompt"
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="Instrução para gerar mensagens"
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="edit-active">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
