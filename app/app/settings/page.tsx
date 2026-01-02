"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { LeadCustomField, PipelineStage, StageRequiredField } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const standardFields = [
  { key: "name", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "company", label: "Empresa" },
  { key: "job_title", label: "Cargo" },
  { key: "source", label: "Origem" },
  { key: "notes", label: "Observações" },
  { key: "responsible_user_id", label: "Responsável" },
]

export default function SettingsPage() {
  const [customFields, setCustomFields] = useState<LeadCustomField[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [requiredFields, setRequiredFields] = useState<StageRequiredField[]>([])
  const [selectedStageId, setSelectedStageId] = useState<string>("")
  const [savingRequired, setSavingRequired] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldType, setNewFieldType] = useState<LeadCustomField["field_type"]>("text")
  const [creatingField, setCreatingField] = useState(false)
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
    fetchSettings()
  }, [currentWorkspaceId])

  const fetchSettings = async () => {
    if (!currentWorkspaceId) return

    try {
      const [{ data: stagesData, error: stagesError }, { data: fieldsData, error: fieldsError }] = await Promise.all([
        supabase.from("pipeline_stages").select("*").eq("workspace_id", currentWorkspaceId).order("sort_order"),
        supabase.from("lead_custom_fields").select("*").eq("workspace_id", currentWorkspaceId).order("created_at"),
      ])

      if (stagesError) throw stagesError
      if (fieldsError) throw fieldsError

      setStages(stagesData || [])
      setCustomFields(fieldsData || [])

      if (stagesData?.length && !selectedStageId) {
        setSelectedStageId(stagesData[0].id)
      }
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

  useEffect(() => {
    if (!currentWorkspaceId || !selectedStageId) return
    fetchRequiredFields(selectedStageId)
  }, [currentWorkspaceId, selectedStageId])

  const fetchRequiredFields = async (stageId: string) => {
    if (!currentWorkspaceId) return

    const { data, error } = await supabase
      .from("stage_required_fields")
      .select("*")
      .eq("workspace_id", currentWorkspaceId)
      .eq("stage_id", stageId)
      .order("created_at")

    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    setRequiredFields(data || [])
  }

  const requiredKeys = useMemo(() => new Set(requiredFields.map((field) => field.field_key)), [requiredFields])

  const fieldOptions = useMemo(() => {
    const custom = customFields.map((field) => ({
      key: `custom:${field.id}`,
      label: `${field.name} (Personalizado)`,
    }))
    return [...standardFields, ...custom]
  }, [customFields])

  const toggleRequiredField = (fieldKey: string, checked: boolean) => {
    setRequiredFields((prev) => {
      if (checked) {
        if (prev.some((field) => field.field_key === fieldKey)) return prev
        return [
          ...prev,
          {
            id: `temp-${fieldKey}`,
            workspace_id: currentWorkspaceId || "",
            stage_id: selectedStageId,
            field_key: fieldKey,
            created_at: new Date().toISOString(),
          },
        ]
      }
      return prev.filter((field) => field.field_key !== fieldKey)
    })
  }

  const saveRequiredFields = async () => {
    if (!currentWorkspaceId || !selectedStageId) return
    setSavingRequired(true)
    try {
      const { error: deleteError } = await supabase
        .from("stage_required_fields")
        .delete()
        .eq("workspace_id", currentWorkspaceId)
        .eq("stage_id", selectedStageId)

      if (deleteError) throw deleteError

      if (requiredKeys.size > 0) {
        const { error: insertError } = await supabase.from("stage_required_fields").insert(
          Array.from(requiredKeys).map((fieldKey) => ({
            workspace_id: currentWorkspaceId,
            stage_id: selectedStageId,
            field_key: fieldKey,
          })),
        )

        if (insertError) throw insertError
      }

      toast({
        title: "Sucesso",
        description: "Campos obrigatórios atualizados",
      })
      fetchRequiredFields(selectedStageId)
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSavingRequired(false)
    }
  }

  const handleCreateField = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentWorkspaceId || !newFieldName.trim()) return

    setCreatingField(true)
    try {
      const { error } = await supabase.from("lead_custom_fields").insert({
        workspace_id: currentWorkspaceId,
        name: newFieldName.trim(),
        field_type: newFieldType,
      })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Campo personalizado criado",
      })
      setNewFieldName("")
      setNewFieldType("text")
      fetchSettings()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setCreatingField(false)
    }
  }

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Remover este campo personalizado?")) return

    try {
      const { error } = await supabase.from("lead_custom_fields").delete().eq("id", fieldId)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Campo removido",
      })
      fetchSettings()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie as configurações do workspace</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campos personalizados</CardTitle>
          <CardDescription>Adicione campos personalizados para os leads do workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleCreateField} className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="custom-field-name">Nome do campo</Label>
              <Input
                id="custom-field-name"
                value={newFieldName}
                onChange={(event) => setNewFieldName(event.target.value)}
                placeholder="Ex: Segmento"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newFieldType} onValueChange={(value) => setNewFieldType(value as LeadCustomField["field_type"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="number">Numero</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={creatingField}>
              {creatingField ? "Criando..." : "Adicionar"}
            </Button>
          </form>

          {customFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum campo personalizado criado.</p>
          ) : (
            <div className="space-y-3">
              {customFields.map((field) => (
                <div key={field.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="font-medium">{field.name}</p>
                    <p className="text-xs text-muted-foreground">Tipo: {field.field_type}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteField(field.id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campos Obrigatorios por Etapa</CardTitle>
          <CardDescription>Defina o que precisa estar preenchido antes de mover um lead</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={selectedStageId} onValueChange={(value) => setSelectedStageId(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
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

          <div className="grid gap-3 md:grid-cols-2">
            {fieldOptions.map((field) => (
              <label key={field.key} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <Checkbox
                  checked={requiredKeys.has(field.key)}
                  onCheckedChange={(checked) => toggleRequiredField(field.key, Boolean(checked))}
                />
                <span className="text-sm">{field.label}</span>
              </label>
            ))}
          </div>

          <Button onClick={saveRequiredFields} disabled={savingRequired || !selectedStageId}>
            {savingRequired ? "Salvando..." : "Salvar campos obrigatórios"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
