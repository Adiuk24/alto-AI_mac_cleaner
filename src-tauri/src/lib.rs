mod scanners;
pub mod helper_client;
mod mcp;

use scanners::{junk::scan_junk, large_files::scan_large_files, scheduler::Scheduler, system_stats::get_stats, watcher::start_watcher, ScanResult};
use tauri::{State, Manager, AppHandle, Emitter};
use mcp::file_index::{index_file, index_files, IndexedFile, FileCategory};
use mcp::context_store::ContextStore;
use tauri_plugin_positioner::{WindowExt, Position};
use std::path::{Path, PathBuf};

/// Canonicalize path and ensure it is under one of the allowed roots (e.g. home). Rejects path traversal.
fn canonicalize_and_validate_path(path_str: &str, allowed_roots: &[PathBuf]) -> Result<PathBuf, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }
    let canonical = path.canonicalize().map_err(|e| e.to_string())?;
    let allowed = allowed_roots.iter().any(|root| canonical.starts_with(root));
    if !allowed {
        return Err("Path is outside allowed directories (e.g. home).".to_string());
    }
    Ok(canonical)
}

#[derive(Clone, serde::Serialize)]
struct DeepScanProgress {
    directory: String,
    files_found: usize,
    size_bytes: u64,
    percent: u8,
}

#[derive(Clone, serde::Serialize)]
struct DeepScanComplete {
    total_files: usize,
    total_size_bytes: u64,
    top_categories: Vec<(String, u64)>,
    duration_secs: f64,
}

#[tauri::command]
async fn start_deep_scan_command(app: AppHandle) -> Result<(), String> {
    // Fire-and-forget: spawn background task and return immediately
    tokio::spawn(async move {
        let home = match dirs::home_dir() {
            Some(h) => h,
            None => return,
        };
        let start = std::time::Instant::now();

        // Deep scan templates — no caps, much more comprehensive than quick scan
        let deep_templates: &[(&str, &str)] = &[
            ("Library/Caches", "System Caches"),
            ("Library/Logs", "System Logs"),
            ("Library/Application Support/Google/Chrome/Default/Cache", "Chrome Cache"),
            ("Library/Application Support/BraveSoftware/Brave-Browser/Default/Cache", "Brave Cache"),
            ("Library/Application Support/Firefox/Profiles", "Firefox Cache"),
            ("Library/Application Support/Slack/Cache", "Slack Cache"),
            ("Library/Application Support/Discord/Cache", "Discord Cache"),
            ("Library/Application Support/Code/Cache", "VS Code Cache"),
            ("Library/Application Support/Code/CachedData", "VS Code Cache"),
            ("Library/Application Support/Spotify/PersistentCache", "Spotify Cache"),
            ("Library/Developer/Xcode/DerivedData", "Xcode DerivedData"),
            ("Library/Developer/Xcode/Archives", "Xcode Archives"),
            ("Library/Developer/Xcode/iOS DeviceSupport", "Xcode Device Support"),
            ("Library/Developer/CoreSimulator/Caches", "Simulator Caches"),
            ("Library/Developer/CoreSimulator/Devices", "Simulator Devices"),
            (".npm/_cacache", "NPM Cache"),
            (".yarn/cache", "Yarn Cache"),
            (".gradle/caches", "Gradle Cache"),
            (".m2/repository", "Maven Cache"),
            ("Library/Application Support/CrashReporter", "Crash Reports"),
            ("Library/Saved Application State", "App Saved State"),
            ("Downloads", "Downloads"),
            (".Trash", "Trash"),
        ];

        let total = deep_templates.len();
        let mut grand_total_files = 0usize;
        let mut grand_total_bytes = 0u64;
        let mut category_map: std::collections::HashMap<String, u64> = std::collections::HashMap::new();

        for (idx, (tpl, label)) in deep_templates.iter().enumerate() {
            let path = home.join(tpl);
            if !path.exists() {
                continue;
            }

            let percent = ((idx as f64 / total as f64) * 100.0) as u8;
            let mut dir_files = 0usize;
            let mut dir_bytes = 0u64;

            // Walk with generous limits — this IS the deep scan
            let walker = walkdir::WalkDir::new(&path)
                .max_depth(20)
                .into_iter();

            for entry in walker.flatten() {
                if entry.path().is_file() {
                    if let Ok(meta) = entry.metadata() {
                        let size = meta.len();
                        dir_files += 1;
                        dir_bytes += size;
                    }
                }
            }

            grand_total_files += dir_files;
            grand_total_bytes += dir_bytes;
            *category_map.entry(label.to_string()).or_insert(0) += dir_bytes;

            // Emit progress event to frontend
            let _ = app.emit("deep-scan-progress", DeepScanProgress {
                directory: label.to_string(),
                files_found: dir_files,
                size_bytes: dir_bytes,
                percent,
            });
        }

        // Sort categories by size for the summary
        let mut top_categories: Vec<(String, u64)> = category_map.into_iter().collect();
        top_categories.sort_by(|a, b| b.1.cmp(&a.1));
        top_categories.truncate(8);

        let duration = start.elapsed().as_secs_f64();

        let _ = app.emit("deep-scan-complete", DeepScanComplete {
            total_files: grand_total_files,
            total_size_bytes: grand_total_bytes,
            top_categories,
            duration_secs: duration,
        });
    });

    Ok(())
}

