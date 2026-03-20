# BackupAgent Web Application Design

**Date**: 2026-03-19  
**Author**: Sisyphus  
**Status**: Approved

---

## 1. Overview

Convert existing PowerShell/bash backup scripts into a Tauri desktop application with a modern web UI. The app lets users select folders/files from a pre-configured list, create compressed backups with original paths preserved, and restore from backup archives — all processed locally without server uploads.

---

## 2. Technical Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop Framework | **Tauri v2** | Native performance, small binary (~10MB), Rust backend |
| Frontend Framework | **Next.js 14** (App Router) | Full-stack capability, TypeScript support |
| Language | **TypeScript** | Type safety throughout |
| Styling | **Tailwind CSS** | Utility-first, rapid development |
| Component Library | **shadcn/ui** | Accessible, customizable components |
| State Management | **Zustand** | Lightweight, minimal boilerplate |
| Compression | **Rust `zip` crate** | Streaming compression in backend |
| Build Tool | **Vite** (via Tauri) | Fast HMR for development |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│              Tauri Desktop Application               │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              Next.js Frontend                  │  │
│  │                                               │  │
│  │  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │ BackupView  │  │ RestoreView │            │  │
│  │  └──────┬──────┘  └──────┬──────┘            │  │
│  │         │                │                    │  │
│  │  ┌──────┴────────────────┴──────┐            │  │
│  │  │       Zustand Store          │            │  │
│  │  └──────────────┬───────────────┘            │  │
│  └────────────────┼────────────────────────────┘  │
│                   │ IPC (invoke)                  │
│  ┌────────────────┴────────────────────────────┐  │
│  │           Rust Tauri Commands                │  │
│  │                                               │  │
│  │  • read_config(paths from .txt)              │  │
│  │  • scan_paths(paths) → exists/size/mtime     │  │
│  │  • create_backup(sources, output_dir) → zip  │  │
│  │  • list_backup_contents(zip_path) → items    │  │
│  │  • restore_backup(zip_path, selected_items)   │  │
│  │                                               │  │
│  │  Backend: zip crate, std::fs, streaming      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 3.1 IPC Command Design

```rust
// Read config file → return list of paths
#[tauri::command]
fn read_backup_config(config_path: &str) -> Result<Vec<BackupPath>, String>

// Scan paths → return metadata (exists, size, mtime)
#[tauri::command]
fn scan_paths(paths: Vec<String>) -> Result<Vec<PathMeta>, String>

// Create backup archive
#[tauri::command]
fn create_backup(
    sources: Vec<BackupSource>,
    output_dir: String,
    progress_callback: Fn(BackupProgress)
) -> Result<BackupResult, String>

// List contents of a backup archive
#[tauri::command]
fn list_backup_contents(zip_path: String) -> Result<Vec<BackupItem>, String>

// Restore selected items from archive
#[tauri::command]
fn restore_backup(
    zip_path: String,
    items: Vec<String>,  // paths to restore
    progress_callback: Fn(BackupProgress)
) -> Result<RestoreResult, String>
```

### 3.2 Data Structures

```typescript
interface BackupPath {
  path: string;          // original path string (e.g. "~/.gitconfig")
  resolved: string;      // expanded absolute path
  exists: boolean;
  size?: number;         // bytes
  isDirectory: boolean;
  category?: string;    // "AI Tools", "Git/SSH", etc.
}

interface BackupItem {
  name: string;          // display name
  path: string;         // relative path in archive
  size: number;         // compressed size
  originalSize: number; // uncompressed size
  isDirectory: boolean;
}

interface BackupProgress {
  current: number;
  total: number;
  currentFile: string;
  phase: 'scanning' | 'compressing' | 'extracting' | 'restoring';
}
```

---

## 4. UI Design

### 4.1 Layout

- **Single-window app** with tab navigation
- **Left sidebar**: Navigation tabs (Backup / Restore / Config)
- **Main content**: Context-dependent view
- **Top bar**: App title, theme toggle, window controls (if frameless)

### 4.2 Views

#### Backup View
1. **Path Selection Panel**  
   - Read from existing `back_path_windows.txt` or `back_path_mac.txt`
   - Display paths grouped by category (AI Tools, Git/SSH, Dev Config)
   - Each item shows: checkbox, name, exists indicator (green/red), size
   - Non-existent paths: grayed out, auto-skipped on backup
   - "Add Path" button: opens native folder/file picker
   - "Remove Path" button: removes from current session list

2. **Output Configuration**  
   - Output directory selector (native folder picker)
   - Filename preview: `backup_YYYY-MM-DD_HH-mm-ss.zip`
   - Archive format: `.zip` (cross-platform)

3. **Action Bar**  
   - "Start Backup" button (disabled if no valid paths selected)
   - Progress modal during backup

#### Restore View
1. **File Selection**  
   - "Select Backup File" button → native file picker for `.zip`
   - Display: filename, size, creation date, total items count

2. **Item Selection List**  
   - Parse zip contents, display as tree or flat list
   - Each item: checkbox, icon (folder/file), name, size
   - "Select All" / "Deselect All" controls
   - Items sorted by original path for clarity

3. **Restore Configuration**  
   - Info text: "Items will be restored to their original paths"
   - Warning: "Existing files will be renamed to `.backup_YYYYMMDDHHMMSS`"

