export interface BackupPath {
  path: string;          // original path string (e.g. "~/.gitconfig")
  resolved: string;      // expanded absolute path
  exists: boolean;
  size?: number;         // bytes
  is_directory: boolean;
  category?: string;     // "AI Tools", "Git/SSH", etc.
}

export interface BackupSource {
  original_path: string;
  source_path: string;
  is_directory: boolean;
}

export interface BackupInfo {
  version: string;
  created_at: string;
  platform: 'windows' | 'mac';
  item_count: number;
  total_size: number;
}

export interface RestorePath {
  original_path: string;
  backup_name: string;
  resolved_path: string;
  is_directory: boolean;
}

export interface RestoreInfo {
  backup_info: BackupInfo;
  sources: RestorePath[];
}

export interface BackupItem {
  name: string;          // display name
  path: string;         // relative path in archive
  size: number;         // compressed size
  original_size: number; // uncompressed size
  is_directory: boolean;
}

export interface BackupProgress {
  current: number;
  total: number;
  current_file: string;
  phase: 'scanning' | 'compressing' | 'extracting' | 'restoring';
}

export interface BackupResult {
  success: boolean;
  output_path: string;
  item_count: number;
  total_size: number;
  skipped_count: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restored_count: number;
  failed_count: number;
  skipped_count: number;
  error?: string;
}
