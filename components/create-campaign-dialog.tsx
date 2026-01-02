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
        title: "Sucesso",
        description: "Campanha criada com sucesso",
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
          <DialogTitle>Criar nova campanha</DialogTitle>
          <DialogDescription>Configure uma campanha de abordagem automatizada</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da campanha *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trigger">Etapa gatilho (opcional)</Label>
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
              <Label htmlFor="context">Contexto</Label>
              <Textarea
                id="context"
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                placeholder="Informacoes de base para a campanha"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="Instrucao para gerar mensagens"
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar campanha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
