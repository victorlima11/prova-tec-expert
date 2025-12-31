"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface WorkspaceContextType {
  currentWorkspaceId: string | null
  setCurrentWorkspaceId: (id: string | null) => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("currentWorkspaceId")
    if (stored) {
      setCurrentWorkspaceIdState(stored)
    }
  }, [])

  // Save to localStorage when changed
  const setCurrentWorkspaceId = (id: string | null) => {
    setCurrentWorkspaceIdState(id)
    if (id) {
      localStorage.setItem("currentWorkspaceId", id)
    } else {
      localStorage.removeItem("currentWorkspaceId")
    }
  }

  return (
    <WorkspaceContext.Provider value={{ currentWorkspaceId, setCurrentWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider")
  }
  return context
}
