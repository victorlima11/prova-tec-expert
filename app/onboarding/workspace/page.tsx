"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import type { Workspace } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Pencil, Trash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function WorkspaceOnboardingPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [editingName, setEditingName] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const router = useRouter()
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspace()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })

      if (error) throw error

      setWorkspaces(data || [])
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

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return

    setCreating(true)
    try {
      const { data, error } = await supabase.rpc("create_workspace_with_defaults", {
        p_name: newWorkspaceName.trim(),
      })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Workspace criado com sucesso",
      })

      // Set as current workspace and navigate
      setCurrentWorkspaceId(data)
      router.push("/app/dashboard")
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const startEditWorkspace = (workspace: Workspace) => {
    setEditingWorkspace(workspace)
    setEditingName(workspace.name)
  }

  const handleEditWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingWorkspace || !editingName.trim()) return

    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: editingName.trim() })
        .eq("id", editingWorkspace.id)

      if (error) throw error

      setWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === editingWorkspace.id ? { ...workspace, name: editingName.trim() } : workspace,
        ),
      )

      toast({
        title: "Sucesso",
        description: "Workspace atualizado com sucesso",
      })
      setEditingWorkspace(null)
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm("Tem certeza que deseja arquivar este workspace?")) return

    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", workspaceId)

      if (error) throw error

      setWorkspaces((prev) => prev.filter((workspace) => workspace.id !== workspaceId))

      if (currentWorkspaceId === workspaceId) {
        setCurrentWorkspaceId(null)
      }

      toast({
        title: "Sucesso",
        description: "Workspace arquivado com sucesso",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const selectWorkspace = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    router.push("/app/dashboard")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando workspaces...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Escolha ou crie um workspace</CardTitle>
          <CardDescription>Selecione um workspace existente ou crie um novo para começar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create new workspace */}
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <h3 className="font-semibold">Criar novo workspace</h3>
            <form onSubmit={createWorkspace} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Nome do workspace</Label>
                <Input
                  id="workspace-name"
                  placeholder="Meu time comercial"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Criando..." : "Criar workspace"}
              </Button>
            </form>
          </div>

          {/* Existing workspaces */}
          {workspaces.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Seus workspaces</h3>
              <div className="grid gap-3">
                {workspaces.map((workspace) => (
                  <Card
                    key={workspace.id}
                    className="cursor-pointer transition hover:border-primary"
                    onClick={() => selectWorkspace(workspace.id)}
                  >
                    <CardHeader className="flex flex-row items-start justify-between gap-4 p-4">
                      <div>
                        <CardTitle className="text-base">{workspace.name}</CardTitle>
                        <CardDescription className="text-xs">
                          Criado em {new Date(workspace.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation()
                            startEditWorkspace(workspace)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteWorkspace(workspace.id)
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingWorkspace} onOpenChange={(open) => !open && setEditingWorkspace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar workspace</DialogTitle>
            <DialogDescription>Atualize o nome do workspace</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditWorkspace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-edit-name">Nome do workspace</Label>
              <Input
                id="workspace-edit-name"
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingWorkspace(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
