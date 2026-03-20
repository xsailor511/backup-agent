# BackupAgent Implementation Plan

**Based on**: `docs/plans/2026-03-19-backup-agent-design.md`  
**Stack**: Tauri v2 + Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Zustand

---

## Phase 1: Project Scaffolding

### 1.1 Initialize Tauri + Next.js Project

**Task**: `src-tauri/init.md` — Scaffold Tauri v2 project with Next.js frontend

- [ ] **1.1.1** Create Tauri app with Next.js template
  ```bash
  npm create tauri-app@latest backup-agent -- --template next-ts --manager npm
  ```
- [ ] **1.1.2** Install dependencies
  ```bash
  npm install zustand lucide-react class-variance-authority clsx tailwind-merge
  npx shadcn@latest init
  ```
- [ ] **1.1.3** Add shadcn/ui components
  ```bash
  npx shadcn@latest add button card checkbox input label tabs dialog progress toast dropdown-menu scroll-area
  ```
- [ ] **1.1.4** Configure Tailwind with custom colors and Inter font
- [ ] **1.1.5** Add Rust `zip` crate to `src-tauri/Cargo.toml`
  ```toml
  zip = "2.0"
  ```
- [ ] **1.1.6** Configure Tauri permissions for filesystem access in `tauri.conf.json`
  - Enable `fs` plugin with scope for user-selected directories
  - Enable `dialog` plugin for native file/folder pickers
  - Set `devtools: true` for development

### 1.2 Configure TypeScript & Path Aliases

**Task**: `tsconfig.json` — Configure path aliases

- [ ] **1.2.1** Add `@/*` alias pointing to `src/`
- [ ] **1.2.2** Add `@tauri-apps/api` type reference

### 1.3 Set Up Zustand Store

**Task**: `src/stores/backup-store.ts` — Create Zustand store for shared state

- [ ] **1.3.1** Define store interfaces:
  ```typescript
  interface BackupStore {
    // Config paths
    configPaths: BackupPath[];
    selectedPaths: Set<string>;
    
    // Backup state
    backupInProgress: boolean;
    backupProgress: BackupProgress | null;
    outputDir: string;
    
    // Restore state
    restoreInProgress: boolean;
    restoreProgress: BackupProgress | null;
    selectedBackupFile: string | null;
    backupContents: BackupItem[];
    selectedRestoreItems: Set<string>;
    
    // Config
    currentProfile: 'windows' | 'mac';
    
    // Actions
    setConfigPaths: (paths: BackupPath[]) => void;
    togglePath: (path: string) => void;
    setOutputDir: (dir: string) => void;
    // ... etc
  }
  ```
- [ ] **1.3.2** Implement all actions (toggle, add, remove, reset)

### 1.4 Define TypeScript Types

**Task**: `src/types/index.ts`

- [ ] **1.4.1** Define `BackupPath`, `BackupItem`, `BackupProgress`, `BackupResult`, `RestoreResult` interfaces matching Rust structs

---

## Phase 2: Rust Backend Commands

### 2.1 Config Reader

**Task**: `src-tauri/src/commands/config.rs`

- [ ] **2.1.1** Implement `read_backup_config(config_path: &str) -> Vec<BackupPath>`
  - Parse `.txt` file, skip comments (`#`) and empty lines
  - Expand `~` to user home directory
  - Expand environment variables (`%USERPROFILE%`, `$HOME`)
  - Detect category from path patterns
- [ ] **2.1.2** Handle file not found gracefully → return empty vec with error in Result

### 2.2 Path Scanner

**Task**: `src-tauri/src/commands/scan.rs`

- [ ] **2.2.1** Implement `scan_paths(paths: Vec<String>) -> Vec<PathMeta>`
  - For each path: check exists, get size, mtime, is_directory
  - Non-existent paths: `exists: false`, size/mtime: null
- [ ] **2.2.2** Handle permission denied → return with `exists: false` and error flag

### 2.3 Backup Creator

**Task**: `src-tauri/src/commands/backup.rs`

- [ ] **2.3.1** Implement `create_backup(sources, output_dir) -> BackupResult`
  - Input: `Vec<(original_path: String, source_path: String)>`
  - Output: zip file path, item count, total size, skipped count
  - **Streaming zip**: use `zip` crate's `ZipWriter` with `File::create`
  - Store entries with original relative paths (e.g. `~/.gitconfig` stored as `~/.gitconfig` in zip)
- [ ] **2.3.2** Progress callback via events (`emit("backup-progress", progress)`)
  - Emit at each file start: `{ current, total, current_file, phase: "compressing" }`
- [ ] **2.3.3** Skip non-existent paths silently (count in skipped)
- [ ] **2.3.4** Handle disk full / write errors → return partial result with error message

