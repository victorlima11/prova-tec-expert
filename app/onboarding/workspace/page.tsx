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
import { useToast } from "@/hooks/use-toast"

export default function WorkspaceOnboardingPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const { setCurrentWorkspaceId } = useWorkspace()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const { data, error } = await supabase.from("workspaces").select("*").order("created_at", { ascending: false })

      if (error) throw error

      setWorkspaces(data || [])
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
        title: "Success",
        description: "Workspace created successfully",
      })

      // Set as current workspace and navigate
      setCurrentWorkspaceId(data)
      router.push("/app/dashboard")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const selectWorkspace = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    router.push("/app/dashboard")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading workspaces...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Select or Create a Workspace</CardTitle>
          <CardDescription>Choose an existing workspace or create a new one to get started</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create new workspace */}
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <h3 className="font-semibold">Create New Workspace</h3>
            <form onSubmit={createWorkspace} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  placeholder="My Sales Team"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Workspace"}
              </Button>
            </form>
          </div>

          {/* Existing workspaces */}
          {workspaces.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Your Workspaces</h3>
              <div className="grid gap-3">
                {workspaces.map((workspace) => (
                  <Card
                    key={workspace.id}
                    className="cursor-pointer hover:border-primary"
                    onClick={() => selectWorkspace(workspace.id)}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">{workspace.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Created {new Date(workspace.created_at).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
