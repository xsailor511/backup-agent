mod commands;
mod models;

use commands::{backup, config, restore, scan};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::read_backup_config,
            scan::scan_paths,
            backup::create_backup,
            restore::list_backup_contents,
            restore::list_restore_info,
            restore::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