4. **Action Bar**  
   - "Start Restore" button (disabled if no items selected)
   - Progress modal during restore

#### Config View
1. **Profile Selector**  
   - Dropdown: Windows / macOS profiles
   - Each loads the corresponding `.txt` config file

2. **Path Editor**  
   - Editable list of backup paths
   - Add/remove paths via UI
   - Categories displayed as collapsible sections
   - Save changes to config file

3. **Import/Export**  
   - Import existing `.txt` config file
   - Export current config

### 4.3 Visual Style

- **Theme**: Modern, clean, follows shadcn/ui design language
- **Colors**: Neutral grays with accent blue for actions
- **Dark/Light**: System preference detection + manual toggle
- **Typography**: Inter or system font stack
- **Icons**: Lucide icons (shadcn/ui default)

### 4.4 Key UI Components

| Component | States | Behavior |
|-----------|--------|----------|
| `PathItem` | default, selected, missing, loading | Checkbox + icon + name + size badge |
| `ProgressModal` | idle, active, complete, error | Progress bar + file name + cancel button |
| `CategorySection` | expanded, collapsed | Collapsible group header |
| `ThemeToggle` | light, dark, system | Cycles through modes |

---

## 5. Core Flows

### 5.1 Backup Flow

```
1. User opens Backup tab
2. App reads config file → populates path list
3. App scans each path → marks exists/size
4. User selects output directory
5. User checks desired paths
6. User clicks "Start Backup"
7. Progress modal opens:
   a. Phase: "Scanning..." (counting files)
   b. Phase: "Compressing..." (streaming zip)
8. On complete: success toast + open output folder option
9. On error: error details in modal + retry option
```

### 5.2 Restore Flow

```
1. User opens Restore tab
2. User selects a .zip backup file
3. App reads zip → displays item list with sizes
4. User checks desired items (default: all selected)
5. User clicks "Start Restore"
6. Progress modal opens:
   a. Phase: "Extracting..." → "Restoring..."
7. Conflict handling: existing files → rename to .backup_timestamp
8. On complete: success toast + summary (success/failed/skipped counts)
```

---

## 6. Risk Assessment

### Anti-Patterns to Avoid

| Risk | Mitigation |
|------|-----------|
| **Large file freeze** | Rust backend streams zip entries; progress callback per-file |
| **Path traversal attack** | Validate all paths stay within output/source boundaries |
| **Concurrent access** | Lock state during backup/restore operations |
| **Config file corruption** | Atomic writes (write to temp, then rename) |
| **Missing dependencies** | Bundle WebView2 installer for Windows; Tauri handles this |

### Known Limitations

- **Binary files**: Full file content stored (no deduplication)
- **Symlinks**: Resolved to actual files (symlink targets backed up, not symlink itself)
- **Permissions**: Restore may fail if target path lacks write permission — show error
- **Path length (Windows)**: ZIP supports long paths; restore respects filesystem limits

---

## 7. File Structure

```
backup-agent/
├── src/                      # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx        # Root layout with sidebar
│   │   ├── page.tsx          # Redirects to /backup
│   │   ├── backup/
│   │   │   └── page.tsx      # Backup view
│   │   ├── restore/
│   │   │   └── page.tsx      # Restore view
│   │   └── config/
│   │       └── page.tsx      # Config view
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Sidebar, TopBar
│   │   ├── backup/           # BackupView, PathList, PathItem
│   │   ├── restore/          # RestoreView, BackupItemList
│   │   └── shared/           # ProgressModal, ThemeToggle
│   ├── lib/
│   │   ├── tauri.ts          # Tauri invoke wrappers
│   │   └── utils.ts          # Helpers
│   ├── stores/
│   │   └── backup-store.ts   # Zustand store
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── commands/         # Tauri command modules
│   │   │   ├── mod.rs
│   │   │   ├── config.rs    # read_backup_config
│   │   │   ├── scan.rs      # scan_paths
│   │   │   ├── backup.rs    # create_backup
│   │   │   └── restore.rs   # restore_backup, list_backup_contents
│   │   └── models.rs        # Shared data structures
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
├── docs/
│   └── plans/
│       └── 2026-03-19-backup-agent-design.md
├── package.json
├── tailwind.config.ts
├── next.config.js
└── tsconfig.json
```

---

## 8. Success Criteria

| Metric | Target |
|--------|--------|
| Backup of 100 files (< 500MB) | < 30 seconds |
| Restore of 100 files | < 30 seconds |
| UI responsiveness during backup | No freeze > 100ms |
| Windows/Mac build | Produces working `.exe` / `.app` |
| Zero server communication | All operations via local filesystem |

---

## 9. Next Steps

1. **Scaffold project**: Tauri + Next.js setup
2. **Implement Rust commands**: config reading, zip operations
3. **Build UI shell**: layout, routing, theme toggle
4. **Implement Backup view**: path list, selection, backup execution
5. **Implement Restore view**: file picker, item list, restore execution
6. **Implement Config view**: path editor, profile switcher
7. **Add progress handling**: streaming + callbacks
8. **Polish**: error handling, toasts, window management
9. **Build & test**: Windows/Mac builds
