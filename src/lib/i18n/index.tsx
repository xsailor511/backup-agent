"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

type Locale = "cn" | "en"

interface LocaleOption {
  code: Locale
  name: string
  flag: string
}

export const localeOptions: LocaleOption[] = [
  { code: "cn", name: "中文", flag: "🇨🇳" },
  { code: "en", name: "English", flag: "🇺🇸" },
]

interface Translations {
  [key: string]: string | Translations
}

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

const cnTranslations: Translations = {
  app: { name: "AI资产备份", description: "本地备份与恢复工具" },
  nav: { backup: "备份", restore: "恢复", config: "配置" },
  backup: {
    title: "备份", subtitle: "选择要备份的文件和文件夹",
    pathsTitle: "待备份路径", pathsSubtitle: "选择要包含在备份中的文件夹和文件",
    addCustomPath: "添加自定义路径...", browse: "浏览", add: "添加",
    outputTitle: "输出位置", outputPlaceholder: "选择输出目录...",
    selectAll: "全选", deselectAll: "取消全选",
    selectedCount: "已选择 {count} 项", startBackup: "开始备份",
    backupComplete: "备份完成！", backupFailed: "备份失败",
    itemsBackedUp: "已备份项目：{count}", totalSize: "总大小：{size}", skipped: "已跳过：{count}",
    compressing: "正在压缩...", noOutputDir: "请先选择输出目录", noSelectedPaths: "请先选择要备份的路径"
  },
  restore: {
    title: "恢复", subtitle: "从备份归档中恢复文件",
    selectFile: "选择备份文件", selectFileSubtitle: "选择一个备份归档 (.zip) 进行恢复",
    selectFileButton: "选择备份文件", createdAt: "创建时间", platform: "平台",
    itemsTitle: "待恢复项目", itemsSubtitle: "选择要恢复的项目，显示备份名称和目标路径",
    warning: "如果目标文件夹/文件已存在，将先重命名为 folder_backup_YYYYMMDD_HHMMSS 再恢复",
    selectAll: "全选", deselectAll: "取消全选", startRestore: "开始恢复",
    restoreComplete: "恢复完成！", restoreFailed: "恢复失败",
    restored: "已恢复：{count}", failed: "失败：{count}", skipped: "已跳过：{count}",
    restoring: "正在恢复...", targetNotFound: "（目标路径未在配置中找到）"
  },
  config: {
    title: "配置", subtitle: "查看和管理备份配置", totalPaths: "共 {count} 个路径",
    windowsTitle: "Windows 配置", windowsDesc: "编辑 Windows 系统的备份路径",
    macTitle: "macOS 配置", macDesc: "编辑 macOS 系统的备份路径",
    importBtn: "导入", exportBtn: "导出", addPathBtn: "添加路径",
    saveBtn: "查看说明",
    importSuccess: "配置已导入！", importFailed: "导入失败", importNote: "配置文件已内置于应用中，无法在运行时修改。请重新编译应用来更改配置。",
    exportNote: "导出功能需要在 Tauri 应用中运行。",
    selectFile: "选择文件", selectPath: "选择路径",
    categories: {
      aiTools: "AI 工具", gitSsh: "Git/SSH", devConfig: "开发配置",
      shellNotes: "Shell/笔记", userAdded: "用户添加", uncategorized: "未分类"
    }
  },
  common: { loading: "加载中...", error: "错误", success: "成功", cancel: "取消", confirm: "确认", close: "关闭", size: "大小", folder: "文件夹", file: "文件" },
  errors: { pathNotExist: "路径不存在", pathNotDirectory: "路径不是文件夹", pathAlreadyAdded: "路径已添加", failedToLoad: "加载失败", failedToBackup: "备份失败", failedToRestore: "恢复失败" }
}

