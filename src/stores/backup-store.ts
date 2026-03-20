import { create } from 'zustand'
import type { BackupPath, BackupItem, BackupProgress, BackupResult, RestoreResult } from '@/types'

interface BackupStore {
  // Config paths
  configPaths: BackupPath[];
  selectedPaths: string[];
  
  // Backup state
  backupInProgress: boolean;
  backupProgress: BackupProgress | null;
  outputDir: string;
  lastBackupResult: BackupResult | null;
  
  // Restore state
  restoreInProgress: boolean;
  restoreProgress: BackupProgress | null;
  selectedBackupFile: string | null;
  backupContents: BackupItem[];
  selectedRestoreItems: string[];
  lastRestoreResult: RestoreResult | null;
  
  // Config
  currentProfile: 'windows' | 'mac';
  
  // Actions
  setConfigPaths: (paths: BackupPath[]) => void;
  togglePath: (path: string) => void;
  selectAllPaths: () => void;
  deselectAllPaths: () => void;
  setOutputDir: (dir: string) => void;
  setBackupInProgress: (inProgress: boolean) => void;
  setBackupProgress: (progress: BackupProgress | null) => void;
  setLastBackupResult: (result: BackupResult | null) => void;
  
  // Restore actions
  setSelectedBackupFile: (file: string | null) => void;
  setBackupContents: (contents: BackupItem[]) => void;
  toggleRestoreItem: (path: string) => void;
  selectAllRestoreItems: () => void;
  deselectAllRestoreItems: () => void;
  setRestoreInProgress: (inProgress: boolean) => void;
  setRestoreProgress: (progress: BackupProgress | null) => void;
  setLastRestoreResult: (result: RestoreResult | null) => void;
  
  // Config actions
  setCurrentProfile: (profile: 'windows' | 'mac') => void;
  reset: () => void;
}

const initialState = {
  configPaths: [],
  selectedPaths: [],
  backupInProgress: false,
  backupProgress: null,
  outputDir: '',
  lastBackupResult: null,
  restoreInProgress: false,
  restoreProgress: null,
  selectedBackupFile: null,
  backupContents: [],
  selectedRestoreItems: [],
  lastRestoreResult: null,
  currentProfile: 'windows' as const,
}

export const useBackupStore = create<BackupStore>((set, get) => ({
  ...initialState,
  
  setConfigPaths: (paths) => set({ configPaths: paths }),
  
  togglePath: (path) => set((state) => {
    const selected = state.selectedPaths.includes(path)
      ? state.selectedPaths.filter(p => p !== path)
      : [...state.selectedPaths, path]
    return { selectedPaths: selected }
  }),
  
  selectAllPaths: () => set((state) => ({
    selectedPaths: state.configPaths.filter(p => p.exists).map(p => p.path)
  })),
  
  deselectAllPaths: () => set({ selectedPaths: [] }),
  
  setOutputDir: (dir) => set({ outputDir: dir }),
  
  setBackupInProgress: (inProgress) => set({ backupInProgress: inProgress }),
  
  setBackupProgress: (progress) => set({ backupProgress: progress }),
  
  setLastBackupResult: (result) => set({ lastBackupResult: result }),
  
  setSelectedBackupFile: (file) => set({ selectedBackupFile: file }),
  
  setBackupContents: (contents) => set({ backupContents: contents }),
  
  toggleRestoreItem: (itemPath) => set((state) => {
    const selected = state.selectedRestoreItems.includes(itemPath)
      ? state.selectedRestoreItems.filter(p => p !== itemPath)
      : [...state.selectedRestoreItems, itemPath]
    return { selectedRestoreItems: selected }
  }),
  
  selectAllRestoreItems: () => set((state) => ({
    selectedRestoreItems: state.backupContents.map(c => c.path)
  })),
  
  deselectAllRestoreItems: () => set({ selectedRestoreItems: [] }),
  
  setRestoreInProgress: (inProgress) => set({ restoreInProgress: inProgress }),
  
  setRestoreProgress: (progress) => set({ restoreProgress: progress }),
  
  setLastRestoreResult: (result) => set({ lastRestoreResult: result }),
  
  setCurrentProfile: (profile) => set({ currentProfile: profile }),
  
  reset: () => set(initialState),
}))