#[tauri::command]
async fn cancel_deep_scan_command() -> Result<(), String> {
    // For now, the background task will finish naturally.
    // A real cancel would use a shared AtomicBool / channel.
    Ok(())
}


/// MCP: Return the full context store so the frontend/AI can use it
#[tauri::command]
async fn get_mcp_context() -> Result<serde_json::Value, String> {
    println!("[Backend] get_mcp_context called");
    let ctx = ContextStore::load();
    serde_json::to_value(&ctx).map_err(|e| e.to_string())
}

#[tauri::command]
async fn reset_mcp_context_command() -> Result<serde_json::Value, String> {
    let mut ctx = ContextStore::load();
    ctx.clear();
    serde_json::to_value(&ctx).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_user_preferences_command(prefs: mcp::context_store::UserPrefs) -> Result<(), String> {
    let mut ctx = ContextStore::load();
    ctx.update_user_preferences(prefs);
    Ok(())
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

#[derive(serde::Serialize)]
struct SmartScanResult {
    junk: ScanResult,
    large_files: ScanResult,
    malware: scanners::malware::MalwareResult,
}

#[tauri::command]
async fn smart_scan_command() -> Result<SmartScanResult, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let home_str = home.to_string_lossy().to_string();
    let (junk, large_files, malware) = tokio::task::spawn_blocking(move || {
        let junk = scan_junk(&home_str);
        let large = scan_large_files(&home_str);
        let malware = scanners::malware::scan_malware();
        (junk, large, malware)
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(SmartScanResult {
        junk,
        large_files,
        malware,
    })
}

#[tauri::command]
async fn get_system_stats_command() -> scanners::system_stats::SystemStats {
    get_stats()
}

#[tauri::command]
async fn get_home_dir_command() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "No home directory".to_string())
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn open_full_disk_access_settings_command() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn open_full_disk_access_settings_command() -> Result<(), String> {
    Ok(())
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
    let home_str = home.to_string_lossy().to_string();
    let result = tauri::async_runtime::spawn_blocking(move || scan_large_files(&home_str))
        .await
        .map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
async fn scan_space_lens_command(path: Option<String>, depth: Option<u32>) -> Result<scanners::space_lens::FileNode, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let allowed_roots: Vec<PathBuf> = {
        let mut v = vec![home.clone()];
        #[cfg(target_os = "macos")]
        {
            v.push(PathBuf::from("/Applications"));
            v.push(PathBuf::from("/Library"));
        }
        v
    };
    let target_path = if let Some(p) = path {
        let p = p.trim();
        if p.is_empty() {
            home.to_string_lossy().to_string()
        } else {
            let canonical = canonicalize_and_validate_path(p, &allowed_roots)?;
            canonical.to_string_lossy().to_string()
        }
    } else {
        home.to_string_lossy().to_string()
    };
    let depth_limit = depth.unwrap_or(4).min(8);

    Ok(scanners::space_lens::scan_space_lens(&target_path, depth_limit))
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
            let mut ctx = ContextStore::load();
            ctx.record_deletion(safe_paths.clone(), total_bytes);
            Ok(serde_json::json!({
                "removed": safe_paths.len(),
                "bytes_freed": total_bytes,
                "blocked": blocked,
                "errors": []
            }))
        },
        Err(e) => Err(format!("Delete failed: {}", e)),
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
async fn scan_leftovers_command(_id: String) -> scanners::uninstaller::LeftoverGroups {
    #[cfg(target_os = "macos")]
    return scanners::uninstaller::scan_leftovers(&_id);
    #[cfg(not(target_os = "macos"))]
    return scanners::uninstaller::LeftoverGroups::default();
}

#[tauri::command]
async fn scan_outdated_apps_command() -> Vec<scanners::updater::OutdatedApp> {
    scanners::updater::scan_outdated_apps()
}

#[tauri::command]
async fn move_paths_command(paths: Vec<String>, destination: String) -> Result<serde_json::Value, String> {
    let dest = PathBuf::from(&destination);
    if !dest.is_dir() {
        return Err("Destination is not a directory".to_string());
    }
    let mut moved = 0usize;
    let mut errors = Vec::<String>::new();
    for path_str in &paths {
        let src = Path::new(path_str);
        if !src.exists() {
            errors.push(format!("Not found: {}", path_str));
            continue;
        }
        let name = src.file_name().and_then(|n| n.to_str()).unwrap_or("file");
        let dest_path = dest.join(name);
        if std::fs::rename(src, &dest_path).is_ok() {
            moved += 1;
        } else if std::fs::copy(src, &dest_path).is_ok() {
            if trash::delete(path_str).is_ok() {
                moved += 1;
            } else {
                errors.push(format!("Moved copy but could not remove original: {}", path_str));
            }
        } else {
            errors.push(format!("Failed to move: {}", path_str));
        }
    }
    Ok(serde_json::json!({ "moved": moved, "errors": errors }))
}

#[tauri::command]
async fn shred_path_command(path: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let allowed_roots = vec![home.clone()];
    let canonical = canonicalize_and_validate_path(path.trim(), &allowed_roots)?;
    let path_str = canonical.to_string_lossy().to_string();

    let indexed = index_file(&path_str);
    if !indexed.is_safe_to_delete {
        return Err(format!(
            "Shredder blocked: {}. Alto will not shred system or user data.",
            indexed.reason
        ));
    }
    if matches!(indexed.category, FileCategory::SystemCritical | FileCategory::UserData) {
        return Err(format!(
            "Shredder blocked: {} (category: {:?})",
            indexed.reason, indexed.category
        ));
    }

    scanners::shredder::shred_path(&path_str)
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

#[derive(serde::Serialize)]
struct TrashScanResult {
    item_count: usize,
    total_size_bytes: u64,
    items: Vec<String>,
}

#[tauri::command]
async fn scan_trash_command() -> Result<TrashScanResult, String> {
    let trash_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".Trash");

    if !trash_dir.exists() {
        return Ok(TrashScanResult { item_count: 0, total_size_bytes: 0, items: vec![] });
    }

    let mut total_size: u64 = 0;
    let mut items: Vec<String> = Vec::new();

    fn dir_size(path: &std::path::Path) -> u64 {
        let mut size = 0u64;
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    size += entry.metadata().map(|m| m.len()).unwrap_or(0);
                } else if p.is_dir() {
                    size += dir_size(&p);
                }
            }
        }
        size
    }

    if let Ok(entries) = std::fs::read_dir(&trash_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            if name.starts_with('.') { continue; }
            let size = if path.is_dir() { dir_size(&path) } else { entry.metadata().map(|m| m.len()).unwrap_or(0) };
            total_size += size;
            items.push(name);
        }
    }

    Ok(TrashScanResult {
        item_count: items.len(),
        total_size_bytes: total_size,
        items,
    })
}

