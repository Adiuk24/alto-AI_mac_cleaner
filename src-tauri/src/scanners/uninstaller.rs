use serde::Serialize;
#[cfg(target_os = "macos")]
use std::path::{Path, PathBuf};
#[cfg(target_os = "macos")]
use crate::helper_client::{self, Command};
#[cfg(target_os = "macos")]
use walkdir::WalkDir;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[derive(Serialize, Clone, Debug)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
    pub bundle_id: Option<String>,
    pub icon_path: Option<String>,
    pub size_bytes: u64,
    pub last_used: Option<u64>,
}

#[cfg(target_os = "macos")]
pub fn scan_apps() -> Vec<AppInfo> {
    let mut apps = Vec::new();
    let dirs_to_scan = vec![
        "/Applications",
        // dirs::home_dir().map(|h| h.join("Applications")).unwrap().to_str().unwrap()
    ];

    for dir in dirs_to_scan {
        if !Path::new(dir).exists() { continue; }
        
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("app") {
                    if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                         let size_bytes = WalkDir::new(&path)
                            .into_iter()
                            .filter_map(|e| e.ok())
                            .filter_map(|e| e.metadata().ok())
                            .map(|m| m.len())
                            .sum();

                        let bundle_id = get_bundle_id(&path);

                        apps.push(AppInfo {
                            name: name.to_string(),
                            path: path.to_string_lossy().to_string(),
                            bundle_id,
                            icon_path: None,
                            size_bytes,
                            last_used: None,
                        });
                    }
                }
            }
        }
    }
    apps
}

#[cfg(target_os = "windows")]
pub fn scan_apps() -> Vec<AppInfo> {
    let mut apps = Vec::new();
    
    // Scan both HKLM and HKCU
    let roots = vec![HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER];
    let subkey = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall";

    for root in roots {
        let hklm = RegKey::predef(root);
        if let Ok(uninstall) = hklm.open_subkey_with_flags(subkey, KEY_READ) {
            for name in uninstall.enum_keys().map(|x| x.unwrap_or_default()) {
                if let Ok(app_key) = uninstall.open_subkey(&name) {
                    let display_name: String = app_key.get_value("DisplayName").unwrap_or_default();
                    if display_name.is_empty() { continue; }

                    let uninstall_string: String = app_key.get_value("UninstallString").unwrap_or_default();
                    let install_location: String = app_key.get_value("InstallLocation").unwrap_or_default();
                    let display_icon: String = app_key.get_value("DisplayIcon").unwrap_or_default();

                    apps.push(AppInfo {
                        name: display_name,
                        path: uninstall_string, // Use uninstall string as "path" for action
                        bundle_id: Some(name), // Use Registry Key Name as ID
                        icon_path: if display_icon.is_empty() { None } else { Some(display_icon) },
                        size_bytes: 0, // Hard to get accurate size from registry
                        last_used: None,
                    });
                }
            }
        }
    }

    apps
}

#[cfg(target_os = "macos")]
fn get_bundle_id(app_path: &Path) -> Option<String> {
    let plist_path = app_path.join("Contents/Info.plist");
    let file = std::fs::File::open(plist_path).ok()?;
    let value: serde_json::Value = plist::from_reader(file).ok()?;
    
    value.get("CFBundleIdentifier")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(target_os = "macos")]
fn scan_leftovers(bundle_id: &str) -> Vec<PathBuf> {
    let mut leftovers = Vec::new();
    let home = dirs::home_dir().unwrap();
    let library = home.join("Library");

    let search_paths = vec![
        library.join("Application Support"),
        library.join("Caches"),
        library.join("Preferences"),
        library.join("Logs"),
        library.join("Saved Application State"),
    ];

    for base in search_paths {
        if let Ok(entries) = std::fs::read_dir(&base) {
            for entry in entries.flatten() {
                let path = entry.path();
                // Simple check: does filename contain bundle_id?
                // E.g. com.google.Chrome -> ~/Library/Caches/com.google.Chrome
                if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                    if name.contains(bundle_id) {
                        leftovers.push(path);
                    }
                }
            }
        }
    }

    leftovers
}

#[cfg(target_os = "macos")]
pub async fn uninstall_app(path: &str) -> Result<(), String> {
    let app_path = Path::new(path);
    
    // 1. Identify Leftovers BEFORE deleting the app (we need the Info.plist)
    let bundle_id = get_bundle_id(app_path);
    let leftovers = if let Some(bid) = &bundle_id {
        scan_leftovers(bid)
    } else {
        Vec::new()
    };

    println!("Uninstalling {}. Found {} leftovers.", path, leftovers.len());

    // 2. Try Standard Trash (User Mode)
    if trash::delete(path).is_err() {
        println!("Trash failed. Trying Helper (Root Mode)...");
        // 3. Upgrade to Protector Mode: Use Helper
        
        let cmd = Command::UninstallApp { bundle_path: path.to_string() };
        let res = helper_client::send_command(cmd).await
            .map_err(|e| format!("Helper failed: {}", e))?;
            
        if !res.success {
            return Err(format!("Uninstallation failed: {}", res.message));
        }
    }

    // 4. Delete Leftovers
    for leftover in leftovers {
        let l_path = leftover.to_string_lossy().to_string();
        if trash::delete(&leftover).is_err() {
             // If user can't delete leftover, ask helper
             let cmd = Command::DeletePath { path: l_path };
             let _ = helper_client::send_command(cmd).await;
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub async fn uninstall_app(path: &str) -> Result<(), String> {
    // Path here is the UninstallString from registry
    // e.g. "MsiExec.exe /I{...}" or "C:\Program Files\...\uninstall.exe"
    
    // Split command and args loosely
    // This is naive; Windows command parsing is complex.
    // Ideally we shell execute it.
    
    use std::process::Command;
    
    println!("Executing uninstall string: {}", path);

    // We use cmd /C to handle potential shell built-ins or complex strings
    let status = Command::new("cmd")
        .args(["/C", path])
        .status()
        .map_err(|e| e.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Uninstall exited with code: {:?}", status.code()))
    }
}
