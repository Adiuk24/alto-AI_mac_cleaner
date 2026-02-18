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
    let system_critical_prefixes = [
        "/system", "/usr", "/bin", "/sbin", "/private/var/db",
        "/library/apple", "/library/coreservices",
    ];
    for prefix in &system_critical_prefixes {
        if path_lower.starts_with(prefix) {
            return IndexedFile {
                path: path.to_string(),
                size_bytes: get_size(p),
                category: FileCategory::SystemCritical,
                app_owner: None,
                is_safe_to_delete: false,
                reason: format!("System critical path: protected by macOS."),
            };
        }
    }

    // --- BLOCKED: User Data ---
    let user_data_patterns = [
        "/documents/", "/desktop/", "/downloads/", "/pictures/",
        "/movies/", "/music/", "/dropbox/", "/icloud drive/",
    ];
    for pattern in &user_data_patterns {
        if path_lower.contains(pattern) {
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

    // --- SAFE: Caches ---
    if path_lower.contains("/library/caches/") || path_lower.contains("/caches/") {
        let app_owner = extract_app_owner(&path_lower, "/library/caches/");
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
    if path_lower.contains("/library/logs/") || path_lower.ends_with(".log") {
        let app_owner = extract_app_owner(&path_lower, "/library/logs/");
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
    if path_lower.starts_with("/tmp/") || path_lower.contains("/var/folders/") {
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
    if path_lower.contains("/library/application support/") {
        let app_owner = extract_app_owner(&path_lower, "/library/application support/");
        return IndexedFile {
            path: path.to_string(),
            size_bytes: get_size(p),
            category: FileCategory::AppSupport,
            app_owner: app_owner.clone(),
            is_safe_to_delete: false,
            reason: format!("App support data{}. Deleting may break the app.", app_owner.map(|a| format!(" for {}", a)).unwrap_or_default()),
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

fn extract_app_owner(path: &str, after: &str) -> Option<String> {
    if let Some(idx) = path.find(after) {
        let rest = &path[idx + after.len()..];
        let component = rest.split('/').next()?;
        if !component.is_empty() {
            return Some(component.to_string());
        }
    }
    None
}
