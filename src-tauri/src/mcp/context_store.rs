use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeletionRecord {
    pub timestamp: String,
    pub paths_deleted: Vec<String>,
    pub total_bytes_freed: u64,
}

/// Live system event recorded by the watcher (app installs, downloads, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemEvent {
    pub timestamp: String,
    pub event_type: String,   // "app_installed" | "file_downloaded" | "suspicious_download"
    pub description: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserPrefs {
    pub always_skip_patterns: Vec<String>,
    pub auto_confirm_caches: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ContextStore {
    pub last_scan_timestamp: Option<String>,
    pub deletion_history: Vec<DeletionRecord>,
    pub system_events: Vec<SystemEvent>,   // NEW: live events from watcher
    pub user_preferences: UserPrefs,
}

impl ContextStore {
    pub fn store_path() -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
        home.join(".alto").join("context.json")
    }

    pub fn load() -> Self {
        let path = Self::store_path();
        if let Ok(data) = std::fs::read_to_string(&path) {
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn save(&self) {
        let path = Self::store_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = std::fs::write(path, json);
        }
    }

    pub fn record_deletion(&mut self, paths: Vec<String>, bytes_freed: u64) {
        let now = chrono::Local::now().to_rfc3339();
        self.deletion_history.push(DeletionRecord {
            timestamp: now,
            paths_deleted: paths,
            total_bytes_freed: bytes_freed,
        });
        if self.deletion_history.len() > 100 {
            self.deletion_history.drain(0..self.deletion_history.len() - 100);
        }
        self.save();
    }

    /// Record a live system event from the watcher
    pub fn record_system_event(&mut self, event: SystemEvent) {
        self.system_events.push(event);
        // Keep last 200 events
        if self.system_events.len() > 200 {
            self.system_events.drain(0..self.system_events.len() - 200);
        }
        self.save();
    }

    pub fn clear(&mut self) {
        self.last_scan_timestamp = None;
        self.deletion_history.clear();
        self.system_events.clear();
        // we keep user_preferences
        self.save();
    }
}
