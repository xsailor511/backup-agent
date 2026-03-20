"use client"

import { useMemo, useState } from "react"
import { PathItem } from "./path-item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, FolderOutput, Check, X } from "lucide-react"
import type { BackupPath } from "@/types"

interface PathListProps {
  paths: BackupPath[]
  selectedPaths: string[]
  onToggle: (path: string) => void
  onRemove: (path: string) => void
}

export function PathList({ paths, selectedPaths, onToggle, onRemove }: PathListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["AI Tools", "Git/SSH", "Dev Config", "Shell/Notes", "用户添加", "未分类"])
  )
  
  const groupedPaths = useMemo(() => {
    const groups: Record<string, BackupPath[]> = {}
    
    for (const path of paths) {
      const category = path.category || "未分类"
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(path)
    }
    
    return Object.entries(groups).map(([name, paths]) => ({
      name,
      paths,
      isExpanded: expandedCategories.has(name)
    }))
  }, [paths, expandedCategories])
  
  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }
  
  const selectAllInCategory = (categoryPaths: BackupPath[]) => {
    categoryPaths.filter(p => p.exists).forEach(p => {
      if (!selectedPaths.includes(p.path)) {
        onToggle(p.path)
      }
    })
  }
  
  const deselectAllInCategory = (categoryPaths: BackupPath[]) => {
    categoryPaths.forEach(p => {
      if (selectedPaths.includes(p.path)) {
        onToggle(p.path)
      }
    })
  }
  
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {groupedPaths.map(group => (
          <div key={group.name} className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleCategory(group.name)}
                className="flex items-center gap-2 hover:bg-accent rounded px-2 py-1"
              >
                {group.isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <FolderOutput className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{group.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({group.paths.filter(p => p.exists).length}/{group.paths.length})
                </span>
              </button>
              
              <div className="flex-1" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectAllInCategory(group.paths)}
              >
                <Check className="h-3 w-3 mr-1" />
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deselectAllInCategory(group.paths)}
              >
                <X className="h-3 w-3 mr-1" />
                Deselect
              </Button>
            </div>
            
            {group.isExpanded && (
              <div className="space-y-1 pl-4">
                {group.paths.map(path => (
                  <PathItem
                    key={path.path}
                    path={path}
                    selected={selectedPaths.includes(path.path)}
                    onToggle={onToggle}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        
        {paths.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOutput className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No paths configured</p>
            <p className="text-sm">Add paths using the button above</p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}