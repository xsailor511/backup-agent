"use client"

import { BackupItem } from "./backup-item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Check, X, FolderOutput } from "lucide-react"
import type { BackupItem as BackupItemType } from "@/types"

interface BackupItemListProps {
  items: BackupItemType[]
  selectedItems: string[]
  onToggle: (path: string) => void
}

export function BackupItemList({ items, selectedItems, onToggle }: BackupItemListProps) {
  const selectAll = () => {
    items.forEach(item => {
      if (!selectedItems.includes(item.path)) {
        onToggle(item.path)
      }
    })
  }
  
  const deselectAll = () => {
    items.forEach(item => {
      if (selectedItems.includes(item.path)) {
        onToggle(item.path)
      }
    })
  }
  
  const totalSize = items.reduce((sum, item) => sum + item.original_size, 0)
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {items.length} items ({formatSize(totalSize)})
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            <Check className="h-3 w-3 mr-1" />
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            <X className="h-3 w-3 mr-1" />
            Deselect All
          </Button>
        </div>
      </div>
      
      <ScrollArea className="h-[400px]">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOutput className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No items in backup</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map(item => (
              <BackupItem
                key={item.path}
                item={item}
                selected={selectedItems.includes(item.path)}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}