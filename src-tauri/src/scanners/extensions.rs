use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use dirs::home_dir;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[derive(Serialize, Debug)]
pub struct ExtensionItem {
    pub path: String,
    pub name: String,
    pub kind: String, // "Launch Agent", "Launch Daemon", "Browser Extension"
    pub enabled: bool,
}



#[cfg(target_os = "macos")]
pub fn scan_extensions() -> Vec<ExtensionItem> {
    let mut items = Vec::new();
    let home = home_dir().unwrap_or_else(|| PathBuf::from("/"));

    // 1. Launch Agents (User)
    let user_agents = home.join("Library/LaunchAgents");
    scan_dir(user_agents, "Launch Agent", &mut items);

    // 2. Launch Agents (System) - readable?
    scan_dir(PathBuf::from("/Library/LaunchAgents"), "System Launch Agent", &mut items);

    // 3. Launch Daemons (System)
    scan_dir(PathBuf::from("/Library/LaunchDaemons"), "System Launch Daemon", &mut items);
    
    // Note: Browser extensions are hidden in randomized profiles and require complex parsing of JSON manifests
    // For MVP transparency, we stick to Startup Items (Launch Agents) which are the "Extensions" that slow down boot.

    items
}

#[cfg(target_os = "windows")]
pub fn scan_extensions() -> Vec<ExtensionItem> {
    let mut items = Vec::new();

    // 1. Registry Run Keys (HKCU)
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(run) = hkcu.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run") {
        for (name, value) in run.enum_values().map(|x| x.unwrap_or_default()) {
             items.push(ExtensionItem {
                 path: value.to_string(), // The command
                 name,
                 kind: "Registry Startup".to_string(), 
                 enabled: true,
             });
        }
    }

    // 2. Startup Folder (User)
    // %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
    if let Some(home) = home_dir() {
        let startup = home.join("AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup");
        if startup.exists() {
             for entry in WalkDir::new(&startup).max_depth(1).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() { // .lnk, .bat, .exe
                     let name = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                     items.push(ExtensionItem {
                         path: path.to_string_lossy().to_string(),
                         name,
                         kind: "Startup Folder".to_string(),
                         enabled: true, 
                     });
                }
            }
        }
    }

    items
}

#[cfg(target_os = "macos")]
use crate::helper_client::{self, Command};
fn scan_dir(root: PathBuf, kind: &str, items: &mut Vec<ExtensionItem>) {
    if !root.exists() { return; }

    for entry in WalkDir::new(&root).max_depth(1).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("plist") {
             let name = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
             items.push(ExtensionItem {
                 path: path.to_string_lossy().to_string(),
                 name,
                 kind: kind.to_string(),
                 enabled: true, 
             });
        }
    }
}

#[cfg(target_os = "macos")]
pub async fn remove_extension(path_str: String) -> Result<(), String> {
    let path = Path::new(&path_str);
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    // Try normal delete first
    if std::fs::remove_file(path).is_ok() {
        return Ok(());
    }

    // If failed (permission error), try helper
    println!("Permission denied. Trying root helper...");
    
    // Ensure helper is there
    if !helper_client::ensure_helper_installed().await {
        return Err("Failed to install execution helper".to_string());
    }

    let cmd = Command::DeletePath { path: path_str };
    let res = helper_client::send_command(cmd).await
        .map_err(|e| format!("Helper communication failed: {}", e))?;

    if res.success {
        Ok(())
    } else {
        Err(res.message)
    }
}

#[cfg(target_os = "windows")]
pub async fn remove_extension(name_or_path: String) -> Result<(), String> {
    // This is tricky because we mixed Registry names and File paths.
    // For now, we try to delete file if it looks like a path, else Registry value.
    
    let path = Path::new(&name_or_path);
    if path.exists() {
         // It's a file (Startup folder)
         std::fs::remove_file(path).map_err(|e| e.to_string())?;
         return Ok(());
    }

    // Assume Registry Key in HKCU Run
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run = hkcu.open_subkey_with_flags("Software\\Microsoft\\Windows\\CurrentVersion\\Run", KEY_WRITE)
        .map_err(|e| e.to_string())?;
    
    run.delete_value(&name_or_path).map_err(|e| e.to_string())?;

    Ok(())
}
