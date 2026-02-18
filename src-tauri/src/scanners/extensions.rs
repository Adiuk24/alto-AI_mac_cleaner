use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use dirs::home_dir;

#[derive(Serialize, Debug)]
pub struct ExtensionItem {
    pub path: String,
    pub name: String,
    pub kind: String, // "Launch Agent", "Launch Daemon", "Browser Extension"
    pub enabled: bool,
}

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
