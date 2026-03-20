use crate::models::{BackupInfo, BackupProgress, BackupResult, BackupSource, RestorePath};
use chrono::Local;
use serde_json;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

fn resolve_path(path: &str) -> PathBuf {
    let mut p = path.to_string();

    if p.starts_with('~') {
        if let Ok(home) = std::env::var("USERPROFILE") {
            p = p.replacen('~', &home, 1);
        } else if let Ok(home) = std::env::var("HOME") {
            p = p.replacen('~', &home, 1);
        }
    }

    PathBuf::from(p)
}

fn path_to_backup_name(original_path: &str) -> String {
    let resolved = resolve_path(original_path);
    let path_str = resolved.to_string_lossy();

    let mut result = String::new();

    for (i, c) in path_str.chars().enumerate() {
        if i == 1 && c == ':' {
            result.push('-');
        } else if c == '\\' || c == '/' || c == ':' {
            result.push('-');
        } else if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
            result.push(c.to_ascii_lowercase());
        }
    }

    while result.starts_with('-') {
        result = result[1..].to_string();
    }
    while result.ends_with('-') || result.ends_with('.') {
        result.pop();
    }

    if result.is_empty() {
        result = "backup".to_string();
    }

    result
}

#[tauri::command]
pub fn create_backup(
    app: AppHandle,
    sources: Vec<BackupSource>,
    output_dir: String,
) -> Result<BackupResult, String> {
    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let backup_name = format!("backup_{}", timestamp);
    let zip_path = PathBuf::from(&output_dir).join(format!("{}.zip", backup_name));

    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    let total = sources.len() as u32;
    let mut item_count = 0u32;
    let mut skipped_count = 0u32;
    let mut total_size = 0u64;

    let file = File::create(&zip_path).map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = ZipWriter::new(BufWriter::new(file));

    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut restore_paths: Vec<RestorePath> = Vec::new();

    for (idx, source) in sources.iter().enumerate() {
        let source_path = resolve_path(&source.source_path);
        let backup_name = path_to_backup_name(&source.source_path);

        restore_paths.push(RestorePath {
            original_path: source.original_path.clone(),
            backup_name: backup_name.clone(),
            resolved_path: source_path.to_string_lossy().to_string(),
            is_directory: source.is_directory,
        });

        let _ = app.emit(
            "backup-progress",
            BackupProgress {
                current: idx as u32 + 1,
                total,
                current_file: source.original_path.clone(),
                phase: "compressing".to_string(),
            },
        );

        if !source_path.exists() {
            skipped_count += 1;
            continue;
        }

        let result = if source.is_directory {
            add_dir_to_zip(&mut zip, &source_path, &backup_name, options)
        } else {
            add_file_to_zip(&mut zip, &source_path, &backup_name, options)
        };

        match result {
            Ok(size) => {
                item_count += 1;
                total_size += size;
            }
            Err(e) => {
                eprintln!("Failed to backup {}: {}", source.original_path, e);
            }
        }
    }

    let platform = if cfg!(windows) { "windows" } else { "mac" };
    let restore_filename = format!("restore_path_{}.json", platform);

    #[derive(serde::Serialize)]
    struct RestoreJson<'a> {
        backup_info: BackupInfo,
        sources: &'a [RestorePath],
    }

    let restore_json_obj = RestoreJson {
        backup_info: BackupInfo {
            version: "1.0".to_string(),
            created_at: Local::now().to_rfc3339(),
            platform: platform.to_string(),
            item_count,
            total_size,
        },
        sources: &restore_paths,
    };

    let restore_json = serde_json::to_string_pretty(&restore_json_obj)
        .map_err(|e| format!("Failed to serialize restore paths: {}", e))?;

    zip.start_file(&restore_filename, options)
        .map_err(|e| format!("Failed to add restore file: {}", e))?;
    zip.write_all(restore_json.as_bytes())
        .map_err(|e| format!("Failed to write restore file: {}", e))?;

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(BackupResult {
        success: true,
        output_path: zip_path.to_string_lossy().to_string(),
        item_count,
        total_size,
        skipped_count,
        error: None,
    })
}

fn add_file_to_zip(
    zip: &mut ZipWriter<BufWriter<File>>,
    source: &PathBuf,
    name: &str,
    options: SimpleFileOptions,
) -> Result<u64, String> {
    let metadata = source
        .metadata()
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    zip.start_file(name, options)
        .map_err(|e| format!("Failed to start file in zip: {}", e))?;

    let content = fs::read(source).map_err(|e| format!("Failed to read file: {}", e))?;

    zip.write_all(&content)
        .map_err(|e| format!("Failed to write to zip: {}", e))?;

    Ok(metadata.len())
}

fn add_dir_to_zip(
    zip: &mut ZipWriter<BufWriter<File>>,
    source: &PathBuf,
    base_name: &str,
    options: SimpleFileOptions,
) -> Result<u64, String> {
    let mut total_size = 0u64;

    for entry in walkdir::WalkDir::new(source)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        let relative = path.strip_prefix(source).unwrap();

        let name = if relative.to_string_lossy().is_empty() {
            base_name.to_string()
        } else {
            format!(
                "{}/{}",
                base_name,
                relative.to_string_lossy().replace('\\', "/")
            )
        };

        if path.is_file() {
            let size = add_file_to_zip(zip, &path.to_path_buf(), &name, options)?;
            total_size += size;
        }
    }

    Ok(total_size)
}
