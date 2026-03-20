"use client"

import { Folder, File, Trash2, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import type { BackupPath } from "@/types"

interface PathItemProps {
  path: BackupPath
  selected: boolean
  onToggle: (path: string) => void
  onRemove: (path: string) => void
}

function formatSize(bytes?: number): string {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function PathItem({ path, selected, onToggle, onRemove }: PathItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
        path.exists
          ? "border-border hover:bg-accent/50"
          : "border-destructive/50 bg-destructive/5",
        selected && "border-primary bg-primary/5"
      )}
    >
      <Checkbox
        checked={selected}
        disabled={!path.exists}
        onCheckedChange={() => onToggle(path.path)}
      />
      
      {path.is_directory ? (
        <Folder className="h-5 w-5 text-muted-foreground" />
      ) : (
        <File className="h-5 w-5 text-muted-foreground" />
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{path.path}</p>
        {path.resolved !== path.path && (
          <p className="text-xs text-muted-foreground truncate">{path.resolved}</p>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {path.exists ? (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            {formatSize(path.size)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="h-3 w-3" />
            Missing
          </span>
        )}
        
        <button
          onClick={() => onRemove(path.path)}
          className="p-1 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}