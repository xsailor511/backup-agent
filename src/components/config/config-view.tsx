"use client"

import { useEffect, useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { readTextFile } from "@tauri-apps/plugin-fs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Settings, Save, Upload, Download, Plus } from "lucide-react"
import { PathEditor } from "./path-editor"
import { useBackupStore } from "@/stores/backup-store"
import { readBackupConfig } from "@/lib/tauri"
import { useTranslation } from "@/lib/i18n"

interface CategoryPaths {
  name: string
  paths: string[]
}

export function ConfigView() {
  const { t, locale } = useTranslation()
  const { currentProfile, setCurrentProfile } = useBackupStore()
  const [editedPaths, setEditedPaths] = useState<CategoryPaths[]>([])
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  
  useEffect(() => {
    readBackupConfig()
      .then(paths => {
        const grouped: Record<string, string[]> = {}
        paths.forEach(p => {
          const category = p.category || (locale === "cn" ? "未分类" : "Uncategorized")
          if (!grouped[category]) grouped[category] = []
          grouped[category].push(p.path)
        })
        setEditedPaths(Object.entries(grouped).map(([name, paths]) => ({ name, paths })))
      })
      .catch(err => {
        console.error("Failed to load config:", err)
        setEditedPaths([])
      })
  }, [currentProfile, locale])
  
  const handleAddPath = (category: string, path: string) => {
    setEditedPaths(prev =>
      prev.map(cat =>
        cat.name === category
          ? { ...cat, paths: [...cat.paths, path] }
          : cat
      )
    )
  }
  
  const handleRemovePath = (category: string, path: string) => {
    setEditedPaths(prev =>
      prev.map(cat =>
        cat.name === category
          ? { ...cat, paths: cat.paths.filter(p => p !== path) }
          : cat
      )
    )
  }
  
  const handleAddCategory = (name: string) => {
    if (!editedPaths.some(c => c.name === name)) {
      setEditedPaths(prev => [...prev, { name, paths: [] }])
    }
  }
  
  const handleSave = async () => {
    setSaveMessage({ type: "error", text: t("config.importNote") })
  }
  
  const handleImport = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: locale === "cn" ? "导入配置文件" : t("config.selectFile"),
        filters: [{ name: locale === "cn" ? "文本文件" : "Text Files", extensions: ["txt"] }],
      })
      
      if (selected && typeof selected === "string") {
        const content = await readTextFile(selected)
        
        const grouped: Record<string, string[]> = {}
        const uncategorized = locale === "cn" ? "未分类" : "Uncategorized"
        const aiTools = locale === "cn" ? "AI 工具" : "AI Tools"
        const gitSsh = locale === "cn" ? "Git/SSH" : "Git/SSH"
        const devConfig = locale === "cn" ? "开发配置" : "Dev Config"
        const shellNotes = locale === "cn" ? "Shell/笔记" : "Shell/Notes"
        
        content.split("\n").forEach(line => {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith("#")) {
            let category = uncategorized
            const lower = trimmed.toLowerCase()
            if (lower.includes("claude") || lower.includes("cursor") || lower.includes("ollama") || lower.includes("kode")) category = aiTools
            else if (lower.includes("git") || lower.includes("ssh")) category = gitSsh
            else if (lower.includes("vscode") || lower.includes("npm") || lower.includes("config")) category = devConfig
            else if (lower.includes("obsidian") || lower.includes("zsh")) category = shellNotes
            
            if (!grouped[category]) grouped[category] = []
            grouped[category].push(trimmed)
          }
        })
        
        setEditedPaths(
          Object.entries(grouped).map(([name, paths]) => ({ name, paths }))
        )
        setSaveMessage({ type: "success", text: t("config.importSuccess") })
      }
    } catch (err) {
      console.error("Failed to import:", err)
      setSaveMessage({ type: "error", text: `${t("config.importFailed")}: ${err}` })
    }
  }

  const handleExport = async () => {
    setSaveMessage({ type: "error", text: t("config.exportNote") })
  }
  
  const handleAddCustomPath = async (category: string) => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: locale === "cn" ? "选择要添加的路径" : t("config.selectPath"),
      })
      
      if (selected && typeof selected === "string") {
        handleAddPath(category, selected)
      }
    } catch (err) {
      console.error("Dialog error:", err)
    }
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("config.title")}</h1>
        <p className="text-muted-foreground">{t("config.subtitle")}</p>
      </div>
      
      <Tabs value={currentProfile} onValueChange={(v) => setCurrentProfile(v as "windows" | "mac")}>
        <TabsList>
          <TabsTrigger value="windows">Windows</TabsTrigger>
          <TabsTrigger value="mac">macOS</TabsTrigger>
        </TabsList>
        
        <TabsContent value="windows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("config.windowsTitle")}
              </CardTitle>
              <CardDescription>
                {t("config.windowsDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PathEditor
                paths={editedPaths}
                onAddPath={handleAddPath}
                onRemovePath={handleRemovePath}
                onAddCategory={handleAddCategory}
              />
              
              {editedPaths.map(category => (
                <div key={category.name} className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{category.name}</Label>
                    <Button variant="outline" size="sm" onClick={() => handleAddCustomPath(category.name)}>
                      <Plus className="h-3 w-3 mr-1" />
                      {t("config.addPathBtn")}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("config.importBtn")}
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("config.exportBtn")}
                </Button>
              </div>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {t("config.saveBtn")}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="mac" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("config.macTitle")}
              </CardTitle>
              <CardDescription>
                {t("config.macDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PathEditor
                paths={editedPaths}
                onAddPath={handleAddPath}
                onRemovePath={handleRemovePath}
                onAddCategory={handleAddCategory}
              />
              
              {editedPaths.map(category => (
                <div key={category.name} className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{category.name}</Label>
                    <Button variant="outline" size="sm" onClick={() => handleAddCustomPath(category.name)}>
                      <Plus className="h-3 w-3 mr-1" />
                      {t("config.addPathBtn")}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("config.importBtn")}
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("config.exportBtn")}
                </Button>
              </div>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {t("config.saveBtn")}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      {saveMessage && (
        <div className={`p-4 rounded-lg ${
          saveMessage.type === "success" 
            ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
            : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
        }`}>
          {saveMessage.text}
        </div>
      )}
    </div>
  )
}
