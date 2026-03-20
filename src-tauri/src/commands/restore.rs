use crate::models::{BackupInfo, BackupItem, RestorePath, RestoreResult};
use serde::Deserialize;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

fn is_restore_config_file(name: &str) -> bool {
    name == "restore_path_windows.json" || name == "restore_path_mac.json"
}

fn get_top_level_name(path: &str) -> Option<String> {
    let path = path.trim_end_matches('/');
    let parts: Vec<&str> = path.split('/').collect();
    parts.first().map(|s| s.to_string())
}

fn backup_existing(target: &PathBuf) -> Result<Option<PathBuf>, String> {
    if !target.exists() {
        return Ok(None);
    }

    let backup_suffix = format!("_backup_{}", chrono::Local::now().format("%Y%m%d_%H%M%S"));
    let parent = target.parent().ok_or("No parent directory")?;
    let file_name = target.file_name().ok_or("No file name")?;
    let backup_path = parent.join(format!("{}{}", file_name.to_string_lossy(), backup_suffix));

    if target.is_dir() {
        rename_dir_recursive(target, &backup_path)?;
    } else {
        fs::rename(target, &backup_path)
            .map_err(|e| format!("Failed to backup {}: {}", target.display(), e))?;
    }

    Ok(Some(backup_path))
}

fn rename_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create backup dir {}: {}", dst.display(), e))?;

    for entry in
        fs::read_dir(src).map_err(|e| format!("Failed to read dir {}: {}", src.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            rename_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::rename(&src_path, &dst_path)
                .map_err(|e| format!("Failed to backup file {}: {}", src_path.display(), e))?;
        }
    }

    fs::remove_dir(src)
        .map_err(|e| format!("Failed to remove old dir {}: {}", src.display(), e))?;

    Ok(())
}

#[derive(Debug, Deserialize)]
struct RestoreJson {
    backup_info: BackupInfoJson,
    sources: Vec<RestoreSourceJson>,
}

#[derive(Debug, Deserialize)]
struct BackupInfoJson {
    version: String,
    created_at: String,
    platform: String,
    item_count: u32,
    total_size: u64,
}

#[derive(Debug, Deserialize)]
struct RestoreSourceJson {
    original_path: String,
    backup_name: String,
    resolved_path: String,
    is_directory: bool,
}

#[tauri::command]
pub fn list_restore_info(zip_path: String) -> Result<(BackupInfo, Vec<RestorePath>), String> {
    let file = File::open(&zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let config_name = if cfg!(windows) {
        "restore_path_windows.json"
    } else {
        "restore_path_mac.json"
    };

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        if file.name() == config_name {
            let mut contents = String::new();
            file.read_to_string(&mut contents)
                .map_err(|e| format!("Failed to read config file: {}", e))?;

            let json: RestoreJson = serde_json::from_str(&contents)
                .map_err(|e| format!("Failed to parse config: {}", e))?;

            return Ok((
                BackupInfo {
                    version: json.backup_info.version,
                    created_at: json.backup_info.created_at,
                    platform: json.backup_info.platform,
                    item_count: json.backup_info.item_count,
                    total_size: json.backup_info.total_size,
                },
                json.sources
                    .into_iter()
                    .map(|s| RestorePath {
                        original_path: s.original_path,
                        backup_name: s.backup_name,
                        resolved_path: s.resolved_path,
                        is_directory: s.is_directory,
                    })
                    .collect(),
            ));
        }
    }

    Err(format!("Config file {} not found in archive", config_name))
}

