"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/lib/workspace-context"
import { useAuth } from "@/lib/auth-context"
import type { Workspace } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, LogOut, Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AppTopbar() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspace()
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!user) return
    fetchWorkspaces()
  }, [user])

  useEffect(() => {
    if (currentWorkspaceId && workspaces.length > 0) {
      const workspace = workspaces.find((w) => w.id === currentWorkspaceId)
      setCurrentWorkspace(workspace || null)
    }
  }, [currentWorkspaceId, workspaces])

  const fetchWorkspaces = async () => {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setWorkspaces(data)
      if (currentWorkspaceId && !data.find((workspace) => workspace.id === currentWorkspaceId)) {
        setCurrentWorkspaceId(null)
      }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setCurrentWorkspaceId(null)
    router.push("/auth")
  }

  const switchWorkspace = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    toast({
      title: "Workspace alterado",
      description: "Você trocou de workspace com sucesso",
    })
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-6 backdrop-blur">
      <div className="flex items-center gap-4">
        {currentWorkspace && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Building2 className="h-4 w-4" />
                {currentWorkspace.name}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Trocar workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => switchWorkspace(workspace.id)}
                  className={workspace.id === currentWorkspaceId ? "bg-accent" : ""}
                >
                  {workspace.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/onboarding/workspace")}>
                Criar novo workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              {user?.email ?? "Conta"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
