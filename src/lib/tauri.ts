import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { BackupPath, BackupSource, BackupItem, BackupProgress, BackupResult, RestoreResult, RestorePath, BackupInfo } from "@/types"

export async function readBackupConfig(): Promise<BackupPath[]> {
  return invoke<BackupPath[]>("read_backup_config")
}

export async function scanPaths(paths: string[]): Promise<BackupPath[]> {
  return invoke<BackupPath[]>("scan_paths", { paths })
}

export async function createBackup(
  sources: BackupSource[],
  outputDir: string
): Promise<BackupResult> {
  return invoke<BackupResult>("create_backup", { sources, outputDir })
}

export async function listBackupContents(zipPath: string): Promise<BackupItem[]> {
  return invoke<BackupItem[]>("list_backup_contents", { zipPath })
}

export async function listRestoreInfo(zipPath: string): Promise<{ backup_info: BackupInfo, sources: RestorePath[] }> {
  const [backup_info, sources] = await invoke<[BackupInfo, RestorePath[]]>("list_restore_info", { zipPath })
  return { backup_info, sources }
}

export async function restoreBackup(
  zipPath: string,
  backupNames: string[]
): Promise<RestoreResult> {
  return invoke<RestoreResult>("restore_backup", { zipPath, backupNames })
}

export async function onBackupProgress(callback: (progress: BackupProgress) => void): Promise<() => void> {
  const unlisten = await listen<BackupProgress>("backup-progress", (event) => {
    callback(event.payload)
  })
  return unlisten
}

export async function onRestoreProgress(callback: (progress: BackupProgress) => void): Promise<() => void> {
  const unlisten = await listen<BackupProgress>("restore-progress", (event) => {
    callback(event.payload)
  })
  return unlisten
}