#[tauri::command]
pub fn list_backup_contents(zip_path: String) -> Result<Vec<BackupItem>, String> {
    let file = File::open(&zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let mut items = Vec::new();
    let mut seen_toplevel: std::collections::HashSet<String> = std::collections::HashSet::new();

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let name = file.name().to_string();
        let is_dir = file.is_dir();

        if is_restore_config_file(&name) {
            continue;
        }

        if let Some(top_level) = get_top_level_name(&name) {
            if !seen_toplevel.contains(&top_level) && !top_level.is_empty() {
                seen_toplevel.insert(top_level.clone());

                items.push(BackupItem {
                    name: top_level,
                    path: name,
                    size: 0,
                    original_size: 0,
                    is_directory: is_dir,
                });
            }
        }
    }

    items.sort_by(|a, b| {
        if a.is_directory != b.is_directory {
            b.is_directory.cmp(&a.is_directory)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(items)
}

#[tauri::command]
pub fn restore_backup(
    app: AppHandle,
    zip_path: String,
    backup_names: Vec<String>,
) -> Result<RestoreResult, String> {
    let file = File::open(&zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let config_name = if cfg!(windows) {
        "restore_path_windows.json"
    } else {
        "restore_path_mac.json"
    };

    let mut restore_map: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        if file.name() == config_name {
            let mut contents = String::new();
            file.read_to_string(&mut contents)
                .map_err(|e| format!("Failed to read config: {}", e))?;

            let json: RestoreJson = serde_json::from_str(&contents)
                .map_err(|e| format!("Failed to parse config: {}", e))?;

            for source in json.sources {
                restore_map.insert(source.backup_name, source.resolved_path);
            }
            break;
        }
    }

    let mut restored_count = 0u32;
    let failed_count = 0u32;
    let mut skipped_count = 0u32;
    let mut backup_count = 0u32;

    let total = backup_names.len() as u32;

    for (idx, backup_name) in backup_names.iter().enumerate() {
        let _ = app.emit(
            "restore-progress",
            crate::models::BackupProgress {
                current: idx as u32 + 1,
                total,
                current_file: backup_name.clone(),
                phase: "restoring".to_string(),
            },
        );

        let Some(target_path) = restore_map.get(backup_name) else {
            skipped_count += 1;
            continue;
        };

        let target = PathBuf::from(target_path);

        let backup_path = if target.exists() {
            match backup_existing(&target) {
                Ok(Some(bp)) => {
                    backup_count += 1;
                    eprintln!(
                        "[RESTORE] Backed up existing {} to {}",
                        target.display(),
                        bp.display()
                    );
                    Some(bp)
                }
                Ok(None) => None,
                Err(e) => {
                    eprintln!("[RESTORE] Failed to backup {}: {}", target.display(), e);
                    skipped_count += 1;
                    continue;
                }
            }
        } else {
            None
        };

        if let Some(parent) = target.parent() {
            if !parent.as_os_str().is_empty() {
                let _ = fs::create_dir_all(parent);
            }
        }

        let mut found = false;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;

            if !file.name().starts_with(backup_name) {
                continue;
            }
            found = true;

            let relative_path = &file.name()[backup_name.len()..].trim_start_matches('/');
            let outpath = if relative_path.is_empty() {
                target.clone()
            } else {
                target.join(relative_path)
            };

            if file.is_dir() {
                let _ = fs::create_dir_all(&outpath);
            } else {
                if let Some(parent) = outpath.parent() {
                    if !parent.as_os_str().is_empty() {
                        let _ = fs::create_dir_all(parent);
                    }
                }

                let mut outfile = File::create(&outpath)
                    .map_err(|e| format!("Failed to create file {}", outpath.display()))?;

                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)
                    .map_err(|e| format!("Failed to read from zip: {}", e))?;

                outfile
                    .write_all(&buffer)
                    .map_err(|e| format!("Failed to write file: {}", e))?;
            }
        }

        if found {
            restored_count += 1;
        } else {
            skipped_count += 1;
            if let Some(bp) = backup_path {
                eprintln!(
                    "[RESTORE] Restoration failed, restoring backup from {}",
                    bp.display()
                );
                if bp.is_dir() {
                    let _ = rename_dir_recursive(&bp, &target);
                } else {
                    let _ = fs::rename(&bp, &target);
                }
            }
        }
    }

    eprintln!(
        "[RESTORE] Complete: restored={}, backed_up={}, skipped={}",
        restored_count, backup_count, skipped_count
    );

    Ok(RestoreResult {
        success: true,
        restored_count,
        failed_count,
        skipped_count,
        error: None,
    })
}
