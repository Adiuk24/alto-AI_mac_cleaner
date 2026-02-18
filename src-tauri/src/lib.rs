mod scanners;
pub mod helper_client;

use scanners::{junk::scan_junk, large_files::scan_large_files, scheduler::Scheduler, system_stats::get_stats, watcher::start_watcher, ScanResult};
use std::path::Path;
use tauri::{State, Manager};

struct AppState {
    scheduler: Scheduler,
}

#[tauri::command]
fn get_system_stats_command() -> scanners::system_stats::SystemStats {
    get_stats()
}

#[tauri::command]
fn scan_junk_command() -> Result<ScanResult, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let home_str = home.to_string_lossy();
    Ok(scan_junk(&home_str))
}

#[tauri::command]
fn scan_large_files_command() -> Result<ScanResult, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let home_str = home.to_string_lossy();
    Ok(scan_large_files(&home_str))
}

#[tauri::command]
fn scan_space_lens_command() -> Result<scanners::space_lens::FileNode, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let home_str = home.to_string_lossy();
    // Scan up to depth 3 for initial view
    Ok(scanners::space_lens::scan_space_lens(&home_str, 3))
}

#[tauri::command]
fn scan_malware_command() -> Result<scanners::malware::MalwareResult, String> {
    Ok(scanners::malware::scan_malware())
}

#[tauri::command]
fn run_speed_task_command(task_id: String) -> Result<scanners::speed::SpeedTaskResult, String> {
    Ok(scanners::speed::run_optimization_task(&task_id))
}

#[tauri::command]
fn clean_items(paths: Vec<String>) -> Result<serde_json::Value, String> {
    let mut removed = 0;
    let mut errors = Vec::new();
    for p in paths {
        if !Path::new(&p).exists() {
            continue;
        }
        match trash::delete(&p) {
            Ok(_) => removed += 1,
            Err(e) => errors.push(format!("{}: {}", p, e)),
        }
    }
    Ok(serde_json::json!({ "removed": removed, "errors": errors }))
}

#[tauri::command]
fn schedule_task(cron: String, task_type: String, state: State<AppState>) -> Result<String, String> {
    Ok(state.scheduler.add_job(cron, task_type))
}

#[tauri::command]
fn scan_apps_command() -> Vec<scanners::uninstaller::AppInfo> {
    scanners::uninstaller::scan_apps()
}

#[tauri::command]
async fn uninstall_app_command(path: String) -> Result<(), String> {
    scanners::uninstaller::uninstall_app(&path).await
}

#[tauri::command]
fn scan_outdated_apps_command() -> Vec<scanners::updater::OutdatedApp> {
    scanners::updater::scan_outdated_apps()
}

#[tauri::command]
fn shred_path_command(path: String) -> Result<(), String> {
    scanners::shredder::shred_path(&path)
}

#[tauri::command]
fn scan_mail_command() -> Vec<scanners::mail::MailAttachment> {
    scanners::mail::scan_mail_attachments()
}

#[tauri::command]
fn clean_mail_command(paths: Vec<String>) -> Result<(), String> {
    scanners::mail::clean_mail_attachments(paths)
}

#[tauri::command]
fn scan_extensions_command() -> Vec<scanners::extensions::ExtensionItem> {
    scanners::extensions::scan_extensions()
}

#[tauri::command]
async fn remove_extension_command(path: String) -> Result<(), String> {
    scanners::extensions::remove_extension(path).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(AppState {
                scheduler: Scheduler::new(),
            });

            // System Tray Setup
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::TrayIconBuilder;

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Alto", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
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
                .build(app)?;

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
            remove_extension_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running Alto");
}
