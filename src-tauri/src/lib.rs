mod scanners;
pub mod helper_client;
mod mcp;

use scanners::{junk::scan_junk, large_files::scan_large_files, scheduler::Scheduler, system_stats::get_stats, watcher::start_watcher, ScanResult};
use tauri::{State, Manager};
use mcp::{file_index::{index_files, IndexedFile}, context_store::ContextStore};
use tauri_plugin_positioner::{WindowExt, Position};

/// MCP: Return the full context store so the frontend/AI can use it
#[tauri::command]
async fn get_mcp_context() -> Result<serde_json::Value, String> {
    println!("[Backend] get_mcp_context called");
    let ctx = ContextStore::load();
    serde_json::to_value(&ctx).map_err(|e| e.to_string())
}

#[tauri::command]
async fn reset_mcp_context_command() -> Result<serde_json::Value, String> {
    println!("[Backend] reset_mcp_context_command called");
    let mut ctx = ContextStore::load();
    ctx.clear();
    serde_json::to_value(&ctx).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_mcp_status() -> Result<serde_json::Value, String> {
    // In a real app, we might check if the watcher thread is alive
    // For now, we'll return based on whether the store can be loaded
    let store_exists = ContextStore::store_path().exists();
    Ok(serde_json::json!({
        "indexer_active": true,
        "watcher_active": true,
        "store_initialized": store_exists,
    }))
}

struct AppState {
    scheduler: Scheduler,
}

#[tauri::command]
async fn get_system_stats_command() -> scanners::system_stats::SystemStats {
    get_stats()
}

#[tauri::command]
async fn scan_junk_command() -> Result<ScanResult, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let home_str = home.to_string_lossy();
    // Perform scan in a blocking task to ensure it doesn't block the async runtime if it were to stay on the same thread (though tauri handles async commands on separate threads, explicit spawn_blocking is safer for heavy IO)
    // Actually, simple async fn in tauri is enough to unblock the main thread.
    Ok(scan_junk(&home_str))
}

#[tauri::command]
async fn scan_large_files_command() -> Result<ScanResult, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let home_str = home.to_string_lossy();
    Ok(scan_large_files(&home_str))
}

#[tauri::command]
async fn scan_space_lens_command(path: Option<String>) -> Result<scanners::space_lens::FileNode, String> {
    let target_path = if let Some(p) = path {
        p
    } else {
        let home = dirs::home_dir().ok_or("No home directory")?;
        home.to_string_lossy().to_string()
    };
    
    // If specific path requested, maybe deeper depth? Or keep same?
    // Let's keep 3 for responsiveness
    Ok(scanners::space_lens::scan_space_lens(&target_path, 2)) 
}

#[tauri::command]
async fn scan_malware_command() -> Result<scanners::malware::MalwareResult, String> {
    Ok(scanners::malware::scan_malware())
}

#[tauri::command]
async fn run_speed_task_command(task_id: String) -> Result<scanners::speed::SpeedTaskResult, String> {
    Ok(scanners::speed::run_optimization_task(&task_id))
}

/// MCP Phase 1: Preview what would be deleted — NEVER deletes anything.
/// Returns an indexed list of files with safety flags.
#[tauri::command]
async fn preview_delete(paths: Vec<String>) -> Result<Vec<IndexedFile>, String> {
    Ok(index_files(&paths))
}

/// MCP Phase 2: Confirm and execute deletion — only called after user approves.
/// Logs the deletion to the context store for history.
#[tauri::command]
async fn confirm_delete(paths: Vec<String>) -> Result<serde_json::Value, String> {
    // Only delete files that are safe according to the indexer
    let indexed = index_files(&paths);
    let safe_paths: Vec<String> = indexed.iter()
        .filter(|f| f.is_safe_to_delete)
        .map(|f| f.path.clone())
        .collect();
    let blocked: Vec<String> = indexed.iter()
        .filter(|f| !f.is_safe_to_delete)
        .map(|f| f.path.clone())
        .collect();

    if safe_paths.is_empty() {
        return Ok(serde_json::json!({
            "removed": 0,
            "blocked": blocked,
            "errors": ["No safe files to delete after safety check."]
        }));
    }

    let path_refs: Vec<&str> = safe_paths.iter().map(|s| s.as_str()).collect();
    let total_bytes: u64 = indexed.iter().filter(|f| f.is_safe_to_delete).map(|f| f.size_bytes).sum();

    match trash::delete_all(&path_refs) {
        Ok(_) => {
            // Log to context store
            let mut ctx = ContextStore::load();
            ctx.record_deletion(safe_paths.clone(), total_bytes);
            Ok(serde_json::json!({
                "removed": safe_paths.len(),
                "bytes_freed": total_bytes,
                "blocked": blocked,
                "errors": []
            }))
        },
        Err(e) => {
            Ok(serde_json::json!({ "removed": 0, "errors": [e.to_string()] }))
        }
    }
}

