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
const SUSPICIOUS_EXT: &[&str] = &[
    "dmg", "pkg", "sh", "command", "app", "deb", "run", // macOS/Linux
    "exe", "msi", "bat", "ps1", "vbs", "js", "vbe", "jse", "wsf", "wsh" // Windows
];

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

        // --- Platform Specific Watching ---
        
        #[cfg(target_os = "macos")]
        {
            let _ = watcher.watch(Path::new("/Applications"), RecursiveMode::NonRecursive);
            println!("[Watcher] Watching /Applications");
        }

        #[cfg(target_os = "windows")]
        {
            let program_files = [
                Path::new("C:\\Program Files"),
                Path::new("C:\\Program Files (x86)"),
            ];
            for path in program_files {
                if path.exists() {
                    let _ = watcher.watch(path, RecursiveMode::NonRecursive);
                    println!("[Watcher] Watching {:?}", path);
                }
            }
        }

        // --- Common Paths ---
        if let Some(home) = dirs::home_dir() {
            let downloads = home.join("Downloads");
            if downloads.exists() {
                let _ = watcher.watch(&downloads, RecursiveMode::NonRecursive);
                println!("[Watcher] Watching ~/Downloads");
            }

            // macOS Specific App Support
            #[cfg(target_os = "macos")]
            {
                let app_support = home.join("Library").join("Application Support");
                if app_support.exists() {
                    let _ = watcher.watch(&app_support, RecursiveMode::NonRecursive);
                    println!("[Watcher] Watching ~/Library/Application Support");
                }
            }

            // Windows Specific AppData
            #[cfg(target_os = "windows")]
            {
                let appdata = home.join("AppData").join("Roaming");
                if appdata.exists() {
                    let _ = watcher.watch(&appdata, RecursiveMode::NonRecursive);
                    println!("[Watcher] Watching ~/AppData/Roaming");
                }
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

    // 1. New App Detection
    let is_app_install_dir = if cfg!(target_os = "macos") {
        path_str.starts_with("/Applications") && ext == "app"
    } else if cfg!(target_os = "windows") {
        (path_str.starts_with("C:\\Program Files") || path_str.starts_with("C:\\Program Files (x86)"))
            && (ext == "exe" || path_buf.is_dir()) // On Windows, new folders in Program Files are also installs
    } else {
        false
    };

    if is_app_install_dir {
        println!("[Watcher] New app detected: {}", name);

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
    else if path_str.to_lowercase().contains("downloads") {
        let is_suspicious = SUSPICIOUS_EXT.contains(&ext.as_str());
        println!("[Watcher] New download: {} (suspicious: {})", name, is_suspicious);

        let mut ctx = ContextStore::load();
        let event_type = if is_suspicious { "suspicious_download" } else { "file_downloaded" }.to_string();
        ctx.record_system_event(SystemEvent {
            timestamp: chrono::Local::now().to_rfc3339(),
            event_type: event_type.clone(),
            description: format!("New file in Downloads: {} ({})", name, if is_suspicious { "⚠️ suspicious type" } else { "normal" }),
            path: path_str.clone(),
        });

        let _ = app_handle.emit("system-event", AppInstallPayload {
            name,
            path: path_str,
            event_type,
        });
    }
}
