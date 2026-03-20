use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupPath {
    pub path: String,
    pub resolved: String,
    pub exists: bool,
    pub size: Option<u64>,
    pub is_directory: bool,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSource {
    pub original_path: String,
    pub source_path: String,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub version: String,
    pub created_at: String,
    pub platform: String,
    pub item_count: u32,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestorePath {
    pub original_path: String,
    pub backup_name: String,
    pub resolved_path: String,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupItem {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub original_size: u64,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupProgress {
    pub current: u32,
    pub total: u32,
    pub current_file: String,
    pub phase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupResult {
    pub success: bool,
    pub output_path: String,
    pub item_count: u32,
    pub total_size: u64,
    pub skipped_count: u32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreResult {
    pub success: bool,
    pub restored_count: u32,
    pub failed_count: u32,
    pub skipped_count: u32,
    pub error: Option<String>,
}
