use crate::commands::config::resolve_path;
use crate::models::BackupPath;

#[tauri::command]
pub fn scan_paths(paths: Vec<String>) -> Vec<BackupPath> {
    paths
        .into_iter()
        .map(|p| {
            let resolved = resolve_path(&p);
            let exists = resolved.exists();

            let (size, is_directory) = if exists {
                if resolved.is_dir() {
                    let size = calculate_dir_size(&resolved).unwrap_or(0);
                    (Some(size), true)
                } else if let Ok(metadata) = resolved.metadata() {
                    (Some(metadata.len()), false)
                } else {
                    (None, false)
                }
            } else {
                (None, false)
            };

            BackupPath {
                path: p.clone(),
                resolved: resolved.to_string_lossy().to_string(),
                exists,
                size,
                is_directory,
                category: None,
            }
        })
        .collect()
}

fn calculate_dir_size(path: &std::path::PathBuf) -> Result<u64, std::io::Error> {
    let mut total = 0u64;

    if path.is_dir() {
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let metadata = entry.metadata()?;

            if metadata.is_file() {
                total += metadata.len();
            } else if metadata.is_dir() {
                total += calculate_dir_size(&entry.path())?;
            }
        }
    }

    Ok(total)
}
