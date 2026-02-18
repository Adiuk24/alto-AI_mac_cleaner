use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::thread;
use tauri::{AppHandle, Emitter};
use serde::Serialize;
use crate::mcp::context_store::{ContextStore, SystemEvent};

#[derive(Clone, Serialize)]
pub struct AppInstallPayload {
    pub name: String,
    pub path: String,
    pub event_type: String,  // "app_installed" | "file_downloaded" | "suspicious_file"
}

/// Suspicious file extensions that could indicate malware
const SUSPICIOUS_EXT: &[&str] = &["dmg", "pkg", "sh", "command", "app", "deb", "run"];

pub fn start_watcher(app_handle: AppHandle) {
    thread::spawn(move || {
        let (tx, rx) = channel();

        let mut watcher: Box<dyn Watcher> = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => Box::new(w),
            Err(e) => {
                eprintln!("[Watcher] Failed to create watcher: {}", e);
                return;
            }
        };

        // Watch /Applications — detect new app installs
        let _ = watcher.watch(Path::new("/Applications"), RecursiveMode::NonRecursive);
        println!("[Watcher] Watching /Applications");

        // Watch ~/Downloads — detect new files (potential malware, new apps)
        if let Some(home) = dirs::home_dir() {
            let downloads = home.join("Downloads");
            if downloads.exists() {
                let _ = watcher.watch(&downloads, RecursiveMode::NonRecursive);
                println!("[Watcher] Watching ~/Downloads");
            }

            // Watch ~/Library/Application Support for app data changes
            let app_support = home.join("Library").join("Application Support");
            if app_support.exists() {
                let _ = watcher.watch(&app_support, RecursiveMode::NonRecursive);
                println!("[Watcher] Watching ~/Library/Application Support");
            }
        }

        for res in rx {
            match res {
                Ok(event) => {
                    match event.kind {
                        notify::EventKind::Create(_) => {
                            for path_buf in &event.paths {
                                handle_new_file(&app_handle, path_buf);
                            }
                        }
                        _ => {}
                    }
                }
                Err(e) => eprintln!("[Watcher] Error: {:?}", e),
            }
        }
    });
}

fn handle_new_file(app_handle: &AppHandle, path_buf: &PathBuf) {
    let path_str = path_buf.to_string_lossy().to_string();
    let ext = path_buf.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let name = path_buf.file_name().unwrap_or_default().to_string_lossy().to_string();

    // 1. New .app in /Applications
    if path_str.starts_with("/Applications") && ext == "app" {
        println!("[Watcher] New app detected: {}", name);

        // Record in MCP context store
        let mut ctx = ContextStore::load();
        ctx.record_system_event(SystemEvent {
            timestamp: chrono::Local::now().to_rfc3339(),
            event_type: "app_installed".to_string(),
            description: format!("New app installed: {}", name),
            path: path_str.clone(),
        });

        let _ = app_handle.emit("system-event", AppInstallPayload {
            name,
            path: path_str,
            event_type: "app_installed".to_string(),
        });
    }
    // 2. New file in Downloads — flag suspicious types
    else if path_str.contains("/Downloads/") {
        let is_suspicious = SUSPICIOUS_EXT.contains(&ext.as_str());
        println!("[Watcher] New download: {} (suspicious: {})", name, is_suspicious);

        // Record in MCP context store
        let mut ctx = ContextStore::load();
        let event_type = if is_suspicious { "suspicious_download" } else { "file_downloaded" }.to_string();
        ctx.record_system_event(SystemEvent {
            timestamp: chrono::Local::now().to_rfc3339(),
            event_type: event_type.clone(),
            description: format!("New file in Downloads: {} ({})", name, if is_suspicious { "⚠️ suspicious type" } else { "normal" }),
            path: path_str.clone(),
        });

        // Always emit event, frontend/AI decides what to do
        let _ = app_handle.emit("system-event", AppInstallPayload {
            name,
            path: path_str,
            event_type,
        });
    }
}
