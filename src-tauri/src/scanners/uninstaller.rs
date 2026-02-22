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
    /// "appstore" | "setapp" | "steam" | "blizzard" | "other"
    pub store: Option<String>,
    /// Vendor/organization derived from bundle id or plist
    pub vendor: Option<String>,
}

/// Leftovers grouped by resource type for per-app breakdown (CMM-style).
#[derive(Serialize, Clone, Debug, Default)]
pub struct LeftoverGroups {
    pub logs: Vec<String>,
    pub preferences: Vec<String>,
    pub caches: Vec<String>,
    pub crashes: Vec<String>,
    pub plugins: Vec<String>,
    pub other: Vec<String>,
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
                        let store = get_store(&path, &bundle_id, name);
                        let vendor = get_vendor(&bundle_id);

                        apps.push(AppInfo {
                            name: name.to_string(),
                            path: path.to_string_lossy().to_string(),
                            bundle_id: bundle_id.clone(),
                            icon_path: None,
                            size_bytes,
                            last_used: None,
                            store,
                            vendor,
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
                    let display_icon: String = app_key.get_value("DisplayIcon").unwrap_or_default();
                    let publisher: Option<String> = app_key.get_value("Publisher").ok();

                    apps.push(AppInfo {
                        name: display_name,
                        path: uninstall_string,
                        bundle_id: Some(name),
                        icon_path: if display_icon.is_empty() { None } else { Some(display_icon) },
                        size_bytes: 0,
                        last_used: None,
                        store: Some("other".to_string()),
                        vendor: publisher,
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
fn get_store(app_path: &Path, bundle_id: &Option<String>, name: &str) -> Option<String> {
    let bid = bundle_id.as_deref().unwrap_or("");
    let name_lower = name.to_lowercase();
    if app_path.join("Contents/_MASReceipt/receipt").exists() {
        return Some("appstore".to_string());
    }
    if bid.contains("setapp") || name_lower.contains("setapp") {
        return Some("setapp".to_string());
    }
    if bid.contains("steam") || name_lower.contains("steam") {
        return Some("steam".to_string());
    }
    if bid.contains("blizzard") || name_lower.contains("blizzard") || name_lower.contains("battle.net") {
        return Some("blizzard".to_string());
    }
    Some("other".to_string())
}

#[cfg(target_os = "macos")]
fn get_vendor(bundle_id: &Option<String>) -> Option<String> {
    let bid = bundle_id.as_deref()?;
    let parts: Vec<&str> = bid.split('.').collect();
    if parts.len() >= 2 {
        let v = parts[1];
        if !v.is_empty() {
            let mut c = v.chars();
            let capitalized = c.next().map(|c| c.to_uppercase().collect::<String>()).unwrap_or_default() + c.as_str();
            return Some(capitalized);
        }
    }
    Some("Other".to_string())
}

#[cfg(target_os = "macos")]
fn categorize_leftover(path: &Path) -> &'static str {
    let path_str = path.to_string_lossy();
    if path_str.contains("Logs") || path_str.contains("DiagnosticReports") {
        "logs"
    } else if path_str.contains("Preferences") {
        "preferences"
    } else if path_str.contains("Caches") || path_str.contains("Cache") {
        "caches"
    } else if path_str.contains("Crash") || path_str.contains("Crashes") {
        "crashes"
    } else if path_str.contains("PlugIns") || path_str.contains("Plugins") {
        "plugins"
    } else {
        "other"
    }
}

#[cfg(target_os = "macos")]
pub fn scan_leftovers(bundle_id: &str) -> LeftoverGroups {
    let mut groups = LeftoverGroups::default();
    let home = dirs::home_dir().unwrap();
    let library = home.join("Library");
    let mut raw: Vec<PathBuf> = Vec::new();

    let search_paths = vec![
        library.join("Application Support"),
        library.join("Caches"),
        library.join("Preferences"),
        library.join("Logs"),
        library.join("Saved Application State"),
        library.join("Containers"),
    ];

    for base in &search_paths {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                    if name.to_lowercase().contains(&bundle_id.to_lowercase()) {
                        raw.push(path);
                    }
                }
            }
        }
    }

    const RULES_JSON: &str = include_str!("../data/app_rules.json");
    if let Ok(rules) = serde_json::from_str::<serde_json::Value>(RULES_JSON) {
        if let Some(app_rule) = rules.get(bundle_id) {
            if let Some(paths) = app_rule.get("paths").and_then(|p| p.as_array()) {
                for rule_path_val in paths {
                    if let Some(rule_path_str) = rule_path_val.as_str() {
                        let expanded = if rule_path_str.starts_with("~") {
                            rule_path_str.replace("~", &home.to_string_lossy())
                        } else {
                            rule_path_str.to_string()
                        };
                        let path = PathBuf::from(expanded);
                        if path.exists() && !raw.iter().any(|p| p == &path) {
                            raw.push(path);
                        }
                    }
                }
            }
        }
    }

    for path in raw {
        let s = path.to_string_lossy().to_string();
        match categorize_leftover(&path) {
            "logs" => groups.logs.push(s),
            "preferences" => groups.preferences.push(s),
            "caches" => groups.caches.push(s),
            "crashes" => groups.crashes.push(s),
            "plugins" => groups.plugins.push(s),
            _ => groups.other.push(s),
        }
    }

    groups
}

#[cfg(target_os = "macos")]
pub async fn uninstall_app(path: &str) -> Result<(), String> {
    let app_path = Path::new(path);
    
    let bundle_id = get_bundle_id(app_path);
    let groups = if let Some(bid) = &bundle_id {
        scan_leftovers(bid)
    } else {
        LeftoverGroups::default()
    };
    let all_leftovers: Vec<String> = groups.logs.iter().chain(groups.preferences.iter())
        .chain(groups.caches.iter()).chain(groups.crashes.iter())
        .chain(groups.plugins.iter()).chain(groups.other.iter())
        .cloned()
        .collect();
    let n = all_leftovers.len();
    println!("Uninstalling {}. Found {} leftovers.", path, n);

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

    for l_path in &all_leftovers {
        if trash::delete(l_path).is_err() {
            let cmd = Command::DeletePath { path: l_path.clone() };
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
