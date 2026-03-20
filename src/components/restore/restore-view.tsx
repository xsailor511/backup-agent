"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileArchive, RotateCcw, AlertTriangle, Folder, File, Check, X, Info } from "lucide-react"
import { ProgressModal } from "@/components/shared/progress-modal"
import { listBackupContents, listRestoreInfo, restoreBackup, onRestoreProgress } from "@/lib/tauri"
import { useTranslation } from "@/lib/i18n"
import type { BackupItem, BackupProgress, RestoreInfo, RestorePath } from "@/types"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  } catch {
    return dateStr
  }
}

export function RestoreView() {
  const { t, locale } = useTranslation()
  const [selectedBackupFile, setSelectedBackupFile] = useState<string | null>(null)
  const [backupContents, setBackupContents] = useState<BackupItem[]>([])
  const [restoreInfo, setRestoreInfo] = useState<RestoreInfo | null>(null)
  const [selectedRestoreItems, setSelectedRestoreItems] = useState<Set<string>>(new Set())
  const [restoreInProgress, setRestoreInProgress] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState<BackupProgress | null>(null)
  const [lastRestoreResult, setLastRestoreResult] = useState<{
    success: boolean
    restored_count: number
    failed_count: number
    skipped_count: number
    error?: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cleanup: (() => void) | undefined
    onRestoreProgress((progress: BackupProgress) => {
      setRestoreProgress(progress)
    }).then(fn => {
      cleanup = fn
    })
    return () => cleanup?.()
  }, [])

  const restorePathMap = useMemo(() => {
    const map = new Map<string, RestorePath>()
    restoreInfo?.sources.forEach(s => map.set(s.backup_name, s))
    return map
  }, [restoreInfo?.sources])

  const getRestorePath = useCallback((backupName: string): RestorePath | undefined => {
    return restorePathMap.get(backupName)
  }, [restorePathMap])

  const toggleRestoreItem = useCallback((backupName: string) => {
    setSelectedRestoreItems(prev => {
      const next = new Set(prev)
      if (next.has(backupName)) {
        next.delete(backupName)
      } else {
        next.add(backupName)
      }
      return next
    })
  }, [])

  const selectAllRestoreItems = useCallback(() => {
    setSelectedRestoreItems(new Set(backupContents.map(item => item.name)))
  }, [backupContents])

  const deselectAllRestoreItems = useCallback(() => {
    setSelectedRestoreItems(new Set())
  }, [])

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: locale === "cn" ? "选择一个备份归档 (.zip)" : "Select backup archive",
        filters: [
          { name: locale === "cn" ? "ZIP 归档" : "ZIP Archives", extensions: ["zip"] },
          { name: locale === "cn" ? "所有文件" : "All Files", extensions: ["*"] },
        ],
      })

      if (selected && typeof selected === "string") {
        setSelectedBackupFile(selected)
        setLastRestoreResult(null)
        setIsLoading(true)

        try {
          const [contents, info] = await Promise.all([
            listBackupContents(selected),
            listRestoreInfo(selected),
          ])
          setBackupContents(contents)
          setRestoreInfo(info)
          setSelectedRestoreItems(new Set(contents.map(item => item.name)))
        } catch (err) {
          console.error("Failed to read backup:", err)
          setBackupContents([])
          setRestoreInfo(null)
        } finally {
          setIsLoading(false)
        }
      }
    } catch (err) {
      console.error("Dialog error:", err)
    }
  }

  const handleStartRestore = async () => {
    if (!selectedBackupFile || selectedRestoreItems.size === 0) return

    setRestoreInProgress(true)
    setRestoreProgress(null)
    setLastRestoreResult(null)

    try {
      const result = await restoreBackup(selectedBackupFile, Array.from(selectedRestoreItems))
      setLastRestoreResult(result)
    } catch (err) {
      setLastRestoreResult({
        success: false,
        restored_count: 0,
        failed_count: 0,
        skipped_count: 0,
        error: String(err),
      })
    } finally {
      setRestoreInProgress(false)
    }
  }

  const backupInfoDisplay = useMemo(() => {
    if (!restoreInfo) return null
    const info = restoreInfo.backup_info
    return {
      createdAt: formatDate(info.created_at),
      itemCount: info.item_count,
      totalSize: formatSize(info.total_size),
      platform: info.platform,
      itemsLabel: locale === "cn" ? "项目" : "Items",
      sizeLabel: locale === "cn" ? "大小" : "Size",
      platformLabel: locale === "cn" ? "平台" : "Platform",
      items: `${locale === "cn" ? "项目" : "Items"}: ${info.item_count}`,
      size: `${locale === "cn" ? "大小" : "Size"}: ${formatSize(info.total_size)}`,
    }
  }, [restoreInfo, locale])

  const itemsLabel = useMemo(() => {
    return locale === "cn" ? "items" : "items"
  }, [locale])

  const selectedCountDisplay = useMemo(() => {
    return `${selectedRestoreItems.size} / ${backupContents.length} ${itemsLabel}`
  }, [selectedRestoreItems.size, backupContents.length, itemsLabel])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("restore.title")}</h1>
        <p className="text-muted-foreground">{t("restore.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            {t("restore.selectFile")}
          </CardTitle>
          <CardDescription>
            {t("restore.selectFileSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={handleSelectFile}>
            <FileArchive className="h-4 w-4 mr-2" />
            {t("restore.selectFileButton")}
          </Button>

          {selectedBackupFile && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileArchive className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedBackupFile.split(/[/\\]/).pop()}</p>
                  <p className="text-sm text-muted-foreground break-all">{selectedBackupFile}</p>
                </div>
              </div>

              {backupInfoDisplay && (
                <div className="flex items-center gap-2 p-2 rounded bg-muted text-sm">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>
                    {locale === "cn" ? "创建时间" : "Created"}: {backupInfoDisplay.createdAt} | 
                    {backupInfoDisplay.items} | 
                    {backupInfoDisplay.size} |
                    {backupInfoDisplay.platformLabel}: {backupInfoDisplay.platform}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {backupContents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {t("restore.itemsTitle")}
            </CardTitle>
            <CardDescription>
              {t("restore.itemsSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t("restore.warning")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllRestoreItems}>
                <Check className="h-4 w-4 mr-1" />
                {t("restore.selectAll")}
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllRestoreItems}>
                <X className="h-4 w-4 mr-1" />
                {t("restore.deselectAll")}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                {backupContents.map(item => {
                  const restorePath = getRestorePath(item.name)
                  const isSelected = selectedRestoreItems.has(item.name)

                  return (
                    <div
                      key={item.name}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                      onClick={() => toggleRestoreItem(item.name)}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected 
                          ? "bg-primary border-primary" 
                          : "border-muted-foreground"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>

                      {item.is_directory ? (
                        <Folder className="h-5 w-5 text-blue-500 shrink-0" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.name}</span>
                          {item.is_directory && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0">
                              {t("common.folder")}
                            </span>
                          )}
                        </div>
                        {restorePath && (
                          <p className="text-sm text-muted-foreground truncate">
                            → <span className="font-mono text-xs">{restorePath.resolved_path}</span>
                          </p>
                        )}
                        {!restorePath && (
                          <p className="text-sm text-destructive">
                            {t("restore.targetNotFound")}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedCountDisplay}
            </div>
            <Button
              onClick={handleStartRestore}
              disabled={selectedRestoreItems.size === 0 || restoreInProgress}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("restore.startRestore")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {lastRestoreResult && (
        <Card className={lastRestoreResult.success ? "border-green-500" : "border-destructive"}>
          <CardHeader>
            <CardTitle>
              {lastRestoreResult.success ? t("restore.restoreComplete") : t("restore.restoreFailed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastRestoreResult.success ? (
              <div className="space-y-2">
                <p>{t("restore.restored", { count: lastRestoreResult.restored_count })}</p>
                {lastRestoreResult.failed_count > 0 && (
                  <p className="text-destructive">{t("restore.failed", { count: lastRestoreResult.failed_count })}</p>
                )}
                {lastRestoreResult.skipped_count > 0 && (
                  <p className="text-muted-foreground">{t("restore.skipped", { count: lastRestoreResult.skipped_count })}</p>
                )}
              </div>
            ) : (
              <p className="text-destructive">{lastRestoreResult.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      <ProgressModal
        open={restoreInProgress}
        progress={restoreProgress}
      />
    </div>
  )
}
