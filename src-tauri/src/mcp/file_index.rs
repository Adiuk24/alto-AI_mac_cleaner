use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileCategory {
    Cache,
    Log,
    Temp,
    UserData,
    SystemCritical,
    AppSupport,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFile {
    pub path: String,
    pub size_bytes: u64,
    pub category: FileCategory,
    pub app_owner: Option<String>,
    pub is_safe_to_delete: bool,
    pub reason: String,
}

/// Categorizes a file path and determines if it is safe to delete.
pub fn index_file(path: &str) -> IndexedFile {
    let p = Path::new(path);
    let path_lower = path.to_lowercase();

    // --- BLOCKED: System Critical ---
    #[cfg(target_os = "macos")]
    let system_critical_prefixes = [
        "/system", "/usr", "/bin", "/sbin", "/private/var/db",
        "/library/apple", "/library/coreservices",
    ];
    #[cfg(target_os = "windows")]
    let system_critical_prefixes = [
        "c:\\windows", "c:\\boot", "c:\\recovery", "c:\\system volume information",
        "c:\\program files\\common files",
    ];

    for prefix in &system_critical_prefixes {
        if path_lower.starts_with(prefix) {
            return IndexedFile {
                path: path.to_string(),
                size_bytes: get_size(p),
                category: FileCategory::SystemCritical,
                app_owner: None,
                is_safe_to_delete: false,
                reason: format!("System critical path: protected by the operating system."),
            };
        }
    }

    // --- BLOCKED: User Data ---
    let user_data_patterns = [
        "documents", "desktop", "downloads", "pictures",
        "movies", "music", "dropbox", "icloud", "onedrive", "google drive"
    ];
    for pattern in &user_data_patterns {
        if path_lower.contains(pattern) {
            // Check if it's actually in a safe place (like a Cache folder inside a user dir)
            if !path_lower.contains("cache") && !path_lower.contains("temp") {
                return IndexedFile {
                    path: path.to_string(),
                    size_bytes: get_size(p),
                    category: FileCategory::UserData,
                    app_owner: None,
                    is_safe_to_delete: false,
                    reason: "User data directory — Alto will never touch this.".to_string(),
                };
            }
        }
    }

    // --- SAFE: Caches ---
    if path_lower.contains("cache") || path_lower.contains("localstorage") {
        let app_owner = extract_app_owner(&path_lower);
        return IndexedFile {
            path: path.to_string(),
            size_bytes: get_size(p),
            category: FileCategory::Cache,
            app_owner: app_owner.clone(),
            is_safe_to_delete: true,
            reason: format!("Application cache{}. Safe to clear.", app_owner.map(|a| format!(" from {}", a)).unwrap_or_default()),
        };
    }

    // --- SAFE: Logs ---
    if path_lower.contains("logs") || path_lower.ends_with(".log") {
        let app_owner = extract_app_owner(&path_lower);
        return IndexedFile {
            path: path.to_string(),
            size_bytes: get_size(p),
            category: FileCategory::Log,
            app_owner: app_owner.clone(),
            is_safe_to_delete: true,
            reason: format!("Log file{}. Safe to delete.", app_owner.map(|a| format!(" from {}", a)).unwrap_or_default()),
        };
    }

    // --- SAFE: Temp ---
    #[cfg(target_os = "macos")]
    let is_temp = path_lower.starts_with("/tmp/") || path_lower.contains("/var/folders/");
    #[cfg(target_os = "windows")]
    let is_temp = path_lower.contains("\\temp\\") || path_lower.contains("\\tmp\\") || path_lower.contains("\\appdata\\local\\temp");

    if is_temp {
        return IndexedFile {
            path: path.to_string(),
            size_bytes: get_size(p),
            category: FileCategory::Temp,
            app_owner: None,
            is_safe_to_delete: true,
            reason: "Temporary file. Safe to delete.".to_string(),
        };
    }

    // --- CAUTION: App Support ---
    let app_support_pattern = if cfg!(target_os = "macos") { "application support" } else { "appdata" };
    if path_lower.contains(app_support_pattern) {
        let app_owner = extract_app_owner(&path_lower);
        return IndexedFile {
            path: path.to_string(),
            size_bytes: get_size(p),
            category: FileCategory::AppSupport,
            app_owner: app_owner.clone(),
            is_safe_to_delete: false,
            reason: format!("App data{}. Deleting may break the app.", app_owner.map(|a| format!(" for {}", a)).unwrap_or_default()),
        };
    }

    // --- Unknown ---
    IndexedFile {
        path: path.to_string(),
        size_bytes: get_size(p),
        category: FileCategory::Unknown,
        app_owner: None,
        is_safe_to_delete: false,
        reason: "Unknown file type. Manual review recommended.".to_string(),
    }
}

/// Index a list of file paths.
pub fn index_files(paths: &[String]) -> Vec<IndexedFile> {
    paths.iter().map(|p| index_file(p)).collect()
}

fn get_size(p: &Path) -> u64 {
    std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)
}

fn extract_app_owner(path: &str) -> Option<String> {
    // Platform-aware path separator
    let sep = if path.contains('\\') { '\\' } else { '/' };
    
    let patterns = [
        "application support", "caches", "logs", "appdata\\local", "appdata\\roaming"
    ];

    for pattern in &patterns {
        if let Some(idx) = path.find(pattern) {
            let rest = &path[idx + pattern.len()..];
            let component = rest.trim_start_matches(sep).split(sep).next()?;
            if !component.is_empty() && component.len() > 3 {
                return Some(component.to_string());
            }
        }
    }
    None
}