#[tauri::command]
async fn empty_trash_command() -> Result<serde_json::Value, String> {
    // Count items in ~/.Trash first for reporting
    let trash_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".Trash");

    let mut pre_count = 0usize;

    if trash_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&trash_dir) {
            for entry in entries.flatten() {
                let name = entry.path().file_name().unwrap_or_default().to_string_lossy().to_string();
                if !name.starts_with('.') { pre_count += 1; }
            }
        }
    }

    // Use AppleScript to empty ALL Finder Trash (including iCloud-backed items)
    // This is the same as clicking "Empty Trash" in Finder
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg("tell application \"Finder\" to empty trash")
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        // If Finder reports "already empty", that's fine
        if !err.contains("empty") {
            return Err(format!("AppleScript error: {}", err));
        }
    }

    // Report back — since iCloud items may have been included, report what we know
    Ok(serde_json::json!({
        "removed": pre_count,
        "bytes_freed": 0, // Can't easily measure iCloud items pre-deletion
        "method": "finder_applescript"
    }))
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
            smart_scan_command,
            scan_junk_command, 
            scan_large_files_command, 
            scan_space_lens_command,
            scan_malware_command,
            run_speed_task_command,
            clean_items,
            schedule_task,
            get_system_stats_command,
            get_home_dir_command,
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
            update_user_preferences_command,
            get_mcp_status,
            get_maintenance_tasks_command,
            run_maintenance_task_command,
            scan_privacy_command,
            clean_privacy_item_command,
            scan_trash_command,
            empty_trash_command,
            start_deep_scan_command,
            cancel_deep_scan_command,
            scan_leftovers_command,
            move_paths_command,
            open_full_disk_access_settings_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running Alto");
}