### 2.4 Backup Lister

**Task**: `src-tauri/src/commands/restore.rs`

- [ ] **2.4.1** Implement `list_backup_contents(zip_path: String) -> Vec<BackupItem>`
  - Read zip file entries without extracting
  - Return: name, relative path, compressed size, uncompressed size, is_directory
  - Filter out zip metadata entries (`.`, `__MACOSX`, etc.)
- [ ] **2.4.2** Support both `.zip` format

### 2.5 Restore Executor

**Task**: `src-tauri/src/commands/restore.rs`

- [ ] **2.5.1** Implement `restore_backup(zip_path, items, output_dir) -> RestoreResult`
  - Extract selected entries from zip
  - Restore to original paths resolved relative to a base directory (or use stored paths directly)
  - **Conflict handling**: if target exists → rename to `.{name}.backup_{timestamp}`
  - Progress events: `{ phase: "extracting" | "restoring", current, total, current_file }`
- [ ] **2.5.2** Report: success count, failed count, skipped count

### 2.6 Register Commands

**Task**: `src-tauri/src/main.rs`

- [ ] **2.6.1** Register all commands with `#[tauri::command]` attributes
- [ ] **2.6.2** Set up event emitters for progress
- [ ] **2.6.3** Add error handler middleware

---

## Phase 3: Frontend UI Shell

### 3.1 App Layout

**Task**: `src/app/layout.tsx`

- [ ] **3.1.1** Create root layout with sidebar navigation
- [ ] **3.1.2** Theme provider (next-themes) with dark/light/system modes
- [ ] **3.1.3** Sidebar: icons + labels for Backup, Restore, Config tabs
- [ ] **3.1.4** Main content area with proper padding

### 3.2 Navigation Routing

**Task**: `src/app/` — Set up Next.js App Router

- [ ] **3.2.1** `src/app/page.tsx` → redirect to `/backup`
- [ ] **3.2.2** `src/app/backup/page.tsx` → BackupView
- [ ] **3.2.3** `src/app/restore/page.tsx` → RestoreView
- [ ] **3.2.4** `src/app/config/page.tsx` → ConfigView

### 3.3 Tauri API Wrapper

**Task**: `src/lib/tauri.ts`

- [ ] **3.3.1** Create typed wrappers for all Tauri invoke calls:
  ```typescript
  export async function readBackupConfig(path: string) {
    return invoke<BackupPath[]>('read_backup_config', { configPath: path });
  }
  export async function createBackup(sources: BackupSource[], outputDir: string) {
    return invoke<BackupResult>('create_backup', { sources, outputDir });
  }
  // etc.
  ```
- [ ] **3.3.2** Set up Tauri event listeners for progress updates

---

## Phase 4: Backup View

### 4.1 Path List Component

**Task**: `src/components/backup/PathList.tsx`

- [ ] **4.1.1** Load config on mount via Tauri command
- [ ] **4.1.2** Display paths grouped by category (collapsible sections)
- [ ] **4.1.3** Each `PathItem`: checkbox, folder/file icon, path name, size badge, status indicator
- [ ] **4.1.4** Non-existent paths: grayed out, red "Missing" badge, checkbox disabled
- [ ] **4.1.5** Select all / deselect all per category

### 4.2 Add/Remove Path

**Task**: `src/components/backup/PathList.tsx`

- [ ] **4.2.1** "Add Path" button → opens Tauri native folder picker via `@tauri-apps/plugin-dialog`
- [ ] **4.2.2** "Remove" button per path → removes from local list only (not config file)
- [ ] **4.2.3** Path input field for manual entry

### 4.3 Output Configuration

**Task**: `src/components/backup/BackupView.tsx`

- [ ] **4.3.1** Output directory selector with "Browse" button
- [ ] **4.3.2** Filename preview with current timestamp
- [ ] **4.3.3** Estimated total size (sum of selected existing paths)

### 4.4 Backup Action

**Task**: `src/components/backup/BackupView.tsx`

- [ ] **4.4.1** "Start Backup" button → disabled if no valid paths selected or no output dir
- [ ] **4.4.2** On click: call `create_backup` Tauri command
- [ ] **4.4.3** Open progress modal during operation

### 4.5 Progress Modal

**Task**: `src/components/shared/ProgressModal.tsx`

- [ ] **4.5.1** Modal with title (Backup/Restore), progress bar, file name, percentage
- [ ] **4.5.2** Phase label: "Scanning...", "Compressing...", "Extracting...", "Restoring..."
- [ ] **4.5.3** Cancel button → sends cancel signal to Rust (use `AbortController` or state flag)
- [ ] **4.5.4** On complete: show success/failure summary
- [ ] **4.5.5** "Open Folder" button on success

