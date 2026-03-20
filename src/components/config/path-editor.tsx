"use client"

import { useState } from "react"
import { Folder, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/lib/i18n"

interface CategoryPaths {
  name: string
  paths: string[]
}

interface PathEditorProps {
  paths: CategoryPaths[]
  onAddPath: (category: string, path: string) => void
  onRemovePath: (category: string, path: string) => void
  onAddCategory: (name: string) => void
}

export function PathEditor({ paths, onAddPath, onRemovePath, onAddCategory }: PathEditorProps) {
  const { t, locale } = useTranslation()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(paths.map(p => p.name))
  )
  const [newCategory, setNewCategory] = useState("")
  const [newPathInput, setNewPathInput] = useState<Record<string, string>>({})
  
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
  
  const handleAddCategory = () => {
    if (newCategory.trim()) {
      onAddCategory(newCategory.trim())
      setNewCategory("")
    }
  }
  
  const handleAddPath = (category: string) => {
    const path = newPathInput[category] || ""
    if (path.trim()) {
      onAddPath(category, path.trim())
      setNewPathInput(prev => ({ ...prev, [category]: "" }))
    }
  }
  
  const placeholderPath = locale === "cn" ? "输入路径..." : "Enter path..."
  const placeholderCategory = locale === "cn" ? "新分类名称..." : "New category name..."
  const addCategoryBtn = locale === "cn" ? "添加分类" : "Add Category"
  const emptyMessage = locale === "cn" ? "暂无分类配置" : "No categories configured"

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[350px]">
        <div className="space-y-4">
          {paths.map(category => (
            <div key={category.name} className="space-y-2">
              <button
                onClick={() => toggleCategory(category.name)}
                className="flex items-center gap-2 hover:bg-accent rounded px-2 py-1 w-full text-left"
              >
                {expandedCategories.has(category.name) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Folder className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{category.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({category.paths.length})
                </span>
              </button>
              
              {expandedCategories.has(category.name) && (
                <div className="pl-6 space-y-1">
                  {category.paths.map(path => (
                    <div
                      key={path}
                      className="flex items-center gap-2 p-2 rounded border bg-card"
                    >
                      <span className="flex-1 text-sm truncate">{path}</span>
                      <button
                        onClick={() => onRemovePath(category.name, path)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder={placeholderPath}
                      value={newPathInput[category.name] || ""}
                      onChange={e => setNewPathInput(prev => ({ ...prev, [category.name]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && handleAddPath(category.name)}
                    />
                    <Button variant="outline" size="sm" onClick={() => handleAddPath(category.name)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {paths.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{emptyMessage}</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="flex gap-2">
        <Input
          placeholder={placeholderCategory}
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAddCategory()}
        />
        <Button variant="outline" onClick={handleAddCategory}>
          <Plus className="h-4 w-4 mr-2" />
          {addCategoryBtn}
        </Button>
      </div>
    </div>
  )
}
