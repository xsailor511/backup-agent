"use client"

import { Folder, File } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import type { BackupItem } from "@/types"

interface BackupItemProps {
  item: BackupItem
  selected: boolean
  onToggle: (path: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function BackupItem({ item, selected, onToggle }: BackupItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50",
        selected && "border-primary bg-primary/5"
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggle(item.path)}
      />
      
      {item.is_directory ? (
        <Folder className="h-5 w-5 text-muted-foreground" />
      ) : (
        <File className="h-5 w-5 text-muted-foreground" />
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.path}</p>
      </div>
      
      <span className="text-xs text-muted-foreground">
        {formatSize(item.original_size)}
      </span>
    </div>
  )
}