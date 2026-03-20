"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { FolderOutput, RotateCcw, Settings } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { LanguageSwitcher } from "./language-switcher"

const navItems = [
  { href: "/backup", icon: FolderOutput },
  { href: "/restore", icon: RotateCcw },
  { href: "/config", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h1 className="text-lg font-semibold truncate pr-2">{t("app.name")}</h1>
        <LanguageSwitcher />
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const label = t(`nav.${item.href.slice(1)}`)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