const enTranslations: Translations = {
  app: { name: "BackupYourAI", description: "Local backup and restore tool" },
  nav: { backup: "Backup", restore: "Restore", config: "Config" },
  backup: {
    title: "Backup", subtitle: "Select files and folders to backup",
    pathsTitle: "Paths to Backup", pathsSubtitle: "Select which folders and files to include in your backup",
    addCustomPath: "Add custom path...", browse: "Browse", add: "Add",
    outputTitle: "Output Location", outputPlaceholder: "Select output directory...",
    selectAll: "Select All", deselectAll: "Deselect All",
    selectedCount: "{count} items selected", startBackup: "Start Backup",
    backupComplete: "Backup Complete!", backupFailed: "Backup Failed",
    itemsBackedUp: "Items backed up: {count}", totalSize: "Total size: {size}", skipped: "Skipped: {count}",
    compressing: "Compressing...", noOutputDir: "Please select an output directory first", noSelectedPaths: "Please select paths to backup first"
  },
  restore: {
    title: "Restore", subtitle: "Restore files from backup archives",
    selectFile: "Select Backup File", selectFileSubtitle: "Choose a backup archive (.zip) to restore from",
    selectFileButton: "Select Backup File", createdAt: "Created", platform: "Platform",
    itemsTitle: "Items to Restore", itemsSubtitle: "Select which items to restore. Showing backup name and target path.",
    warning: "If target folder/file already exists, it will be renamed to folder_backup_YYYYMMDD_HHMMSS before restoration",
    selectAll: "Select All", deselectAll: "Deselect All", startRestore: "Start Restore",
    restoreComplete: "Restore Complete!", restoreFailed: "Restore Failed",
    restored: "Restored: {count}", failed: "Failed: {count}", skipped: "Skipped: {count}",
    restoring: "Restoring...", targetNotFound: "(Target path not found in config)"
  },
  config: {
    title: "Config", subtitle: "View and manage backup configuration", totalPaths: "{count} paths total",
    windowsTitle: "Windows Configuration", windowsDesc: "Edit backup paths for Windows system",
    macTitle: "macOS Configuration", macDesc: "Edit backup paths for macOS system",
    importBtn: "Import", exportBtn: "Export", addPathBtn: "Add Path",
    saveBtn: "View Instructions",
    importSuccess: "Configuration imported successfully!", importFailed: "Import failed", importNote: "Configuration file is embedded in the application and cannot be modified at runtime. Please recompile the application to change the configuration.",
    exportNote: "Export function needs to run in Tauri application.",
    selectFile: "Select File", selectPath: "Select Path",
    categories: {
      aiTools: "AI Tools", gitSsh: "Git/SSH", devConfig: "Dev Config",
      shellNotes: "Shell/Notes", userAdded: "User Added", uncategorized: "Uncategorized"
    }
  },
  common: { loading: "Loading...", error: "Error", success: "Success", cancel: "Cancel", confirm: "Confirm", close: "Close", size: "Size", folder: "Folder", file: "File" },
  errors: { pathNotExist: "Path does not exist", pathNotDirectory: "Path is not a directory", pathAlreadyAdded: "Path already added", failedToLoad: "Failed to load", failedToBackup: "Failed to backup", failedToRestore: "Failed to restore" }
}

const translations: Record<Locale, Translations> = { cn: cnTranslations, en: enTranslations }

function getNestedValue(obj: Translations, path: string): string | undefined {
  const keys = path.split(".")
  let current: Translations | string | undefined = obj
  for (const key of keys) {
    if (typeof current === "object" && current !== null && key in current) {
      current = current[key]
    } else {
      return undefined
    }
  }
  return typeof current === "string" ? current : undefined
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("cn")

  useEffect(() => {
    const stored = localStorage.getItem("locale") as Locale | null
    if (stored && (stored === "cn" || stored === "en")) {
      setLocaleState(stored)
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem("locale", newLocale)
    document.documentElement.lang = newLocale
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    const translation = getNestedValue(translations[locale], key)
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`)
      return key
    }
    return params ? interpolate(translation, params) : translation
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useTranslation must be used within I18nProvider")
  }
  return context
}
