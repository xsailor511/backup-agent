use crate::models::BackupPath;
use std::fs;
use std::path::PathBuf;

pub fn categorize_path(path: &str) -> Option<String> {
    let lower = path.to_lowercase();
    if lower.contains("claude")
        || lower.contains("cursor")
        || lower.contains("windsurf")
        || lower.contains("ollama")
        || lower.contains("cline")
        || lower.contains("opencode")
        || lower.contains("codex")
        || lower.contains("gemini")
        || lower.contains("continue")
        || lower.contains("cherry")
        || lower.contains("kode")
        || lower.contains("iflow")
        || lower.contains("codebuddy")
    {
        Some("AI Tools".to_string())
    } else if lower.contains("git") || lower.contains("ssh") {
        Some("Git/SSH".to_string())
    } else if lower.contains("vscode")
        || lower.contains("npm")
        || lower.contains("config")
        || lower.contains("yarn")
        || lower.contains("docker")
    {
        Some("Dev Config".to_string())
    } else if lower.contains("obsidian") || lower.contains("zsh") || lower.contains("bash") {
        Some("Shell/Notes".to_string())
    } else {
        None
    }
}

pub fn resolve_path(path: &str) -> PathBuf {
    let mut p = path.to_string();

    // Handle ~ (home directory)
    if p.starts_with('~') {
        if let Ok(home) = std::env::var("USERPROFILE") {
            p = p.replacen('~', &home, 1);
        } else if let Ok(home) = std::env::var("HOME") {
            p = p.replacen('~', &home, 1);
        }
    }

    // Handle environment variables
    // Windows: %VAR%
    #[cfg(windows)]
    {
        let mut result = String::new();
        let mut chars = p.chars().peekable();

        while let Some(c) = chars.next() {
            if c == '%' {
                let mut var_name = String::new();
                while let Some(&c) = chars.peek() {
                    chars.next();
                    if c == '%' {
                        break;
                    }
                    var_name.push(c);
                }
                if let Ok(val) = std::env::var(&var_name) {
                    result.push_str(&val);
                } else {
                    result.push('%');
                    result.push_str(&var_name);
                    result.push('%');
                }
            } else {
                result.push(c);
            }
        }
        p = result;
    }

    // Unix: $VAR or ${VAR}
    #[cfg(not(windows))]
    {
        let mut result = String::new();
        let mut chars = p.chars().peekable();

        while let Some(c) = chars.next() {
            if c == '$' {
                let mut var_name = String::new();
                if chars.peek() == Some(&'{') {
                    chars.next(); // consume '{'
                    while let Some(&c) = chars.peek() {
                        chars.next();
                        if c == '}' {
                            break;
                        }
                        var_name.push(c);
                    }
                } else {
                    while let Some(&c) = chars.peek() {
                        if !c.is_alphanumeric() && c != '_' {
                            break;
                        }
                        chars.next();
                        var_name.push(c);
                    }
                }
                if let Ok(val) = std::env::var(&var_name) {
                    result.push_str(&val);
                } else {
                    result.push('$');
                    if !var_name.is_empty() {
                        result.push_str(&var_name);
                    }
                }
            } else {
                result.push(c);
            }
        }
        p = result;
    }

    PathBuf::from(p)
}

#[tauri::command]
pub fn read_backup_config() -> Result<Vec<BackupPath>, String> {
    let content: &'static str = if cfg!(windows) {
        include_str!("../../../scripts/back_path_windows.txt")
    } else {
        include_str!("../../../scripts/back_path_mac.txt")
    };

    let mut paths = Vec::new();

    for line in content.lines() {
        let trimmed: &str = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let resolved = resolve_path(trimmed);
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

        let category = categorize_path(trimmed);

        paths.push(BackupPath {
            path: trimmed.to_string(),
            resolved: resolved.to_string_lossy().to_string(),
            exists,
            size,
            is_directory,
            category,
        });
    }

    eprintln!("[DEBUG] Total paths loaded: {}", paths.len());
    Ok(paths)
}

fn calculate_dir_size(path: &PathBuf) -> Result<u64, std::io::Error> {
    let mut total = 0u64;

    if path.is_dir() {
        for entry in fs::read_dir(path)? {
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