---

## Phase 5: Restore View

### 5.1 File Selector

**Task**: `src/components/restore/RestoreView.tsx`

- [ ] **5.1.1** "Select Backup File" button → Tauri native file picker (filter: `.zip`)
- [ ] **5.1.2** Display selected file info: name, size, date, item count

### 5.2 Backup Contents List

**Task**: `src/components/restore/BackupItemList.tsx`

- [ ] **5.2.1** After file selected: call `list_backup_contents`
- [ ] **5.2.2** Display items: checkbox, icon, name, size
- [ ] **5.2.3** "Select All" / "Deselect All" buttons
- [ ] **5.2.4** Sort by path for readability

### 5.3 Restore Action

**Task**: `src/components/restore/RestoreView.tsx`

- [ ] **5.3.1** "Start Restore" button → disabled if no items selected
- [ ] **5.3.2** Call `restore_backup` Tauri command
- [ ] **5.3.3** Reuse `ProgressModal` component
- [ ] **5.3.4** On complete: show summary (success/failed/skipped)

---

## Phase 6: Config View

### 6.1 Profile Selector

**Task**: `src/components/config/ConfigView.tsx`

- [ ] **6.1.1** Dropdown: "Windows" / "macOS" profile selector
- [ ] **6.1.2** On change: reload config from corresponding `.txt` file

### 6.2 Path Editor

**Task**: `src/components/config/PathEditor.tsx`

- [ ] **6.2.1** Editable list of paths with add/remove
- [ ] **6.2.2** Categories: collapsible sections with section headers
- [ ] **6.2.3** Inline editing of path text
- [ ] **6.2.4** "Save" button → write back to config file (via Rust command with atomic write)

### 6.3 Import/Export

**Task**: `src/components/config/ConfigView.tsx`

- [ ] **6.3.1** "Import Config" → load external `.txt` file
- [ ] **6.3.2** "Export Config" → save current config to user-selected location

---

## Phase 7: Polish & Error Handling

### 7.1 Error Handling

- [ ] **7.1.1** Wrap all Tauri invocations in try/catch
- [ ] **7.1.2** Display errors via shadcn/ui `toast` notifications
- [ ] **7.1.3** Rust commands return structured `Result<T, String>` for typed errors

### 7.2 Theme & Styling

- [ ] **7.2.1** Implement dark/light mode toggle in sidebar
- [ ] **7.2.2** Use CSS variables for consistent theming
- [ ] **7.2.3** Responsive layout (min-width: 800px, sidebar collapsible)

### 7.3 Window Management

- [ ] **7.3.1** Set minimum window size (800x600)
- [ ] **7.3.2** Window title: "BackupAgent"
- [ ] **7.3.3** Native window controls (standard title bar)

### 7.4 Loading States

- [ ] **7.4.1** Skeleton loaders for initial config loading
- [ ] **7.4.2** Disabled states for buttons during operations
- [ ] **7.4.3** Optimistic UI updates where safe

---

## Phase 8: Build & Release

### 8.1 Build Configuration

- [ ] **8.1.1** Configure `tauri.conf.json`:
  - App name: `BackupAgent`
  - Bundle identifier: `com.backupagent.app`
  - Enable devtools for debug builds
- [ ] **8.1.2** Set up build scripts for Windows (.exe) and macOS (.app)

### 8.2 Testing

- [ ] **8.2.1** Test backup with 10+ paths (mix of files/dirs, existing/missing)
- [ ] **8.2.2** Test restore: verify files land in correct locations
- [ ] **8.2.3** Test conflict handling: restore to path with existing file
- [ ] **8.2.4** Test large backup (> 1GB) for progress responsiveness
- [ ] **8.2.5** Test path edge cases: special characters, long paths, Unicode names

### 8.3 Release

- [ ] **8.3.1** Windows: `.exe` installer or portable `.exe`
- [ ] **8.3.2** macOS: `.dmg` or `.app` bundle
- [ ] **8.3.3** Include default config files in bundle

---

## Implementation Order (Critical Path)

```
Phase 1 (Scaffold) → Phase 2 (Rust) → Phase 3 (UI Shell) → Phase 4 (Backup) → Phase 5 (Restore) → Phase 6 (Config) → Phase 7+8
```

**Parallel opportunities within phases:**
- Phase 1: Steps 1.1–1.3 can run in parallel (setup tasks)
- Phase 2: Steps 2.1–2.5 are sequential (each builds on types)
- Phase 3: Steps 3.1–3.3 can run in parallel
- Phase 4–6: Sequential per view
- Phase 7+8: Sequential at end
