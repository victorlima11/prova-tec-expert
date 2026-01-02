"use client"

import { LayoutDashboard, Users, Megaphone, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const menuItems = [
  {
    title: "Painel",
    href: "/app/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Leads",
    href: "/app/leads",
    icon: Users,
  },
  {
    title: "Campanhas",
    href: "/app/campaigns",
    icon: Megaphone,
  },
  {
    title: "Configurações",
    href: "/app/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-border/70 bg-sidebar shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] sm:flex">
      <div className="flex h-16 items-center border-b border-border/70 px-6">
        <h1 className="text-lg font-semibold tracking-tight text-sidebar-foreground">Mini CRM</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.title}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