/// Legacy command — kept for compatibility but now routes through safety layer.
#[tauri::command]
async fn clean_items(paths: Vec<String>) -> Result<serde_json::Value, String> {
    // Route through the safe confirm_delete
    confirm_delete(paths).await
}

#[tauri::command]
async fn schedule_task(cron: String, task_type: String, state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.scheduler.add_job(cron, task_type))
}

#[tauri::command]
async fn scan_apps_command() -> Vec<scanners::uninstaller::AppInfo> {
    scanners::uninstaller::scan_apps()
}

#[tauri::command]
async fn uninstall_app_command(path: String) -> Result<(), String> {
    scanners::uninstaller::uninstall_app(&path).await
}

#[tauri::command]
async fn scan_leftovers_command(id: String) -> Vec<std::path::PathBuf> {
    #[cfg(target_os = "macos")]
    return scanners::uninstaller::scan_leftovers(&id);
    #[cfg(not(target_os = "macos"))]
    return Vec::new();
}

#[tauri::command]
async fn scan_outdated_apps_command() -> Vec<scanners::updater::OutdatedApp> {
    scanners::updater::scan_outdated_apps()
}

#[tauri::command]
async fn shred_path_command(path: String) -> Result<(), String> {
    scanners::shredder::shred_path(&path)
}

#[tauri::command]
async fn scan_mail_command() -> Vec<scanners::mail::MailAttachment> {
    scanners::mail::scan_mail_attachments()
}

#[tauri::command]
async fn clean_mail_command(paths: Vec<String>) -> Result<(), String> {
    scanners::mail::clean_mail_attachments(paths)
}

#[tauri::command]
async fn scan_extensions_command() -> Vec<scanners::extensions::ExtensionItem> {
    scanners::extensions::scan_extensions()
}

#[tauri::command]
async fn remove_extension_command(path: String) -> Result<(), String> {
    scanners::extensions::remove_extension(path).await
}

#[tauri::command]
async fn get_maintenance_tasks_command() -> Vec<scanners::maintenance::MaintenanceTask> {
    scanners::maintenance::get_tasks()
}

#[tauri::command]
async fn run_maintenance_task_command(id: String) -> Result<String, String> {
    // In a real production app, this should run in a separate thread/task if long-running
    scanners::maintenance::run_task(&id)
}

#[tauri::command]
async fn scan_privacy_command() -> Vec<scanners::privacy::PrivacyItem> {
    scanners::privacy::scan_privacy()
}

#[tauri::command]
async fn clean_privacy_item_command(path: String) -> Result<(), String> {
    scanners::privacy::clean_privacy_item(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            app.manage(AppState {
                scheduler: Scheduler::new(),
            });

            // System Tray Setup
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Alto", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app: &tauri::AppHandle, event: tauri::menu::MenuEvent| {
                    match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("menu") {
                            let _ = window.move_window(Position::TrayCenter);
                            
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            scanners::monitor::start_monitor_thread(app.handle().clone());
            start_watcher(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_junk_command, 
            scan_large_files_command, 
            scan_space_lens_command,
            scan_malware_command,
            run_speed_task_command,
            clean_items,
            schedule_task,
            get_system_stats_command,
            scan_apps_command,
            uninstall_app_command,
            scan_outdated_apps_command,
            shred_path_command,
            scan_mail_command,
            clean_mail_command,
            scan_extensions_command,
            remove_extension_command,
            preview_delete,
            confirm_delete,
            get_mcp_context,
            reset_mcp_context_command,
            get_mcp_status,
            get_maintenance_tasks_command,
            run_maintenance_task_command,
            scan_privacy_command,
            scan_privacy_command,
            clean_privacy_item_command,
            scan_leftovers_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running Alto");
}
