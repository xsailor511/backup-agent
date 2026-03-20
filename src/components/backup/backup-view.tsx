"use client"

import { useEffect, useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FolderOutput, FolderOpen, Play, Plus } from "lucide-react"
import { PathList } from "./path-list"
import { ProgressModal } from "@/components/shared/progress-modal"
import { useBackupStore } from "@/stores/backup-store"
import { readBackupConfig, createBackup, onBackupProgress, scanPaths } from "@/lib/tauri"
import { useTranslation } from "@/lib/i18n"
import type { BackupSource, BackupProgress } from "@/types"

export function BackupView() {
  const { t } = useTranslation()
  const {
    configPaths,
    selectedPaths,
    setConfigPaths,
    togglePath,
    selectAllPaths,
    deselectAllPaths,
    outputDir,
    setOutputDir,
    backupInProgress,
    setBackupInProgress,
    backupProgress,
    setBackupProgress,
    lastBackupResult,
    setLastBackupResult,
  } = useBackupStore()
  
  const [newPath, setNewPath] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  
  useEffect(() => {
    readBackupConfig()
      .then(paths => {
        setConfigPaths(paths)
        selectAllPaths()
      })
      .catch(err => {
        console.error("Failed to load config:", err)
      })
  }, [])
  
  useEffect(() => {
    let cleanup: (() => void) | undefined
    onBackupProgress((progress: BackupProgress) => {
      setBackupProgress(progress)
    }).then(fn => {
      cleanup = fn
    })
    return () => cleanup?.()
  }, [])
  
  const handleAddPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("backup.pathsSubtitle"),
      })
      
      if (selected && typeof selected === "string") {
        setNewPath(selected)
      }
    } catch (err) {
      console.error("Dialog error:", err)
    }
  }
  
  const handleAddManualPath = async () => {
    if (newPath.trim()) {
      const pathToAdd = newPath.trim()
      const exists = configPaths.some(p => p.path === pathToAdd)
      if (exists) {
        setAddError(t("errors.pathAlreadyAdded"))
        return
      }
      
      try {
        const scanned = await scanPaths([pathToAdd])
        const validated = scanned[0]
        
        if (!validated.exists) {
          setAddError(t("errors.pathNotExist"))
          return
        }
        
        if (!validated.is_directory) {
          setAddError(t("errors.pathNotDirectory"))
          return
        }
        
        setAddError(null)
        setConfigPaths([...configPaths, validated])
        if (!selectedPaths.includes(pathToAdd)) {
          togglePath(pathToAdd)
        }
      } catch (err) {
        setAddError(String(err))
        return
      }
      
      setNewPath("")
    }
  }
  
  const handleRemovePath = (path: string) => {
    setConfigPaths(configPaths.filter(p => p.path !== path))
  }
  
  const handleSelectOutputDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("backup.outputTitle"),
      })
      
      if (selected && typeof selected === "string") {
        setOutputDir(selected)
      }
    } catch (err) {
      console.log("Dialog not available")
    }
  }
  
  const handleStartBackup = async () => {
    if (!outputDir || selectedPaths.length === 0) return
    
    setBackupInProgress(true)
    setBackupProgress(null)
    setLastBackupResult(null)
    
    try {
      const sources: BackupSource[] = selectedPaths
        .map(path => {
          const configPath = configPaths.find(p => p.path === path)
          return {
            original_path: path,
            source_path: configPath?.resolved || path,
            is_directory: configPath?.is_directory ?? true,
          }
        })
      
      const result = await createBackup(sources, outputDir)
      setLastBackupResult(result)
    } catch (err) {
      setLastBackupResult({
        success: false,
        output_path: "",
        item_count: 0,
        total_size: 0,
        skipped_count: 0,
        error: String(err),
      })
    } finally {
      setBackupInProgress(false)
    }
  }
  
  const selectedSize = configPaths
    .filter(p => selectedPaths.includes(p.path) && p.exists)
    .reduce((sum, p) => sum + (p.size || 0), 0)
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} GB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("backup.title")}</h1>
        <p className="text-muted-foreground">{t("backup.subtitle")}</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOutput className="h-5 w-5" />
            {t("backup.pathsTitle")}
          </CardTitle>
          <CardDescription>
            {t("backup.pathsSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={t("backup.addCustomPath")}
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddManualPath()}
            />
            <Button variant="outline" onClick={handleAddPath}>
              <Plus className="h-4 w-4 mr-2" />
              {t("backup.browse")}
            </Button>
            <Button variant="outline" onClick={handleAddManualPath}>
              {t("backup.add")}
            </Button>
          </div>
          
          {addError && (
            <p className="text-sm text-destructive">{addError}</p>
          )}
          
          <PathList
            paths={configPaths}
            selectedPaths={selectedPaths}
            onToggle={togglePath}
            onRemove={handleRemovePath}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t("backup.outputTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={t("backup.outputPlaceholder")}
              value={outputDir}
              readOnly
              className="flex-1"
            />
            <Button variant="outline" onClick={handleSelectOutputDir}>
              {t("backup.browse")}
            </Button>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Filename: backup_YYYY-MM-DD_HH-MM-SS.zip</span>
            <span>|</span>
            <span>{t("backup.totalSize", { size: formatSize(selectedSize) })}</span>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="text-sm text-muted-foreground">
            {t("backup.selectedCount", { count: selectedPaths.length })}
          </div>
          <Button
            onClick={handleStartBackup}
            disabled={!outputDir || selectedPaths.length === 0 || backupInProgress}
          >
            <Play className="h-4 w-4 mr-2" />
            {t("backup.startBackup")}
          </Button>
        </CardFooter>
      </Card>
      
      {lastBackupResult && (
        <Card className={lastBackupResult.success ? "border-green-500" : "border-destructive"}>
          <CardHeader>
            <CardTitle>
              {lastBackupResult.success ? t("backup.backupComplete") : t("backup.backupFailed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastBackupResult.success ? (
              <div className="space-y-2">
                <p>Output: {lastBackupResult.output_path}</p>
                <p>{t("backup.itemsBackedUp", { count: lastBackupResult.item_count })}</p>
                <p>{t("backup.totalSize", { size: formatSize(lastBackupResult.total_size) })}</p>
                {lastBackupResult.skipped_count > 0 && (
                  <p className="text-muted-foreground">{t("backup.skipped", { count: lastBackupResult.skipped_count })}</p>
                )}
              </div>
            ) : (
              <p className="text-destructive">{lastBackupResult.error}</p>
            )}
          </CardContent>
        </Card>
      )}
      
      <ProgressModal
        open={backupInProgress}
        progress={backupProgress}
      />
    </div>
  )
}
